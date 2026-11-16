/* core/practice.js — shared logic for building practice sessions.
   ------------------------------------------------------------------
   Every activity (cards, quiz, spell, match) asks the same questions:
   "which words?", "what are good wrong answers?", "where is the word
   in the example sentence?". The answers live here, once.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  /**
   * Which words an activity works on, from the route: #/<scope>/<mode>?filters
     recall   words due today                    #/recall
     new      the next new words to learn        #/new/cards
     today    words you first studied today      #/today/quiz
     tricky   words you keep missing             #/tricky/spell
     all      the whole library                  #/all/match
     pick     a filtered list from the library   #/pick/quiz?status=learning&tag=IELTS
   */
  VS.scope = function (params) {
    const home = "#/";
    switch (params.scope) {
      case "recall": return { kind: "recall", title: "Daily recall", back: home, words: VS.store.dueWords() };
      case "tricky": return { kind: "tricky", title: "Tricky words", back: home, words: VS.store.trickyWords() };
      case "all": return { kind: "all", title: "Whole library", back: "#/words", words: VS.allWords() };
      case "new": return { kind: "new", title: "New words", back: home, words: VS.store.newWords().slice(0, VS.newPerDay()) };
      case "today": {
        const ids = VS.store.totals().learnedToday;
        return { kind: "today", title: "Today's words", back: home, words: ids.map((id) => VS.byId[id]) };
      }
      case "pick": {
        const f = VS.filters.parse(params.query);
        const q = VS.filters.query(f);
        return { kind: "pick", title: VS.filters.describe(f) || "Whole library", back: "#/words" + (q ? "?" + q : ""),
                 query: q, words: VS.filters.apply(VS.allWords(), f) };
      }
    }
    return null;
  };

  /** New words per day (Settings → Study). */
  VS.newPerDay = () => VS.store.settings().newPerDay || 10;

  /* Today's plan, in order: learn the new words with cards, then practise
     today's words. Speak joins only where the browser can listen. */
  VS.todaySteps = () => ["quiz", "spell", "match"].concat(VS.listen && VS.listen.supported ? ["speak"] : []);
  const STEP_NAMES = { quiz: "Quiz", spell: "Spell", match: "Match", speak: "Speak" };

  /**
   * Called when an activity ends: remembers today's plan steps, and returns
   * the next step as { href, label } (or null when there is none).
   */
  VS.finishStep = function (scope, mode) {
    if (!scope) return null;
    if (scope.kind === "new" && mode === "cards") {
      VS.store.markDone("today", "learn");
      return { href: "#/today/quiz", label: "Next: Quiz" };
    }
    if (scope.kind !== "today") return null;
    VS.store.markDone("today", mode);
    const steps = VS.todaySteps();
    const next = steps[steps.indexOf(mode) + 1];
    return next ? { href: "#/today/" + next, label: "Next: " + STEP_NAMES[next] } : null;
  };

  /** How many items a round has (Settings → Round size). */
  VS.roundSize = () => VS.store.settings().roundSize || 20;

  /** Order a session: due words first, then learning, new, and mastered last. */
  VS.sessionWords = function (words, size) {
    const rank = (w) => (VS.store.isDue(w.id) ? -1 : { learning: 0, new: 1, mastered: 2 }[VS.store.status(w.id)]);
    const ordered = VS.shuffle(words).sort(
      (a, b) => rank(a) - rank(b)
    );
    return size ? ordered.slice(0, size) : ordered;
  };

  /**
   * Wrong options for a multiple-choice question.
   * Prefers words of the same type (a verb among verbs is a fair test),
   * never repeats the right answer's text, and falls back to all words.
   */
  VS.distractors = function (target, field, count, pool) {
    const seen = new Set([String(target[field]).toLowerCase()]);
    const pick = [];
    const sameType = VS.shuffle((pool || VS.allWords()).filter((w) => w.type === target.type));
    const any = VS.shuffle(VS.allWords());
    for (const w of sameType.concat(any)) {
      const value = String(w[field]).toLowerCase();
      if (w.id === target.id || seen.has(value)) continue;
      seen.add(value);
      pick.push(w);
      if (pick.length === count) break;
    }
    return pick;
  };

  /* Contractions: "you've" in the headword also matches "you have". */
  const CONTRACTIONS = { "'ve": "have", "'re": "are", "'ll": "will", "'d": "would", "'m": "am", "n't": "not", "'s": "is" };

  /** Regex source for one word of a headword, with every form it may take. */
  function tokenPattern(token) {
    const stand = VS.STAND_INS[token];
    if (stand && stand[0] === "*") return "[\\w'’]+(?:\\s+[\\w'’]+)?";          // someone → any 1–2 words
    for (const [short, long] of stand ? [] : Object.entries(CONTRACTIONS)) {
      if (token.endsWith(short) && token.length > short.length) {
        const base = VS.escapeRegExp(token.slice(0, -short.length));
        return "\\b" + base + "(?:" + VS.escapeRegExp(short).replace("'", "['’]") + "|\\s+" + long + ")\\b";
      }
    }
    const stem = token.length > 4 ? token.replace(/(e|y)$/, "") : token;
    const forms = [VS.escapeRegExp(stem) + "[a-z]*"]
      .concat((VS.IRREGULAR[token] || []).map(VS.escapeRegExp))
      .concat((stand || []).map((f) => VS.escapeRegExp(f) + "\\b"));
    return "\\b(?:" + forms.join("|") + ")";
  }

  /**
   * Find the word inside its example sentence.
   * Handles inflections ("rip" → "ripped"), irregular verbs ("bring" →
   * "brought"), contractions ("you've" → "you have") and idiom
   * placeholders ("your" → "my", "someone" → "my cousin"); see
   * core/word-forms.js. With `loose`, a phrasal verb may be split by its
   * object ("bring my friend along"). Highlighting uses loose matching;
   * "Fill the gap" uses strict, so the blank never swallows other words.
   * Returns { before, answer, after } or null.
   */
  VS.findInExample = function (w, loose) {
    const tokens = w.word.toLowerCase().replace(/’/g, "'").replace(/[^a-z' -]/g, "").trim().split(/[\s-]+/).filter(Boolean);
    if (!tokens.length) return null;
    const join = loose ? "(?:[\\s-]+[\\w'’]+){0,3}?[\\s-]+" : "[\\s-]+";
    const m = new RegExp(tokens.map(tokenPattern).join(join), "i").exec(w.example);
    if (!m) return null;
    return { before: w.example.slice(0, m.index), answer: m[0], after: w.example.slice(m.index + m[0].length) };
  };

  /** The word as the learner should type it in Spell (no sense label). */
  VS.spellingOf = (w) => w.word.trim();

  /** Normalise typed answers: case, curly quotes and extra spaces don't count. */
  VS.normalise = (s) =>
    String(s).toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, " ").trim();
})();
