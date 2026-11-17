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
     quick    the 10 words that matter most      #/quick   (the 5-minute review)
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
      case "quick": return { kind: "quick", title: "5-minute review", back: home, words: VS.store.quickWords(10) };
      case "tricky": return { kind: "tricky", title: "Tricky words", back: home, words: VS.store.trickyWords() };
      case "all": return { kind: "all", title: "Whole library", back: "#/words", words: VS.allWords() };
      case "new": return { kind: "new", title: "New words", back: home, words: VS.store.newWords().slice(0, VS.newLeftToday()) };
      case "today": {
        const ids = VS.store.totals().learnedToday;
        return { kind: "today", title: "Today's words", back: home, words: ids.map((id) => VS.byId[id]) };
      }
      case "word": {
        const w = VS.byId[new URLSearchParams(params.query || "").get("id") || ""];
        return w ? { kind: "word", title: w.word, back: "#/words?q=" + encodeURIComponent(w.word), words: [w] } : null;
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

  /** New words still allowed today — a daily cap, not a per-session batch. */
  VS.newLeftToday = () => Math.max(0, VS.newPerDay() - VS.store.totals().newToday);

  /* Today's plan, in order: learn the new words with cards, then practise
     today's words — recognise (Quiz), spell, connect (Match), then use them
     in a sentence of your own (Write). Speak joins only where the browser can listen. */
  VS.todaySteps = () => ["quiz", "spell", "match", "write"].concat(VS.listen && VS.listen.supported ? ["speak"] : []);
  const STEP_NAMES = { quiz: "Quiz", spell: "Spell", match: "Match", write: "Use it", speak: "Speak" };

  /**
   * Called when an activity ends: remembers today's plan steps, and returns
   * the next step as { href, label } (or null when there is none).
   */
  VS.finishStep = function (scope, mode) {
    VS.roundsDone = (VS.roundsDone || 0) + 1;     // the install card waits for one (app.js)
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
  /* Wrong answers that make you think: the same kind of word first — from
     this round, then from the whole library — and only then anything. A
     verb among adjectives gives the answer away ("achieve" next to
     "beautiful", "actually"). Verb and phrasal verb are one family. */
  const FAMILY = { "Phrasal Verb": "Verb", Idiom: "Phrase" };
  const family = (t) => FAMILY[t] || t;
  VS.distractors = function (target, field, count, pool) {
    const seen = new Set([String(target[field]).toLowerCase()]);
    const pick = [];
    const kin = (w) => family(w.type) === family(target.type);
    const sameType = VS.shuffle((pool || VS.allWords()).filter(kin));
    const sameTypeAll = VS.shuffle(VS.allWords().filter(kin));
    const any = VS.shuffle(VS.allWords());
    for (const w of sameType.concat(sameTypeAll, any)) {
      const value = String(w[field] || "").toLowerCase();
      if (w.id === target.id || !value || seen.has(value)) continue;     // never a blank answer
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
  VS.findInExample = (w, loose) => VS.findIn(w, w.example, loose);

  /** The same search in any text: where you met it, or a sentence you wrote. */
  VS.findIn = function (w, text, loose) {
    if (!text) return null;
    const tokens = w.word.toLowerCase().replace(/’/g, "'").replace(/[^a-z' -]/g, "").trim().split(/[\s-]+/).filter(Boolean);
    if (!tokens.length) return null;
    const join = loose ? "(?:[\\s-]+[\\w'’]+){0,3}?[\\s-]+" : "[\\s-]+";
    const m = new RegExp(tokens.map(tokenPattern).join(join), "i").exec(text);
    if (!m) return null;
    return { before: text.slice(0, m.index), answer: m[0], after: text.slice(m.index + m[0].length) };
  };

  /**
   * Read a sentence the learner wrote with a word ("Use it"), the way a
   * teacher marks it — on this device, no service:
   *   problems  must be fixed before it counts: Arabic keyboard, too short,
   *             the word missing, a copy of the example, an Arab-learner
   *             mistake from core/usage-traps.js (anywhere in the sentence)
   *   tips      small things that don't block: a capital, a full stop, "I"
   * → { ok, problems: [{ text, trap? }], tips: [text], clean }
   */
  VS.checkSentence = function (w, text) {
    const raw = String(text || "").replace(/\s+/g, " ").trim();
    const problems = [], tips = [];
    const words = raw.split(" ").filter((x) => /[a-z]/i.test(x));
    if (VS.isArabicTyping(raw)) {
      problems.push({ text: "Your keyboard is in Arabic — switch it to English and write the sentence again." });
      return { ok: false, problems, tips, clean: raw };
    }
    if (words.length < 4) problems.push({ text: "Make it a full sentence: at least four words — who does what, when or why." });
    if (!VS.findIn(w, raw, true)) {
      const forms = formsHint(w);
      problems.push({ text: `Use “${w.word}” in it.` + (forms ? ` Any form works: ${forms}.` : "") });
    }
    const copied = [w.example, w.context].concat(w.mine || []).filter(Boolean)
      .some((s) => VS.editDistance(s, raw) <= Math.max(3, VS.normalise(s).length * 0.15));
    if (copied) problems.push({ text: "That sentence is already here. Write a new one — about your own day, your work or someone you know." });
    // The learner's own words that went wrong ("depends of"), next to the fix.
    VS.findUsageMistakes(raw).forEach((trap) => {
      const m = trap.bad.exec(" " + raw.replace(/[’‘]/g, "'") + " ");
      // The learner's own sentence, fixed — never the trap's canned example (core/usage-traps.js).
      problems.push({ text: trap.why, trap, found: m ? m[0].trim() : "", fixed: VS.fixSentence(raw, trap) });
    });
    if (/^[a-z]/.test(raw)) tips.push("Start with a capital letter.");
    if (raw && !/[.!?…"”')]$/.test(raw)) tips.push("End with a full stop.");
    if (/(^|\s)i(\s|'|$)/.test(raw)) tips.push("Write I as a capital: I, I'm, I've.");
    // Fix the small things for the saved copy; the learner sees the tips.
    let clean = raw.replace(/(^|\s)i(?=\s|'|$)/g, "$1I");
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    if (clean && !/[.!?…"”')]$/.test(clean)) clean += ".";
    return { ok: !problems.length, problems, tips, clean };
  };

  /** "borrow" → "borrows, borrowed, borrowing" — so learners know any form counts.
      Only verbs and nouns change; for other words there's nothing to say. */
  function formsHint(w) {
    const word = String(w.word).trim();
    const head = word.split(/\s+/)[0].toLowerCase();
    if (/verb/i.test(w.type)) {
      const irr = VS.IRREGULAR[head];
      const rest = word.slice(head.length);
      if (irr && irr.length) return [head].concat(irr.slice(0, 2)).map((v) => v + rest).join(", ");
      const base = head.replace(/e$/, "");
      return [head + "s", base + "ed", base + "ing"].map((v) => v + rest).join(", ");
    }
    if (w.type === "Noun" && !/\s/.test(word)) return word + ", " + (/(s|x|z|ch|sh)$/.test(word) ? word + "es" : /[^aeiou]y$/.test(word) ? word.slice(0, -1) + "ies" : word + "s");
    return "";
  }

  /**
   * The real forms of a word, for judging a typed answer — strict, unlike
   * findIn: "take off" → take off, takes off, took off, taken off, taking off;
   * "decide" → decides, decided, deciding; "study" → studies, studied. A
   * phrase changes its first word only ("made a decision"). Never "user" for
   * "use": only these endings, and the irregular forms in core/word-forms.js.
   */
  VS.wordForms = function (word) {
    const parts = String(word || "").toLowerCase().replace(/’/g, "'").trim().split(/\s+/);
    const head = parts[0], rest = parts.slice(1).join(" ");
    const out = new Set([head, head + "s", head + "ed", head + "ing"]);
    if (/(s|x|z|ch|sh|o)$/.test(head)) out.add(head + "es");
    if (/e$/.test(head)) { out.add(head + "d"); out.add(head.slice(0, -1) + "ing"); }
    if (/ie$/.test(head)) out.add(head.slice(0, -2) + "ying");
    if (/[^aeiou]y$/.test(head)) { out.add(head.slice(0, -1) + "ies"); out.add(head.slice(0, -1) + "ied"); }
    if (/^[^aeiou]*[aeiou][bdgklmnprt]$/.test(head) || /[^aeiou][aeiou][bdgmnprt]$/.test(head) && head.length <= 4) {
      out.add(head + head.slice(-1) + "ed"); out.add(head + head.slice(-1) + "ing");
    }
    (VS.IRREGULAR[head] || []).forEach((f) => out.add(f));
    return [...out].map((f) => (rest ? f + " " + rest : f));
  };

  /** Is `typed` the word, or one of its real forms? ("took off" for "take off") */
  VS.isWordForm = (typed, word) => {
    const t = VS.normalise(typed);
    return !!t && VS.wordForms(word).some((f) => VS.normalise(f) === t);
  };

  /** The word as the learner should type it in Spell (no sense label). */
  VS.spellingOf = (w) => w.word.trim();

  /** How many letters must change to turn one text into the other (Levenshtein).
      1 = a slip ("recieve" for "receive" is 2: a swap counts as two). */
  VS.editDistance = function (a, b) {
    a = VS.normalise(a); b = VS.normalise(b);
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++) {
        row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = row;
    }
    return prev[b.length];
  };

  /** A typed answer that is right but for a slip: one letter (two in a long word). */
  VS.isAlmost = (typed, answer) => {
    const d = VS.editDistance(typed, answer);
    return d > 0 && d <= (VS.normalise(answer).length >= 8 ? 2 : 1);
  };

  /** Normalise typed answers: case, curly quotes and extra spaces don't count. */
  VS.normalise = (s) =>
    String(s).toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, " ").trim();
})();
