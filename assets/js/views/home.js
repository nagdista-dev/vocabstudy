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

  /* A first visit: no words of their own and nothing studied yet. */
  const isNewLearner = (t) => !t.started && !VS.allWords().some((w) => w.custom);

  function welcome() {
    const sample = VS.days.find((d) => d.sample);
    return html`
      <div class="today-main">
        <h1>Learn your English words — and keep them.</h1>
        <ol class="welcome-steps">
          <li><b>Add your words</b> — type them, paste a table, or upload a file.</li>
          <li><b>Study</b> them once: meaning, Arabic, example and sound.</li>
          <li><b>Recall</b> them on spaced days, so they stay for good.</li>
        </ol>
        <div class="row">
          <a class="btn btn-primary btn-lg" href="#/add">${icon("plus")} Add your first words</a>
          ${sample ? html`<a class="btn btn-lg" href="${VS.dayHref(sample.iso)}">Try the Starter set</a>` : ""}
        </div>
        <p class="hint">Free, no account. Your words and progress stay on this device.</p>
      </div>`;
  }

  function todayPanel(t) {
    if (isNewLearner(t)) return welcome();
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
    const acc = t.today.answered ? "· " + Math.round((t.today.right / t.today.answered) * 100) + "% right" : "";
    const tile = (tone, ico, label, value, small) => html`
      <div class="stat-tile tone-${tone}">
        <span class="stat-ico">${icon(ico, "icon-sm")}</span>
        <span><dt>${label}</dt><dd>${value}${small ? html` <small>${small}</small>` : ""}</dd></span>
      </div>`;
    return html`
      <dl class="home-stats">
        ${tile("mark", "flame", "Streak", VS.plural(t.streak, "day"))}
        ${tile("good", "star", "Mastered", t.mastered, "/ " + t.words)}
        ${tile("brand", "clock", "Studied today", VS.formatDuration(t.today.seconds))}
        ${tile("brand", "target", "Answers today", t.today.answered, acc)}
      </dl>`;
  }

  /* Word spotlight: one of your words, big, with its sound and meaning.
     Opening the app teaches something before you even start. "Next" draws
     another — learning words first, then the rest. */
  let spotlightId = null;
  function pickSpotlight() {
    const all = VS.allWords();
    if (!all.length) return null;
    const learning = all.filter((w) => VS.store.status(w.id) === "learning");
    const pool = learning.length > 3 && Math.random() < 0.6 ? learning : all;
    let w = pool[Math.floor(Math.random() * pool.length)];
    if (w.id === spotlightId && pool.length > 1) w = pool[(pool.indexOf(w) + 1) % pool.length];
    spotlightId = w.id;
    return w;
  }
  function spotlight() {
    const w = (spotlightId && VS.byId[spotlightId]) || pickSpotlight();
    if (!w) return "";
    return html`
      <aside class="spotlight" aria-label="Word spotlight">
        <div class="row spotlight-top">
          <span class="hint">Word spotlight</span>
          ${VS.ui.levelBadge(w)}<span class="badge">${w.type}</span>
        </div>
        <p class="spotlight-word"><span class="mark">${w.word}</span></p>
        <div class="row">${VS.ui.speakButton(w.word)}<span class="ipa">${w.ipa}</span></div>
        <p class="spotlight-ar" lang="ar">${w.arabic}</p>
        <p class="spotlight-ex">“${VS.ui.example(w)}”</p>
        <div class="row spotlight-foot">
          <a class="btn btn-quiet" href="${VS.dayHref(w.day)}">${VS.day(w.day).label}</a>
          <button class="btn" type="button" data-action="spotlight-next">Next word ${icon("arrow-right", "icon-sm")}</button>
        </div>
      </aside>`;
  }

  /* The set's CEFR spread as small badges: A2 ×3, B1 ×12 … */
  function levelMix(day) {
    const n = {};
    day.words.forEach((w) => { n[w.level] = (n[w.level] || 0) + 1; });
    return Object.keys(n).sort().map((l) => html`<span class="badge ${VS.levelGroup(l)}">${l} <small>${n[l]}</small></span>`);
  }

  function dayCard(day) {
    const s = VS.store.dayStats(day);
    const state = s.started === 0 ? "Not started" : s.mastered === s.total ? "Mastered" : s.percent + "% mastered";
    const seg = (n) => (s.total ? (n / s.total) * 100 : 0).toFixed(2) + "%";
    return html`
      <a class="day-card card" href="${VS.dayHref(day.iso)}">
        <span class="day-card-top">
          ${VS.ui.ring(s.percent, null, 48)}
          <span class="day-card-title">
            <b class="day-card-date">${day.label}</b>
            <span class="hint">${day.weekday} · ${VS.plural(s.total, "word")}</span>
          </span>
          ${s.due ? html`<span class="badge is-due">${s.due} due</span>` : ""}
        </span>
        <span class="day-levels">${levelMix(day)}</span>
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
      const label = m.days.every((d) => d.sample) ? "Getting started"
        : m.days[0].date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
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

  /* Progress lives in this browser: remind once a week to keep a copy. */
  function backupNudge(t) {
    if (t.started < 20) return "";
    const last = VS.store.lastBackup();
    const days = last ? Math.round((new Date(VS.todayKey()) - new Date(last)) / 864e5) : Infinity;
    if (days < 7) return "";
    return html`
      <a class="recall-strip backup-strip" href="#/data">
        ${icon("review")}
        <span><b>${last ? "Your last backup was " + days + " days ago" : "You haven't backed up your progress yet"}</b>
          <span class="hint">${VS.plural(t.started, "word")} of progress live only in this browser. One tap saves a copy.</span></span>
        ${icon("arrow-right", "icon-sm")}
      </a>`;
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

    actions: {
      "spotlight-next"() {
        pickSpotlight();
        const old = VS.$(".spotlight");
        if (old) { old.outerHTML = String(spotlight()); VS.speech.auto(VS.byId[spotlightId].word); }
      },
    },
    crumbs: () => [],

    render() {
      const t = VS.store.totals();
      // Before the first study session, home is only the welcome, the
      // spotlight and the sets: numbers at zero and practice modes for words
      // not yet met would compete with the one thing to do.
      const fresh = !t.started;
      return html`
        <div class="page view-enter">
          <section class="today card">
            <div class="today-left">${todayPanel(t)}${isNewLearner(t) ? "" : goal(t)}</div>
            ${spotlight()}
          </section>
          ${fresh ? "" : stats(t)}

          ${backupNudge(t)}
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

          ${fresh ? "" : html`<section aria-labelledby="all-title">
            <div class="section-title"><h2 id="all-title">Practise everything</h2>
              <span class="hint">Mixed from all ${VS.plural(t.words, "word")}, weakest first</span></div>
            <div class="mode-grid">
              ${MODES.map((m) => html`
                <a class="mode card" href="#/all/${m.mode}">
                  <span class="mode-ico">${icon(m.icon)}</span>
                  <span><b>${m.name}</b><span class="hint">${m.text}</span></span>
                </a>`)}
            </div>
          </section>`}

          ${isNewLearner(t) ? "" : html`<section class="how">
            <h2>How recall works</h2>
            <ol>
              <li><b>Study</b> a day's cards once — meaning, example, sound.</li>
              <li><b>Practise</b> it the same day with Quiz, Spell and Match.</li>
              <li><b>Recall</b> it on later days. Each word you remember waits longer before it comes back: 1, 3, 7, 14, 30, then 60 days. Forget it, and it returns tomorrow.</li>
            </ol>
          </section>`}
        </div>`;
    },
  };
})();
