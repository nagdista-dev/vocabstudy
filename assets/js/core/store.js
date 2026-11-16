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

  const KEY = "vocabstudy";
  const WAIT_DAYS = [0, 1, 3, 7, 14, 30, 60];
  const MASTERED_BOX = 4;

  const DEFAULTS = {
    words: {},                                     // id → [box, due, right, wrong] (packed, see below)
    streak: { last: "", count: 0 },
    today: { date: "", answered: 0, right: 0, seconds: 0, newWords: 0, met: 0, learned: [] },   // met: new words first met on a card; learned: ids first studied today
    done: {},                                      // "today:quiz" → date last finished
    notes: {},                                     // id → your own note / memory trick
    history: {},                                   // "2026-11-15" → [answered, right, seconds, newWords, mastered]
    library: [],                                   // your words, oldest first — the app ships with none
    lastBackup: "",                                // date of the last full backup download
    backupNudgeIgnored: "",                        // date the learner hid the weekly backup reminder
    weekSeen: "",                                  // the Saturday of the last weekly report opened (core/week.js)
    milestone: 0,                                  // the highest mastered-words milestone celebrated
    best: {},                                      // "match" → best time in ms
    settings: { sound: true, rate: 0.9, textScale: 1, roundSize: 20, breakEvery: 50, dailyGoal: 150, effects: true,
                accent: "blue", voice: "us", recorded: true, autoplay: true, cardFront: "en", newPerDay: 10, autofill: true, grammar: true, speak: false,
                quizTypes: ["meaning", "arabic", "english", "gap", "listen"] },
  };

  const unpack = (p) => (Array.isArray(p) ? p : [p.box || 0, p.due || "", p.right || 0, p.wrong || 0]);

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      return Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), saved, {
        settings: Object.assign({}, DEFAULTS.settings, saved.settings),
      });
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  let state = load();
  const listeners = [];
  let lastUndo = null;     // the last grade, so a mis-tap can be taken back

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
    if (state.today.date !== today) state.today = { date: today, answered: 0, right: 0, seconds: 0, newWords: 0, met: 0, learned: [] };
    if (!Array.isArray(state.today.learned)) state.today.learned = [];
    return today;
  }

  /** Count today's activity and keep the daily streak. */
  function touchDay(correct) {
    freshToday();
    state.today.answered++;
    if (correct) state.today.right++;
    touchStreak();
  }

  /** Studying today keeps the streak alive. */
  function touchStreak() {
    const today = freshToday();
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
     * opts.meet: the learner is meeting a new word for the first time (Learn
     *   new words). That is not a test: "Still learning" is no mistake, so it
     *   counts as studied — not as a wrong answer, and not in today's accuracy.
     * Returns an undo token for VS.store.undo().
     */
    grade(id, grade, opts) {
      const before = { id, entry: state.words[id] ? state.words[id].slice() : null,
                       today: JSON.parse(JSON.stringify(state.today)), streak: Object.assign({}, state.streak) };
      const e = Object.assign({}, entry(id));
      const meet = !!(opts && opts.meet) && e.box === 0;
      const correct = grade !== "again";
      if (meet) touchStreak(); else touchDay(correct);
      if (e.box === 0) {
        state.today.newWords = (state.today.newWords || 0) + 1;
        if (!state.today.learned.includes(id)) state.today.learned.push(id);
      }
      if (meet) {
        state.today.met = (state.today.met || 0) + 1;     // effort for the daily goal, not a test
        // First contact: box 1, back tomorrow. "Easy" may skip a step.
        e.box = grade === "easy" ? 2 : 1;
        e.due = addDays(WAIT_DAYS[e.box]);
      } else if (!correct) {
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
      lastUndo = before;
      return before;
    },

    /** Take back the last answer (a mis-tap on a phone): the word and today's counts go back. */
    undo(token) {
      const t = token || lastUndo;
      if (!t || t !== lastUndo) return false;
      if (t.entry) state.words[t.id] = t.entry; else delete state.words[t.id];
      const seconds = state.today.seconds;          // time studied since then still counts
      state.today = Object.assign(t.today, { seconds: Math.max(seconds || 0, t.today.seconds || 0) });
      state.streak = t.streak;
      lastUndo = null;
      save();
      return true;
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

    /**
     * Quick 5: the ten words that matter most right now, for a five-minute gap
     * in the day. Due words first — longest overdue, weakest memory, most
     * missed — then, if fewer than ten are due, the weakest words you're
     * learning. Words never studied are left for "Learn new words".
     */
    quickWords(n) {
      const size = n || 10;
      const score = (w) => { const e = entry(w.id); return e.box * 3 - e.wrong; };
      const due = this.dueWords().sort((a, b) => (entry(a.id).due < entry(b.id).due ? -1 : entry(a.id).due > entry(b.id).due ? 1 : score(a) - score(b)));
      if (due.length >= size) return due.slice(0, size);
      const rest = VS.allWords().filter((w) => { const e = entry(w.id); return e.box > 0 && e.box < MASTERED_BOX && !isDue(e); })
        .sort((a, b) => score(a) - score(b));
      return due.concat(rest).slice(0, size);
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
      const today = state.today.date === VS.todayKey() ? state.today : { answered: 0, right: 0, seconds: 0, newWords: 0, met: 0 };
      const live = state.streak.last === VS.todayKey() || state.streak.last === VS.yesterdayKey();
      return {
        words: all.length,
        started: all.filter((w) => entry(w.id).box > 0).length,
        mastered: all.filter((w) => entry(w.id).box >= MASTERED_BOX).length,
        due: all.filter((w) => isDue(entry(w.id))).length,
        streak: live ? state.streak.count : 0,
        today,
        // New words met today, even ones later deleted — the daily cap counts them.
        newToday: (today.learned || []).length,
        // Words first studied today that are still in the library (Practise today's words).
        learnedToday: (today.learned || []).filter((id) => VS.byId[id]),
      };
    },

    /** Was this step of today's plan finished today? ("learn", "quiz", "spell", "match", "speak") */
    doneToday: (mode) => state.done["today:" + mode] === VS.todayKey(),

    /** Words never studied, oldest added first: the library is a queue to learn from.
        Words added the same day: the most common first — they pay off soonest. */
    newWords() {
      return VS.allWords()
        .filter((w) => entry(w.id).box === 0)
        .sort((a, b) => (a.added < b.added ? -1 : a.added > b.added ? 1 : VS.frequency.rank(a.word) - VS.frequency.rank(b.word)));
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
    backupNudgeIgnored: () => state.backupNudgeIgnored,
    weekSeen: () => state.weekSeen || "",
    setWeekSeen(start) { if (state.weekSeen !== start) { state.weekSeen = start; save(); } },
    milestoneSeen: () => state.milestone || 0,
    setMilestoneSeen(n) { state.milestone = n; save(); },
    ignoreBackupNudge() { state.backupNudgeIgnored = VS.todayKey(); save(); },

    /**
     * Merge a backup into this device: for every word keep the stronger memory
     * (higher box; on a tie the later due date), add up nothing twice, keep both
     * devices' notes and added words, and the longer history row per day.
     */
    mergeJSON(text) {
      let data;
      try { data = JSON.parse(text); } catch (e) { return false; }
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
    exportJSON: () => JSON.stringify(Object.assign({ app: "vocabstudy", version: 1, exported: VS.todayKey() }, state)),

    /** Replace progress with a backup. Returns false if the file isn't one. */
    importJSON(text) {
      let data;
      try { data = JSON.parse(text); } catch (e) { return false; }
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
       join VS.words at start-up (bottom of this file). */
    library: () => state.library,

    /** Add words to your library. Words already there are skipped → { added, skipped } */
    saveUserWords(words) {
      const result = VS.addWords(words);
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
     * Give a word a new headword in place — auto-fill uses it to turn
     * "postponed" into "postpone". Progress and note move with it. Returns
     * the new id, or "" when that word is already in the library.
     */
    renameUserWord(id, word) {
      const w = VS.byId[id];
      const newId = VS.wordKey(word, w && w.sense);
      if (!w || newId === id || VS.byId[newId]) return "";
      const r = this.editUserWord(id, { word: VS.naturalCase(word, w.example) });
      if (r.error) return "";
      delete VS.byId[id];
      w.word = VS.naturalCase(word, w.example);
      w.id = newId;
      VS.byId[newId] = w;
      return newId;
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
      if (fields.audio && !raw.audio) { raw.audio = fields.audio; w.audio = fields.audio; }
      if (fields.goes && fields.goes.length && !(raw.goes && raw.goes.length)) { raw.goes = fields.goes.slice(); w.goes = fields.goes.slice(); }
      if (fields.synonyms && fields.synonyms.length && !(raw.synonyms && raw.synonyms.length)) {
        raw.synonyms = fields.synonyms.slice(); w.synonyms = fields.synonyms.slice();
      }
      // "wednesday" → "Wednesday": only the capital changes, so the id stays.
      if (fields.word && VS.wordKey(fields.word) === VS.wordKey(raw.word) && fields.word !== raw.word) {
        raw.word = fields.word; w.word = fields.word;
      }
      if (auto) raw.auto = w.auto = auto;
      else { delete raw.auto; delete w.auto; }
      save();
    },

    /** A sentence the learner wrote with a word ("Use it"): newest first, the last five kept. */
    addSentence(id, text) {
      const raw = state.library.find((x) => VS.wordKey(x.word, x.sense) === id);
      const w = VS.byId[id];
      const clean = String(text || "").trim().slice(0, 300);
      if (!raw || !w || !clean) return;
      raw.mine = [clean].concat((raw.mine || []).filter((s) => s !== clean)).slice(0, 5);
      w.mine = raw.mine.slice();
      save();
    },
    removeSentence(id, index) {
      const raw = state.library.find((x) => VS.wordKey(x.word, x.sense) === id);
      const w = VS.byId[id];
      if (!raw || !w || !raw.mine) return;
      raw.mine.splice(index, 1);
      if (!raw.mine.length) delete raw.mine;
      w.mine = (raw.mine || []).slice();
      save();
    },

    /** Delete words from the library, with their progress and notes. */
    deleteUserWords(ids) {
      const gone = new Set(ids.filter((id) => VS.byId[id]));
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
    ["word", "sense", "type", "level", "ipa", "definition", "example", "arabic", "synonyms", "context", "source",
     "mine", "audio", "goes", "tags", "added", "auto"].forEach((k) => {
      if (w.given && (k === "type" || k === "level") && !w.given[k]) return;     // a display default, not your choice
      if (w[k] !== undefined && w[k] !== "" && !(Array.isArray(w[k]) && !w[k].length)) out[k] = w[k];
    });
    return out;
  }

  // Your words join the library before any screen draws.
  VS.addWords(state.library);

  // Progress or notes without a word (a word deleted elsewhere, a merged
  // backup) are dropped on the next save.
  Object.keys(state.words).forEach((id) => { if (!VS.byId[id]) delete state.words[id]; });
  Object.keys(state.notes).forEach((id) => { if (!VS.byId[id]) delete state.notes[id]; });
  delete state.settings.showSample;
})();
