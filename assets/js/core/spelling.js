/* core/spelling.js — "Did you mean receive?" before a typo becomes a lesson.
   ------------------------------------------------------------------
   Everything the app teaches is built on the word as it was typed: the
   quiz, Spell, Use it and Recall all treat it as the right answer. So a
   word typed as "recieve" would be taught as "recieve", and the learner
   who later writes "receive" would be told they are wrong. One typo at
   the door becomes five wrong lessons. This file stops it at the door.

   A word is checked only when it isn't one of the 30,000 most used words
   (assets/data/frequency.js): common words go straight in, as fast as
   before. For the rest:
     online   Google's spelling correction (the same free endpoint as
              auto-fill, only the typed word is sent): it corrects
              "recieve", "acheive", "wierd" and leaves real words alone
     offline  the closest common word, by edit distance: one letter
              changed, added, dropped or two swapped ("ie" ↔ "ei")

   It only ever suggests. "Keep it as typed" is always one tap away: rare
   words, names and slang are real words too.

     VS.spelling.known(word)       → in the common-words list?
     VS.spelling.local(text)       → nearest common spelling, or "" (sync)
     VS.spelling.suggest(text)     → Promise of a better spelling, or ""
     VS.spelling.confirm(text, el) → Promise of the word to add, or null
                                     (shows "Did you mean …?" under el)
     VS.spelling.kept(word)        → did the learner choose "Keep" for it?
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;

  const GOOGLE = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dj=1&dt=t&dt=qca&q=";
  const TIMEOUT = 2500;            // a slow answer must not hold up adding a word
  const tokens = (text) => String(text || "").toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [];

  /** In the common-words list (or one of its forms: "postponed", "studies")? */
  function known(word) {
    const w = String(word || "").toLowerCase();
    if (w.length < 3 || !VS.frequency.ready) return true;          // too short to judge, or list not loaded
    return VS.frequency.rank(w) !== Infinity;
  }

  /** Optimal string alignment distance, stopping early above `max`. */
  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      let best = Infinity;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        best = Math.min(best, d[i][j]);
      }
      if (best > max) return max + 1;
    }
    return d[a.length][b.length];
  }

  /** The nearest common word to one unknown word, or "". */
  function nearest(word) {
    const list = VS.frequency.words();
    if (!list) return "";
    const max = word.length <= 4 ? 1 : 2;
    let best = "", bestD = max + 1, bestRank = Infinity;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c[0] !== word[0] && c[1] !== word[1]) continue;            // typos rarely change both first letters
      const dd = distance(word, c, Math.min(max, bestD));
      if (dd < bestD || (dd === bestD && i < bestRank)) { best = c; bestD = dd; bestRank = i; }
    }
    return bestD <= max ? best : "";
  }

  /** Offline: every unknown word in the text swapped for its nearest common word. */
  function local(text) {
    const t = String(text || "").trim();
    let changed = false;
    const out = t.replace(/[A-Za-z]+(?:'[A-Za-z]+)?/g, (w) => {
      if (known(w)) return w;
      const n = nearest(w.toLowerCase());
      if (!n) return w;
      changed = true;
      return w[0] === w[0].toUpperCase() ? n[0].toUpperCase() + n.slice(1) : n;
    });
    return changed ? out : "";
  }

  async function google(text) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const res = await fetch(GOOGLE + encodeURIComponent(text), { signal: ctrl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const fix = data && data.spell && data.spell.spell_res;
      return fix ? String(fix).trim() : "";
    } finally {
      clearTimeout(timer);
    }
  }

  /** A better spelling for a word or phrase, or "" when it looks right. */
  async function suggest(text) {
    const t = String(text || "").trim();
    if (!t) return "";
    await VS.frequency.load();
    if (tokens(t).every(known)) return "";
    if (VS.autofill.enabled() && navigator.onLine) {
      try {
        const fix = await google(t);
        return fix && fix.toLowerCase() !== t.toLowerCase() ? fix : "";
      } catch (e) { /* slow or blocked: fall back to the local list */ }
    }
    return local(t);
  }

  /* ── The question under the add box ──────────────────────────── */

  let open = null;           // { typed, resolve, box }
  let checking = "";         // the word being checked right now
  const keptWords = new Set(); // "Keep it as typed": auto-fill won't ask again

  function close(value) {
    if (!open) return;
    const o = open;
    open = null;
    o.box.remove();
    o.resolve(value);
  }

  /**
   * Check `text` and resolve with the word to add: the text itself, the
   * suggestion the learner picked, or null if they closed the question.
   * Pressing Add again with the same text keeps it as typed.
   */
  async function confirm(text, anchor) {
    const typed = String(text || "").trim();
    if (open && open.typed === typed) { keptWords.add(typed.toLowerCase()); close(typed); return null; }   // the second Add is the "keep"
    if (checking === typed) return null;                               // still checking: one press is enough
    close(null);
    checking = typed;
    let fix = "";
    try { fix = await suggest(typed); } finally { checking = ""; }
    if (!fix || !anchor || !anchor.isConnected) return typed;
    return new Promise((resolve) => {
      const box = document.createElement("div");
      box.className = "spell-check";
      box.setAttribute("role", "alert");
      box.innerHTML = String(html`
        <p class="spell-check-q">${icon("bulb", "icon-sm")}<span>Did you mean <b>${fix}</b>?</span></p>
        <div class="spell-check-actions">
          <button class="btn btn-primary" type="button" data-pick="fix">Add “${fix}”</button>
          <button class="btn btn-quiet" type="button" data-pick="keep">Keep “${typed}”</button>
        </div>`);
      box.addEventListener("click", (e) => {
        const b = e.target.closest("[data-pick]");
        if (!b) return;
        e.stopPropagation();
        if (b.dataset.pick === "keep") keptWords.add(typed.toLowerCase());
        close(b.dataset.pick === "fix" ? fix : typed);
      });
      anchor.after(box);
      open = { typed, resolve, box };
      const first = box.querySelector("[data-pick='fix']");
      if (first) first.focus({ preventScroll: true });
    });
  }

  // Leaving the screen (or typing something else) closes the question.
  window.addEventListener("hashchange", () => close(null));

  VS.spelling = { known, local, suggest, confirm, isOpen: () => !!open, cancel: () => close(null),
                  kept: (word) => keptWords.has(String(word || "").trim().toLowerCase()) };
})();
