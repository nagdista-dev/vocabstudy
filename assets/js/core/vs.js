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
    days: [],      // [{ iso, date, label, words: [...] }] sorted newest first
    byId: {},      // word id → word
    views: {},     // screen name → view object (see views/*.js)
  });

  /* ── Data ─────────────────────────────────────────────────────── */

  /** Called by every data/days/*.js file — and by sets added in the app
      (`custom: true`, saved in this browser by core/store.js). Adding to a
      date that already exists merges the words; duplicates are skipped. */
  VS.addDay = function (iso, words, options) {
    const date = new Date(iso + "T12:00:00");
    let day = VS.day(iso);
    if (!day) {
      day = {
        iso,
        date,
        label: date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        weekday: date.toLocaleDateString("en-GB", { weekday: "long" }),
        words: [],
        custom: false,     // true when every word came from the in-app importer
        built: false,      // true when the day has its own days/*.html page
      };
      VS.days.push(day);
      VS.days.sort((a, b) => (a.iso < b.iso ? 1 : -1));
    }
    if (options && options.title) { day.label = options.title; day.weekday = "Sample set"; day.sample = true; }
    const custom = !!(options && options.custom);
    if (!custom) day.built = true;
    day.custom = !day.built;
    words.forEach((w) => {
      // The id survives edits to the definition/example, so progress is kept.
      const id = iso + ":" + (w.word + (w.sense ? " (" + w.sense + ")" : "")).toLowerCase();
      const word = Object.assign({ sense: "" }, w, { id, day: iso });
      // "Habit (N)": the sense only repeats the word type, which a badge already shows.
      if (/^(n|v|adj|adv|noun|verb|adjective|adverb)\.?$/i.test(word.sense)) word.sense = "";
      if (VS.byId[id]) return;                     // already in this day
      word.custom = custom;
      word.definition = word.definition || "";
      word.ipa = word.ipa || "";
      day.words.push(word);
      VS.byId[id] = word;
    });
  };

  VS.day = (iso) => VS.days.find((d) => d.iso === iso) || null;
  VS.allWords = () => VS.days.flatMap((d) => d.words);

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
