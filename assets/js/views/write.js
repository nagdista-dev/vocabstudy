/* views/write.js — Use it: write a sentence of your own with the word.
   ------------------------------------------------------------------
   Knowing what "depend" means is not the same as using it. Arab learners
   say "it depends of", "I did a mistake", "before three years" — not
   because they forgot the word, but because nobody marked their own
   sentence. This screen does what a teacher's red pen does, kindly and
   on the device (VS.checkSentence in core/practice.js):

     1. See the word: meaning, sound, and what Arab learners get wrong
        with it (core/usage-traps.js).
     2. Write one sentence about your own life with it.
     3. Check: the word is there (any form), it's a full sentence, it's
        not the example copied, and no usage trap is hiding in it. Then,
        online, LanguageTool reads its grammar (core/grammar.js): "She
        don't", "I didn't went". The learner can keep a sentence anyway —
        no checker is always right.
   A sentence that passes is kept with the word ("Your sentences") and
   comes back in Recall as a gap — the strongest cue there is: your life.
   A sentence kept against a warning ("Keep it anyway") is saved but never
   used as a Recall cue: a mistake shown back as a reminder gets learned.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;

  const ROUND = 5;          // writing is slow, careful work: five sentences make a round
  /* Starters for the blank page — the hardest part of writing is the first word. */
  const IDEAS = ["Yesterday I…", "At work, …", "My friend…", "Next week I want to…", "When I was a child, …",
                 "In my city, …", "I think that…", "Last summer…", "Every morning I…", "My family…"];

  let s = null;   // { scope, words, index, draft, result, written, skipped, saved }

  function feedback() {
    const r = s.result;
    if (!r) return "";
    if (r.ok) {
      return html`
        <div class="feedback is-right write-ok" role="status">
          <p class="feedback-title">${icon("check", "icon-sm")} Kept with the word</p>
          <p class="write-saved">${VS.ui.mixed(r.clean)}</p>
          ${r.tips.length ? html`<p class="hint">${r.tips.join(" ")} (Fixed in the saved copy.)</p>` : ""}
          <p class="hint">${r.unsure
            ? "Kept as you wrote it. It may have a mistake, so Recall won't use it — write another one later."
            : "It comes back in Recall as a gap — your own life is the strongest reminder."}</p>
          ${r.grammarSkipped && VS.grammar.enabled() ? html`<p class="hint">Grammar wasn't checked this time (offline).</p>` : ""}
        </div>`;
    }
    return html`
      <div class="write-check" role="status">
        <p class="write-check-title">Almost there — fix this and check again:</p>
        <ul>
          ${r.problems.map((p) => html`
            <li>${p.trap
              ? html`<span class="usage-kind">${p.trap.label}</span>
                     ${p.found ? html`<span class="usage-wrong">${icon("x", "icon-sm")}<span>${p.found}</span><small>you wrote</small></span>` : ""}
                     ${p.fixed ? html`<span class="usage-right">${icon("check", "icon-sm")}<span>${p.fixed}</span><small>your sentence, fixed</small></span>` : ""}
                     <span class="usage-why">${VS.ui.mixed(p.text)}</span>`
              : p.grammar
              ? html`<span class="usage-kind">${p.grammar.label}</span>
                     ${p.grammar.found ? html`<span class="usage-wrong">${icon("x", "icon-sm")}<span>${p.grammar.found}</span><small>you wrote</small></span>` : ""}
                     ${p.grammar.fixes.length ? html`<span class="usage-right">${icon("check", "icon-sm")}<span>${p.grammar.fixes.join(" / ")}</span></span>` : ""}
                     <span class="usage-why">${p.text}</span>`
              : html`<span>${VS.ui.mixed(p.text)}</span>`}</li>`)}
        </ul>
        ${r.canKeep ? html`<p class="hint write-keep">Sure it's right? A checker can be wrong too.
          <button class="link-btn" type="button" data-action="keep">Keep it anyway</button>
          — it stays with the word, but Recall won't use it as a reminder.</p>` : ""}
      </div>`;
  }

  /* A sentence that passed (or that the learner chose to keep): saved with the word. */
  function keep(w, result) {
    s.result = Object.assign(result, { ok: true });
    VS.store.addSentence(w.id, result.clean, { unsure: !!result.unsure });
    VS.store.grade(w.id, "good");      // using a word is a real right answer
    s.written.push(w.id);
    VS.sfx.play("right");
    VS.app.render();
  }

  function finish() {
    const next = VS.finishStep(s.scope, "write");
    if (s.written.length >= 3 && !s.skipped) setTimeout(VS.ui.celebrate, 150);
    return VS.ui.summary({
      title: s.written.length ? "Your words, your sentences" : "Round over",
      message: s.written.length
        ? "Each sentence is kept with its word and comes back in Recall."
        : "Skipped this time. A sentence a day makes a word yours.",
      stats: [
        { value: s.written.length, label: s.written.length === 1 ? "sentence" : "sentences", tone: "good" },
        { value: s.skipped, label: "skipped" },
      ],
      words: s.written.map((id) => VS.byId[id]).filter(Boolean),
      actions: [
        next ? Object.assign({ primary: true }, next) : { href: s.scope.back, label: "Done", primary: true },
        s.scope.kind !== "word" ? { action: "restart", label: "Write more" } : null,
      ],
    });
  }

  VS.views.write = {
    title: () => "Use it",
    crumbs: (p) => VS.ui.crumbs(p, "Use it"),

    start(p) {
      const scope = VS.scope(p);
      // Words with the fewest sentences first: every word deserves one.
      const words = scope ? VS.sessionWords(scope.words).sort((a, b) => a.mine.length - b.mine.length).slice(0, ROUND) : [];
      s = { scope, words, index: 0, draft: "", result: null, written: [], skipped: 0, idea: Math.floor(Math.random() * IDEAS.length) };
    },

    render() {
      if (!s.scope || !s.words.length) return VS.ui.emptyActivity("#/", "There are no words to write with yet.");
      if (s.index >= s.words.length) return html`<div class="activity">${finish()}</div>`;
      const w = s.words[s.index];
      const done = s.result && s.result.ok;
      return html`
        <div class="activity">
          ${VS.ui.activityHead({ back: s.scope.back, title: "Use it", sub: s.scope.title, index: s.index, total: s.words.length })}
          <div class="activity-stage stage-center">
          <section class="write card">
            <div class="write-word">
              <p class="write-headword"><span class="mark">${w.word}</span></p>
              <div class="row">${VS.ui.speakButton(w.word)}${VS.ui.ipa(w)}</div>
              ${w.arabic ? html`<p class="write-ar" lang="ar">${w.arabic}</p>` : ""}
              ${w.definition ? html`<p class="write-def">${w.definition}</p>` : ""}
            </div>
            ${VS.ui.usage(w, 2, "write-usage")}
            ${w.example || w.context ? html`
              <details class="write-example">
                <summary>See how it's used</summary>
                ${VS.ui.context(w)}
                ${w.example ? html`<p class="feedback-example">${VS.ui.quote(w)}</p>` : ""}
              </details>` : ""}
            <form class="write-form" data-form="write" autocomplete="off">
              ${VS.ui.goes(w)}
              <label class="form-field">
                <span>Write a sentence about <b>your own life</b> with “${w.word}”</span>
                <textarea id="writeInput" rows="3" maxlength="300" spellcheck="true" lang="en" enterkeyhint="done"
                  placeholder="${IDEAS[(s.idea + s.index) % IDEAS.length]}" ${done ? VS.raw("readonly") : ""}>${s.draft}</textarea>
              </label>
            </form>
            ${VS.grammar.enabled() && !done ? html`<p class="hint write-privacy">Grammar is checked online by LanguageTool — only this sentence is sent. (Settings → Grammar check)</p>` : ""}
            ${feedback()}
          </section>
          </div>
          <div class="action-bar">
            ${done
              ? html`<button class="btn btn-lg btn-primary" type="button" data-action="next" id="writeNext">
                  ${s.index + 1 < s.words.length ? "Next word" : "See results"} <kbd>Enter</kbd></button>`
              : html`
                <button class="btn btn-lg btn-quiet" type="button" data-action="skip">Skip</button>
                <button class="btn btn-lg btn-primary" type="button" data-action="check" ${s.checking ? VS.raw("disabled") : ""}>${s.checking ? "Checking…" : "Check"} <kbd>Enter</kbd></button>`}
          </div>
        </div>`;
    },

    mount() {
      const input = VS.$("#writeInput");
      if (input) {
        VS.ui.watchKeyboard(input);
        input.addEventListener("input", () => {
          s.draft = input.value;
          input.style.height = "auto";
          input.style.height = Math.min(input.scrollHeight + 2, 220) + "px";
        });
        // Enter checks (a sentence is one line); Shift+Enter is still a new line.
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey && !input.readOnly) { e.preventDefault(); VS.views.write.actions.check(); }
        });
        if (!input.readOnly && matchMedia("(hover: hover)").matches) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }
      const next = VS.$("#writeNext");
      if (next) next.focus({ preventScroll: true });
      const fb = VS.$(".write-check, .write-ok");
      if (fb && innerWidth <= 640) fb.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },

    actions: {
      async check() {
        if (s.checking) return;
        const w = s.words[s.index];
        const input = VS.$("#writeInput");
        s.draft = input ? input.value : s.draft;
        if (!s.draft.trim()) { VS.toast("Write a sentence first — or Skip."); return; }
        const local = VS.checkSentence(w, s.draft);
        // Only tense patterns found (soft, core/usage-traps.js): the learner may keep it.
        if (!local.ok) {
          s.result = Object.assign(local, { canKeep: local.problems.every((p) => p.trap && p.trap.soft) });
          VS.sfx.play("wrong");
          VS.app.render();
          return;
        }
        // The word is used well: now the general grammar, online (core/grammar.js).
        s.checking = true;
        VS.app.render();
        const g = await VS.grammar.check(local.clean);
        s.checking = false;
        if (g.issues.length) {
          s.result = Object.assign({}, local, { ok: false, canKeep: true,
            problems: g.issues.map((i) => ({ text: i.message, grammar: i })) });
          VS.sfx.play("wrong");
          VS.app.render();
          return;
        }
        keep(w, Object.assign(local, { grammarSkipped: g.skipped }));
      },
      keep() {
        // Kept against a warning: saved, but never shown back as a Recall cue —
        // a mistake repeated as a reminder is a mistake learned.
        const w = s.words[s.index];
        keep(w, Object.assign(VS.checkSentence(w, s.draft), { ok: true, unsure: true }));
      },
      skip() { s.skipped++; this.next(); },
      next() { s.index++; s.draft = ""; s.result = null; VS.app.render(); window.scrollTo({ top: 0 }); },
      restart() { VS.views.write.start(VS.app.params()); VS.app.render(); },
    },

    keys(e) {
      if (!s || s.index >= s.words.length) return;
      if (e.key === "Enter" && s.result && s.result.ok && document.activeElement.id !== "writeNext") { e.preventDefault(); this.actions.next(); }
    },
  };
})();
