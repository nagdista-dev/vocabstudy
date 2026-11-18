/* views/spell.js — hear it, write it.
   Spelling from sound joins the word's sound to its letters. The Arabic
   meaning is shown so the learner knows *which* word they are writing.
   A wrong answer shows a letter-by-letter comparison. */
(function () {
  "use strict";
  const { html, icon } = VS;
  
  let s = null;   // { scope, words, index, typed, checked, hints, right, wrong: [] }

  function finish() {
    const next = VS.finishStep(s.scope, "spell");
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
        next ? Object.assign({ primary: true }, next) : { href: s.scope.back, label: "Done", primary: true },
        s.wrong.length ? { action: "retry", label: "Practise these" } : null,
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
          ${VS.ui.activityHead({ back: s.scope.back, title: "Spell", sub: s.scope.title, index: s.index, total: s.words.length, combo: s.combo })}
          <div class="activity-stage stage-center">
          <section class="spell card ${!s.checked && !s.hints && !s.typed ? "spell-fresh" : ""}">
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
                <input dir="auto" id="spellInput" type="text" value="${s.typed}" ${s.checked ? "readonly" : ""}
                       spellcheck="false" autocapitalize="off" autocorrect="off" placeholder="Type the word"/>
              </label>
            </form>

            ${s.checked
              ? html`<div class="feedback ${ok ? "is-right" : "is-wrong"}" role="status">
                  <p class="feedback-title">${ok ? "Correct" : "Not quite"}</p>
                  ${ok
                    ? html`<p class="spell-line"><span class="feedback-word"><span class="mark">${answer}</span></span> <span class="ipa">${VS.ipaText(w)}</span></p>`
                    : html`
                      <p class="spell-line"><span class="hint">You wrote</span><span class="spell-typed">${s.typed}</span></p>
                      <p class="spell-line"><span class="hint">Correct</span><span class="spell-diff" aria-label="Correct spelling: ${answer}">${VS.ui.letters(s.typed, answer)}</span></p>
                      <p class="spell-legend hint"><span class="ch-bad">marked</span> = the letters to learn · <span class="ipa">${VS.ipaText(w)}</span></p>`}
                  ${VS.ui.soundTraps(w)}
                  ${w.example ? html`<p class="feedback-example">${VS.ui.quote(w)}</p>` : ""}
                </div>
                ${ok ? "" : html`
                  <form class="spell-retype" data-form="retype" autocomplete="off">
                    <label class="form-field"><span>Now type it once more, the right way</span>
                      <input dir="auto" id="retypeInput" type="text" spellcheck="false" autocapitalize="off" autocorrect="off" lang="en"
                             class="${s.retyped ? "is-right" : ""}" value="${s.retype || ""}" placeholder="${answer.replace(/[^\s]/g, "·")}"/>
                    </label>
                  </form>`}`
              : ""}
          </section>
          </div>
          <div class="action-bar">
            ${s.checked
              ? html`<button class="btn btn-lg btn-primary" type="button" data-action="next" id="nextBtn"
                  ${ok || s.retyped ? "" : VS.raw("disabled")}>Next word <kbd>Enter</kbd></button>`
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
      VS.ui.watchKeyboard(input);
      if (form) form.addEventListener("submit", (e) => { e.preventDefault(); s.checked ? VS.views.spell.actions.next() : VS.views.spell.actions.check(); });
      // After a miss, the hand learns it: the word is typed once more before Next wakes up.
      const retype = VS.$("#retypeInput");
      if (retype) {
        const answer = VS.normalise(VS.spellingOf(s.words[s.index]));
        retype.addEventListener("input", () => {
          s.retype = retype.value;
          s.retyped = VS.normalise(retype.value) === answer;
          retype.classList.toggle("is-right", s.retyped);
          VS.$("#nextBtn").disabled = !s.retyped;
          if (s.retyped) VS.sfx.play("right");
        });
        VS.$("[data-form='retype']").addEventListener("submit", (e) => { e.preventDefault(); if (s.retyped) VS.views.spell.actions.next(); });
      }
      if (!s.checked) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        if (!s.typed && !s.hints) VS.speech.say(VS.spellingOf(s.words[s.index]));
      } else if (retype && !s.retyped) {
        retype.focus({ preventScroll: true });
      } else {
        VS.$("#nextBtn").focus({ preventScroll: true });
      }
    },

    actions: {
      check() {
        const w = s.words[s.index];
        s.typed = VS.$("#spellInput").value.trim();
        if (!s.typed) { VS.toast("Type the word first — or use Hint."); return; }
        // Arabic letters mean the keyboard is in Arabic, not that you misspelled.
        // Keyboard left on Arabic: read the keys pressed, and say so once.
        if (VS.isArabicTyping(s.typed)) {
          s.typed = VS.fromArabicKeys(s.typed);
          VS.toast("Your keyboard is in Arabic — read as “" + s.typed + "”. Switch it to English next time.");
        }
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
        const w = s.words[s.index];
        const missed = s.checked && VS.normalise(s.typed) !== VS.normalise(VS.spellingOf(w));
        if (missed && !s.retyped) return;
        s.index++; s.typed = ""; s.checked = false; s.hints = 0; s.retype = ""; s.retyped = false;
        VS.app.render();
      },
      restart() { VS.views.spell.start(VS.app.params()); VS.app.render(); },
      retry() { VS.views.spell.start(VS.app.params(), VS.shuffle(s.wrong)); VS.app.render(); },
    },

    keys(e) {
      if (s && s.checked && e.key === "Enter" && !["nextBtn", "retypeInput"].includes(document.activeElement.id)) { e.preventDefault(); this.actions.next(); }
    },
  };
})();
