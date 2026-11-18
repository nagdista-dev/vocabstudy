/* core/grammar.js — a second pair of eyes on the learner's sentence (Use it).
   ------------------------------------------------------------------
   core/usage-traps.js knows the mistakes Arab learners make with *words*.
   LanguageTool (free, no account: api.languagetool.org) knows general
   grammar: "She don't", "He have two childs", "I didn't went", "more
   taller". Together they mark a sentence the way a teacher would.

   Only the sentence is sent, and only when the learner presses Check in
   Use it with Settings → Grammar check on. Offline, or if the service is
   slow or down, the sentence is kept without it — the app never waits
   on someone else's server.

     VS.grammar.enabled()        → Settings → Grammar check
     VS.grammar.check(text)      → { issues: [{ label, message, found, fixes }], skipped }
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  const URL = "https://api.languagetool.org/v2/check";
  const TIMEOUT = 7000;
  // Kept: real grammar and spelling. Dropped: capitals, quotes, spaces and
  // style advice — Use it fixes capitals itself, and style isn't a mistake.
  const KEEP = new Set(["GRAMMAR", "TYPOS", "CONFUSED_WORDS", "COLLOCATIONS", "MISC", "NONSTANDARD_PHRASES", "SEMANTICS"]);
  const SKIP_RULES = new Set(["I_LOWERCASE", "UPPERCASE_SENTENCE_START", "EN_QUOTES", "WHITESPACE_RULE", "PUNCTUATION_PARAGRAPH_END"]);
  const LABEL = { TYPOS: "Spelling", CONFUSED_WORDS: "Word choice", COLLOCATIONS: "Goes with" };

  VS.grammar = {
    // It sends the learner's own sentence out, so it is asked once, in Use it, and never
    // on by default (critique v10). A new key: older saves had "grammar" on without asking.
    enabled: () => VS.store.settings().grammarOnline === true,
    /** Not chosen yet: Use it asks once, beside the sentence it would send. */
    undecided: () => VS.store.settings().grammarOnline === "ask",

    async check(text) {
      if (!this.enabled() || !navigator.onLine) return { issues: [], skipped: true };
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
      try {
        const body = new URLSearchParams({ text, language: VS.store.settings().voice === "uk" ? "en-GB" : "en-US" });
        const res = await fetch(URL, { method: "POST", body, signal: ctrl.signal });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        const issues = (data.matches || [])
          .filter((m) => KEEP.has(m.rule && m.rule.category && m.rule.category.id) && !SKIP_RULES.has(m.rule.id))
          .map((m) => ({
            label: LABEL[m.rule.category.id] || "Grammar",
            message: m.message,
            found: text.substr(m.offset, m.length),
            fixes: (m.replacements || []).slice(0, 2).map((r) => r.value),
          }))
          .slice(0, 3);
        return { issues, skipped: false };
      } catch (e) {
        return { issues: [], skipped: true };
      } finally {
        clearTimeout(timer);
      }
    },
  };
})();
