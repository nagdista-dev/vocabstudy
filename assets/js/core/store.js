/* core/store.js — the learner's progress and settings, saved in localStorage.
   ------------------------------------------------------------------
   One object, one key, one place that writes it. Screens read and
   change progress only through VS.store — never localStorage directly.

   SPACED REPETITION (a Leitner system)
   Every word sits in a box 0–6. The box decides when you see it again:

       box:      1    2    3    4     5     6
       wait:   1 day 3 d  7 d  14 d  30 d  60 d

   • You get it right (and it was due) → it moves up one box.
   • You forget it                     → back to box 1, due tomorrow.
   • Right answers on a word that is not due yet are counted, but do
     not move it: cramming the same day should not fake long-term memory.

   Status shown to the learner:
       new       never studied             (box 0)
       learning  in boxes 1–3
       mastered  box 4+ (remembered after a two-week gap)
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  const KEY = "vocabstudy.v2";
  const WAIT_DAYS = [0, 1, 3, 7, 14, 30, 60];
  const MASTERED_BOX = 4;

  const DEFAULTS = {
    words: {},                                     // id → [box, due, right, wrong] (packed, see below)
    streak: { last: "", count: 0 },
    today: { date: "", answered: 0, right: 0, seconds: 0, newWords: 0, learned: [] },   // learned: ids first studied today
    done: {},                                      // "today:quiz" → date last finished
    notes: {},                                     // id → your own note / memory trick
    history: {},                                   // "2026-11-15" → [answered, right, seconds, newWords, mastered]
    library: [],                                   // your own words, oldest first (the Starter set is built in)
    lastBackup: "",                                // date of the last full backup download
    best: {},                                      // "match" → best time in ms
    settings: { sound: true, rate: 0.9, textScale: 1, roundSize: 20, breakEvery: 50, dailyGoal: 150, effects: true,
                accent: "blue", voice: "us", autoplay: true, cardFront: "en", newPerDay: 10, autofill: true, speak: true,
                quizTypes: ["meaning", "arabic", "english", "gap", "listen"], showSample: true },
  };

  const unpack = (p) => (Array.isArray(p) ? p : [p.box || 0, p.due || "", p.right || 0, p.wrong || 0]);

  /**
   * Bring older saves and backups up to date. Version 2 grouped words in
   * days ("userDays") and prefixed every id with the day: "2026-11-16:borrow".
   * Now there is one library and the id is the word. A word that was in two
   * days keeps the stronger memory and both notes, so nothing is lost.
   */
  function migrate(data) {
    if (!data || typeof data !== "object") return data;
    const key = (id) => String(id).replace(/^\d{4}-\d{2}-\d{2}:/, "").replace(/[’‘]/g, "'").replace(/\s+/g, " ");
    if (data.words && typeof data.words === "object") {
      const out = {};
      Object.entries(data.words).forEach(([id, p]) => {
        const k = key(id), a = unpack(p), b = out[k];
        if (!b) out[k] = a;
        else {
          const strong = a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]) ? a : b;
          out[k] = [strong[0], strong[1], a[2] + b[2], a[3] + b[3]];
        }
      });
      data.words = out;
    }
    if (data.notes && typeof data.notes === "object") {
      const out = {};
      Object.entries(data.notes).forEach(([id, n]) => {
        const k = key(id);
        out[k] = out[k] && out[k] !== n ? out[k] + " · " + n : n;
      });
      data.notes = out;
    }
    if (data.userDays && typeof data.userDays === "object") {
      const library = Array.isArray(data.library) ? data.library : [];
      const seen = new Set(library.map((w) => VS.wordKey(w.word, w.sense)));
      Object.keys(data.userDays).sort().forEach((iso) => (data.userDays[iso] || []).forEach((w) => {
        const k = VS.wordKey(w.word, w.sense);
        if (!w.word || seen.has(k)) return;
        seen.add(k);
        library.push(Object.assign({}, w, { added: w.added || iso }));
      }));
      data.library = library;
      delete data.userDays;
    }
    if (data.done) Object.keys(data.done).forEach((k) => { if (!/^today:/.test(k)) delete data.done[k]; });
    if (data.best) Object.keys(data.best).forEach((k) => { if (k.includes(":")) delete data.best[k]; });
    return data;
  }

  function load() {
    try {
      const saved = migrate(JSON.parse(localStorage.getItem(KEY) || "{}"));
      return Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), saved, {
        settings: Object.assign({}, DEFAULTS.settings, saved.settings),
      });
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  let state = load();
  const listeners = [];

  /* One compact row per study day: [answers, right, seconds, new words, mastered total].
     Kept for every day you study — the Stats screen draws from it. */
  function logToday() {
    const d = state.today;
    if (!d.date) return;
    const mastered = Object.values(state.words).filter((p) => (Array.isArray(p) ? p[0] : p.box) >= MASTERED_BOX).length;
    state.history[d.date] = [d.answered, d.right, d.seconds || 0, d.newWords || 0, mastered];
  }

  function save() {
    logToday();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private window: keep in memory */ }
    listeners.forEach((fn) => fn());
  }

  /* Each word is saved as a small array instead of an object:
     [2, "2026-11-18", 5, 1] is about half the size of
     {"box":2,"due":"2026-11-18","right":5,"wrong":1}. With thousands of
     words that keeps us far below the browser's ~5 MB storage limit. */
  function entry(id) {
    const p = state.words[id];
    if (!p) return { box: 0, due: "", right: 0, wrong: 0 };
    if (!Array.isArray(p)) return Object.assign({ box: 0, due: "", right: 0, wrong: 0 }, p);  // older saves
    return { box: p[0], due: p[1], right: p[2], wrong: p[3] };
  }
  const put = (id, e) => { state.words[id] = [e.box, e.due, e.right, e.wrong]; };
  const addDays = (n) => VS.dateKey(new Date(Date.now() + n * 864e5));
  const isDue = (e) => e.box > 0 && e.due <= VS.todayKey();

  function freshToday() {
    const today = VS.todayKey();
    if (state.today.date !== today) state.today = { date: today, answered: 0, right: 0, seconds: 0, newWords: 0, learned: [] };
    if (!Array.isArray(state.today.learned)) state.today.learned = [];
    return today;
  }

  /** Count today's activity and keep the daily streak. */
  function touchDay(correct) {
    const today = freshToday();
    state.today.answered++;
    if (correct) state.today.right++;
    if (state.streak.last !== today) {
      state.streak.count = state.streak.last === VS.yesterdayKey() ? state.streak.count + 1 : 1;
      state.streak.last = today;
    }
  }

  function statusOf(e) {
    if (e.box === 0) return "new";
    return e.box >= MASTERED_BOX ? "mastered" : "learning";
  }

  VS.store = {
    onChange(fn) { listeners.push(fn); },

    word: entry,
    status: (id) => statusOf(entry(id)),
    isDue: (id) => isDue(entry(id)),

    /**
     * The one function every activity calls after the learner answers.
     * grade: "again" (forgot / wrong) | "good" (right) | "easy" (knew it instantly)
     */
    grade(id, grade) {
      const e = Object.assign({}, entry(id));
      const correct = grade !== "again";
      touchDay(correct);
      if (e.box === 0) {
        state.today.newWords = (state.today.newWords || 0) + 1;
        if (!state.today.learned.includes(id)) state.today.learned.push(id);
      }
      if (!correct) {
        e.wrong++;
        e.box = 1;
        e.due = addDays(1);
      } else {
        e.right++;
        if (e.box === 0 || isDue(e)) {
          e.box = Math.min(6, e.box + (grade === "easy" ? 2 : 1));
          e.due = addDays(WAIT_DAYS[e.box]);
        }
      }
      put(id, e);
      save();
      return e;
    },

    /** Study history, oldest first → [{ date, answered, right, seconds, newWords, mastered }] */
    history: () => Object.keys(state.history).sort().map((date) => {
      const [answered, right, seconds, newWords, mastered] = state.history[date];
      return { date, answered, right, seconds, newWords, mastered };
    }),

    /** How many words sit in each box 0–6: the shape of your memory. */
    boxes() {
      const counts = [0, 0, 0, 0, 0, 0, 0];
      VS.allWords().forEach((w) => counts[entry(w.id).box]++);
      return counts;
    },

    /** Your own note for a word (a memory trick, a sentence about your life…). */
    note: (id) => state.notes[id] || "",
    setNote(id, text) {
      const clean = String(text || "").trim().slice(0, 500);
      if (clean) state.notes[id] = clean; else delete state.notes[id];
      save();
    },

    /** Put a word back to "new" (from the word list). */
    forget(id) { delete state.words[id]; save(); },

    /** Words to recall today, across every day, oldest due first. */
    dueWords(words) {
      return (words || VS.allWords())
        .filter((w) => isDue(entry(w.id)))
        .sort((a, b) => (entry(a.id).due < entry(b.id).due ? -1 : 1));
    },

    /** Words you keep missing (3+ wrong, not yet mastered): the most likely to be forgotten. */
    trickyWords: () => VS.allWords().filter((w) => {
      const e = entry(w.id);
      return e.wrong >= 3 && e.wrong > e.right / 2 && e.box < MASTERED_BOX;
    }),

    /** Due counts for today and the next 6 days → [{ date, count }]. Overdue words count as today. */
    forecast() {
      const out = [];
      for (let i = 0; i < 7; i++) out.push({ date: addDays(i), count: 0 });
      VS.allWords().forEach((w) => {
        const e = entry(w.id);
        if (!e.box) return;
        const slot = e.due <= out[0].date ? 0 : out.findIndex((d) => d.date === e.due);
        if (slot >= 0) out[slot].count++;
      });
      return out;
    },

    /** When is the next review after today? → { date, count } or null */
    nextReview() {
      const next = {};
      VS.allWords().forEach((w) => {
        const e = entry(w.id);
        if (e.box > 0 && e.due > VS.todayKey()) next[e.due] = (next[e.due] || 0) + 1;
      });
      const date = Object.keys(next).sort()[0];
      return date ? { date, count: next[date] } : null;
    },

    /** Counts for any list of words: new / learning / mastered / due, and % mastered. */
    statsFor(words) {
      const s = { total: words.length, new: 0, learning: 0, mastered: 0, due: 0 };
      words.forEach((w) => {
        const e = entry(w.id);
        s[statusOf(e)]++;
        if (isDue(e)) s.due++;
      });
      s.started = s.total - s.new;
      s.percent = s.total ? Math.round((s.mastered / s.total) * 100) : 0;
      return s;
    },

    totals() {
      const all = VS.allWords();
      const today = state.today.date === VS.todayKey() ? state.today : { answered: 0, right: 0, seconds: 0, newWords: 0 };
      const live = state.streak.last === VS.todayKey() || state.streak.last === VS.yesterdayKey();
      return {
        words: all.length,
        started: all.filter((w) => entry(w.id).box > 0).length,
        mastered: all.filter((w) => entry(w.id).box >= MASTERED_BOX).length,
        due: all.filter((w) => isDue(entry(w.id))).length,
        streak: live ? state.streak.count : 0,
        today,
        // Words first studied today that are still in the library (Practise today's words).
        learnedToday: (today.learned || []).filter((id) => VS.byId[id]),
      };
    },

    /** Was this step of today's plan finished today? ("learn", "quiz", "spell", "match", "speak") */
    doneToday: (mode) => state.done["today:" + mode] === VS.todayKey(),

    /** Words never studied, in the order you added them: your own words before the Starter set. */
    newWords() {
      return VS.allWords()
        .filter((w) => entry(w.id).box === 0)
        .sort((a, b) => (a.custom === b.custom ? (a.added < b.added ? -1 : a.added > b.added ? 1 : 0) : a.custom ? -1 : 1));
    },

    /** The strength of a word's memory, for "weakest first": wrong answers pull it down. */
    strength(id) {
      const e = entry(id);
      return e.box * 2 - e.wrong + (e.box === 0 ? 100 : 0);   // unstudied words count as strongest (nothing to lose yet)
    },

    /** Active study time, added by core/study-time.js. Saved quietly (no re-render). */
    addStudyTime(seconds) {
      freshToday();
      state.today.seconds = (state.today.seconds || 0) + seconds;
      logToday();
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      return state.today.seconds;
    },

    /** Remember that an activity was finished, to suggest the next step. */
    markDone(scope, mode) { state.done[scope + ":" + mode] = VS.todayKey(); save(); },

    best: (key) => state.best[key] || 0,
    setBest(key, ms) {
      if (state.best[key] && ms >= state.best[key]) return false;
      state.best[key] = ms;
      save();
      return true;
    },

    settings: () => state.settings,
    setSetting(name, value) { state.settings[name] = value; save(); },

    notesAll: () => state.notes,
    lastBackup: () => state.lastBackup,
    markBackup() { state.lastBackup = VS.todayKey(); save(); },

    /**
     * Merge a backup into this device: for every word keep the stronger memory
     * (higher box; on a tie the later due date), add up nothing twice, keep both
     * devices' notes and added words, and the longer history row per day.
     */
    mergeJSON(text) {
      let data;
      try { data = migrate(JSON.parse(text)); } catch (e) { return false; }
      if (!data || data.app !== "vocabstudy" || typeof data.words !== "object") return false;
      Object.entries(data.words).forEach(([id, p]) => {
        const theirs = unpack(p);
        const ours = state.words[id] ? unpack(state.words[id]) : null;
        if (!ours || theirs[0] > ours[0] || (theirs[0] === ours[0] && theirs[1] > ours[1])) {
          state.words[id] = [theirs[0], theirs[1], Math.max(theirs[2], ours ? ours[2] : 0), Math.max(theirs[3], ours ? ours[3] : 0)];
        }
      });
      Object.entries(data.notes || {}).forEach(([id, n]) => {
        if (!state.notes[id]) state.notes[id] = n;
        else if (state.notes[id] !== n && !state.notes[id].includes(n)) state.notes[id] += " · " + n;
      });
      const mine = new Set(state.library.map((w) => VS.wordKey(w.word, w.sense)));
      (data.library || []).forEach((w) => {
        const k = VS.wordKey(w.word, w.sense);
        if (!w.word || mine.has(k)) return;
        mine.add(k);
        state.library.push(w);
      });
      Object.entries(data.history || {}).forEach(([day, row]) => {
        const mineRow = state.history[day];
        if (!mineRow || (row[0] || 0) > (mineRow[0] || 0)) state.history[day] = row;
      });
      Object.entries(data.done || {}).forEach(([k, d]) => { if (!state.done[k] || d > state.done[k]) state.done[k] = d; });
      Object.entries(data.best || {}).forEach(([k, ms]) => { if (!state.best[k] || ms < state.best[k]) state.best[k] = ms; });
      if (data.streak && data.streak.last > state.streak.last) state.streak = data.streak;
      save();
      return true;
    },

    /** Everything, as a JSON string — for Backup & export. */
    exportJSON: () => JSON.stringify(Object.assign({ app: "vocabstudy", version: 3, exported: VS.todayKey() }, state)),

    /** Replace progress with a backup. Returns false if the file isn't one. */
    importJSON(text) {
      let data;
      try { data = migrate(JSON.parse(text)); } catch (e) { return false; }
      if (!data || data.app !== "vocabstudy" || typeof data.words !== "object") return false;
      state = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), data, {
        settings: Object.assign({}, DEFAULTS.settings, data.settings),
      });
      delete state.app; delete state.version; delete state.exported;
      save();
      return true;
    },

    /* ── Your words ────────────────────────────────────────────────
       state.library holds the words you added, as you typed them. They
       join VS.words at start-up (bottom of this file). The Starter set is
       built in, so it isn't stored. */
    library: () => state.library,

    /** Add words to your library. Words already there are skipped → { added, skipped } */
    saveUserWords(words) {
      const result = VS.addWords(words, { source: "mine" });
      result.added.forEach((w) => state.library.push(plain(w)));
      if (result.added.length) save();
      return result;
    },

    /**
     * Change one of your words. If the word or its sense changes, its id
     * changes too — progress and note move to the new id, so nothing is lost.
     * Returns { id } or { error: "duplicate", word } when the new spelling is
     * already in the library. The page reloads after edits (views/shared.js).
     */
    editUserWord(id, changes) {
      const i = state.library.findIndex((x) => VS.wordKey(x.word, x.sense) === id);
      if (i < 0) return { error: "missing" };
      const next = Object.assign({}, state.library[i], changes);
      const newId = VS.wordKey(next.word, next.sense);
      if (newId !== id && VS.byId[newId]) return { error: "duplicate", word: VS.byId[newId] };
      state.library[i] = next;
      if (newId !== id) {
        if (state.words[id]) { state.words[newId] = state.words[id]; delete state.words[id]; }
        if (state.notes[id]) { state.notes[newId] = state.notes[id]; delete state.notes[id]; }
      }
      save();
      return { id: newId };
    },

    /**
     * Auto-fill results for one of your words (core/autofill.js). Only empty
     * fields are filled — what you typed is never replaced. `auto` "todo"
     * keeps the word marked for another try (it was added offline).
     */
    fillUserWord(id, fields, auto) {
      const raw = state.library.find((x) => VS.wordKey(x.word, x.sense) === id);
      const w = VS.byId[id];
      if (!raw || !w) return;
      ["ipa", "definition", "example", "type", "level", "arabic"].forEach((k) => {
        if (fields[k] && !raw[k]) { raw[k] = fields[k]; w[k] = fields[k]; }
      });
      if (auto) raw.auto = w.auto = auto;
      else { delete raw.auto; delete w.auto; }
      save();
    },

    /** Delete your own words (Starter words can only be hidden, in Settings). */
    deleteUserWords(ids) {
      const gone = new Set(ids.filter((id) => VS.byId[id] && VS.byId[id].custom));
      if (!gone.size) return 0;
      state.library = state.library.filter((x) => !gone.has(VS.wordKey(x.word, x.sense)));
      gone.forEach((id) => { delete state.words[id]; delete state.notes[id]; });
      VS.removeWords([...gone]);
      save();
      return gone.size;
    },

    /** Put words back to "new": their recall schedule starts again. */
    resetWords(ids) {
      ids.forEach((id) => delete state.words[id]);
      save();
    },

    resetProgress() {
      // Words you added are content, not progress: they survive a reset.
      state = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), { settings: state.settings, library: state.library });
      save();
    },

    WAIT_DAYS,
  };

  /** A word as it is stored: only the fields you typed (ids are derived). */
  function plain(w) {
    const out = {};
    ["word", "sense", "type", "level", "ipa", "definition", "example", "arabic", "tags", "added", "auto"].forEach((k) => {
      if (w.given && (k === "type" || k === "level") && !w.given[k]) return;     // a display default, not your choice
      if (w[k] !== undefined && w[k] !== "" && !(Array.isArray(w[k]) && !w[k].length)) out[k] = w[k];
    });
    return out;
  }

  // The Starter set can be hidden once you have your own words (Settings → Study).
  if (state.settings.showSample === false) VS.removeWords(VS.words.filter((w) => w.source === "starter").map((w) => w.id));

  // Your own words join the library before any screen draws.
  VS.addWords(state.library, { source: "mine" });
})();
