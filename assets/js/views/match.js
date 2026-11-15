/* views/match.js — pair English words with their Arabic meanings.
   Two columns (English left, Arabic right) read more clearly than a
   shuffled grid. The clock starts on your first tap; every wrong pair
   counts as a miss for that word's recall schedule. */
(function () {
  "use strict";
  const { html, icon } = VS;
  const PAIRS = 6;
  const BOARDS = 3;

  let s = null;  // { scope, boards, board, en, ar, pick: {en, ar}, matched:Set, misses, missed:Set, start, elapsed, timer }

  function deal() {
    const words = s.boards[s.board];
    s.en = VS.shuffle(words);
    s.ar = VS.shuffle(words);
    s.pick = { en: null, ar: null };
    s.matched = new Set();
  }

  function tile(w, side) {
    const done = s.matched.has(w.id);
    const on = s.pick[side] === w.id;
    const fresh = s.lastMatch === w.id;
    return html`
      <button class="tile ${done ? "is-done" : ""} ${fresh ? "just-matched" : ""} ${on ? "is-on" : ""}" type="button" data-action="pick" data-side="${side}" data-id="${w.id}"
              ${done ? "disabled" : ""} aria-pressed="${on}">
        ${side === "ar" ? html`<span lang="ar">${w.arabic}</span>` : VS.ui.headword(w)}
      </button>`;
  }

  function tick() {
    const el = VS.$("#matchClock");
    if (el && s.start) el.textContent = VS.formatTime(Date.now() - s.start);
  }

  function finish() {
    clearInterval(s.timer);
    const key = "match:" + (s.scope.day ? s.scope.day.iso : "recall");
    const best = VS.store.setBest(key, s.elapsed);
    if (s.scope.day) VS.store.markDone(s.scope.day.iso, "match");
    const missed = [...s.missed].map((id) => VS.byId[id]);
    return VS.ui.summary({
      title: best ? "New best time" : "All pairs matched",
      message: best ? "Faster than ever on this set." : "Best time on this set: " + VS.formatTime(VS.store.best(key)) + ".",
      stats: [
        { value: VS.formatTime(s.elapsed), label: "time" },
        { value: s.boards.flat().length, label: "pairs", tone: "good" },
        { value: s.misses, label: "wrong taps", tone: s.misses ? "bad" : "" },
      ],
      words: missed,
      actions: [
        { href: s.scope.back, label: "Back to the set", primary: true },
        { action: "restart", label: "Play again" },
      ],
    });
  }

  VS.views.match = {
    title: () => "Match",
    crumbs: (p) => VS.ui.crumbs(p, "Match"),

    start(p) {
      const scope = VS.scope(p);
      if (s && s.timer) clearInterval(s.timer);
      const words = scope ? VS.sessionWords(scope.words, PAIRS * BOARDS) : [];
      const boards = [];
      for (let i = 0; i + 2 <= words.length && boards.length < BOARDS; i += PAIRS) boards.push(words.slice(i, i + PAIRS));
      s = { scope, boards, board: 0, misses: 0, missed: new Set(), start: 0, elapsed: 0, timer: null };
      if (boards.length) deal();
    },

    leave() { if (s && s.timer) clearInterval(s.timer); },

    render() {
      if (!s.scope || !s.boards.length) return VS.ui.emptyActivity("#/", "You need at least two words to play.");
      if (s.board >= s.boards.length) return html`<div class="activity">${finish()}</div>`;
      return html`
        <div class="activity activity-wide">
          ${VS.ui.activityHead({ back: s.scope.back, title: "Match · " + s.scope.title, index: s.board, total: s.boards.length })}
          <div class="match-bar">
            <span>${icon("clock", "icon-sm")} <b id="matchClock">${VS.formatTime(s.start ? Date.now() - s.start : 0)}</b></span>
            <span class="hint">${s.matched.size} / ${s.en.length} pairs · ${VS.plural(s.misses, "miss", "misses")}</span>
          </div>
          <p class="sr-only" aria-live="polite" id="matchLive"></p>
          <div class="match-grid">
            <div class="match-col">${s.en.map((w) => tile(w, "en"))}</div>
            <div class="match-col">${s.ar.map((w) => tile(w, "ar"))}</div>
          </div>
        </div>`;
    },

    actions: {
      pick(el) {
        const side = el.dataset.side;
        if (!s.start) { s.start = Date.now(); s.timer = setInterval(tick, 250); }
        s.pick[side] = s.pick[side] === el.dataset.id ? null : el.dataset.id;
        if (side === "en" && s.pick.en) VS.speech.auto(VS.byId[s.pick.en].word);

        if (s.pick.en && s.pick.ar) {
          const word = VS.byId[s.pick.en];
          if (s.pick.en === s.pick.ar) {
            s.matched.add(s.pick.en);
            VS.sfx.play("pop");
            s.lastMatch = s.pick.en;
            if (!s.missed.has(word.id)) VS.store.grade(word.id, "good");
          } else {
            s.misses++;
            VS.sfx.play("wrong");
            if (!s.missed.has(word.id)) { s.missed.add(word.id); VS.store.grade(word.id, "again"); }
            VS.app.render();
            VS.$$(".tile.is-on").forEach((t) => t.classList.add("is-wrong"));
            s.pick = { en: null, ar: null };
            setTimeout(() => { if (VS.app.current() === "match") VS.app.render(); }, 450);
            return;
          }
          s.pick = { en: null, ar: null };
          if (s.matched.size === s.en.length) {
            s.board++;
            if (s.board >= s.boards.length) s.elapsed = Date.now() - s.start;
            else deal();
          }
        }
        VS.app.render();
      },
      restart() { VS.views.match.start(VS.app.params()); VS.app.render(); },
    },
  };
})();
