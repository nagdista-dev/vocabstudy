/* views/stats.js — your progress over time.
   ------------------------------------------------------------------
   Seeing effort turn into results keeps long study days going. Four
   questions, one chart each (single series → no legend; the title
   names it; every bar has a tooltip; every chart has a table view):

     How long did I study?            minutes per day, last 14 days
     How much did I practise?         answers per day, last 14 days
     Is my memory growing?            mastered words, last 30 days
     How strong is my memory now?     words per box (new → 60 days)

   Data comes from VS.store.history() (one row per study day) and
   VS.store.boxes(). Charts are plain HTML bars — no chart library.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;
  const BOX_LABELS = VS.filters.BOXES;   // one list of box names (core/filters.js)

  /** The last n calendar days (oldest first), each with that day's history row or zeros. */
  function lastDays(n) {
    const rows = {};
    VS.store.history().forEach((r) => { rows[r.date] = r; });
    const out = [];
    let mastered = 0;
    for (let i = n - 1; i >= 0; i--) {
      const date = VS.dateKey(new Date(Date.now() - i * 864e5));
      const r = rows[date];
      if (r) mastered = r.mastered;                     // carry the last known total forward
      out.push(Object.assign({ date, answered: 0, right: 0, seconds: 0, newWords: 0 }, r, { mastered: r ? r.mastered : mastered }));
    }
    return out;
  }

  const dayLabel = (iso, i, n) => {
    const d = new Date(iso + "T12:00:00");
    const back = n - 1 - i;
    if (!back) return "Today";
    // Long charts count back in weeks ("2 wk") — dates of the month read as noise.
    if (n > 14) return back % 7 === 0 && back < n - 1 ? back / 7 + " wk" : "";
    // Never a label right beside "Today": they ran together ("TToday").
    return back === 1 ? "" : d.toLocaleDateString("en-GB", { weekday: "narrow" });
  };
  const longDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  /**
   * One bar chart. items = [{ label, value, tip, tone? }]
   * `tone` "seq-N" paints a sequential step (memory strength).
   */
  function barChart({ id, title, sub, items, unit }) {
    const max = Math.max(1, ...items.map((d) => d.value));
    const peak = items.reduce((a, b) => (b.value > a.value ? b : a), items[0]);
    return html`
      <figure class="chart card" aria-labelledby="${id}-t">
        <figcaption>
          <h2 id="${id}-t">${title}</h2>
          <span class="hint">${sub}</span>
        </figcaption>
        <div class="bars" style="--n:${items.length}" role="img" aria-label="${title}: ${items.map((d) => d.tip).join("; ")}">
          ${items.map((d) => html`
            <div class="bar-col" tabindex="0" data-tip="${d.tip}">
              ${d === peak && d.value ? html`<b class="bar-peak">${d.value}${unit || ""}</b>` : ""}
              <span class="bar ${d.tone || ""}" style="height:${d.value ? Math.max(2, (d.value / max) * 100) : 0}%"></span>
              <small>${d.label}</small>
            </div>`)}
        </div>
        <details class="chart-table">
          <summary>Show as table</summary>
          <table><tbody>${items.map((d) => html`<tr><td>${d.tip.split(":")[0]}</td><td>${d.tip.split(":").slice(1).join(":")}</td></tr>`)}</tbody></table>
        </details>
      </figure>`;
  }

  /* Next 7 days of recall, as small bars: plan your week at a glance. */
  function forecast() {
    const days = VS.store.forecast();
    const max = Math.max(1, ...days.map((d) => d.count));
    if (!days.some((d) => d.count)) return "";
    return html`
      <section class="forecast" aria-labelledby="fc-title">
        <div class="section-title"><h2 id="fc-title">Coming up</h2>
          <span class="hint">${VS.plural(days.reduce((n, d) => n + d.count, 0), "word")} in 7 days</span></div>
        <ol class="fc-bars card">
          ${days.map((d, i) => {
            const day = new Date(d.date + "T12:00:00");
            return html`
              <li class="${i === 0 ? "is-today" : ""}" title="${d.count} on ${day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}">
                <b>${d.count || ""}</b>
                <span class="fc-bar"><i style="height:${Math.round((d.count / max) * 100)}%"></i></span>
                <small>${i === 0 ? html`<span class="today-long">Today</span><span class="today-short">Now</span>` : day.toLocaleDateString("en-GB", { weekday: "short" })}</small>
              </li>`;
          })}
        </ol>
      </section>`;
  }

  VS.views.stats = {
    title: () => "Progress",
    crumbs: () => [],           // a main tab: the nav already says where you are

    render() {
      const t = VS.store.totals();
      const history = VS.store.history();
      const totalSec = history.reduce((n, r) => n + r.seconds, 0);
      const answered = history.reduce((n, r) => n + r.answered, 0);
      const right = history.reduce((n, r) => n + r.right, 0);
      const d14 = lastDays(14);
      const d30 = lastDays(30);
      const boxes = VS.store.boxes();

      if (!history.length) {
        return html`<div class="page view-enter"><div class="empty">
          <h1>Your progress shows up here</h1>
          <p>Study a set or answer a quiz, and your days start filling in.</p>
          <a class="btn btn-primary" href="#/">Start studying</a></div></div>`;
      }

      return html`
        <div class="page view-enter">
          <header class="page-head"><div><h1>Your progress</h1><p class="hint">Since ${longDate(history[0].date)}</p></div></header>

          <section class="card stats-week" aria-labelledby="sw-title">
            <div class="section-title"><h2 id="sw-title">This week</h2>
              <a class="btn btn-quiet" href="#/week">Open your week ${icon("arrow-right", "icon-sm")}</a></div>
            ${VS.ui.weekStrip(VS.week.summary())}
            <p class="hint">Weeks run Saturday to Friday. The full report opens on Thursday.</p>
          </section>
          ${VS.ui.milestone()}

          <dl class="stat-tiles card">
            <div><dt>${icon("clock", "icon-sm")} Study time</dt><dd>${VS.formatDuration(totalSec)}</dd></div>
            <div><dt>${icon("flame", "icon-sm")} Days studied</dt><dd>${history.length} <small>${t.streak}-day streak</small></dd></div>
            <div><dt>${icon("target", "icon-sm")} Accuracy</dt><dd>${VS.accuracyText(right, answered)}${answered >= 30 ? html` <small>${answered.toLocaleString("en-GB")} answers</small>` : ""}</dd></div>
            <div><dt>${icon("star", "icon-sm")} Mastered</dt><dd>${t.mastered} <small>of ${t.words}</small></dd></div>
          </dl>

          ${forecast()}
          <div class="chart-grid">
            ${barChart({
              id: "time", title: "Study time", sub: "Minutes per day, last 14 days", unit: "m",
              items: d14.map((d, i) => ({ label: dayLabel(d.date, i, 14), value: Math.round(d.seconds / 60), tip: longDate(d.date) + ": " + VS.formatDuration(d.seconds) })),
            })}
            ${barChart({
              id: "answers", title: "Practice", sub: "Answers per day, last 14 days",
              items: d14.map((d, i) => ({ label: dayLabel(d.date, i, 14), value: d.answered,
                tip: longDate(d.date) + ": " + d.answered + " answers" + (d.answered ? ", " + Math.round((d.right / d.answered) * 100) + "% right" : "") })),
            })}
            ${barChart({
              id: "mastered", title: "Mastered words", sub: "Total at the end of each day, last 30 days",
              items: d30.map((d, i) => ({ label: dayLabel(d.date, i, 30), value: d.mastered, tip: longDate(d.date) + ": " + d.mastered + " mastered" })),
            })}
            ${barChart({
              id: "boxes", title: "Your words on the ruler",
              // Unstudied words aren't memory yet: they'd dwarf every other bar, so they go in the subtitle.
              sub: "How many days each word waits before it comes back · " + boxes[0] + " not studied yet",
              items: boxes.slice(1).map((n, i) => ({ label: String([1, 3, 7, 14, 30, 60][i]), value: n, tone: "seq-" + (i + 1), tip: BOX_LABELS[i + 1] + ": " + VS.plural(n, "word") })),
            })}
          </div>
          <p class="hint stats-note">Remember a word on its day and it moves one step along the ruler. Mastered means it came back after a week or more, and now waits two weeks.</p>
        </div>`;
    },
  };
})();
