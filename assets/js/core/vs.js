/* core/vs.js — the app namespace, the word registry and tiny helpers.
   ------------------------------------------------------------------
   Why one global (window.VS)? The site must open with a double-click
   (file://), where ES modules are blocked by the browser. Classic
   scripts + one namespace keep it working everywhere, and every
   shared thing has exactly one name: VS.something.

   Load order (see index.html): core/* → views/* → app.js.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  const VS = (window.VS = {
    words: [],     // the library: every word once, in the order it was added
    byId: {},      // word id → word
    views: {},     // screen name → view object (see views/*.js)
  });

  /* ── The word library ───────────────────────────────────────────
     There are no "days" or sets: every word lives once in one library.
     A word's id is the word itself (plus its sense when it has two
     meanings): "borrow", "axe (tool)". So the same word can't be added
     twice, and progress belongs to the word, not to when it was added.

     Each word: { id, word, sense, type, level, ipa, definition, example,
                  arabic, tags: [], added: "YYYY-MM-DD", source, custom }
       source  "starter" — the built-in Starter set (data/sample/)
               "mine"    — added by the learner (saved by core/store.js)
       custom  true for "mine": only your own words can be edited/deleted. */

  /** The id of a word: lower case, single spaces, curly quotes straightened. */
  VS.wordKey = (word, sense) =>
    (String(word || "").trim() + (sense ? " (" + String(sense).trim() + ")" : ""))
      .toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");

  /**
   * Put words in the library. Returns { added: [...], skipped: [...] }:
   * a word already in the library is skipped, never duplicated — except
   * that your own version of a word replaces the Starter one.
   */
  VS.addWords = function (list, options) {
    const o = options || {};
    const source = o.source || "mine";
    const out = { added: [], skipped: [] };
    (list || []).forEach((raw) => {
      if (!raw || !raw.word) return;
      const w = Object.assign({ sense: "" }, raw);
      // Type and level get display defaults below; remember whether they were
      // really given, so the store saves only those and auto-fill can fill the rest.
      Object.defineProperty(w, "given", { value: { type: !!raw.type, level: !!raw.level }, enumerable: false });
      // "Habit (N)": the sense only repeats the word type, which a badge already shows.
      if (/^(n|v|adj|adv|noun|verb|adjective|adverb)\.?$/i.test(w.sense)) w.sense = "";
      w.word = VS.naturalCase(String(w.word).trim(), w.example);
      w.id = VS.wordKey(w.word, w.sense);
      w.definition = w.definition || "";
      w.example = w.example || "";
      w.ipa = w.ipa || "";
      w.arabic = w.arabic || "";
      w.level = w.level || "B1";
      w.type = w.type || (/\s/.test(w.word) ? "Phrase" : "Noun");     // until auto-fill knows better
      w.tags = Array.isArray(w.tags) ? w.tags : VS.parseTags(w.tags);
      w.added = w.added || o.added || VS.todayKey();
      w.source = source;
      w.custom = source === "mine";
      const old = VS.byId[w.id];
      if (old && !(w.custom && old.source === "starter")) { out.skipped.push(w); return; }
      if (old) VS.words.splice(VS.words.indexOf(old), 1);      // your version wins over the Starter one
      VS.words.push(w);
      VS.byId[w.id] = w;
      out.added.push(w);
    });
    return out;
  };

  /** Take words out of the library (the store deletes them from storage). */
  VS.removeWords = function (ids) {
    const gone = new Set(ids);
    VS.words = VS.words.filter((w) => !gone.has(w.id));
    ids.forEach((id) => delete VS.byId[id]);
  };

  /** "IELTS, work;travel" → ["IELTS", "work", "travel"] — tags group words your way. */
  VS.parseTags = (text) => [...new Set(String(text || "").split(/[,;،#]+/).map((t) => t.trim()).filter(Boolean))].slice(0, 12);

  /** Every tag in the library, most used first → [{ tag, count }] */
  VS.allTags = function () {
    const n = {};
    VS.words.forEach((w) => w.tags.forEach((t) => { n[t] = (n[t] || 0) + 1; }));
    return Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b)).map((tag) => ({ tag, count: n[tag] }));
  };

  /** Show a headword the way it is written in a sentence: "Get Used To" →
      "get used to". Learners copy what they see, and Spell checks every
      letter. "I", acronyms and words the example capitalises mid-sentence (Monday,
      English) keep their capital. The id is lower case, so progress stays. */
  VS.naturalCase = function (text, example) {
    const ex = String(example || "");
    return String(text || "").replace(/[A-Za-z’']+/g, (t) => {
      if (t === "I" || !/^[A-Z][a-z’']*$/.test(t)) return t;        // I, TV, iPhone stay as written
      const mid = new RegExp("[^.!?\\s]\\s+" + t + "\\b").test(ex);
      return mid ? t : t.toLowerCase();
    });
  };

  VS.allWords = () => VS.words;

  /* ── HTML templating ─────────────────────────────────────────────
     html`<p>${text}</p>` escapes every value, so word data can never
     break the page. Wrap trusted markup in VS.raw() to skip escaping.
     Arrays are joined, so html`${items.map(renderItem)}` just works. */

  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  VS.escape = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ESC[c]);

  function Raw(s) { this.s = s; }
  Raw.prototype.toString = function () { return this.s; };
  VS.raw = (s) => new Raw(String(s));

  function piece(v) {
    if (v instanceof Raw) return v.s;
    if (Array.isArray(v)) return v.map(piece).join("");
    if (v === false || v == null) return "";
    return VS.escape(v);
  }
  VS.html = function (strings, ...values) {
    let out = strings[0];
    values.forEach((v, i) => { out += piece(v) + strings[i + 1]; });
    return new Raw(out);
  };

  /* ── Small utilities ──────────────────────────────────────────── */

  VS.$ = (sel, root) => (root || document).querySelector(sel);
  VS.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /** Fisher–Yates: an unbiased shuffle (sort(() => Math.random() - .5) is not). */
  VS.shuffle = function (list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  VS.sample = (list, n) => VS.shuffle(list).slice(0, n);

  VS.escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  VS.levelGroup = (level) => "lvl-" + String(level || "B").charAt(0).toLowerCase();

  VS.plural = (n, one, many) => n + " " + (n === 1 ? one : many || one + "s");

  /** Local calendar date as "YYYY-MM-DD" (local, not UTC: a late-night
      session in Cairo still counts for today). */
  VS.dateKey = (d) =>
    d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  VS.todayKey = () => VS.dateKey(new Date());
  VS.yesterdayKey = () => VS.dateKey(new Date(Date.now() - 864e5));

  VS.formatTime = function (ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };

  let toastTimer;
  VS.toast = function (message) {
    const el = VS.$("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 2200);
  };
})();
