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
       mastered  box 4+ (remembered after a one-week gap; now waits two weeks)
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
    wallet: [],                                    // words met in an example, kept for later: [{ id, word, sentence, source, added }]
    reminder: "",                                  // "9 PM": the daily calendar reminder the learner added (views/home.js)
    weekSeen: "",                                  // the Saturday of the last weekly report opened (core/week.js)
    milestone: 0,                                  // the highest mastered-words milestone celebrated
    best: {},                                      // "match" → best time in ms
    settings: { sound: true, rate: 0.9, textScale: 1, roundSize: 20, breakEvery: 50, dailyGoal: 50, effects: true,
                accent: "blue", voice: "us", recorded: false, recordedChosen: false, autoplay: true, cardFront: "ar", newPerDay: 10, autofill: true, grammarOnline: "ask", theme: "light", speak: false,
                quizTypes: ["meaning", "arabic", "english", "gap", "listen"] },
  };

  const unpack = (p) => (Array.isArray(p) ? p : [p.box || 0, p.due || "", p.right || 0, p.wrong || 0]);

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      const st = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), saved, {
        settings: Object.assign({}, DEFAULTS.settings, saved.settings),
      });
      // Daily goal choices are 20 / 50 / 100 / 200 now: an old 150, 300 or 600 moves to the nearest one.
      // Light for everyone unless they chose Night or Auto themselves: an "auto" saved
      // as the old default (before anyone picked it) goes back to light.
      if (st.settings.theme === "auto" && !st.settings.themeChosen) st.settings.theme = "light";
      // Recorded voice is opt-in now: an old save that still carries the old
      // default goes off once, while a real On/Off choice is kept.
      if (!st.settings.recordedChosen) st.settings.recorded = false;
      // The install nudge no longer stores a snooze: it returns on every visit
      // until the app is installed. Drop the flag old saves still carry.
      delete st.installNudgeDismissed;
      // A wallet entry is a word the learner met and kept; it carries the sentence
      // that made them tap. Old or damaged saves fall back to an empty wallet.
      if (!Array.isArray(st.wallet)) st.wallet = [];
      st.wallet = st.wallet.filter((e) => e && e.word).slice(-300);
      // The old "this word has more than one meaning" question is gone. Drop
      // its stored flag so an old save never resurrects it; a spelling flag stays.
      if (!Array.isArray(st.library)) st.library = [];
      st.library.forEach((w) => { if (w && w.check && w.check.kind === "meaning") delete w.check; });
      const g = st.settings.dailyGoal;
      if (g && ![20, 50, 100, 200].includes(g)) st.settings.dailyGoal = g < 75 ? 50 : g < 150 ? 100 : g <= 150 ? 100 : 200;
      return st;
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  let state = load();
  const listeners = [];
  let lastUndo = null;     // the last grade, so a mis-tap can be taken back

  /* A library entry's id: the headword, its sense, and the hidden variant that
     keeps two Arabic meanings of one English word apart (core/vs.js). */
  const rawIndex = (id) => state.library.findIndex((x) => VS.idOf(x) === id);
  const rawOf = (id) => { const i = rawIndex(id); return i < 0 ? null : state.library[i]; };

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

    /* ── The word wallet ──────────────────────────────────────────
       A word the learner met inside an example and kept for later. It is
       not a library word yet: it has no schedule, no note and no place in
       the ruler. Adding it to the library is a separate, deliberate tap. */
    wallet: () => state.wallet || [],

    /**
     * Keep one word from a sentence. Returns:
     *   { ok: true, entry }            newly kept
     *   { ok: true, entry, existed }   already in the wallet
     *   { ok: false, inLibrary }       already one of the learner's words
     */
    walletAdd(word, sentence, source, kind, arabic) {
      const text = String(word || "").trim().replace(/\s+/g, " ").slice(0, 80);
      const id = VS.wordKey(text);
      if (!text || !id) return { ok: false };
      const known = VS.findWord(text);
      if (known) return { ok: false, inLibrary: true, id: known.id };
      const list = state.wallet || (state.wallet = []);
      const found = list.find((e) => e.id === id);
      if (found) return { ok: true, entry: found, existed: true };
      const entry = {
        id, word: text,
        sentence: String(sentence || "").trim().slice(0, 300),
        source: String(source || "").slice(0, 80),
        added: VS.todayKey(),
      };
      if (kind === "meaning" || kind === "shared") entry.kind = kind;   // met in a meaning, or sent by a friend
      if (arabic) entry.arabic = String(arabic).slice(0, 120);   // the gloss the word card showed, if it had loaded
      list.push(entry);
      if (list.length > 300) list.splice(0, list.length - 300);
      save();
      return { ok: true, entry };
    },

    /** Fill in a kept word's Arabic later (looked up after it was kept). */
    walletSetArabic(id, arabic) {
      const e = (state.wallet || []).find((x) => x.id === id);
      if (!e || !arabic || e.arabic) return;
      e.arabic = String(arabic).slice(0, 120);
      save();
    },

    /** Take one word out; returns it so a toast can put it back. */
    walletRemove(id) {
      const list = state.wallet || [];
      const i = list.findIndex((e) => e.id === id);
      if (i < 0) return null;
      const [gone] = list.splice(i, 1);
      save();
      return gone;
    },

    /** Put kept words back (the Undo behind Remove and Clear). */
    walletRestore(entries) {
      if (!Array.isArray(entries) || !entries.length) return;
      const list = state.wallet || (state.wallet = []);
      const seen = new Set(list.map((e) => e.id));
      entries.forEach((e) => {
        if (!e || !e.word || !e.id || seen.has(e.id)) return;
        list.push(e);
        seen.add(e.id);
      });
      save();
    },

    /** Empty the wallet; returns what was removed, for Undo. */
    walletClear() {
      const gone = (state.wallet || []).slice();
      if (!gone.length) return [];
      state.wallet = [];
      save();
      return gone;
    },

    notesAll: () => state.notes,
    lastBackup: () => state.lastBackup,
    markBackup() { state.lastBackup = VS.todayKey(); save(); },
    backupNudgeIgnored: () => state.backupNudgeIgnored,
    reminder: () => state.reminder || "",
    setReminder(at) { state.reminder = at; save(); },
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
      // A word with the same meaning may have another id here (an old backup,
      // or its first meaning was deleted). A word whose meaning is new gets the
      // id it will have in this library — possibly a variant — and its progress
      // follows it there instead of landing on another meaning of the word.
      const remap = {};
      const link = (oldId, id) => { if (!(oldId in remap)) remap[oldId] = id; };
      const incoming = [];
      (data.library || []).forEach((w) => {
        if (!w || !w.word) return;
        const oldId = VS.idOf(w);
        const same = VS.findSameWord(w.word, w.sense, w.arabic);
        if (same) { link(oldId, same.id); return; }
        const base = VS.wordKey(w.word, w.sense);
        const ar = VS.arKey(w.arabic);
        const sameIncoming = incoming.find((x) => VS.wordKey(x.word, x.sense) === base && VS.arKey(x.arabic) === ar);
        if (sameIncoming) { link(oldId, sameIncoming.id); return; }
        const twins = VS.words.filter((x) => VS.wordKey(x.word, x.sense) === base).concat(incoming);
        let variant = String(w.variant || "").trim();
        if (twins.length) {
          if (!ar) return;                       // no Arabic: two meanings can't be told apart
          if (!variant) variant = twins.some((x) => !x.variant) ? ar : "";
          let n = 2;
          const want = variant;
          while (variant && twins.some((x) => x.variant === variant)) variant = want + "-" + n++;
        }
        const id = VS.wordId(w.word, w.sense, variant);
        if (VS.byId[id] || incoming.some((x) => x.id === id)) { link(oldId, id); return; }
        incoming.push(Object.assign({}, w, { variant, id }));
        link(oldId, id);
      });
      Object.entries(data.words).forEach(([id, p]) => {
        const target = remap[id] || id;
        const theirs = unpack(p);
        const ours = state.words[target] ? unpack(state.words[target]) : null;
        if (!ours || theirs[0] > ours[0] || (theirs[0] === ours[0] && theirs[1] > ours[1])) {
          state.words[target] = [theirs[0], theirs[1], Math.max(theirs[2], ours ? ours[2] : 0), Math.max(theirs[3], ours ? ours[3] : 0)];
        }
      });
      Object.entries(data.notes || {}).forEach(([id, n]) => {
        const target = remap[id] || id;
        if (!state.notes[target]) state.notes[target] = n;
        else if (state.notes[target] !== n && !state.notes[target].includes(n)) state.notes[target] += " · " + n;
      });
      incoming.forEach((w) => {
        if (VS.byId[w.id]) return;
        state.library.push(w);
        VS.words.push(w);
        VS.byId[w.id] = w;
      });
      Object.entries(data.history || {}).forEach(([day, row]) => {
        const mineRow = state.history[day];
        if (!mineRow || (row[0] || 0) > (mineRow[0] || 0)) state.history[day] = row;
      });
      Object.entries(data.done || {}).forEach(([k, d]) => { if (!state.done[k] || d > state.done[k]) state.done[k] = d; });
      Object.entries(data.best || {}).forEach(([k, ms]) => { if (!state.best[k] || ms < state.best[k]) state.best[k] = ms; });
      if (data.streak && data.streak.last > state.streak.last) state.streak = data.streak;
      // Both devices' wallets, one entry per word; never a word that is now in the library.
      const wallet = state.wallet || (state.wallet = []);
      const kept = new Set(wallet.map((e) => e.id));
      (Array.isArray(data.wallet) ? data.wallet : []).forEach((e) => {
        if (!e || !e.word || !e.id || kept.has(e.id) || VS.findWord(e.word)) return;
        wallet.push(e);
        kept.add(e.id);
      });
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
     * Change one of your words. If the word, its sense or its Arabic meaning
     * changes, its id changes too — progress and note move to the new id, so
     * nothing is lost. The same English word may stay twice only when its
     * Arabic meaning differs.
     * Returns { id }, { error: "duplicate", word } or { error: "needsArabic", word }.
     * The page reloads after edits (views/shared.js).
     */
    editUserWord(id, changes) {
      const i = rawIndex(id);
      if (i < 0) return { error: "missing" };
      const prev = state.library[i];
      const next = Object.assign({}, prev, changes);
      delete next.check;                 // edited by hand: the learner has checked it
      if ("context" in changes && changes.context !== prev.context) delete next.fromContext;
      if ("mistake" in changes) {
        const mistake = VS.cleanMistake(changes.mistake);
        if (mistake) next.mistake = mistake; else delete next.mistake;
      }
      // One English word, one Arabic meaning. A different Arabic meaning is a
      // second word; no Arabic cannot tell two meanings apart. The sense label
      // names a meaning but never makes the same Arabic a different word.
      const base = VS.wordKey(next.word, next.sense);
      const ar = VS.arKey(next.arabic);
      const sameWord = VS.words.filter((x) => x.id !== id && VS.wordKey(x.word) === VS.wordKey(next.word));
      const same = sameWord.find((x) => VS.arKey(x.arabic) === ar);
      if (same) return { error: "duplicate", word: same };
      if (sameWord.length && !ar) return { error: "needsArabic", word: sameWord[0] };
      // The primary word keeps the base id while its headword stays the same;
      // a word taking over another headword (or already a variant) gets one.
      const twins = sameWord.filter((x) => VS.wordKey(x.word, x.sense) === base);
      const headChanged = VS.wordKey(prev.word, prev.sense) !== base;
      next.variant = twins.length && (prev.variant || headChanged) ? ar : "";
      const newId = VS.wordId(next.word, next.sense, next.variant);
      if (newId !== id && VS.byId[newId]) return { error: "duplicate", word: VS.byId[newId] };
      state.library[i] = next;
      if (newId !== id) {
        if (state.words[id]) { state.words[newId] = state.words[id]; delete state.words[id]; }
        if (state.notes[id]) { state.notes[newId] = state.notes[id]; delete state.notes[id]; }
        const learned = state.today && state.today.learned;
        if (Array.isArray(learned) && learned.includes(id)) {
          state.today.learned = [...new Set(learned.map((x) => (x === id ? newId : x)))];
        }
      }
      save();
      return { id: newId, variant: next.variant || "" };
    },

    /**
     * Give a word a new headword in place — auto-fill uses it to turn
     * "postponed" into "postpone". Progress and note move with it. Returns
     * the new id, or "" when that word cannot take the spelling (a duplicate).
     */
    renameUserWord(id, word) {
      const w = VS.byId[id];
      if (!w) return "";
      const clean = VS.naturalCase(word, w.example);
      const r = this.editUserWord(id, { word: clean });
      if (r.error) return "";
      delete VS.byId[id];
      w.word = clean;
      w.id = r.id;
      const raw = rawOf(r.id);
      w.variant = raw ? raw.variant : "";
      VS.byId[r.id] = w;
      return r.id;
    },

    /**
     * Auto-fill results for one of your words (core/autofill.js). Only empty
     * fields are filled — what you typed is never replaced. `auto` "todo"
     * keeps the word marked for another try (it was added offline).
     */
    fillUserWord(id, fields, auto, opts) {
      const raw = rawOf(id);
      const w = VS.byId[id];
      if (!raw || !w) return;
      // What auto-fill wrote is remembered, so a corrected spelling can be filled again from scratch.
      const filled = new Set(raw.filled || []);
      ["ipa", "definition", "example", "type", "level", "arabic"].forEach((k) => {
        if (fields[k] && !raw[k]) { raw[k] = fields[k]; w[k] = fields[k]; filled.add(k); }
      });
      if (fields.audio && !raw.audio) { raw.audio = fields.audio; w.audio = fields.audio; filled.add("audio"); }
      if (fields.goes && fields.goes.length && !(raw.goes && raw.goes.length)) { raw.goes = fields.goes.slice(); w.goes = fields.goes.slice(); filled.add("goes"); }
      if (fields.synonyms && fields.synonyms.length && !(raw.synonyms && raw.synonyms.length)) {
        raw.synonyms = fields.synonyms.slice(); w.synonyms = fields.synonyms.slice(); filled.add("synonyms");
      }
      if (filled.size) raw.filled = [...filled];
      // "Check the spelling" (core/autofill.js).
      if (fields.check) { raw.check = Object.assign({}, fields.check); w.check = raw.check; }
      // A meaning checked by hand (assets/data/overrides.js) is trusted only
      // when its Arabic is the one shown: Arabic the learner typed keeps no badge.
      if (fields.trusted && raw.arabic === fields.arabic) raw.trusted = w.trusted = true;
      if (fields.fromContext) raw.fromContext = w.fromContext = true;     // the meaning came from "Where you met it"
      // "wednesday" → "Wednesday": only the capital changes, so the id stays.
      if (fields.word && VS.wordKey(fields.word) === VS.wordKey(raw.word) && fields.word !== raw.word) {
        raw.word = fields.word; w.word = fields.word;
      }
      // A word filled while Google was down is "partial"; it is tried again
      // (VS.autofill.resume) up to three times, then left as it is.
      if (opts && opts.partial) { raw.partial = w.partial = true; raw.tries = w.tries = (raw.tries || 0) + 1; }
      else if (!auto) { delete raw.partial; delete w.partial; delete raw.tries; delete w.tries; }
      if (raw.tries > 3) auto = "";
      if (auto) raw.auto = w.auto = auto;
      else { delete raw.auto; delete w.auto; }
      save();
    },

    /**
     * The learner has looked at a misspelled word ("Keep it"): the
     * "Check spelling" line goes away.
     */
    clearCheck(id) {
      const raw = rawOf(id);
      const w = VS.byId[id];
      if (!raw || !raw.check) return;
      delete raw.check;
      if (w) delete w.check;
      save();
    },

    /**
     * "recieve" → "receive": rename the word, forget everything auto-fill
     * wrote for the misspelling (what the learner typed stays), and mark it
     * to be filled again. Returns the new id, or "" if the spelling is taken.
     */
    respellUserWord(id, word) {
      const newId = this.renameUserWord(id, word);
      if (!newId) return "";
      this.clearAutoFields(newId);
      const raw = rawOf(newId);
      const w = VS.byId[newId];
      if (!raw) return "";
      delete raw.check;
      if (w) delete w.check;
      raw.auto = "todo";
      if (w) w.auto = "todo";
      save();
      return newId;
    },

    /**
     * A word filled before its meaning was checked by hand gets the checked one
     * (core/autofill.js migrateChecked): Arabic, definition, example and type
     * change together — only the ones auto-fill wrote; what the learner typed stays.
     */
    upgradeToChecked(id, m, fromContext) {
      const raw = rawOf(id);
      const w = VS.byId[id];
      if (!raw || !m) return false;
      const filled = new Set(raw.filled || []);
      if (!filled.has("arabic")) return false;                          // the learner's own Arabic: leave the word alone
      ["arabic", "definition", "example", "type"].forEach((k) => {
        if (!m[k] || (raw[k] && !filled.has(k))) return;
        raw[k] = m[k]; if (w) w[k] = m[k]; filled.add(k);
      });
      raw.filled = [...filled];
      if (raw.goes) { delete raw.goes; if (w) w.goes = []; }            // collocations of the old meaning
      raw.trusted = true; if (w) w.trusted = true;
      if (fromContext) { raw.fromContext = true; if (w) w.fromContext = true; }
      save();
      return true;
    },

    /**
     * Use another meaning for a word: its Arabic, definition, example, type
     * and similar words replace the old ones together (never mixed), and the
     * word counts as confirmed. The id stays the same.
     */
    applySense(id, m) {
      const raw = rawOf(id);
      const w = VS.byId[id];
      if (!raw || !m) return;
      // "goes" belongs to the old meaning too ("heavy fine" is not "I'm fine"): it goes with it.
      const next = { arabic: m.arabic || "", definition: m.definition || "", example: m.example || "",
                     type: m.type || raw.type || "", synonyms: (m.synonyms || []).slice(0, 3), goes: [] };
      Object.keys(next).forEach((k) => {
        const v = next[k];
        if (v && (!Array.isArray(v) || v.length)) { raw[k] = v; if (w) w[k] = Array.isArray(v) ? v.slice() : v; }
        else { delete raw[k]; if (w) w[k] = Array.isArray(w[k]) ? [] : ""; }
      });
      if (w && !w.type) w.type = /\s/.test(w.word) ? "Phrase" : "Noun";
      raw.confirmed = true; if (w) w.confirmed = true;
      if (m.trusted) { raw.trusted = true; if (w) w.trusted = true; }
      delete raw.check; if (w) delete w.check;
      save();
    },

    /** Forget what auto-fill wrote for a word (what the learner typed stays), so it can be filled afresh. */
    clearAutoFields(id) {
      const raw = rawOf(id);
      const w = VS.byId[id];
      if (!raw) return;
      (raw.filled || []).forEach((k) => {
        delete raw[k];
        if (w) w[k] = Array.isArray(w[k]) ? [] : "";
      });
      if (w && !w.type) w.type = /\s/.test(w.word) ? "Phrase" : "Noun";
      delete raw.filled;
      save();
    },

    /** A sentence the learner wrote with a word ("Use it"): newest first, the last five kept. */
    addSentence(id, text, opts) {
      const raw = rawOf(id);
      const w = VS.byId[id];
      const clean = String(text || "").trim().slice(0, 300);
      if (!raw || !w || !clean) return;
      raw.mine = [clean].concat((raw.mine || []).filter((s) => s !== clean)).slice(0, 5);
      w.mine = raw.mine.slice();
      // Kept against a warning: listed in `unsure`, so Recall never shows it as a cue.
      const unsure = (raw.unsure || []).filter((s) => s !== clean && raw.mine.includes(s));
      if (opts && opts.unsure) unsure.push(clean);
      if (unsure.length) raw.unsure = unsure; else delete raw.unsure;
      w.unsure = (raw.unsure || []).slice();
      save();
    },
    /** A sentence corrected ("Use the fix"): same place, no longer unsure, so Recall may use it. */
    replaceSentence(id, index, text) {
      const raw = rawOf(id);
      const w = VS.byId[id];
      const clean = String(text || "").trim().slice(0, 300);
      if (!raw || !raw.mine || !raw.mine[index] || !clean) return;
      const old = raw.mine[index];
      raw.mine[index] = clean;
      if (raw.unsure) { raw.unsure = raw.unsure.filter((s) => s !== old); if (!raw.unsure.length) delete raw.unsure; }
      if (w) { w.mine = raw.mine.slice(); w.unsure = (raw.unsure || []).slice(); }
      save();
    },
    removeSentence(id, index) {
      const raw = rawOf(id);
      const w = VS.byId[id];
      if (!raw || !w || !raw.mine) return;
      const [gone] = raw.mine.splice(index, 1);
      if (!raw.mine.length) delete raw.mine;
      w.mine = (raw.mine || []).slice();
      if (raw.unsure) {
        raw.unsure = raw.unsure.filter((s) => s !== gone);
        if (!raw.unsure.length) delete raw.unsure;
        w.unsure = (raw.unsure || []).slice();
      }
      save();
    },

    /**
     * Undo for everything that removes or resets (V1.1). `snapshot(ids)` keeps
     * each word as it is now — its library entry, its place in the list, its
     * progress and note; `restore(snap)` puts back exactly that: a deleted
     * word returns where it was, a reset word gets its schedule back, a
     * removed sentence comes back.
     */
    snapshot(ids) {
      return ids.map((id) => {
        const i = rawIndex(id);
        return { id, i, raw: i >= 0 ? JSON.parse(JSON.stringify(state.library[i])) : null,
                 prog: state.words[id] ? state.words[id].slice() : null, note: state.notes[id] };
      }).filter((x) => x.raw);
    },
    restore(snap) {
      snap.slice().sort((a, b) => a.i - b.i).forEach(({ id, i, raw, prog, note }) => {
        // Whatever is there now (edited since, or gone) is replaced by the word as it was, in its old place —
        // in storage and in the list in memory, so both agree.
        const at = rawIndex(id);
        if (at >= 0) state.library.splice(at, 1);
        if (VS.byId[id]) VS.removeWords([id]);
        const pos = Math.min(i, state.library.length);
        state.library.splice(pos, 0, raw);
        const added = VS.addWords([raw]).added[0];
        if (added) {
          VS.words.splice(VS.words.indexOf(added), 1);
          const nextRaw = state.library[pos + 1];
          const before = nextRaw && VS.findWord(nextRaw.word, nextRaw.sense);
          const k = before ? VS.words.indexOf(before) : -1;
          VS.words.splice(k >= 0 ? k : VS.words.length, 0, added);
        }
        if (prog) state.words[id] = prog.slice(); else delete state.words[id];
        if (note) state.notes[id] = note; else delete state.notes[id];
      });
      save();
    },

    /** Delete words from the library, with their progress and notes. */
    deleteUserWords(ids) {
      const gone = new Set(ids.filter((id) => VS.byId[id]));
      if (!gone.size) return 0;
      state.library = state.library.filter((x) => !gone.has(VS.idOf(x)));
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
      // The wallet is content too — words kept, not answers given.
      state = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), { settings: state.settings, library: state.library, wallet: state.wallet });
      lastUndo = null;
      save();
    },

    /**
     * Delete everything this browser holds and return to the first day.
     * Words, notes, answers, history, streak, best times and settings all go;
     * the installed app itself stays. The caller must take a backup first —
     * this is the one action the app cannot undo.
     */
    startOver() {
      const ids = [...new Set([...Object.keys(VS.byId), ...state.library.map(VS.idOf)])];
      state = JSON.parse(JSON.stringify(DEFAULTS));
      lastUndo = null;
      VS.removeWords(ids);
      save();
      return ids.length;
    },

    WAIT_DAYS,
  };

  /** A word as it is stored: only the fields you typed (ids are derived). */
  function plain(w) {
    const out = {};
    ["word", "sense", "variant", "type", "level", "ipa", "definition", "example", "arabic",
     "synonyms", "antonyms", "context", "source", "memory", "mistake",
     "mine", "unsure", "audio", "goes", "tags", "added", "auto", "partial", "tries"].forEach((k) => {
      if (w.given && (k === "type" || k === "level") && !w.given[k]) return;     // a display default, not your choice
      const v = w[k];
      if (v == null || v === "") return;
      if (Array.isArray(v) && !v.length) return;
      if (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length) return;
      out[k] = v;
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
