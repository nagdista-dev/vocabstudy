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
    today: { date: "", answered: 0, right: 0, seconds: 0, newWords: 0 },
    done: {},                                      // "2026-11-02:quiz" → date last finished
    notes: {},                                     // id → your own note / memory trick
    history: {},                                   // "2026-11-15" → [answered, right, seconds, newWords, mastered]
    userDays: {},                                  // sets added in the app: "2026-11-16" → [word objects]
    lastBackup: "",                                // date of the last full backup download
    best: {},                                      // "match:2026-11-02" → best time in ms
    settings: { sound: true, rate: 0.9, textScale: 1, roundSize: 20, breakEvery: 50, dailyGoal: 150, effects: true,
                accent: "blue", voice: "us", autoplay: true, cardFront: "en",
                quizTypes: ["meaning", "arabic", "english", "gap", "listen"], showSample: true },
  };

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
    if (state.today.date !== today) state.today = { date: today, answered: 0, right: 0, seconds: 0, newWords: 0 };
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
      if (e.box === 0) state.today.newWords = (state.today.newWords || 0) + 1;
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

    dayStats(day) {
      const s = { total: day.words.length, new: 0, learning: 0, mastered: 0, due: 0 };
      day.words.forEach((w) => {
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
      };
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
    markDone(dayIso, mode) { state.done[dayIso + ":" + mode] = VS.todayKey(); save(); },
    doneOn: (dayIso, mode) => state.done[dayIso + ":" + mode] || "",

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
      try { data = JSON.parse(text); } catch (e) { return false; }
      if (!data || data.app !== "vocabstudy" || typeof data.words !== "object") return false;
      const unpack = (p) => (Array.isArray(p) ? p : [p.box || 0, p.due || "", p.right || 0, p.wrong || 0]);
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
      Object.entries(data.userDays || {}).forEach(([iso, words]) => {
        const list = state.userDays[iso] || [];
        const seen = new Set(list.map((w) => (w.word + "|" + (w.sense || "")).toLowerCase()));
        words.forEach((w) => { if (!seen.has((w.word + "|" + (w.sense || "")).toLowerCase())) list.push(w); });
        state.userDays[iso] = list;
      });
      Object.entries(data.history || {}).forEach(([day, row]) => {
        const mine = state.history[day];
        if (!mine || (row[0] || 0) > (mine[0] || 0)) state.history[day] = row;
      });
      Object.entries(data.done || {}).forEach(([k, d]) => { if (!state.done[k] || d > state.done[k]) state.done[k] = d; });
      Object.entries(data.best || {}).forEach(([k, ms]) => { if (!state.best[k] || ms < state.best[k]) state.best[k] = ms; });
      if (data.streak && data.streak.last > state.streak.last) state.streak = data.streak;
      save();
      return true;
    },

    /** Everything, as a JSON string — for Backup & export. */
    exportJSON: () => JSON.stringify(Object.assign({ app: "vocabstudy", version: 2, exported: VS.todayKey() }, state)),

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

    /** Sets added with the in-app importer (views/import.js). */
    userDays: () => state.userDays,
    saveUserWords(iso, words) {
      const list = state.userDays[iso] || [];
      const seen = new Set(list.map((w) => (w.word + "|" + (w.sense || "")).toLowerCase()));
      words.forEach((w) => {
        const key = (w.word + "|" + (w.sense || "")).toLowerCase();
        if (!seen.has(key)) { seen.add(key); list.push(w); }
      });
      state.userDays[iso] = list;
      save();
      VS.addDay(iso, words, { custom: true });
    },
    deleteUserDay(iso) {
      delete state.userDays[iso];
      save();
    },

    /**
     * Change one of your words. If the word or its sense changes, its id
     * changes too — progress and note move to the new id, so nothing is lost.
     * Returns the new id. The page reloads after edits (see views/shared.js).
     */
    editUserWord(id, changes) {
      const w = VS.byId[id];
      const list = w && state.userDays[w.day];
      if (!list) return null;
      const key = (x) => (x.word + "|" + (x.sense || "")).toLowerCase();
      const i = list.findIndex((x) => key(x) === key(w));
      if (i < 0) return null;
      list[i] = Object.assign({}, list[i], changes);
      const newId = w.day + ":" + (list[i].word + (list[i].sense ? " (" + list[i].sense + ")" : "")).toLowerCase();
      if (newId !== id) {
        if (state.words[id]) { state.words[newId] = state.words[id]; delete state.words[id]; }
        if (state.notes[id]) { state.notes[newId] = state.notes[id]; delete state.notes[id]; }
      }
      save();
      return newId;
    },
    deleteUserWord(id) {
      const w = VS.byId[id];
      const list = w && state.userDays[w.day];
      if (!list) return;
      const key = (x) => (x.word + "|" + (x.sense || "")).toLowerCase();
      state.userDays[w.day] = list.filter((x) => key(x) !== key(w));
      if (!state.userDays[w.day].length) delete state.userDays[w.day];
      delete state.words[id];
      delete state.notes[id];
      save();
    },

    resetProgress() {
      // Words you added are content, not progress: they survive a reset.
      state = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), { settings: state.settings, userDays: state.userDays });
      save();
    },

    WAIT_DAYS,
  };

  // The Starter set can be hidden once you have your own words (Settings → Study).
  if (state.settings.showSample === false) {
    VS.days.filter((d) => d.sample).forEach((d) => {
      d.words.forEach((w) => delete VS.byId[w.id]);
      VS.days.splice(VS.days.indexOf(d), 1);
    });
  }

  // Sets added in the app join the built-in ones before any screen draws.
  Object.keys(state.userDays || {}).sort().forEach((iso) => VS.addDay(iso, state.userDays[iso], { custom: true }));
})();
