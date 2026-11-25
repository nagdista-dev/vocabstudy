/* views/cards.js — Study: first contact with each word.
   Front: the English word (highlighted), IPA and sound.
   Back:  the Arabic meaning, the definition and the example.
   The learner decides "Still learning" or "I know it"; both feed the
   recall schedule through VS.store.grade(). Cards marked "still
   learning" come back once more at the end of the round.

   New words are taught before they are tested. "Learn new words" runs in
   two steps: Meet — each word open on one card (meaning, Arabic, example,
   sound), one "Next", nothing graded: you can't remember what you have
   never seen. Then Check — the same words as flip cards, and
   that answer feeds the schedule. "I already know this word" during Meet
   skips its check. The counter counts words, not cards: a word shown
   again says "Once more" instead of growing the total (6 → 9). */
(function () {
  "use strict";
  const { html, icon } = VS;
  
  let s = null;   // session: { scope, queue, index, flipped, known, learning, again }

  /* Every face on the study card shares three bands: a quiet meta row, the
     reading body, and one line at the foot that says what to do next. The
     bands are what make the card a page instead of floating pieces. */
  function meta(w) {
    return html`<div class="row flash-badges">${VS.ui.levelBadge(w)}${w.type ? html`<span class="badge">${w.type}</span>` : ""}${VS.ui.freq(w)}</div>`;
  }

  /** The speaker and the IPA as one pill, so pronunciation reads as a unit. */
  function sound(w) {
    return html`<div class="flash-sound ${w.ipa ? "" : "is-bare"}">${VS.ui.speakButton(w.word)}${w.ipa ? VS.ui.ipa(w) : ""}</div>`;
  }

  /** Everything under the headword, in ONE column of one width with one left
      edge: where you met it (or the example), then "Goes with" and "Similar"
      as label | chips rows. The headword above stays centred; this column is
      the entry's body, set apart by a hairline. */
  function extra(w) {
    const parts = [
      VS.ui.context(w, "flash-met"),
      w.example && !w.context ? html`<div class="flash-example">
        <p>“${VS.ui.exampleTap(w)}”</p>${VS.ui.speakButton(w.example, "Hear the example")}
      </div>` : "",
      VS.ui.goes(w, "flash-related"),
      VS.ui.similar(w, "flash-related"),
    ];
    if (!parts.some((x) => String(x).trim())) return "";
    return html`<div class="flash-extra">${parts}</div>`;
  }

  function foot(ico, text) {
    return html`<div class="flash-foot"><p class="flash-tip">${icon(ico, "icon-sm")}<span>${text}</span></p></div>`;
  }

  /** Arabic-first front (Settings → Study cards show first). */
  function arabicFront(w) {
    return html`
      <div class="flash-face flash-front" aria-hidden="${s.flipped}">
        <div class="flash-top">${meta(w)}</div>
        <div class="flash-main">
          <p class="flash-ar" lang="ar">${w.arabic}</p>
          ${w.definition ? html`<p class="flash-def">${VS.ui.defTap(w, { tab: false })}</p>` : ""}
        </div>
        ${foot("flip", "Say it in English, then tap to check")}
      </div>
      <div class="flash-face flash-back" aria-hidden="${!s.flipped}">
        <div class="flash-top">${meta(w)}</div>
        <div class="flash-main">
          <div class="flash-answer">
            <p class="flash-word"><span class="mark">${VS.cap(w.word)}</span></p>
            ${w.sense ? html`<p class="flash-sense">${w.sense}</p>` : ""}
            ${sound(w)}
          </div>
          ${extra(w)}
        </div>
        ${foot("text", "Say it once in a sentence")}
      </div>`;
  }

  /** Meet: the whole word on one open card — nothing hidden, nothing asked. */
  function teachCard(w) {
    return html`
      <div class="flash flash-teach">
        <div class="flash-face flash-open">
          <div class="flash-top">${meta(w)}</div>
          <div class="flash-main">
            <div class="flash-headrow">
              <div class="flash-answer">
                <p class="flash-word"><span class="mark">${VS.cap(w.word)}</span></p>
                ${w.sense ? html`<p class="flash-sense">${w.sense}</p>` : ""}
                ${sound(w)}
              </div>
              ${w.arabic ? html`<p class="flash-ar" lang="ar" dir="rtl">${w.arabic}</p>` : ""}
            </div>
            ${w.definition ? html`<p class="flash-def">${VS.ui.defTap(w, { tab: false })}</p>` : ""}
            ${!w.trusted && !w.confirmed && w.arabic && VS.autofill.enabled() ? html`
              <div class="meaning-ask">
                <p class="meaning-ask-q">${w.context ? "Is this the meaning you met?" : "Is this the meaning you need?"}</p>
                <div class="row meaning-ask-actions">
                  <button class="btn btn-tonal" type="button" data-action="meaning-yes" data-id="${w.id}">${icon("check", "icon-sm")} Yes</button>
                  <button class="btn btn-quiet" type="button" data-action="meaning-list" data-id="${w.id}">Another meaning</button>
                </div>
                <div class="meanings" aria-live="polite"></div>
              </div>` : ""}
            ${extra(w)}
          </div>
          ${w.example
            ? foot("translate", "Tap a dotted word to translate or keep it")
            : foot("volume", "Read it, listen, say it once")}
        </div>
      </div>`;
  }

  function card(w) {
    // After Meet, the check always starts from the Arabic: recall the English, don't recognise it.
    if (VS.store.settings().cardFront === "ar" || s.met.length) {
      return html`<div class="flash ${s.flipped ? "is-flipped" : ""}" data-action="flip" role="button" tabindex="0"
        aria-label="${s.flipped ? "Card back" : "Card front. Press space to see the word"}">${arabicFront(w)}</div>`;
    }
    return html`
      <div class="flash ${s.flipped ? "is-flipped" : ""}" data-action="flip" role="button" tabindex="0"
           aria-label="${s.flipped ? "Card back" : "Card front. Press space to see the meaning"}">
        <div class="flash-face flash-front" aria-hidden="${s.flipped}">
          <div class="flash-top">${meta(w)}</div>
          <div class="flash-main">
            <p class="flash-word"><span class="mark">${VS.cap(w.word)}</span></p>
            ${w.sense ? html`<p class="flash-sense">${w.sense}</p>` : ""}
            ${sound(w)}
          </div>
          ${foot("flip", "Tap to see the meaning")}
        </div>
        <div class="flash-face flash-back" aria-hidden="${!s.flipped}">
          <div class="flash-top">${meta(w)}</div>
          <div class="flash-main">
            <div class="flash-meaning">
              ${w.arabic ? html`<p class="flash-ar" lang="ar">${w.arabic}</p>` : ""}
              ${w.definition ? html`<p class="flash-def">${VS.ui.defTap(w, { tab: false })}</p>` : ""}
            </div>
            ${extra(w)}
          </div>
          ${foot("text", "Say it once in a sentence")}
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
        { value: total, label: total === 1 ? "word" : "words" },
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
    title: () => "Learn",
    crumbs: (p) => VS.ui.crumbs(p, "Learn"),

    start(p) {
      const scope = VS.scope(p);
      // "Learn new words" meets every word in today's batch; other lists
      // take a round (Settings → Round size), weakest words first.
      const queue = !scope ? [] : scope.kind === "new" ? scope.words.slice() : VS.sessionWords(scope.words, VS.roundSize());
      const meet = !!scope && scope.kind === "new" && queue.length > 0;
      s = { scope, queue: meet ? [] : queue, index: 0, flipped: false, base: queue.length,
            phase: meet ? "meet" : "check", met: meet ? queue : [], metIndex: 0,
            known: new Set(), learning: new Set(), again: new Set() };
    },

    render(p) {
      if (s.phase === "meet") {
        const w = s.met[s.metIndex];
        return html`
          <div class="activity">
            ${VS.ui.activityHead({ back: s.scope.back, title: "Meet the words", sub: "Step 1 of 2 · read, listen, say it", index: s.metIndex, total: s.met.length })}
            <div class="activity-stage stage-center">${teachCard(w)}</div>
            <div class="action-bar">
              <button class="btn btn-lg btn-quiet" type="button" data-action="meet-knew">I already know it</button>
              <button class="btn btn-lg btn-primary" type="button" data-action="meet-next" id="meetNext">
                ${s.metIndex + 1 < s.met.length ? "Next word" : "Now check yourself"} ${icon("arrow-right", "icon-sm")} <kbd>Enter</kbd></button>
            </div>
          </div>`;
      }
      // After Meet, every word may have been "already known": straight to the results.
      if (s.met.length && !s.queue.length) return html`<div class="activity">${finish()}</div>`;
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
          ${VS.ui.activityHead({ back: s.scope.back, title: s.met.length ? "Check yourself" : "Learn",
            sub: s.met.length ? "Step 2 of 2 · do you remember it?" : s.scope.title,
            index: s.index, total: s.base, again: Math.max(0, s.queue.length - Math.max(s.index, s.base)), undo: !!s.undo })}
          <div class="activity-stage stage-center">
            ${card(w)}
          </div>
          <!-- One clear step at a time: "Show" until the card is turned, then the two answers
               (faded, disabled answers read as broken). -->
          <div class="action-bar card-bar ${s.flipped ? "is-flipped" : ""}">
            <button class="btn btn-lg btn-primary card-show" type="button" data-action="flip">
              ${icon("flip", "icon-sm")} ${VS.store.settings().cardFront === "ar" || s.met.length ? "Show the English" : "Show the meaning"} <kbd>Space</kbd></button>
            <button class="btn btn-lg btn-bad card-grade" type="button" data-action="grade" data-grade="again">
              ${icon("arrow-left", "icon-sm")} Still learning <kbd>1</kbd></button>
            <button class="btn btn-lg btn-good card-grade" type="button" data-action="grade" data-grade="good">
              I know it ${icon("arrow-right", "icon-sm")} <kbd>2</kbd></button>
          </div>
        </div>`;
    },

    mount() {
      if (s && s.phase === "meet") {
        const w = s.met[s.metIndex];
        if (w) VS.speech.auto(w.word);
        const card = VS.$(".flash");
        if (card) card.classList.add("enter");
        return;
      }
      const w = s && s.queue[s.index];
      if (!w || s.index >= s.queue.length) return;
      if (!s.flipped && VS.store.settings().cardFront !== "ar") VS.speech.auto(w.word);
      const card = VS.$(".flash");
      card.classList.add("enter");
      swipe(card);
    },

    actions: {
      /* Meet: one word after another; then the check, without the words already known. */
      "meet-next"() {
        if (s.phase !== "meet") return;
        s.metIndex++;
        if (s.metIndex >= s.met.length) {
          s.phase = "check";
          s.queue = s.met.filter((w) => !s.known.has(w.id));
          s.base = s.queue.length;
          s.index = 0;
        }
        VS.sfx.play("flip");
        VS.app.render();
        window.scrollTo({ top: 0 });
      },
      "meet-knew"() {
        if (s.phase !== "meet") return;
        const w = s.met[s.metIndex];
        VS.store.grade(w.id, "good", { meet: true });
        s.known.add(w.id);
        this["meet-next"]();
      },
      flip(el, e) {
        if (e && e.target.closest("[data-action='speak']")) return;
        if (s.suppressFlip) { s.suppressFlip = false; return; }   // the swipe already answered
        s.flipped = !s.flipped;
        VS.sfx.play("flip");
        if (s.flipped && VS.store.settings().cardFront === "ar") VS.speech.auto(s.queue[s.index].word);
        VS.$(".flash").classList.toggle("is-flipped", s.flipped);
        // The answer comes after the check: "Show" gives way to the two answers once the card is turned.
        const bar = VS.$(".card-bar");
        if (bar) bar.classList.toggle("is-flipped", s.flipped);
        VS.$$(".flash-face").forEach((f) => f.setAttribute("aria-hidden", f.classList.contains("flash-back") ? !s.flipped : s.flipped));
      },
      grade(el) {
        if (s.busy) return;
        // A grade before the card is turned (a swipe, a key) turns it first: you check, then answer.
        if (!s.flipped) {
          const swiped = s.suppressFlip;          // a swipe: flip now, and swallow the click that follows it
          s.suppressFlip = false;
          this.flip();
          s.suppressFlip = swiped;
          const card = VS.$(".flash");
          if (card) card.style.transform = "";
          return;
        }
        const w = s.queue[s.index];
        const grade = el.dataset.grade;
        // Remember the round as it was, so Undo can put this card back.
        s.undo = { index: s.index, queue: s.queue.slice(), known: new Set(s.known), learning: new Set(s.learning),
                   again: new Set(s.again), token: null };
        // Grade the schedule once per round; a card shown again only moves the round on.
        // A new word met for the first time is not a test: "Still learning" is no mistake.
        if (!s.again.has(w.id)) s.undo.token = VS.store.grade(w.id, grade, { meet: true });
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
      undo() {
        const u = s.undo;
        if (!u || s.busy) return;
        if (u.token) VS.store.undo(u.token);
        Object.assign(s, { index: u.index, queue: u.queue, known: u.known, learning: u.learning, again: u.again,
                           flipped: true, undo: null });
        VS.toast("Answer taken back.");
        VS.app.render();
      },
    },

    keys(e) {
      if (s && s.phase === "meet") {
        if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); this.actions["meet-next"](); }
        return;
      }
      if (!s || s.index >= s.queue.length) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); this.actions.flip(); }
      else if (e.key === "1" || e.key === "ArrowLeft") this.actions.grade({ dataset: { grade: "again" } });
      else if (e.key === "2" || e.key === "ArrowRight") this.actions.grade({ dataset: { grade: "good" } });
      else if (e.key === "u" || e.key === "U") this.actions.undo();
    },
  };
})();
