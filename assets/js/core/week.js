/* core/week.js — your week, Saturday to Friday, and the milestones on the way.
   ------------------------------------------------------------------
   Long-term memory is slow to see day by day; a week makes it visible.
   The week runs Saturday → Friday, as it does across the Arab world, and
   the report is ready on Thursday — the end of the working week — so the
   weekend can start with "this is what I did".

     VS.week.range(date?)     → { start, end, days: [7 dates] }   (Sat … Fri)
     VS.week.summary(start?)  → the numbers for one week, with last week's
     VS.week.reportDue()      → the start date of a report the home screen
                                should offer now, or ""
     VS.milestones.next()     → { at, left, pct } toward the next milestone
     VS.milestones.claim()    → a milestone just reached (once), or 0

   Everything is computed from the study history store.js already keeps
   (one row per day: answers, right, seconds, new words, mastered total).
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  const DAY = 864e5;
  // The first ones come early: on day 1, "100 words mastered" is a wall, not a goal.
  const MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000];
  const at = (iso) => new Date(iso + "T12:00:00");

  /** Saturday … Friday around a date. getDay(): Sunday 0 … Saturday 6. */
  function range(date) {
    const d = date ? at(date) : new Date();
    const back = (d.getDay() + 1) % 7;               // days since Saturday
    const sat = new Date(d.getTime() - back * DAY);
    const days = Array.from({ length: 7 }, (_, i) => VS.dateKey(new Date(sat.getTime() + i * DAY)));
    return { start: days[0], end: days[6], days };
  }

  function rowsBetween(start, end) {
    return VS.store.history().filter((r) => r.date >= start && r.date <= end);
  }

  /** Mastered words at the end of a day (carried from the last day studied before it). */
  function masteredAt(date) {
    const rows = VS.store.history().filter((r) => r.date <= date);
    return rows.length ? rows[rows.length - 1].mastered : 0;
  }

  function numbers(start, upto) {
    const r = range(start);
    const rows = rowsBetween(r.start, upto && upto < r.end ? upto : r.end);
    const byDay = {};
    rows.forEach((row) => { byDay[row.date] = row; });
    const sum = (k) => rows.reduce((n, row) => n + (row[k] || 0), 0);
    const before = masteredAt(VS.dateKey(new Date(at(r.start).getTime() - DAY)));
    const today = VS.todayKey();
    const after = r.end >= today ? VS.store.totals().mastered : masteredAt(r.end);
    const best = rows.reduce((a, b) => (!a || b.answered > a.answered ? b : a), null);
    return {
      start: r.start, end: r.end,
      days: r.days.map((date) => ({ date, row: byDay[date] || null, future: date > today, today: date === today })),
      studied: rows.filter((row) => row.answered || row.seconds >= 60 || row.newWords).length,
      answers: sum("answered"), right: sum("right"), seconds: sum("seconds"), met: sum("newWords"),
      mastered: Math.max(0, after - before),
      added: VS.allWords().filter((w) => w.added >= r.start && w.added <= r.end).length,
      best: best && best.answered ? best : null,
    };
  }

  VS.week = {
    range,

    /**
     * A week's numbers with last week's beside them. A week still running is
     * compared with last week up to the same weekday ("so far"): Tuesday
     * against a whole week reads as a loss that isn't one.
     */
    summary(start) {
      const week = numbers(start);
      const lastStart = VS.dateKey(new Date(at(week.start).getTime() - 7 * DAY));
      const today = VS.todayKey();
      week.partial = week.end >= today && week.start <= today;
      const upto = week.partial ? VS.dateKey(new Date(at(today).getTime() - 7 * DAY)) : "";
      week.last = numbers(lastStart, upto);
      return week;
    },

    /** Thursday and Friday: this week's report. Saturday: last week's, if it was never opened. */
    reportDue() {
      if (!VS.store.history().length) return "";
      const day = new Date().getDay();               // Thu 4, Fri 5, Sat 6
      const r = range();
      const seen = VS.store.weekSeen();
      if ((day === 4 || day === 5) && seen !== r.start) return r.start;
      if (day === 6) {
        const last = range(VS.dateKey(new Date(Date.now() - DAY))).start;
        if (seen !== last && rowsBetween(last, VS.dateKey(new Date(Date.now() - DAY))).length) return last;
      }
      return "";
    },

    /** "Sat 14 Nov – Fri 20 Nov" */
    label(start) {
      const r = range(start);
      const f = (iso) => at(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
      return f(r.start) + " – " + f(r.end);
    },
  };

  /* Accuracy after 7 answers on day 1 ("29%") says more about luck than about
     the learner. It shows from 30 answers on; before that, how many are left. */
  const ACCURACY_FROM = 30;
  VS.accuracyText = (right, answered) => answered >= ACCURACY_FROM
    ? Math.round((right / answered) * 100) + "%"
    : VS.html`<span class="muted-num" title="Shown after ${ACCURACY_FROM} answers">after ${ACCURACY_FROM}</span>`;

  // Words already mastered when the app opened: only milestones past this are celebrated.
  const startMastered = VS.store.totals().mastered;

  VS.milestones = {
    LIST: MILESTONES,

    /** The next milestone and how far along you are. */
    next() {
      const m = VS.store.totals().mastered;
      const nextAt = MILESTONES.find((x) => x > m) || Math.ceil((m + 1) / 5000) * 5000;
      const prev = MILESTONES.filter((x) => x <= m).pop() || 0;
      return { at: nextAt, left: nextAt - m, pct: Math.round(((m - prev) / (nextAt - prev)) * 100), mastered: m };
    },

    /**
     * A milestone crossed in THIS visit and not yet celebrated → its number
     * (marked as celebrated). Milestones already behind the learner when the
     * app opened — a restore, an older version, a seeded library — are
     * marked quietly: "Your first word mastered" never greets someone with 3.
     */
    claim() {
      const m = VS.store.totals().mastered;
      const before = MILESTONES.filter((x) => x <= startMastered).pop() || 0;
      if (before > VS.store.milestoneSeen()) VS.store.setMilestoneSeen(before);
      const reached = MILESTONES.filter((x) => x <= m && x > startMastered);
      const top = reached[reached.length - 1];
      if (!top || VS.store.milestoneSeen() >= top) return 0;
      VS.store.setMilestoneSeen(top);
      return top;
    },
    /** The word mastered, when there is exactly one ("postpone is yours now"). */
    firstWord() {
      const w = VS.allWords().filter((x) => VS.store.status(x.id) === "mastered");
      return w.length === 1 ? w[0].word : "";
    },
  };
})();
