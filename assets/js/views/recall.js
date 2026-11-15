/* views/recall.js — Active recall: the heart of the app.
   ------------------------------------------------------------------
   Recognising a word ("oh, I've seen that") is easy and fades fast.
   Producing it from its meaning is what builds memory. So recall
   shows the *meaning* and asks for the *word*:

     1. Read the Arabic meaning and the definition.
     2. Say or type the English word — from memory.
     3. Reveal, compare, and grade yourself honestly:
          Forgot  → back to box 1, due tomorrow
          Got it  → up one box (waits longer)
          Easy    → up two boxes
   Typing is optional; when you type, the app checks it for you.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;

  // Many due words? Recall them in batches so a session always has an end.
  const RECALL_BATCH = 50;

  let s = null;   // { scope, queue, index, revealed, typed, verdict, results: Map(id → grade) }

  /* Two ways to ask, mixed at random: from the meaning, or from the word's
     own sentence with a gap. Retrieving a word through different cues
     builds more paths back to it — that is what makes it last. */
  function gapText(w) {
    const hit = VS.findInExample(w);
    return s.revealed ? html`${hit.before}<mark class="mark">${hit.answer}</mark>${hit.after}`
                      : html`${hit.before}<span class="gap">_____</span>${hit.after}`;
  }

  function prompt(w) {
    return html`
      <article class="recall card">
        <div class="row recall-badges">${VS.ui.levelBadge(w)}<span class="badge">${w.type}</span>
          <span class="hint recall-from">from ${VS.day(w.day).label}</span></div>
        ${s.style[s.index] === "gap"
          ? html`<p class="q-label">Which word fits the sentence?</p>
                 <p class="recall-gap">${gapText(w)}</p>
                 <p class="recall-ar recall-ar-sm" lang="ar">${w.arabic}</p>`
          : html`<p class="recall-ar" lang="ar">${w.arabic}</p>
                 <p class="recall-def">${w.definition}</p>`}
        ${w.sense ? html`<p class="hint">Sense: ${w.sense}</p>` : ""}

        ${s.revealed
          ? html`
            <div class="recall-answer view-enter">
              ${s.verdict ? html`<p class="verdict is-${s.verdict}">${s.verdict === "right" ? "You typed it right." : html`You typed “${s.typed}”.`}</p>` : ""}
              <div class="row">
                <p class="recall-word"><span class="mark">${w.word}</span></p>
                ${VS.ui.speakButton(w.word)}
              </div>
              <span class="ipa">${w.ipa}</span>
              <p class="recall-example">“${VS.ui.example(w)}”</p>
            </div>`
          : html`
            <form class="recall-form" data-form="reveal" autocomplete="off">
              <label class="field">
                <span class="sr-only">Type the English word (optional)</span>
                <input id="recallInput" type="text" placeholder="Type the word… (optional)" spellcheck="false" autocapitalize="off" autocorrect="off"/>
              </label>
            </form>`}
      </article>`;
  }

  function finish() {
    const counts = { again: 0, good: 0, easy: 0 };
    s.results.forEach((g) => counts[g]++);
    const forgot = [...s.results].filter(([, g]) => g === "again").map(([id]) => VS.byId[id]);
    if (s.scope.day) VS.store.markDone(s.scope.day.iso, "recall");
    if (!counts.again && s.results.size >= 5) setTimeout(VS.ui.celebrate, 150);
    const next = VS.store.nextReview();
    return VS.ui.summary({
      title: "Recall done",
      message: next
        ? html`Next recall: ${VS.plural(next.count, "word")} ${VS.ui.whenText(next.date)}.`
        : "Nothing else is scheduled yet.",
      stats: [
        { value: s.results.size, label: "recalled" },
        { value: counts.good + counts.easy, label: "remembered", tone: "good" },
        { value: counts.again, label: "forgot", tone: "bad" },
      ],
      words: forgot,
      actions: s.more
        ? [{ action: "restart", label: "Next " + Math.min(s.more, RECALL_BATCH) + " words", primary: true }, { href: s.scope.back, label: "Stop for now" }]
        : [{ href: s.scope.back, label: "Done", primary: true }],
    });
  }

  VS.views.recall = {
    title: () => "Recall",
    crumbs: (p) => VS.ui.crumbs(p, "Recall"),

    start(p) {
      const scope = VS.scope(p);
      const words = scope ? VS.store.dueWords(scope.words) : [];
      const queue = VS.shuffle(words).slice(0, RECALL_BATCH);
      s = { scope, queue, style: queue.map((w) => (VS.findInExample(w) && Math.random() < 0.5 ? "gap" : "meaning")), more: Math.max(0, words.length - RECALL_BATCH),
            index: 0, revealed: false, typed: "", verdict: "", results: new Map(), combo: 0 };
    },

    render() {
      if (!s.scope) return VS.ui.emptyActivity("#/", "This set was not found.");
      if (!s.queue.length) {
        return html`<div class="activity"><div class="empty">
          <h2>Nothing to recall right now</h2>
          <p>Words you study come back here on their review day.</p>
          <a class="btn btn-primary" href="${s.scope.back}">Go back</a></div></div>`;
      }
      if (s.index >= s.queue.length) return html`<div class="activity">${finish()}</div>`;
      const w = s.queue[s.index];
      return html`
        <div class="activity">
          ${VS.ui.activityHead({ back: s.scope.back, title: "Recall", index: s.index, total: s.queue.length, combo: s.combo })}
          ${prompt(w)}
          <div class="action-bar">
            ${s.revealed
              ? html`
                <button class="btn btn-lg btn-bad" type="button" data-action="grade" data-grade="again">Forgot <kbd>1</kbd></button>
                <button class="btn btn-lg btn-good" type="button" data-action="grade" data-grade="good">Got it <kbd>2</kbd></button>
                <button class="btn btn-lg" type="button" data-action="grade" data-grade="easy">Easy <kbd>3</kbd></button>`
              : html`<button class="btn btn-lg btn-primary" type="button" data-action="reveal">Show the word <kbd>Enter</kbd></button>`}
          </div>
        </div>`;
    },

    mount() {
      const input = VS.$("#recallInput");
      if (input && matchMedia("(hover: hover)").matches) input.focus();
      const form = VS.$("[data-form='reveal']");
      if (form) form.addEventListener("submit", (e) => { e.preventDefault(); VS.views.recall.actions.reveal(); });
      if (s && s.revealed && s.queue[s.index]) VS.speech.auto(s.queue[s.index].word);
    },

    actions: {
      reveal() {
        const w = s.queue[s.index];
        const input = VS.$("#recallInput");
        s.typed = input ? input.value.trim() : "";
        s.verdict = s.typed ? (VS.normalise(s.typed) === VS.normalise(w.word) ? "right" : "wrong") : "";
        s.revealed = true;
        VS.sfx.play(s.verdict === "wrong" ? "wrong" : "flip");
        VS.app.render();
      },
      restart() { VS.views.recall.start(VS.app.params()); VS.app.render(); },
      grade(el) {
        const w = s.queue[s.index];
        const grade = el.dataset.grade;
        if (!s.results.has(w.id)) VS.store.grade(w.id, grade);
        s.results.set(w.id, s.results.get(w.id) === "again" ? "again" : grade);
        s.combo = grade === "again" ? 0 : s.combo + 1;
        VS.sfx.play(grade === "again" ? "wrong" : "right");
        // A forgotten word comes back once at the end, so the session ends on success.
        if (grade === "again" && s.queue.indexOf(w, s.index + 1) === -1) { s.queue.push(w); s.style.push("meaning"); }
        s.index++; s.revealed = false; s.typed = ""; s.verdict = "";
        VS.app.render();
      },
    },

    keys(e) {
      if (!s || s.index >= s.queue.length) return;
      if (!s.revealed) {                    // (Enter inside the input submits its form instead)
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.actions.reveal(); }
        return;
      }
      const grade = { 1: "again", 2: "good", 3: "easy" }[e.key];
      if (grade) this.actions.grade({ dataset: { grade } });
    },
  };
})();
