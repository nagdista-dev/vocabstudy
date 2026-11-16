/* core/frequency.js — how common is this word? So time goes where it pays.
   ------------------------------------------------------------------
   A learner who knows the 3,000 most used English words understands most
   of what they read and hear; a rare word may come up once a year. Both
   deserve a place in the library — but the learner should know which is
   which. The list (assets/data/frequency.js, from wordfreq, CC BY-SA 4.0,
   written by tools/frequency.py) ships with the app: nothing is looked up.

   A word counts with its family: "borrow" is as common as the most common
   of borrow / borrows / borrowed / borrowing. Phrases ("give up") have no
   reliable count, so they get no band.

     VS.frequency.load()     → loads the list after the app has started
     VS.frequency.rank(word) → 0-based rank, or Infinity (rare / unknown)
     VS.frequency.band(word) → { level 0–5, label, line } or null
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  const BANDS = [
    { below: 1000, level: 5, label: "Top 1,000", line: "One of the 1,000 most used words in English — learn it until it comes without thinking." },
    { below: 3000, level: 4, label: "Top 3,000", line: "Very common: you'll meet it every week. Worth learning really well." },
    { below: 6000, level: 3, label: "Top 6,000", line: "Common in series, news and books." },
    { below: 12000, level: 2, label: "Top 12,000", line: "Less common — a strong word for reading, work and IELTS." },
    { below: 30000, level: 1, label: "Uncommon", line: "You'll meet it now and then. Learn it after the common ones." },
    { below: Infinity, level: 0, label: "Rare", line: "Rare: you'll seldom meet it. Keep it if you need it — but don't let it slow you down." },
  ];

  let ranks = null;          // word → rank
  let loading = null;

  /** Every form a word may be counted under: borrow → borrows, borrowed, borrowing… and back. */
  function forms(word) {
    const w = word.toLowerCase();
    const out = new Set([w, w + "s", w + "es", w + "ed", w + "d", w + "ing"]);    // inflections only: "slowly" is another word
    if (/e$/.test(w)) out.add(w.slice(0, -1) + "ing");
    if (/[^aeiou]y$/.test(w)) { out.add(w.slice(0, -1) + "ies"); out.add(w.slice(0, -1) + "ied"); }
    if (/[^aeiou][aeiou][bdgmnprt]$/.test(w)) { out.add(w + w.slice(-1) + "ed"); out.add(w + w.slice(-1) + "ing"); }
    (VS.IRREGULAR[w] || []).forEach((f) => out.add(f));
    // A word typed in one of its forms ("postponed") still finds its family.
    [[/ies$/, "y"], [/ied$/, "y"], [/(?:es|s)$/, ""], [/ed$/, ""], [/d$/, ""], [/ing$/, ""], [/ing$/, "e"]]
      .forEach(([re, to]) => { if (re.test(w) && w.length > 4) out.add(w.replace(re, to)); });
    return out;
  }

  VS.frequency = {
    get ready() { return !!ranks; },

    /** Load the list in the background; resolves when it's ready (or failed quietly). */
    load() {
      if (!loading) {
        loading = VS.loadScript("assets/data/frequency.js", "VS_FREQ").then((list) => {
          ranks = new Map();
          String(list).split(" ").forEach((w, i) => { if (!ranks.has(w)) ranks.set(w, i); });
          delete window.VS_FREQ;                  // the Map is all we need
        }).catch(() => { loading = null; });
      }
      return loading;
    },

    rank(word) {
      if (!ranks || !word || /\s/.test(String(word).trim())) return Infinity;
      let best = Infinity;
      forms(String(word).trim()).forEach((f) => { const r = ranks.get(f); if (r !== undefined && r < best) best = r; });
      return best;
    },

    band(w) {
      const word = typeof w === "string" ? w : w && w.word;
      if (!ranks || !word || /\s/.test(word.trim())) return null;
      const r = this.rank(word);
      return Object.assign({ rank: r }, BANDS.find((b) => r < b.below) || BANDS[BANDS.length - 1]);
    },

    BANDS,
  };
})();
