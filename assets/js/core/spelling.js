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
     VS.spelling.chooseEnglish(ar, el) → Arabic typed in an add box: the
                                     English words for it, picked under el
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;

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
    const data = await VS.google.json({ sl: "en", tl: "ar", dt: ["t", "qca"], q: text }, TIMEOUT);
    const fix = data && data.spell && data.spell.spell_res;
    return fix ? String(fix).trim() : "";
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
    if (o.cleanup) o.cleanup();
    o.box.remove();
    // Cancelling returns the learner to the box they were in, not to <body>.
    if (value == null && o.back && o.back.isConnected) {
      try { o.back.focus({ preventScroll: true }); } catch (e) { /* the screen changed under it */ }
    }
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
      // The right spelling may already be in the library: open it instead of adding it twice.
      const have = VS.findWord(fix);
      box.innerHTML = String(have
        ? html`
          <p class="spell-check-q">${icon("bulb", "icon-sm")}<span>Did you mean <b>${fix}</b>? It's already in your library.</span></p>
          <div class="spell-check-actions">
            <button class="btn btn-primary" type="button" data-pick="open">Open “${have.word}”</button>
            <button class="btn btn-quiet" type="button" data-pick="keep">Keep “${typed}”</button>
          </div>`
        : html`
          <p class="spell-check-q">${icon("bulb", "icon-sm")}<span>Did you mean <b>${fix}</b>?</span></p>
          <div class="spell-check-actions">
            <button class="btn btn-primary" type="button" data-pick="fix">Add “${fix}”</button>
            <button class="btn btn-quiet" type="button" data-pick="keep">Keep “${typed}”</button>
          </div>`);
      box.addEventListener("click", (e) => {
        const b = e.target.closest("[data-pick]");
        if (!b) return;
        e.stopPropagation();
        if (b.dataset.pick === "open") { close(null); openWord(have); return; }
        if (b.dataset.pick === "keep") keptWords.add(typed.toLowerCase());
        close(b.dataset.pick === "fix" ? fix : typed);
      });
      anchor.after(box);
      open = { typed, resolve, box };
      const first = box.querySelector("[data-pick='fix']");
      if (first) first.focus({ preventScroll: true });
    });
  }

  /* ── Arabic in the add box: find the English word ──────────────
     A learner often knows the word in Arabic and wants the English one
     («تحدي» → challenge). The app's interface stays English and the word
     saved is English — Arabic is only the way in. Google's translation
     comes first; its dictionary adds a few more, each with the Arabic it
     means, so the learner can tell "plane" from "pilot" (طيار) or see that
     «حالياً» is currently, not actually. Only the Arabic text is sent. */
  const ARTICLE = /^(?:a|an|the|to)\s+/i;
  async function english(text) {
    const data = await VS.google.json({ sl: "ar", tl: "en", dt: ["t", "bd"], q: text }, 6000);
    const out = [];
    const add = (word, hint) => {
      const w = String(word || "").replace(/[.!?]+$/, "").trim().replace(ARTICLE, "");
      if (!w || /[^A-Za-z' -]/.test(w) || w.split(/\s+/).length > 4) return;
      const lw = w.charAt(0) === w.charAt(0).toUpperCase() && w.slice(1) === w.slice(1).toLowerCase() ? w.toLowerCase() : w;
      if (!out.some((o) => o.word.toLowerCase() === lw.toLowerCase())) out.push({ word: lw, hint: hint || "" });
    };
    add((data.sentences || []).map((x) => x.trans || "").join(""), "");
    (data.dict || []).forEach((d) => (d.entry || []).forEach((e) => {
      if ((e.score || 0) >= 0.001) add(e.word, (e.reverse_translation || []).slice(0, 3).join("، "));
    }));
    return out.slice(0, 4);
  }

  /**
   * Arabic typed in an add box → resolve with the English word picked, or
   * null. Offline (or auto-fill off): a toast, as before.
   */
  async function chooseEnglish(text, anchor) {
    const ar = String(text || "").trim();
    close(null);
    if (!VS.autofill.enabled() || !navigator.onLine) {
      VS.toast(!VS.autofill.enabled()
        ? "That's Arabic. Finding the English word needs Auto-fill — turn it on in Settings, or type it in English."
        : "That's Arabic. Finding the English word needs the internet — type it in English for now.");
      return null;
    }
    if (checking === ar) return null;
    checking = ar;
    let list = [], failed = false;
    // The keyboard may just be left on Arabic: "شؤفعشممغ" is "actually" typed on the Arabic layout.
    const keys = VS.fromArabicKeys(ar);
    const typo = /^[a-z' -]{3,}$/i.test(keys) && keys.split(/\s+/).every((t) => known(t)) ? keys : "";
    try { list = await english(ar); } catch (e) { failed = !typo; } finally { checking = ""; }
    if (typo) list = [{ word: typo, hint: "", keys: true }].concat(list.filter((o) => o.word.toLowerCase() !== typo.toLowerCase()));
    if (failed) {
      VS.toast(VS.google.status() === "paused"
        ? "The translation service is busy. Try again in a few minutes — or type the word in English."
        : "Couldn't reach the translation service. Try again — or type the word in English.");
      return null;
    }
    if (!list.length) {
      VS.toast(ar.split(/\s+/).length > 3
        ? "No single English word found for that. For a whole text, use Add words → From Arabic."
        : "No English word found for that. Try another Arabic word — or type it in English.");
      return null;
    }
    if (!anchor || !anchor.isConnected) return null;
    return new Promise((resolve) => {
      const box = document.createElement("div");
      box.className = "spell-check ar-pick";
      box.setAttribute("role", "group");
      box.setAttribute("aria-labelledby", "arPickQ");
      box.innerHTML = String(html`
        <div class="ar-pick-top">
          <p class="spell-check-q" id="arPickQ">${icon("book", "icon-sm")}<span><bdi lang="ar" dir="rtl">${ar}</bdi> in English — which one do you mean?</span></p>
          <button class="icon-btn ar-pick-close" type="button" data-pick="cancel" aria-label="Close">${icon("x")}</button>
        </div>
        <div class="ar-pick-list">
          ${list.map((o, i) => html`<button class="ar-pick-opt ${i ? "" : "is-first"}" type="button" data-pick="${i}">
            <b>${o.word}</b>${o.keys ? html`<small class="ar-pick-have">Your keyboard was in Arabic</small>` : ""}${VS.findWord(o.word) ? html`<small class="ar-pick-have">In your library</small>` : ""}${o.hint ? html`<bdi lang="ar" dir="rtl">${o.hint}</bdi>` : ""}</button>`)}
        </div>
        <p class="hint">Not here? Close this and type it in English.</p>`);
      const back = document.activeElement;
      let cleanup = null;
      box.addEventListener("click", (e) => {
        const b = e.target.closest("[data-pick]");
        if (!b) return;
        e.stopPropagation();
        if (b.dataset.pick === "cancel") { close(null); return; }
        const pick = list[Number(b.dataset.pick)].word;
        // Already in the library: open it rather than "already in your library" after the tap.
        const have = VS.findWord(pick);
        if (have) { close(null); openWord(have); return; }
        close(pick);
      });
      anchor.after(box);
      // The "Arabic? Press Add" note has done its job: the choices replace it.
      const warn = anchor.parentElement && anchor.parentElement.querySelector(":scope > .kb-warn");
      if (warn) warn.hidden = true;
      // Escape or a tap anywhere else closes it, with no word saved.
      const onKey = (ev) => { if (ev.key === "Escape") { ev.preventDefault(); close(null); } };
      const onDown = (ev) => { if (!box.contains(ev.target)) close(null); };
      document.addEventListener("keydown", onKey);
      document.addEventListener("pointerdown", onDown, true);
      cleanup = () => {
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("pointerdown", onDown, true);
      };
      open = { typed: ar, resolve, box, back, cleanup };
      const first = box.querySelector(".ar-pick-opt");
      if (first) first.focus({ preventScroll: true });
    });
  }

  /** Show a word that's already in the library: its search, with its card open. */
  function openWord(w) {
    const hash = "#/words?q=" + encodeURIComponent(w.word);
    const show = () => setTimeout(() => VS.openWordCard(w.id), 60);
    if (location.hash === hash) { VS.app.render(); show(); }
    else { window.addEventListener("hashchange", show, { once: true }); location.hash = hash; }
  }

  // Leaving the screen (or typing something else) closes the question.
  window.addEventListener("hashchange", () => close(null));

  VS.spelling = { known, local, suggest, confirm, chooseEnglish, english, isOpen: () => !!open, cancel: () => close(null),
                  kept: (word) => keptWords.has(String(word || "").trim().toLowerCase()) };
})();
