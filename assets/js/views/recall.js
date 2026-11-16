/* views/recall.js — Active recall: the heart of the app.
   ------------------------------------------------------------------
   Recognising a word ("oh, I've seen that") is easy and fades fast.
   Producing it from its meaning is what builds memory. So recall
   shows the *meaning* and asks for the *word*:

     1. Read the Arabic meaning and the definition.
     2. Say or type the English word — from memory. Stuck? A hint gives
        the first letter, then a few more (and similar words).
     3. Reveal, compare, and grade yourself honestly:
          Forgot  → back to box 1, due tomorrow
          Got it  → up one box (waits longer)
          Easy    → up two boxes (not offered after a hint)
   Typing is optional; when you type, the app checks it for you, shows
   the letters you missed, and suggests the honest grade: a one-letter
   slip is "Almost" (you remembered the word), a different word is
   "Forgot". Undo takes back a mis-tapped grade.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;

  // Many due words? Recall them in batches so a session always has an end.
  const RECALL_BATCH = 50;
  const MAX_HINTS = 2;

  let s = null;   // { scope, queue, style, index, revealed, typed, verdict, hints, results: Map(id → grade), undo }

  /* Two ways to ask, mixed at random: from the meaning, or from the word's
     own sentence with a gap. Retrieving a word through different cues
     builds more paths back to it — that is what makes it last. */
  function gapText(w) {
    const hit = VS.findInExample(w);
    return s.revealed ? html`${hit.before}<mark class="mark">${hit.answer}</mark>${hit.after}`
                      : html`${hit.before}<span class="gap"><span class="sr-only">blank</span></span>${hit.after}`;
  }

  /* Hint 1: the first letter and the length. Hint 2: a third of the word.
     Similar words come with the first hint: another way in to the meaning. */
  function hintMarkup(w) {
    if (!s.hints || s.revealed) return "";
    const word = VS.spellingOf(w);
    const shown = s.hints === 1 ? 1 : Math.max(2, Math.ceil(word.replace(/\s/g, "").length / 3));
    let n = 0;
    const letters = [...word].map((ch) => {
      if (ch === " ") return html`<span class="hint-space"></span>`;
      n++;
      return n <= shown ? html`<b>${ch}</b>` : html`<span class="hint-blank">_</span>`;
    });
    return html`
      <div class="recall-hint view-enter">
        <p class="recall-hint-letters" aria-label="Starts with ${word.slice(0, shown)}, ${word.replace(/\s/g, "").length} letters">${letters}</p>
        ${VS.ui.similar(w)}
      </div>`;
  }

  function verdictMarkup(w) {
    if (!s.verdict) return "";
    if (s.verdict === "right") return html`<p class="verdict is-right">${icon("check", "icon-sm")} You typed it right.</p>`;
    return html`
      <div class="verdict is-${s.verdict}">
        <p>${s.verdict === "almost" ? html`<b>Almost.</b> You typed “${s.typed}” — one slip:` : html`You typed “${s.typed}”.`}</p>
        <p class="spell-diff verdict-diff" aria-label="Correct spelling: ${w.word}">${VS.ui.letters(s.typed, VS.spellingOf(w))}</p>
      </div>`;
  }

  function prompt(w) {
    const gap = s.style[s.index] === "gap";
    return html`
      <article class="recall card">
        <div class="row recall-badges">${VS.ui.levelBadge(w)}<span class="badge">${w.type}</span>
          ${w.tags.length ? html`<span class="hint recall-from">#${w.tags.join(" #")}</span>` : ""}</div>
        ${gap
          ? html`<p class="q-label">Which word fits the sentence?</p>
                 <p class="recall-gap">${gapText(w)}</p>
                 <p class="recall-ar recall-ar-sm" lang="ar">${w.arabic}</p>`
          : html`<p class="recall-ar" lang="ar">${w.arabic}</p>
                 ${w.definition ? html`<p class="recall-def">${w.definition}</p>` : ""}`}
        ${w.sense ? html`<p class="hint">Sense: ${w.sense}</p>` : ""}
        ${hintMarkup(w)}

        ${s.revealed
          ? html`
            <div class="recall-answer view-enter">
              ${verdictMarkup(w)}
              <div class="row">
                <p class="recall-word"><span class="mark">${w.word}</span></p>
                ${VS.ui.speakButton(w.word)}
              </div>
              <span class="ipa">${w.ipa}</span>
              ${!gap && w.example ? html`<p class="recall-example">${VS.ui.quote(w)}</p>` : ""}
              ${VS.ui.similar(w)}
            </div>`
          : html`
            <form class="recall-form" data-form="reveal" autocomplete="off">
              <label class="field">
                <span class="sr-only">Type the English word (optional)</span>
                <input id="recallInput" type="text" value="${s.draft || ""}" placeholder="Type the word… (optional)" spellcheck="false" autocapitalize="off" autocorrect="off"/>
              </label>
            </form>`}
      </article>`;
  }

  /** The honest grade for what was typed: the button that Enter presses. */
  const suggested = () => (s.verdict === "wrong" ? "again" : "good");

  function gradeBar() {
    const pick = suggested();
    const easy = !s.hints && s.verdict !== "almost";
    const btn = (grade, tone, label, key) => html`
      <button class="${["btn btn-lg", tone, pick === grade ? "is-suggested" : ""].join(" ")}" type="button" data-action="grade" data-grade="${grade}"
        ${pick === grade ? VS.raw('id="suggestedGrade"') : ""}>${label} <kbd>${key}</kbd></button>`;
    return html`
      ${btn("again", "btn-bad", "Forgot", "1")}
      ${btn("good", "btn-good", "Got it", "2")}
      ${easy ? btn("easy", "", "Easy", "3") : ""}`;
  }

  function finish() {
    const counts = { again: 0, good: 0, easy: 0 };
    s.results.forEach((g) => counts[g]++);
    const forgot = [...s.results].filter(([, g]) => g === "again").map(([id]) => VS.byId[id]).filter(Boolean);
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

  function nextCard() {
    s.index++; s.revealed = false; s.typed = ""; s.draft = ""; s.verdict = ""; s.hints = 0;
  }

  VS.views.recall = {
    title: () => "Recall",
    crumbs: (p) => VS.ui.crumbs(p, "Recall"),

    start(p) {
      const scope = VS.scope(p);
      const words = scope ? VS.store.dueWords(scope.words) : [];
      const queue = VS.shuffle(words).slice(0, RECALL_BATCH);
      s = { scope, queue, style: queue.map((w) => (VS.findInExample(w) && Math.random() < 0.5 ? "gap" : "meaning")),
            more: Math.max(0, words.length - RECALL_BATCH),
            index: 0, revealed: false, typed: "", draft: "", verdict: "", hints: 0, results: new Map(), combo: 0, undo: null };
    },

    render() {
      if (!s.scope) return VS.ui.emptyActivity("#/", "This list was not found.");
      if (!s.queue.length) {
        const next = VS.store.nextReview();
        // Nothing studied yet: the useful next step is learning, not practising.
        if (!next && VS.store.newWords().length) {
          return html`<div class="activity"><div class="empty">
            <h2>Nothing to recall yet</h2>
            <p>Words come back here after you learn them. Start with today's new words.</p>
            <div class="row empty-actions">
              <a class="btn btn-primary" href="#/new/cards">${icon("cards", "icon-sm")} Learn new words</a>
              <a class="btn btn-quiet" href="${s.scope.back}">Go back</a>
            </div></div></div>`;
        }
        return html`<div class="activity"><div class="empty">
          <h2>Nothing to recall right now</h2>
          <p>${next
            ? html`Your next recall is <b>${VS.ui.whenText(next.date)}</b>: ${VS.plural(next.count, "word")}.`
            : "Add words to your library — they come back here on their recall days."}</p>
          <p class="hint">Want to keep going? Practise without changing your schedule:</p>
          <div class="row empty-actions">
            <a class="btn btn-primary" href="#/all/quiz">${icon("quiz", "icon-sm")} Quiz</a>
            <a class="btn" href="#/all/spell">${icon("spell", "icon-sm")} Spell</a>
            <a class="btn btn-quiet" href="${s.scope.back}">Go back</a>
          </div></div></div>`;
      }
      if (s.index >= s.queue.length) return html`<div class="activity">${finish()}</div>`;
      const w = s.queue[s.index];
      return html`
        <div class="activity">
          ${VS.ui.activityHead({ back: s.scope.back, title: "Recall", index: s.index, total: s.queue.length, combo: s.combo, undo: !!s.undo })}
          ${prompt(w)}
          <div class="action-bar">
            ${s.revealed
              ? gradeBar()
              : html`
                <button class="btn btn-lg btn-quiet" type="button" data-action="hint" ${s.hints >= MAX_HINTS ? VS.raw("disabled") : ""}>
                  ${icon("bulb", "icon-sm")} ${s.hints ? "Another letter" : "Hint"} <kbd>H</kbd></button>
                <button class="btn btn-lg btn-primary" type="button" data-action="reveal">Show the word <kbd>Enter</kbd></button>`}
          </div>
        </div>`;
    },

    mount() {
      const input = VS.$("#recallInput");
      VS.ui.watchKeyboard(input);
      if (input) {
        input.addEventListener("input", () => { s.draft = input.value; });
        if (matchMedia("(hover: hover)").matches) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
      }
      const form = VS.$("[data-form='reveal']");
      if (form) form.addEventListener("submit", (e) => { e.preventDefault(); VS.views.recall.actions.reveal(); });
      if (s && s.revealed && s.queue[s.index]) {
        VS.speech.auto(s.queue[s.index].word);
        const pick = VS.$("#suggestedGrade");
        if (pick && matchMedia("(hover: hover)").matches) pick.focus({ preventScroll: true });
      }
    },

    actions: {
      hint() {
        if (s.revealed || s.hints >= MAX_HINTS) return;
        const input = VS.$("#recallInput");
        if (input) s.draft = input.value;
        s.hints++;
        VS.sfx.play("flip");
        VS.app.render();
      },
      reveal() {
        const w = s.queue[s.index];
        const input = VS.$("#recallInput");
        s.typed = input ? input.value.trim() : "";
        if (VS.isArabicTyping(s.typed)) s.typed = "";      // Arabic keyboard: judge from memory only, not the typing
        const answer = VS.spellingOf(w);
        s.verdict = !s.typed ? "" : VS.normalise(s.typed) === VS.normalise(answer) ? "right"
          : VS.isAlmost(s.typed, answer) ? "almost" : "wrong";
        s.revealed = true;
        VS.sfx.play(s.verdict === "wrong" ? "wrong" : "flip");
        VS.app.render();
      },
      restart() { VS.views.recall.start(VS.app.params()); VS.app.render(); },
      grade(el) {
        const w = s.queue[s.index];
        const grade = el.dataset.grade;
        // Remember the session as it was, so Undo can bring this word back.
        s.undo = { index: s.index, queue: s.queue.slice(), style: s.style.slice(), results: new Map(s.results), combo: s.combo,
                   typed: s.typed, verdict: s.verdict, hints: s.hints, token: null };
        if (!s.results.has(w.id)) s.undo.token = VS.store.grade(w.id, grade);
        s.results.set(w.id, s.results.get(w.id) === "again" ? "again" : grade);
        s.combo = grade === "again" ? 0 : s.combo + 1;
        VS.sfx.play(grade === "again" ? "wrong" : "right");
        // A forgotten word comes back once at the end, so the session ends on success.
        if (grade === "again" && s.queue.indexOf(w, s.index + 1) === -1) { s.queue.push(w); s.style.push("meaning"); }
        nextCard();
        VS.app.render();
      },
      undo() {
        const u = s.undo;
        if (!u) return;
        if (u.token) VS.store.undo(u.token);
        Object.assign(s, { index: u.index, queue: u.queue, style: u.style, results: u.results, combo: u.combo,
                           typed: u.typed, verdict: u.verdict, hints: u.hints, revealed: true, undo: null });
        VS.toast("Answer taken back.");
        VS.app.render();
      },
    },

    keys(e) {
      if (!s || s.index >= s.queue.length) return;
      if (e.key === "u" || e.key === "U") { this.actions.undo(); return; }
      if (!s.revealed) {                    // (Enter inside the input submits its form instead)
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.actions.reveal(); }
        else if (e.key === "h" || e.key === "H") { e.preventDefault(); this.actions.hint(); }
        return;
      }
      if (e.key === "Enter") { e.preventDefault(); this.actions.grade({ dataset: { grade: suggested() } }); return; }
      const grade = { 1: "again", 2: "good", 3: "easy" }[e.key];
      if (grade === "easy" && (s.hints || s.verdict === "almost")) return;
      if (grade) this.actions.grade({ dataset: { grade } });
    },
  };
})();
