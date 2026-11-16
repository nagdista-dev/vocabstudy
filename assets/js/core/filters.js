/* core/filters.js — the library's brain: filter and sort any words.
   ------------------------------------------------------------------
   One filter object describes a list of words:

     { q, status, level, type, box, added, tag, note, tricky, trap, usage, sort }

   It lives in the address bar ("#/words?status=learning&tag=IELTS"), so a
   filtered list can be bookmarked, reopened, and handed to any activity:
   "#/pick/quiz?status=learning&tag=IELTS" quizzes exactly that list.

     VS.filters.parse(query)      → filter object (defaults filled in)
     VS.filters.query(f)          → "status=learning&tag=IELTS" (defaults left out)
     VS.filters.apply(words, f)   → the matching words, sorted
     VS.filters.describe(f)       → "Learning · #IELTS" — a short name for the list
     VS.filters.active(f)         → how many filters are on (search and sort don't count)

   Pure functions: no screen code here, so practice.js, print.js and the
   library all agree on what a filter means.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  const DEFAULTS = { q: "", status: "all", level: "all", type: "all", box: "all",
                     added: "all", tag: "all", note: "", tricky: "", trap: "", usage: "", sort: "newest" };

  const STATUS = { all: "All", new: "New", learning: "Learning", mastered: "Mastered", due: "Due today", started: "Started" };
  const ADDED = { all: "Any time", today: "Today", week: "This week", month: "This month", older: "Older" };
  const SORTS = {
    az: "A–Z", za: "Z–A", newest: "Newest added", oldest: "Oldest added",
    weakest: "Weakest first", due: "Due soonest", missed: "Most mistakes", level: "Level",
  };
  const BOXES = ["New", "1 day", "3 days", "1 week", "2 weeks", "1 month", "2 months"];
  const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

  function parse(query) {
    const f = Object.assign({}, DEFAULTS);
    new URLSearchParams(String(query || "").replace(/^\?/, "")).forEach((v, k) => {
      if (k in DEFAULTS) f[k] = v;
    });
    return f;
  }

  function query(f) {
    const p = new URLSearchParams();
    Object.keys(DEFAULTS).forEach((k) => { if (f[k] && f[k] !== DEFAULTS[k]) p.set(k, f[k]); });
    return p.toString();
  }

  const active = (f) => Object.keys(DEFAULTS).filter((k) => k !== "q" && k !== "sort" && f[k] && f[k] !== DEFAULTS[k]).length;

  /** Calendar boundaries for "added": local dates as YYYY-MM-DD strings compare correctly. */
  function since(added) {
    const d = new Date();
    if (added === "today") return VS.todayKey();
    if (added === "week") return VS.dateKey(new Date(d.getTime() - 6 * 864e5));
    if (added === "month") return VS.dateKey(new Date(d.getTime() - 29 * 864e5));
    return "";
  }

  function apply(words, f) {
    const store = VS.store;
    const q = f.q.trim().toLowerCase();
    const from = since(f.added);
    const older = VS.dateKey(new Date(Date.now() - 29 * 864e5));
    const tricky = f.tricky ? new Set(store.trickyWords().map((w) => w.id)) : null;
    const out = words.filter((w) => {
      const e = store.word(w.id);
      const status = store.status(w.id);
      if (f.status === "due" ? !store.isDue(w.id) : f.status === "started" ? e.box === 0 : f.status !== "all" && status !== f.status) return false;
      if (f.level === "none" ? w.level : f.level !== "all" && (f.level.length === 1 ? w.level.charAt(0) !== f.level : w.level !== f.level)) return false;
      if (f.type !== "all" && w.type !== f.type) return false;
      if (f.box !== "all" && String(e.box) !== f.box) return false;
      if (f.added === "older" ? w.added >= older : from && w.added < from) return false;
      if (f.tag === "none" ? w.tags.length : f.tag !== "all" && !w.tags.includes(f.tag)) return false;
      if (f.note && !store.note(w.id)) return false;
      if (tricky && !tricky.has(w.id)) return false;
      if (f.trap && !VS.soundTraps(w).length) return false;
      if (f.usage && !VS.usageTraps(w).length) return false;
      if (!q) return true;
      return (w.word + " " + w.sense + " " + w.arabic + " " + w.definition + " " + w.example + " " +
              w.tags.join(" ") + " " + store.note(w.id)).toLowerCase().includes(q);
    });
    return out.sort(comparer(f.sort));
  }

  function comparer(sort) {
    const store = VS.store;
    const az = (a, b) => a.word.localeCompare(b.word);
    switch (sort) {
      case "za": return (a, b) => -az(a, b);
      case "newest": return (a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : az(a, b));
      case "oldest": return (a, b) => (a.added < b.added ? -1 : a.added > b.added ? 1 : az(a, b));
      case "weakest": return (a, b) => store.strength(a.id) - store.strength(b.id) || az(a, b);
      case "due": return (a, b) => {
        const da = store.word(a.id).due || "9999", db = store.word(b.id).due || "9999";
        return da < db ? -1 : da > db ? 1 : az(a, b);
      };
      case "missed": return (a, b) => store.word(b.id).wrong - store.word(a.id).wrong || az(a, b);
      case "level": return (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || az(a, b);
      default: return az;
    }
  }

  /** A short human name for a filtered list, used as the activity title. */
  function describe(f) {
    const parts = [];
    if (f.status !== "all") parts.push(STATUS[f.status]);
    if (f.level === "none") parts.push("No level");
    else if (f.level !== "all") parts.push(f.level.length === 1 ? f.level + "1–" + f.level + "2" : f.level);
    if (f.type !== "all") parts.push(f.type + "s");
    if (f.box !== "all") parts.push("Box " + f.box);
    if (f.added !== "all") parts.push("Added " + ADDED[f.added].toLowerCase());
    if (f.tag === "none") parts.push("No tag");
    else if (f.tag !== "all") parts.push("#" + f.tag);
    if (f.note) parts.push("With notes");
    if (f.tricky) parts.push("Tricky");
    if (f.trap) parts.push("Sound traps");
    if (f.usage) parts.push("Usage traps");
    if (f.q.trim()) parts.push("“" + f.q.trim() + "”");
    return parts.join(" · ");
  }

  VS.filters = { DEFAULTS, STATUS, ADDED, SORTS, BOXES, parse, query, apply, describe, active };
})();
