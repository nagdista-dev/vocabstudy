/* views/home.js — the hub (index.html).
   The question a learner has when they open the app is "what should I do
   today?". So the first thing on screen answers it: words due for recall,
   then the day sets with their progress. */
(function () {
  "use strict";
  const { html, icon } = VS;

  const MODES = [
    { mode: "cards", icon: "cards", name: "Cards", text: "Flip through words" },
    { mode: "quiz", icon: "quiz", name: "Quiz", text: "Mixed questions" },
    { mode: "spell", icon: "spell", name: "Spell", text: "Hear it, type it" },
    { mode: "match", icon: "match", name: "Match", text: "Beat the clock" },
  ];

  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }

  function todayPanel(t) {
    if (!t.started) {
      const newest = VS.days[0];
      return html`
        <div class="today-main">
          <p class="eyebrow">${greeting()}</p>
          <h1>Start with your newest word set.</h1>
          <p class="muted">Study the cards once. From tomorrow, the words you studied come back here for recall, spaced out so they stick.</p>
          ${newest ? html`<a class="btn btn-primary btn-lg" href="${VS.dayHref(newest.iso)}">${icon("cards")} Study ${newest.label}</a>` : ""}
        </div>`;
    }
    if (t.due) {
      return html`
        <div class="today-main">
          <p class="eyebrow">${greeting()}</p>
          <h1><span class="today-count">${t.due}</span> ${t.due === 1 ? "word is" : "words are"} ready for recall.</h1>
          <p class="muted">See the meaning, bring the English word back from memory, then check yourself. A few minutes now saves relearning later.</p>
          <div class="row">
            <a class="btn btn-primary btn-lg" href="#/recall">${icon("review")} Start recall</a>
            <a class="btn btn-lg btn-quiet" href="#/print/recall">${icon("print", "icon-sm")} Print them</a>
          </div>
        </div>`;
    }
    const next = VS.store.nextReview();
    return html`
      <div class="today-main">
        <p class="eyebrow">${greeting()}</p>
        <h1>You're all caught up.</h1>
        <p class="muted">${next
          ? html`Next recall: ${VS.plural(next.count, "word")} ${VS.ui.whenText(next.date)}. Meanwhile, study a new set or practise one you know.`
          : "Study a new set to start your recall schedule."}</p>
        ${VS.days[0] ? html`<a class="btn btn-primary btn-lg" href="${VS.dayHref(VS.days[0].iso)}">${icon("cards")} Open ${VS.days[0].label}</a>` : ""}
      </div>`;
  }

  /* Today's goal: answers given today against Settings → Daily goal. */
  function goal(t) {
    const target = VS.store.settings().dailyGoal;
    if (!target) return "";
    const done = t.today.answered;
    const pct = Math.min(100, Math.round((done / target) * 100));
    return html`
      <div class="goal" title="Change it in Settings">
        <div class="goal-line">
          <span>${done >= target ? html`${icon("check", "icon-sm")} Daily goal reached` : "Daily goal"}</span>
          <b>${Math.min(done, target)} / ${target} answers</b>
        </div>
        <div class="progress ${done >= target ? "is-good" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${done}">
          <i style="--value:${pct}%"></i>
        </div>
      </div>`;
  }

  function stats(t) {
    const acc = t.today.answered ? Math.round((t.today.right / t.today.answered) * 100) + "%" : "—";
    return html`
      <dl class="today-stats">
        <div><dt>${icon("flame", "icon-sm")} Streak</dt><dd>${VS.plural(t.streak, "day")}</dd></div>
        <div><dt>${icon("star", "icon-sm")} Mastered</dt><dd>${t.mastered} <small>/ ${t.words}</small></dd></div>
        <div><dt>${icon("clock", "icon-sm")} Studied today</dt><dd>${VS.formatDuration(t.today.seconds)}</dd></div>
        <div><dt>${icon("target", "icon-sm")} Answers today</dt><dd>${t.today.answered} <small>· ${acc} right</small></dd></div>
      </dl>`;
  }

  function dayCard(day) {
    const s = VS.store.dayStats(day);
    const state = s.started === 0 ? "Not started" : s.mastered === s.total ? "Mastered" : s.percent + "% mastered";
    const seg = (n) => (s.total ? (n / s.total) * 100 : 0).toFixed(2) + "%";
    return html`
      <a class="day-card card" href="${VS.dayHref(day.iso)}">
        <span class="day-card-top">
          <span>
            <b class="day-card-date">${day.label}</b>
            <span class="hint">${day.weekday} · ${VS.plural(s.total, "word")}</span>
          </span>
          ${s.due ? html`<span class="badge is-due">${s.due} due</span>` : ""}
        </span>
        <span class="mix-bar" aria-hidden="true">
          <i class="is-mastered" style="width:${seg(s.mastered)}"></i>
          <i class="is-learning" style="width:${seg(s.learning)}"></i>
        </span>
        <span class="day-card-foot">
          <span class="hint">${state}</span>
          ${icon("arrow-right", "icon-sm")}
        </span>
      </a>`;
  }

  /* Days grouped by month, newest first. With a year of daily sets the
     page stays short: the latest two months are open, older ones fold. */
  function monthGroups() {
    const months = [];
    VS.days.forEach((d) => {
      const key = d.iso.slice(0, 7);
      let m = months[months.length - 1];
      if (!m || m.key !== key) months.push((m = { key, days: [] }));
      m.days.push(d);
    });
    return months.map((m, i) => {
      const label = m.days[0].date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      const words = m.days.reduce((n, d) => n + d.words.length, 0);
      const due = m.days.reduce((n, d) => n + VS.store.dayStats(d).due, 0);
      return html`
        <details class="month" ${i < 2 ? VS.raw("open") : ""}>
          <summary>
            <h3>${label}</h3>
            <span class="hint">${VS.plural(m.days.length, "day")} · ${VS.plural(words, "word")}</span>
            ${due ? html`<span class="badge is-due">${due} due</span>` : ""}
            ${icon("chevron-right", "icon-sm month-chev")}
          </summary>
          <div class="day-grid">${m.days.map(dayCard)}</div>
        </details>`;
    });
  }

  /* Next 7 days of recall, as small bars: plan your week at a glance. */
  function forecast() {
    const days = VS.store.forecast();
    const max = Math.max(1, ...days.map((d) => d.count));
    if (!days.some((d) => d.count)) return "";
    return html`
      <section class="forecast" aria-labelledby="fc-title">
        <div class="section-title"><h2 id="fc-title">Recall this week</h2>
          <span class="hint">${VS.plural(days.reduce((n, d) => n + d.count, 0), "word")} in 7 days</span></div>
        <ol class="fc-bars card">
          ${days.map((d, i) => {
            const day = new Date(d.date + "T12:00:00");
            return html`
              <li class="${i === 0 ? "is-today" : ""}" title="${d.count} on ${day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}">
                <b>${d.count || ""}</b>
                <span class="fc-bar"><i style="height:${Math.round((d.count / max) * 100)}%"></i></span>
                <small>${i === 0 ? "Today" : day.toLocaleDateString("en-GB", { weekday: "short" })}</small>
              </li>`;
          })}
        </ol>
      </section>`;
  }

  /* Words missed again and again get their own practice. */
  function tricky() {
    const words = VS.store.trickyWords();
    if (!words.length) return "";
    return html`
      <section class="tricky card">
        <div>
          <h2>${VS.plural(words.length, "tricky word")}</h2>
          <p class="hint">You've missed these several times. A focused round now stops them slipping away.</p>
          <p class="tricky-words">${words.slice(0, 8).map((w) => html`<span class="badge">${w.word}</span>`)}${words.length > 8 ? html`<span class="hint">+${words.length - 8} more</span>` : ""}</p>
        </div>
        <div class="row">
          <a class="btn btn-primary" href="#/tricky/quiz">${icon("quiz", "icon-sm")} Quiz them</a>
          <a class="btn" href="#/tricky/spell">${icon("spell", "icon-sm")} Spell them</a>
          <a class="btn" href="#/tricky/cards">${icon("cards", "icon-sm")} Cards</a>
        </div>
      </section>`;
  }

  VS.views.home = {
    title: () => "VocabStudy",
    crumbs: () => [],

    render() {
      const t = VS.store.totals();
      return html`
        <div class="page view-enter">
          <section class="today card">
            <div class="today-left">${todayPanel(t)}${goal(t)}</div>
            ${stats(t)}
          </section>

          ${tricky()}
          ${forecast()}

          <div class="section-title">
            <h2>Your word sets</h2>
            <span class="row"><span class="hint">${VS.plural(VS.days.length, "day")} · ${VS.plural(t.words, "word")}</span>
              <a class="btn btn-quiet" href="#/add">${icon("plus", "icon-sm")} Add words</a></span>
          </div>
          ${VS.days.length
            ? monthGroups()
            : html`<div class="empty"><h2>No word sets yet</h2><p>Add a file to data/days/ and run python3 tools/build.py.</p></div>`}

          <section aria-labelledby="all-title">
            <div class="section-title"><h2 id="all-title">Practise everything</h2>
              <span class="hint">Mixed from all ${VS.plural(t.words, "word")}, weakest first</span></div>
            <div class="mode-grid">
              ${MODES.map((m) => html`
                <a class="mode card" href="#/all/${m.mode}">
                  <span class="mode-ico">${icon(m.icon)}</span>
                  <span><b>${m.name}</b><span class="hint">${m.text}</span></span>
                </a>`)}
            </div>
          </section>

          <section class="how">
            <h2>How recall works</h2>
            <ol>
              <li><b>Study</b> a day's cards once — meaning, example, sound.</li>
              <li><b>Practise</b> it the same day with Quiz, Spell and Match.</li>
              <li><b>Recall</b> it on later days. Each word you remember waits longer before it comes back: 1, 3, 7, 14, 30, then 60 days. Forget it, and it returns tomorrow.</li>
            </ol>
          </section>
        </div>`;
    },
  };
})();
