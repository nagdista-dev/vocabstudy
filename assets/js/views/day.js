/* views/day.js — one word set: the learning path and the word list.
   The path is a real sequence (study → quiz → spell → match), so it is
   numbered, and the next unfinished step is the one that stands out. */
(function () {
  "use strict";
  const { html, icon } = VS;

  const STEPS = [
    { mode: "cards", icon: "cards", name: "Study the cards", text: "Meet each word: meaning, Arabic, example and sound." },
    { mode: "quiz",  icon: "quiz",  name: "Quiz",            text: "Mixed questions: meaning, Arabic and fill the gap." },
    { mode: "spell", icon: "spell", name: "Spell",           text: "Hear a word and type it. Every letter is checked." },
    { mode: "match", icon: "match", name: "Match",           text: "Pair English with Arabic against the clock." },
  ];

  // One word browser per day, kept while the page is open, so filters survive re-renders.
  const browsers = {};
  const browserFor = (day) =>
    (browsers[day.iso] = browsers[day.iso] || new VS.WordBrowser({ id: "d" + day.iso.replace(/-/g, ""), words: () => day.words }));

  function nextStep(day) {
    const step = STEPS.find((s) => !VS.store.doneOn(day.iso, s.mode));
    return step ? step.mode : null;
  }

  function stepRow(day, step, i, next) {
    const done = VS.store.doneOn(day.iso, step.mode);
    return html`
      <li class="step ${next === step.mode ? "is-next" : ""} ${done ? "is-done" : ""}">
        <span class="step-n" aria-hidden="true">${done ? icon("check", "icon-sm") : i + 1}</span>
        <span class="step-ico" aria-hidden="true">${icon(step.icon)}</span>
        <span class="step-copy">
          <b>${step.name}</b>
          <span class="hint">${done ? "Done " + (done === VS.todayKey() ? "today" : done) : step.text}</span>
        </span>
        <a class="btn ${next === step.mode ? "btn-primary" : ""}" href="#/day/${day.iso}/${step.mode}">
          ${done ? "Again" : "Start"}
        </a>
      </li>`;
  }

  VS.views.day = {
    title: (p) => (VS.day(p.iso) || {}).label,
    crumbs: (p) => [{ label: (VS.day(p.iso) || {}).label }],

    render(p) {
      const day = VS.day(p.iso);
      if (!day) return html`<div class="page"><div class="empty"><h2>This day doesn't exist</h2><a class="btn btn-primary" href="${VS.homeHref}">All word sets</a></div></div>`;
      const s = VS.store.dayStats(day);
      const next = nextStep(day);
      return html`
        <div class="page view-enter">
          <header class="day-head">
            <div class="row day-title">
              ${VS.ui.ring(s.percent, null, 64)}
              <div>
                <h1>${day.label}</h1>
                <p class="hint">${day.weekday}</p>
              </div>
            </div>
            <dl class="day-stats">
              <div><dt>Words</dt><dd>${s.total}</dd></div>
              <div><dt>Learning</dt><dd>${s.learning}</dd></div>
              <div><dt>Mastered</dt><dd>${s.mastered}</dd></div>
            </dl>
          </header>

          ${s.due ? html`
            <a class="recall-strip" href="#/day/${day.iso}/recall">
              ${icon("review")}
              <span><b>${VS.plural(s.due, "word")} from this day ${s.due === 1 ? "is" : "are"} due for recall</b>
              <span class="hint">Bring them back from memory before they fade.</span></span>
              ${icon("arrow-right", "icon-sm")}
            </a>` : ""}

          <div class="row day-tools">
            <a class="btn btn-quiet" href="#/print/day/${day.iso}">${VS.icon("print", "icon-sm")} Print / PDF</a>
          </div>

          <section aria-labelledby="path-title">
            <div class="section-title"><h2 id="path-title">Learning path</h2>
              <span class="hint">${next ? "Next: " + STEPS.find((x) => x.mode === next).name : "All steps done — come back for recall"}</span></div>
            <ol class="steps">${STEPS.map((step, i) => stepRow(day, step, i, next))}</ol>
          </section>

          <section aria-labelledby="words-title">
            <div class="section-title"><h2 id="words-title">Words</h2></div>
            ${browserFor(day).markup()}
          </section>
        </div>`;
    },

    mount(root, p) {
      const day = VS.day(p.iso);
      if (day) browserFor(day).mount(root);
    },

    keys(e) {
      if (e.key === "/") {
        e.preventDefault();
        const day = VS.day(VS.app.params().iso);
        if (day) browserFor(day).focusSearch();
      }
    },
  };
})();
