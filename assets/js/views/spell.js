/* views/spell.js — hear it, write it.
   Spelling from sound joins the word's sound to its letters. The Arabic
   meaning is shown so the learner knows *which* word they are writing.
   A wrong answer shows a letter-by-letter comparison. */
(function () {
  "use strict";
  const { html, icon } = VS;
  
  let s = null;   // { scope, words, index, typed, checked, hints, right, wrong: [] }

  /**
   * The correct spelling, letter by letter: green for letters you wrote in
   * the right order, red (underlined) for letters you missed or got wrong.
   * Uses the longest common subsequence, so one missing letter in the middle
   * doesn't turn every letter after it red ("recieve" vs "receive").
   */
  function diff(typed, answer) {
    const a = [...answer.toLowerCase()];
    const t = [...typed.toLowerCase()];
    const L = Array.from({ length: a.length + 1 }, () => new Array(t.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--)
      for (let j = t.length - 1; j >= 0; j--)
        L[i][j] = a[i] === t[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const hit = new Set();
    for (let i = 0, j = 0; i < a.length && j < t.length;) {
      if (a[i] === t[j]) { hit.add(i); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) i++;
      else j++;
    }
    return [...answer].map((ch, i) =>
      ch === " " ? html`<span class="ch-space"> </span>` : html`<span class="${hit.has(i) ? "ch-ok" : "ch-bad"}">${ch}</span>`);
  }

  function finish() {
    if (s.scope.day) VS.store.markDone(s.scope.day.iso, "spell");
    if (!s.wrong.length) setTimeout(VS.ui.celebrate, 150);
    return VS.ui.summary({
      title: s.wrong.length ? "Spelling done" : "Every word spelled right",
      message: s.wrong.length ? "Misspelled words come back tomorrow for recall." : "Your ear and your spelling agree.",
      stats: [
        { value: s.right + " / " + s.words.length, label: "spelled right", tone: "good" },
        { value: s.wrong.length, label: "to review", tone: s.wrong.length ? "bad" : "" },
      ],
      words: s.wrong,
      actions: [
        s.scope.day ? { href: s.scope.back + "/match", label: "Next: Match", primary: true } : { href: s.scope.back, label: "Done", primary: true },
        s.wrong.length ? { action: "retry", label: "Practise the " + VS.plural(s.wrong.length, "mistake") } : null,
        { action: "restart", label: "Spell again" },
      ],
    });
  }

  VS.views.spell = {
    title: () => "Spell",
    crumbs: (p) => VS.ui.crumbs(p, "Spell"),

    /** `only` (optional): spell exactly these words — used by "Practise mistakes". */
    start(p, only) {
      const scope = VS.scope(p);
      s = { scope, words: only || (scope ? VS.sessionWords(scope.words, VS.roundSize()) : []), index: 0,
            typed: "", checked: false, hints: 0, right: 0, wrong: [], combo: 0 };
    },

    render() {
      if (!s.scope || !s.words.length) return VS.ui.emptyActivity("#/", "There are no words to spell.");
      if (s.index >= s.words.length) return html`<div class="activity">${finish()}</div>`;
      const w = s.words[s.index];
      const answer = VS.spellingOf(w);
      const ok = s.checked && VS.normalise(s.typed) === VS.normalise(answer);
      return html`
        <div class="activity">
          ${VS.ui.activityHead({ back: s.scope.back, title: "Spell · " + s.scope.title, index: s.index, total: s.words.length, combo: s.combo })}
          <section class="spell card">
            <div class="spell-listen">
              <button class="speak-btn speak-xl" type="button" data-action="speak" data-say="${answer}" aria-label="Play the word">${icon("volume", "icon-lg")}</button>
              <button class="btn btn-quiet" type="button" data-action="slow">${icon("clock", "icon-sm")} Slower</button>
            </div>
            <p class="spell-ar" lang="ar">${w.arabic}</p>
            <p class="hint spell-meta">${w.type} · ${answer.length} letters${answer.includes(" ") ? " · more than one word" : ""}</p>
            ${s.hints ? html`<p class="spell-hint">Starts with <b>${answer.slice(0, s.hints)}</b></p>` : ""}

            <form data-form="spell" autocomplete="off">
              <label class="field field-xl ${s.checked ? (ok ? "is-right" : "is-wrong") : ""}">
                <span class="sr-only">Type the word you hear</span>
                <input id="spellInput" type="text" value="${s.typed}" ${s.checked ? "readonly" : ""}
                       spellcheck="false" autocapitalize="off" autocorrect="off" placeholder="Type what you hear"/>
              </label>
            </form>

            ${s.checked
              ? html`<div class="feedback ${ok ? "is-right" : "is-wrong"}" role="status">
                  <p class="feedback-title">${ok ? "Correct" : "Not quite"}</p>
                  ${ok
                    ? html`<p class="spell-line"><span class="feedback-word"><span class="mark">${answer}</span></span> <span class="ipa">${w.ipa}</span></p>`
                    : html`
                      <p class="spell-line"><span class="hint">You wrote</span><span class="spell-typed">${s.typed}</span></p>
                      <p class="spell-line"><span class="hint">Correct</span><span class="spell-diff" aria-label="Correct spelling: ${answer}">${diff(s.typed, answer)}</span></p>
                      <p class="spell-legend hint"><span class="ch-ok">green</span> = you had it · <span class="ch-bad">red</span> = missed or wrong · <span class="ipa">${w.ipa}</span></p>`}
                  <p class="feedback-example">“${VS.ui.example(w)}”</p>
                </div>`
              : ""}
          </section>
          <div class="action-bar">
            ${s.checked
              ? html`<button class="btn btn-lg btn-primary" type="button" data-action="next" id="nextBtn">Next word <kbd>Enter</kbd></button>`
              : html`
                <button class="btn btn-lg" type="button" data-action="hint" ${s.hints >= answer.length - 1 ? "disabled" : ""}>${icon("bulb", "icon-sm")} Hint</button>
                <button class="btn btn-lg btn-primary" type="button" data-action="check">Check <kbd>Enter</kbd></button>`}
          </div>
        </div>`;
    },

    mount() {
      if (!s || s.index >= s.words.length) return;
      const input = VS.$("#spellInput");
      const form = VS.$("[data-form='spell']");
      if (form) form.addEventListener("submit", (e) => { e.preventDefault(); s.checked ? VS.views.spell.actions.next() : VS.views.spell.actions.check(); });
      if (!s.checked) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        if (!s.typed && !s.hints) VS.speech.say(VS.spellingOf(s.words[s.index]));
      } else {
        VS.$("#nextBtn").focus({ preventScroll: true });
      }
    },

    actions: {
      check() {
        const w = s.words[s.index];
        s.typed = VS.$("#spellInput").value.trim();
        if (!s.typed) { VS.toast("Type the word first — or use Hint."); return; }
        s.checked = true;
        const ok = VS.normalise(s.typed) === VS.normalise(VS.spellingOf(w));
        // A word you needed hints for still counts as a miss for the schedule.
        VS.store.grade(w.id, ok && !s.hints ? "good" : "again");
        if (ok) s.right++; else s.wrong.push(w);
        s.combo = ok && !s.hints ? s.combo + 1 : 0;
        VS.sfx.play(ok ? "right" : "wrong");
        VS.app.render();
      },
      hint() {
        s.typed = VS.$("#spellInput").value;
        s.hints++;
        VS.app.render();
      },
      slow() { VS.speech.say(VS.spellingOf(s.words[s.index]), null, 0.55); },
      next() {
        s.index++; s.typed = ""; s.checked = false; s.hints = 0;
        VS.app.render();
      },
      restart() { VS.views.spell.start(VS.app.params()); VS.app.render(); },
      retry() { VS.views.spell.start(VS.app.params(), VS.shuffle(s.wrong)); VS.app.render(); },
    },

    keys(e) {
      if (s && s.checked && e.key === "Enter" && document.activeElement.id !== "nextBtn") { e.preventDefault(); this.actions.next(); }
    },
  };
})();
