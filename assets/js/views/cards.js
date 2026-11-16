/* views/cards.js — Study: first contact with each word.
   Front: the English word (highlighted), IPA and sound.
   Back:  the Arabic meaning, the definition and the example.
   The learner decides "Still learning" or "I know it"; both feed the
   recall schedule through VS.store.grade(). Cards marked "still
   learning" come back once more at the end of the round. */
(function () {
  "use strict";
  const { html, icon } = VS;
  
  let s = null;   // session: { scope, queue, index, flipped, known, learning, again }

  /** Arabic-first front (Settings → Study cards show first). */
  function arabicFront(w) {
    return html`
      <div class="flash-face flash-front" aria-hidden="${s.flipped}">
        <div class="row flash-badges">${VS.ui.levelBadge(w)}<span class="badge">${w.type}</span></div>
        <p class="flash-ar" lang="ar">${w.arabic}</p>
        ${w.definition ? html`<p class="flash-def">${w.definition}</p>` : ""}
        <p class="flash-tip">${icon("flip", "icon-sm")} Say the English word, then tap to check</p>
      </div>
      <div class="flash-face flash-back" aria-hidden="${!s.flipped}">
        <p class="flash-word"><span class="mark">${w.word}</span></p>
        ${w.sense ? html`<p class="flash-sense">${w.sense}</p>` : ""}
        <div class="row flash-sound">${VS.ui.speakButton(w.word)}<span class="ipa">${w.ipa}</span></div>
        ${VS.ui.soundTraps(w, "flash-traps")}
        <div class="flash-example"><p>“${VS.ui.example(w)}”</p>${VS.ui.speakButton(w.example, "Hear the example")}</div>
      </div>`;
  }

  function card(w) {
    if (VS.store.settings().cardFront === "ar") {
      return html`<div class="flash ${s.flipped ? "is-flipped" : ""}" data-action="flip" role="button" tabindex="0"
        aria-label="${s.flipped ? "Card back" : "Card front. Press space to see the word"}">${arabicFront(w)}</div>`;
    }
    return html`
      <div class="flash ${s.flipped ? "is-flipped" : ""}" data-action="flip" role="button" tabindex="0"
           aria-label="${s.flipped ? "Card back" : "Card front. Press space to see the meaning"}">
        <div class="flash-face flash-front" aria-hidden="${s.flipped}">
          <div class="row flash-badges">${VS.ui.levelBadge(w)}<span class="badge">${w.type}</span></div>
          <p class="flash-word"><span class="mark">${w.word}</span></p>
          ${w.sense ? html`<p class="flash-sense">${w.sense}</p>` : ""}
          <div class="row flash-sound">${VS.ui.speakButton(w.word)}<span class="ipa">${w.ipa}</span></div>
          ${VS.ui.soundTraps(w, "flash-traps")}
          <p class="flash-tip">${icon("flip", "icon-sm")} Tap to see the meaning · swipe to answer</p>
        </div>
        <div class="flash-face flash-back" aria-hidden="${!s.flipped}">
          <p class="flash-ar" lang="ar">${w.arabic}</p>
          <p class="flash-def">${w.definition}</p>
          <div class="flash-example">
            <p>“${VS.ui.example(w)}”</p>
            ${VS.ui.speakButton(w.example, "Hear the example")}
          </div>
          <p class="flash-word-small">${VS.ui.headword(w)} <span class="ipa">${w.ipa}</span></p>
        </div>
      </div>`;
  }

  /* Swipe on touch screens: right = "I know it", left = "Still learning".
     A short drag that is not far enough springs back; a tap still flips. */
  function swipe(card) {
    let x0 = null, dx = 0;
    card.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" || e.target.closest("[data-action='speak']")) return;
      x0 = e.clientX; dx = 0;
    });
    card.addEventListener("pointermove", (e) => {
      if (x0 === null) return;
      dx = e.clientX - x0;
      if (Math.abs(dx) < 8) return;
      card.classList.add("is-dragging");
      card.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`;
      card.dataset.lean = dx > 60 ? "good" : dx < -60 ? "again" : "";
    });
    const end = () => {
      if (x0 === null) return;
      x0 = null;
      card.classList.remove("is-dragging");
      card.dataset.lean = "";
      if (Math.abs(dx) > 90) {
        s.suppressFlip = true;
        VS.views.cards.actions.grade({ dataset: { grade: dx > 0 ? "good" : "again" } });
      } else {
        card.style.transform = "";
      }
    };
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
  }

  function finish() {
    const next = VS.finishStep(s.scope, "cards");
    const total = s.known.size + s.learning.size;
    const learning = [...s.learning].map((id) => VS.byId[id]);
    return VS.ui.summary({
      title: "Round complete",
      message: learning.length
        ? "Good work. The words you're still learning will come back tomorrow for recall."
        : "You knew every word in this round.",
      stats: [
        { value: total, label: "cards" },
        { value: s.known.size, label: "I know it", tone: "good" },
        { value: s.learning.size, label: "still learning", tone: "mark" },
      ],
      words: learning,
      actions: [
        next ? Object.assign({ primary: true }, next) : { href: s.scope.back, label: "Done", primary: true },
        // After learning new words, offer another round only while today's allowance has words left.
        s.scope.kind === "new"
          ? (VS.newLeftToday() > 0 && VS.store.newWords().length ? { action: "restart", label: "Learn more words" } : null)
          : { action: "restart", label: "Another round" },
      ],
    });
  }

  VS.views.cards = {
    title: () => "Study",
    crumbs: (p) => VS.ui.crumbs(p, "Study"),

    start(p) {
      const scope = VS.scope(p);
      // "Learn new words" meets every word in today's batch; other lists
      // take a round (Settings → Round size), weakest words first.
      const queue = !scope ? [] : scope.kind === "new" ? scope.words.slice() : VS.sessionWords(scope.words, VS.roundSize());
      s = { scope, queue, index: 0, flipped: false,
            known: new Set(), learning: new Set(), again: new Set() };
    },

    render(p) {
      if (!s.scope || !s.queue.length) {
        if (s.scope && s.scope.kind === "new") {
          return VS.store.newWords().length
            ? VS.ui.emptyActivity("#/", "You've finished today's new words. The rest are waiting for tomorrow.", "Back to today")
            : VS.ui.emptyActivity("#/add", "You've started every word in your library. Add more words to keep learning.", "Add words");
        }
        return VS.ui.emptyActivity("#/", "There are no words in this list.");
      }
      if (s.index >= s.queue.length) return html`<div class="activity">${finish()}</div>`;
      const w = s.queue[s.index];
      return html`
        <div class="activity">
          ${VS.ui.activityHead({ back: s.scope.back, title: "Study · " + s.scope.title, index: s.index, total: s.queue.length })}
          ${card(w)}
          <div class="action-bar">
            <button class="btn btn-lg btn-bad" type="button" data-action="grade" data-grade="again">
              ${icon("arrow-left", "icon-sm")} Still learning <kbd>1</kbd></button>
            <button class="btn btn-lg btn-good" type="button" data-action="grade" data-grade="good">
              I know it ${icon("arrow-right", "icon-sm")} <kbd>2</kbd></button>
          </div>
        </div>`;
    },

    mount() {
      const w = s && s.queue[s.index];
      if (!w || s.index >= s.queue.length) return;
      if (!s.flipped && VS.store.settings().cardFront !== "ar") VS.speech.auto(w.word);
      const card = VS.$(".flash");
      card.classList.add("enter");
      swipe(card);
    },

    actions: {
      flip(el, e) {
        if (e && e.target.closest("[data-action='speak']")) return;
        if (s.suppressFlip) { s.suppressFlip = false; return; }   // the swipe already answered
        s.flipped = !s.flipped;
        VS.sfx.play("flip");
        if (s.flipped && VS.store.settings().cardFront === "ar") VS.speech.auto(s.queue[s.index].word);
        VS.$(".flash").classList.toggle("is-flipped", s.flipped);
        VS.$$(".flash-face").forEach((f) => f.setAttribute("aria-hidden", f.classList.contains("flash-back") ? !s.flipped : s.flipped));
      },
      grade(el) {
        if (s.busy) return;
        const w = s.queue[s.index];
        const grade = el.dataset.grade;
        // Grade the schedule once per round; a card shown again only moves the round on.
        if (!s.again.has(w.id)) VS.store.grade(w.id, grade);
        if (grade === "again") {
          s.learning.add(w.id); s.known.delete(w.id);
          if (!s.again.has(w.id)) { s.again.add(w.id); s.queue.push(w); }
        } else if (!s.learning.has(w.id)) {
          s.known.add(w.id);
        }
        VS.sfx.play(grade === "again" ? "flip" : "pop");
        // Let the card fly out toward the answer, then show the next one.
        s.busy = true;
        const card = VS.$(".flash");
        if (card) { card.removeAttribute("style"); card.classList.add(grade === "again" ? "leave-again" : "leave-good"); }
        setTimeout(() => { s.index++; s.flipped = false; s.busy = false; VS.app.render(); }, card ? 220 : 0);
      },
      restart() { VS.views.cards.start(VS.app.params()); VS.app.render(); },
    },

    keys(e) {
      if (!s || s.index >= s.queue.length) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); this.actions.flip(); }
      else if (e.key === "1" || e.key === "ArrowLeft") this.actions.grade({ dataset: { grade: "again" } });
      else if (e.key === "2" || e.key === "ArrowRight") this.actions.grade({ dataset: { grade: "good" } });
    },
  };
})();
