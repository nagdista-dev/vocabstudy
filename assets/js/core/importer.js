/* core/importer.js — turn a pasted table into words.
   ------------------------------------------------------------------
   Accepts what people actually paste: a table copied from Excel,
   Google Sheets or Notion (tab-separated), or CSV, or ";" / "|"
   separated text. Column names are matched loosely, so "file name",
   "term" or "word" all mean the headword, "category" or "pos" the type.

     VS.importer.parse(text) → { rows: [{ word, …, issues: [] }], columns, delimiter }
     VS.importer.parseDataFile(text) → { iso, rows } from a VocabStudy .js data file
     VS.importer.checkWord(word)    → the word cleaned, with its issues
     VS.importer.toDataFile(iso, words) → the text of a .js data file

   Without a header row, columns are read in this order:
     word, definition, example, type, level, ipa, arabic
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  const FIELDS = ["word", "definition", "example", "type", "level", "ipa", "arabic"];
  const ALIASES = {
    word: ["word", "filename", "file", "name", "term", "headword", "vocab", "vocabulary", "english", "phrase", "expression"],
    sense: ["sense", "meaningnote", "context"],
    definition: ["definition", "def", "meaning", "explanation", "englishmeaning", "description"],
    example: ["example", "examples", "sentence", "examplesentence", "usage"],
    type: ["type", "category", "pos", "partofspeech", "class", "wordtype", "kind"],
    level: ["level", "cefr", "difficulty"],
    ipa: ["ipa", "pronunciation", "phonetic", "phonetics", "transcription"],
    arabic: ["arabic", "ar", "translation", "arabicmeaning", "meaningar", "عربي", "المعنى", "الترجمة"],
  };
  const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const TYPES = ["Noun", "Verb", "Adjective", "Adverb", "Phrase", "Phrasal Verb", "Idiom",
                 "Interjection", "Conjunction", "Determiner", "Preposition", "Pronoun"];

  const key = (s) => String(s).toLowerCase().replace(/[^a-z؀-ۿ]/g, "");

  function fieldFor(header) {
    const k = key(header);
    if (!k) return null;
    for (const [field, names] of Object.entries(ALIASES)) if (names.includes(k)) return field;
    return null;
  }

  /** Split one line, honouring "quoted, cells" for CSV. */
  function splitLine(line, delimiter) {
    if (delimiter !== ",") return line.split(delimiter);
    const out = [];
    let cell = "", quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && line[i + 1] === '"' && quoted) { cell += '"'; i++; }
      else if (c === '"') quoted = !quoted;
      else if (c === "," && !quoted) { out.push(cell); cell = ""; }
      else cell += c;
    }
    out.push(cell);
    return out;
  }

  function detectDelimiter(firstLine) {
    for (const d of ["\t", "|", ";", ","]) if (firstLine.includes(d)) return d;
    return "\t";
  }

  /** "Category: Vocabulary" isn't a part of speech — guess one from the word. */
  function normaliseType(raw, word) {
    const t = String(raw || "").trim();
    const hit = TYPES.find((x) => x.toLowerCase() === t.toLowerCase());
    if (hit) return hit;
    const short = { n: "Noun", v: "Verb", adj: "Adjective", adv: "Adverb", prep: "Preposition", phr: "Phrase", "phrasal": "Phrasal Verb" }[t.toLowerCase().replace(/\.$/, "")];
    if (short) return short;
    if (/\s/.test(word)) return "Phrase";
    if (/ly$/i.test(word)) return "Adverb";
    return "Noun";                                   // the most common type; flagged so you can fix it
  }

  function parse(text) {
    const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
    if (!lines.length) return { rows: [], columns: [], delimiter: "\t" };
    const delimiter = detectDelimiter(lines[0]);
    const firstCells = splitLine(lines[0], delimiter);
    const mapped = firstCells.map(fieldFor);
    const hasHeader = mapped.filter(Boolean).length >= 2;
    const columns = hasHeader ? mapped : FIELDS.slice(0, firstCells.length);
    const body = hasHeader ? lines.slice(1) : lines;

    const rows = body.map((line, n) => {
      const cells = splitLine(line, delimiter).map((c) => c.trim());
      const w = blank();
      columns.forEach((field, i) => { if (field && cells[i] != null && !w[field]) w[field] = cells[i]; });
      return checkWord(w, n + (hasHeader ? 2 : 1));
    });
    return { rows, columns, hasHeader, delimiter };
  }

  const blank = () => ({ word: "", sense: "", definition: "", example: "", type: "", level: "", ipa: "", arabic: "" });

  /** Clean one word and list what's missing. Used by tables, files and the one-word form. */
  function checkWord(w, line) {
      w = Object.assign(blank(), w);
      Object.keys(w).forEach((k) => { w[k] = String(w[k] == null ? "" : w[k]).trim(); });
      const issues = [];

      // "Axe (tool)" → word "Axe", sense "tool"
      const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(w.word);
      if (m && !w.sense) { w.word = m[1]; w.sense = m[2]; }
      w.word = w.word.replace(/\s+/g, " ").trim();

      const level = w.level.toUpperCase().replace(/\s/g, "");
      if (LEVELS.includes(level)) w.level = level;
      else { if (w.level) issues.push({ kind: "warn", text: `level “${w.level}” → B1` }); else issues.push({ kind: "warn", text: "no level → B1" }); w.level = "B1"; }

      const rawType = w.type;
      w.type = normaliseType(rawType, w.word);
      if (rawType.toLowerCase() !== w.type.toLowerCase()) issues.push({ kind: "warn", text: rawType ? `type “${rawType}” → ${w.type}` : `no type → ${w.type}` });

      if (w.ipa && !/^\/.*\/$|^\[.*\]$/.test(w.ipa)) w.ipa = "/" + w.ipa.replace(/^\/|\/$/g, "") + "/";

      if (!w.word) issues.push({ kind: "error", text: "no word" });
      if (!w.arabic) issues.push({ kind: "warn", text: "no Arabic meaning" });
      if (!w.example) issues.push({ kind: "warn", text: "no example" });
      if (!w.definition) issues.push({ kind: "warn", text: "no definition" });
      if (!w.ipa) issues.push({ kind: "warn", text: "no IPA" });
      return Object.assign(w, { line, issues });
  }

  /**
   * Read a VocabStudy data file (VS.addDay("2026-11-02", [ … ])) — the
   * format older versions kept in data/days/. Never runs the file: each
   * { word: "…", … } row is read as data. Returns { iso, rows } or null.
   */
  function parseDataFile(text) {
    const head = /VS\.addDay\(\s*["'](\d{4}-\d{2}-\d{2})["']/.exec(text);
    if (!head) return null;
    const rows = [];
    const rowRe = /\{\s*word\s*:[^{}]*\}/g;
    let m, n = 0;
    while ((m = rowRe.exec(text))) {
      n++;
      const w = {};
      const pairRe = /(\w+)\s*:\s*("(?:[^"\\]|\\.)*")/g;
      let pm;
      while ((pm = pairRe.exec(m[0]))) {
        try { w[pm[1]] = JSON.parse(pm[2]); } catch (e) { /* skip a broken value */ }
      }
      rows.push(checkWord(w, n));
    }
    return { iso: head[1], rows };
  }

  /** The text of a data/days/ISO.js file for these words (same format as the built-in sets). */
  function toDataFile(iso, words) {
    const date = new Date(iso + "T12:00:00");
    const label = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const order = ["word", "sense", "type", "level", "ipa", "definition", "example", "arabic"];
    const rows = words.map((w) => "  { " + order.filter((k) => k !== "sense" || w.sense)
      .map((k) => k + ": " + JSON.stringify(w[k] || "")).join(", ") + " },");
    return `/* Word set for ${label} — ${words.length} words.
   Content only. Each word: word, sense (optional, tells two meanings apart),
   type, level (CEFR A1–C2), ipa, definition, example, arabic (Egyptian).
   After editing, run: python3 tools/build.py */
VS.addDay("${iso}", [
${rows.join("\n")}
]);
`;
  }

  /**
   * Optional: fill an empty definition / IPA from the free dictionary at
   * dictionaryapi.dev. Only the English word is sent. Resolves to the
   * number of words that got something new.
   */
  async function fillFromDictionary(words, onProgress) {
    let filled = 0, done = 0;
    const todo = words.filter((w) => w.word && (!w.definition || !w.ipa));
    const worker = async () => {
      while (todo.length) {
        const w = todo.shift();
        try {
          const res = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(w.word.toLowerCase()));
          if (res.ok) {
            const [entry] = await res.json();
            const ipa = entry.phonetic || (entry.phonetics || []).map((p) => p.text).find(Boolean);
            const def = (entry.meanings || []).flatMap((m) => m.definitions || []).map((d) => d.definition).find(Boolean);
            let got = false;
            if (!w.ipa && ipa) { w.ipa = ipa.startsWith("/") ? ipa : "/" + ipa + "/"; got = true; }
            if (!w.definition && def) { w.definition = def; got = true; }
            if (got) { filled++; w.issues = w.issues.filter((i) => !/no (IPA|definition)/.test(i.text)); w.issues.push({ kind: "info", text: "filled from the dictionary" }); }
          }
        } catch (e) { /* offline or not found: leave it empty */ }
        done++;
        if (onProgress) onProgress(done, done + todo.length);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    return filled;
  }

  VS.importer = { parse, parseDataFile, checkWord, toDataFile, fillFromDictionary, FIELDS, LEVELS, TYPES };
})();
