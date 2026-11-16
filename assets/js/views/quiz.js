/* views/quiz.js — a round of mixed multiple-choice questions (Settings → Round size).
   Four question types test the word from different sides:
     meaning  → pick the word for a definition
     arabic   → pick the English word for the Arabic
     english  → pick the Arabic for the English word
     gap      → pick the word missing from its example sentence
   After every answer the full word is shown, so a mistake becomes a
   mini-lesson instead of just a red mark. */
(function () {
  "use strict";
  const { html, icon } = VS;
    // "listen" needs the browser's voices; without them it falls back to "english".
  const TYPES = ["meaning", "arabic", "english", "gap", "listen"];

  let s = null;   // { scope, questions, index, picked, right, wrong: [] }

  /* A question needs something to ask about (a definition, the Arabic, a
     sentence with the word) and at least two answers. A word that's still
     being auto-filled may have neither yet: it falls back, or is skipped. */
  function makeQuestion(w, type) {
    if (type === "gap" && !VS.findInExample(w)) type = "meaning";
    if (type === "meaning" && !w.definition) type = "arabic";
    if (type === "listen" && !(VS.speech.supported && VS.store.settings().sound)) type = "english";
    if ((type === "arabic" || type === "english" || type === "listen") && !w.arabic) type = w.definition ? "meaning" : VS.findInExample(w) ? "gap" : "";
    if (!type) return null;
    const field = type === "english" || type === "listen" ? "arabic" : "word";
    const options = VS.shuffle([w].concat(VS.distractors(w, field, 3)));
    return options.length < 2 ? null : { w, type, field, options };
  }

  function promptMarkup(q) {
    const w = q.w;
    switch (q.type) {
      case "arabic":
        return html`<p class="q-label">Which English word means…</p><p class="q-ar" lang="ar">${w.arabic}</p>`;
      case "english":
        return html`<p class="q-label">What does this word mean in Arabic?</p>
          <div class="row q-word-row"><p class="q-word">${VS.ui.headword(w)}</p>${VS.ui.speakButton(w.word)}</div>`;
      case "listen":
        return html`<p class="q-label">Listen. What does this word mean?</p>
          <div class="row q-word-row">
            <button class="speak-btn speak-xl" type="button" data-action="speak" data-say="${w.word}" aria-label="Play the word again">${icon("headphones", "icon-lg")}</button>
            ${s.picked ? html`<p class="q-word">${VS.ui.headword(w)}</p>` : html`<p class="hint">Tap to hear it again</p>`}
          </div>`;
      case "gap": {
        const hit = VS.findInExample(w);
        return html`<p class="q-label">Which word completes the sentence?</p>
          <p class="q-sentence">${hit.before}${s.picked ? html`<mark class="mark">${hit.answer}</mark>` : html`<span class="gap"><span class="sr-only">blank</span></span>`}${hit.after}</p>`;
      }
      default:
        return html`<p class="q-label">Which word matches this meaning?</p><p class="q-def">${w.definition}</p>`;
    }
  }

  function optionMarkup(q, o, i) {
    const value = o[q.field];
    let state = "";
    if (s.picked) {
      if (o.id === q.w.id) state = "is-right";
      else if (o.id === s.picked) state = "is-wrong";
    }
    const isAr = q.field === "arabic";
    return html`
      <button class="option ${state}" type="button" data-action="pick" data-id="${o.id}" ${s.picked ? "disabled" : ""}>
        <kbd class="opt-key"><span class="opt-letter">${"ABCD"[i]}</span><span class="opt-num">${i + 1}</span></kbd>
        <span class="opt-label" ${isAr ? VS.raw('lang="ar"') : ""}>${value}${!isAr && o.sense ? html` <small>(${o.sense.toLowerCase()})</small>` : ""}</span>
        ${state === "is-right" ? icon("check", "icon-sm") : state === "is-wrong" ? icon("x", "icon-sm") : ""}
      </button>`;
  }

  function feedback(q) {
    const ok = s.picked === q.w.id;
    const w = q.w;
    return html`
      <div class="feedback ${ok ? "is-right" : "is-wrong"}" role="status">
        <p class="feedback-title">${ok ? "Correct" : "Not quite"}</p>
        <div class="row"><b class="feedback-word">${VS.ui.headword(w)}</b>${VS.ui.speakButton(w.word)}${VS.ui.ipa(w)}</div>
        <p lang="ar" class="feedback-ar">${w.arabic}</p>
        <p class="hint">${w.definition}</p>
        ${w.example ? html`<p class="feedback-example">${VS.ui.quote(w)}</p>` : ""}
        ${ok ? "" : picked(VS.byId[s.picked])}
        ${VS.ui.usage(w, 1, "feedback-usage")}
      </div>`;
  }

  /* A wrong pick is a word too: say what it means, so the difference itself
     is learned ("actually" ≠ "eventually"). */
  function picked(o) {
    if (!o) return "";
    return html`
      <p class="feedback-picked">${icon("x", "icon-sm")}
        <span>You chose <b>${VS.ui.headword(o)}</b>${o.arabic ? html` (<bdi lang="ar" dir="rtl">${o.arabic.split(" - ")[0]}</bdi>)` : ""}${o.definition ? html`: ${o.definition}` : ""}</span></p>`;
  }

  function finish() {
    const mode = "quiz";
    const next = VS.finishStep(s.scope, mode);
    const total = s.questions.length;
    const pct = Math.round((s.right / total) * 100);
    if (pct === 100) setTimeout(VS.ui.celebrate, 150);
    return VS.ui.summary({
      title: pct === 100 ? "Perfect score" : pct >= 70 ? "Well done" : "Keep going",
      message: s.wrong.length
        ? "The words you missed are scheduled for recall tomorrow."
        : "Every answer was right.",
      stats: [
        { value: s.right + " / " + total, label: "correct", tone: "good" },
        { value: pct + "%", label: "score" },
        { value: s.wrong.length, label: "to review", tone: s.wrong.length ? "bad" : "" },
      ],
      words: s.wrong,
      actions: [
        next ? Object.assign({ primary: true }, next) : { href: s.scope.back, label: "Done", primary: true },
        s.wrong.length ? { action: "retry", label: "Practise these" } : null,
        { action: "restart", label: "New quiz" },
      ],
    });
  }

  VS.views.quiz = {
    title: () => "Quiz",
    crumbs: (p) => VS.ui.crumbs(p, "Quiz"),

    /** `only` (optional): quiz exactly these words — used by "Practise mistakes". */
    start(p, only) {
      const scope = VS.scope(p);
      const words = only || (scope ? VS.sessionWords(scope.words, VS.roundSize()) : []);
      const chosen = TYPES.filter((t) => (VS.store.settings().quizTypes || TYPES).includes(t));
      if (!chosen.length) chosen.push("meaning");
      s = { scope, index: 0, picked: null, right: 0, wrong: [], combo: 0,
            questions: words.map((w, i) => makeQuestion(w, chosen[i % chosen.length])).filter(Boolean) };
      s.questions = VS.shuffle(s.questions);
    },

    render() {
      if (!s.scope || !s.questions.length) {
        return VS.ui.emptyActivity("#/", VS.allWords().length < 2
          ? "A quiz needs at least two words in your library. Add another one."
          : "These words have no meaning yet — wait for auto-fill, or add it in your words.");
      }
      if (s.index >= s.questions.length) return html`<div class="activity">${finish()}</div>`;
      const q = s.questions[s.index];
      return html`
        <div class="activity">
          ${VS.ui.activityHead({ back: s.scope.back, title: "Quiz", sub: s.scope.title, index: s.index, total: s.questions.length, combo: s.combo })}
          <div class="activity-stage ${s.picked ? "" : "q-fresh"}">
            <section class="question card">${promptMarkup(q)}</section>
            <div class="options ${s.picked ? "is-resolved" : ""}" role="group" aria-label="Answers">${q.options.map((o, i) => optionMarkup(q, o, i))}</div>
            ${s.picked ? feedback(q) : ""}
          </div>
          ${s.picked ? html`<div class="action-bar"><button class="btn btn-lg btn-primary" type="button" data-action="next" id="nextBtn">
            ${s.index + 1 < s.questions.length ? "Next question" : "See results"} <kbd>Enter</kbd></button></div>` : ""}
        </div>`;
    },

    mount() {
      const q = s && s.questions[s.index];
      if (q && q.type === "listen" && !s.picked) VS.speech.say(q.w.word);
      const next = VS.$("#nextBtn");
      if (next) next.focus({ preventScroll: true });
      // No auto-scroll: the prompt, the marked answer and the start of the
      // explanation stay in view. Phones hide the other options once answered
      // (see activities.css), so the feedback is never below a wall of rows.
    },

    actions: {
      pick(el) {
        if (s.picked) return;
        const q = s.questions[s.index];
        s.picked = el.dataset.id;
        const ok = s.picked === q.w.id;
        VS.store.grade(q.w.id, ok ? "good" : "again");
        if (ok) { s.right++; s.combo++; } else { s.wrong.push(q.w); s.combo = 0; }
        VS.sfx.play(ok ? "right" : "wrong");
        VS.app.render();
        if (ok) VS.speech.auto(q.w.word);
      },
      next() { s.index++; s.picked = null; VS.app.render(); window.scrollTo({ top: 0 }); },
      restart() { VS.views.quiz.start(VS.app.params()); VS.app.render(); },
      retry() { VS.views.quiz.start(VS.app.params(), VS.shuffle(s.wrong)); VS.app.render(); },
    },

    keys(e) {
      if (!s || s.index >= s.questions.length) return;
      const q = s.questions[s.index];
      const n = parseInt(e.key, 10);
      if (!s.picked && n >= 1 && n <= q.options.length) this.actions.pick({ dataset: { id: q.options[n - 1].id } });
      else if (s.picked && e.key === "Enter" && document.activeElement.id !== "nextBtn") { e.preventDefault(); this.actions.next(); }
    },
  };
})();
