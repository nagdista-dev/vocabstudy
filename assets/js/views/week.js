/* views/week.js — Your week: Saturday to Friday, ready on Thursday.
   ------------------------------------------------------------------
   One page that answers "am I getting anywhere?" in the learner's own
   numbers (core/week.js): words that stuck, days studied, new words met,
   answers and time — each next to last week's — plus one short note from
   the teacher about what to do next week, and the next milestone.

     #/week                 this week
     #/week?start=2026-11-07  the week that starts on that Saturday
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;

  let start = "";

  /** "+12" / "−3" / "same" next to last week's number. */
  function delta(now, last, unit) {
    const d = now - last;
    if (!last && !now) return "";
    if (!d) return html`<small class="wk-delta">same as last week</small>`;
    return html`<small class="wk-delta ${d > 0 ? "is-up" : "is-down"}">${d > 0 ? "+" : "−"}${Math.abs(d)}${unit || ""} vs last week</small>`;
  }

  /** The week as seven days, Saturday first: a filled dot for a day you studied. */
  function strip(w) {
    return html`
      <ol class="wk-days" aria-label="Days studied this week">
        ${w.days.map((d) => {
          const day = new Date(d.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" });
          const done = d.row && (d.row.answered || d.row.seconds >= 60 || d.row.newWords);
          return html`
            <li class="${[done ? "is-done" : "", d.today ? "is-today" : "", d.future ? "is-future" : ""].join(" ")}"
                title="${day}: ${done ? VS.plural(d.row.answered, "answer") : d.future ? "still to come" : "no study"}">
              <span class="wk-dot">${done ? icon("check", "icon-sm") : ""}</span>
              <small>${d.today ? html`<span class="today-long">Today</span><span class="today-short">Now</span>` : day}</small>
            </li>`;
        })}
      </ol>`;
  }

  /** Toward the next milestone: 100, 500, 1000… words mastered. */
  function milestone() {
    const m = VS.milestones.next();
    return html`
      <div class="wk-milestone">
        <p>${icon("trophy", "icon-sm")} <span>Next milestone: <b>${m.at === 1 ? "your first word mastered" : m.at.toLocaleString("en-GB") + " words mastered"}</b>${m.at === 1 ? "" : html` — ${m.left.toLocaleString("en-GB")} to go`}</span></p>
        <div class="wk-track" role="progressbar" aria-label="Toward ${m.at} words mastered" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m.pct}"><i style="width:${m.pct}%"></i></div>
      </div>`;
  }

  /* One sentence from the teacher: the single most useful thing for next week. */
  function note(w) {
    const acc = w.answers ? Math.round((w.right / w.answers) * 100) : 0;
    const sentences = VS.allWords().reduce((n, x) => n + x.mine.length, 0);
    const day = new Date().getDay();
    if (w.end >= VS.todayKey() && day !== 4 && day !== 5) {
      return "The week runs until Friday — keep going. Your full report, with a note on next week, is ready on Thursday.";
    }
    if (!w.studied) return "A quiet week happens. Five minutes today — Quick 5 — and the habit is back.";
    if (w.studied < 4) return "Short sessions on more days beat one long one: memory grows in the gaps. Aim for five days next week, even if some are five minutes.";
    if (w.answers >= 40 && acc < 65) return `${acc}% right this week — that's normal when the words are new: forgetting and remembering again is how they stick. Keep the recall days.`;
    if (!sentences) return "Next week, try Use it on three words: one sentence about your own life makes a word yours.";
    if (w.met > 0 && !w.mastered) return "Words count as mastered after you remember them two weeks later. This week's words will start counting soon — keep recalling them on their days.";
    return "A strong week. Keep the rhythm: recall first every day, then a few new words.";
  }

  // The Progress screen shows the same strip and milestone (views/stats.js).
  VS.ui.weekStrip = strip;
  VS.ui.milestone = milestone;

  VS.views.week = {
    title: () => "Your week",
    crumbs: () => [{ label: "Progress", href: "#/stats" }, { label: "Your week" }],

    start(p) {
      const q = new URLSearchParams(p.query || "").get("start");
      start = VS.week.range(q || undefined).start;
    },

    render() {
      const w = VS.week.summary(start);
      const thisWeek = VS.week.range().start;
      const prev = VS.dateKey(new Date(new Date(start + "T12:00:00").getTime() - 7 * 864e5));
      const next = VS.dateKey(new Date(new Date(start + "T12:00:00").getTime() + 7 * 864e5));
      const acc = w.answers ? Math.round((w.right / w.answers) * 100) : 0;
      const head = w.mastered
        ? html`You made <mark class="mark">${VS.plural(w.mastered, "word")}</mark> stick.`
        : w.studied ? html`You studied on <mark class="mark">${VS.plural(w.studied, "day")}</mark>.`
        : html`A quiet week.`;
      return html`
        <div class="page week-page view-enter">
          <header class="wk-head">
            <h1>${start === thisWeek ? "Your week" : "That week"}</h1>
            <p class="hint">${VS.week.label(start)}</p>
          </header>

          <section class="card wk-card" aria-labelledby="wk-title">
            <h2 id="wk-title" class="wk-headline">${head}</h2>
            ${strip(w)}
            <dl class="wk-numbers">
              <div><dt>Mastered</dt><dd>${w.mastered}</dd>${delta(w.mastered, w.last.mastered)}</div>
              <div><dt>New words met</dt><dd>${w.met}</dd>${delta(w.met, w.last.met)}</div>
              <div><dt>Answers</dt><dd>${w.answers.toLocaleString("en-GB")}${w.answers ? html`<small> · ${acc}% right</small>` : ""}</dd>${delta(w.answers, w.last.answers)}</div>
              <div><dt>Study time</dt><dd>${VS.formatDuration(w.seconds)}</dd>${delta(Math.round(w.seconds / 60), Math.round(w.last.seconds / 60), " min")}</div>
            </dl>
            ${w.best ? html`<p class="hint wk-best">Best day: <b>${new Date(w.best.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long" })}</b> — ${VS.plural(w.best.answered, "answer")}.${w.added ? " You added " + VS.plural(w.added, "word") + " this week." : ""}</p>` : ""}
            <p class="wk-note">${icon("bulb", "icon-sm")}<span>${note(w)}</span></p>
          </section>

          ${milestone()}

          <nav class="row wk-nav" aria-label="Other weeks">
            <a class="btn btn-quiet" href="#/week?start=${prev}">${icon("arrow-left", "icon-sm")} Previous week</a>
            ${start < thisWeek ? html`<a class="btn btn-quiet" href="#/week?start=${next}">Next week ${icon("arrow-right", "icon-sm")}</a>` : ""}
            <a class="btn btn-primary" href="#/">Back to today</a>
          </nav>
        </div>`;
    },

    mount() {
      // Opening the report marks it read: the home screen stops offering it.
      if (start === VS.week.range().start || start === VS.week.reportDue()) VS.store.setWeekSeen(start);
    },
  };
})();
