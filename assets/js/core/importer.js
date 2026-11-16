/* core/importer.js — turn a pasted table into words.
   ------------------------------------------------------------------
   Accepts what people actually paste: a table copied from Excel,
   Google Sheets or Notion (tab-separated), or CSV, or ";" / "|"
   separated text. Column names are matched loosely, so "file name",
   "term" or "word" all mean the headword, "category" or "pos" the type.

     VS.importer.parse(text) → { rows: [{ word, …, issues: [] }], columns, delimiter }
     VS.importer.checkWord(word)    → the word cleaned, with its issues

   Only the word is required. Empty fields are left empty on purpose:
   auto-fill (core/autofill.js) completes them after saving.

   Without a header row, columns are read in this order:
     word, definition, example, type, level, ipa, arabic
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  const FIELDS = ["word", "definition", "example", "type", "level", "ipa", "arabic", "tags", "synonyms", "context", "source"];
  const ALIASES = {
    word: ["word", "filename", "file", "name", "term", "headword", "vocab", "vocabulary", "english", "phrase", "expression"],
    sense: ["sense", "meaningnote"],
    definition: ["definition", "def", "meaning", "explanation", "englishmeaning", "description"],
    example: ["example", "examples", "sentence", "examplesentence", "usage"],
    type: ["type", "category", "pos", "partofspeech", "class", "wordtype", "kind"],
    level: ["level", "cefr", "difficulty"],
    ipa: ["ipa", "pronunciation", "phonetic", "phonetics", "transcription"],
    arabic: ["arabic", "ar", "translation", "arabicmeaning", "meaningar", "عربي", "المعنى", "الترجمة"],
    tags: ["tags", "tag", "labels", "label", "group", "list", "topic"],
    synonyms: ["synonyms", "synonym", "similar", "similarwords"],
    context: ["context", "wheremet", "whereimetit", "sentenceimet", "metin", "originalsentence"],
    source: ["source", "from", "where"],
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

  const blank = () => ({ word: "", sense: "", definition: "", example: "", type: "", level: "", ipa: "", arabic: "", tags: "", synonyms: "", context: "", source: "" });

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
      else if (w.level) { issues.push({ kind: "warn", text: `level “${w.level}” isn't A1–C2 — it's left empty` }); w.level = ""; }

      const rawType = w.type;
      if (rawType) {
        w.type = normaliseType(rawType, w.word);
        if (rawType.toLowerCase() !== w.type.toLowerCase()) issues.push({ kind: "warn", text: `type “${rawType}” → ${w.type}` });
      }

      if (w.ipa && !/^\/.*\/$|^\[.*\]$/.test(w.ipa)) w.ipa = "/" + w.ipa.replace(/^\/|\/$/g, "") + "/";

      if (!w.word) issues.push({ kind: "error", text: "no word" });
      else if (VS.isArabicTyping(w.word)) issues.push({ kind: "error", text: "the word is in Arabic letters" });
      const missing = ["arabic", "definition", "example", "ipa"].filter((k) => !w[k]);
      if (w.word && missing.length) {
        issues.push(VS.autofill && VS.autofill.enabled()
          ? { kind: "info", text: "auto-fill: " + missing.map((k) => (k === "ipa" ? "IPA" : k)).join(", ") }
          : { kind: "warn", text: "no " + missing.map((k) => (k === "ipa" ? "IPA" : k)).join(", ") });
      }
      return Object.assign(w, { line, issues });
  }

  VS.importer = { parse, checkWord, FIELDS, LEVELS, TYPES };
})();
