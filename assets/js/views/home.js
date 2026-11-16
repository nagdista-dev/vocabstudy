/* views/home.js — the hub (index.html).
   The question a learner has when they open the app is "what should I do
   today?". So home is today's plan, in the order that builds memory:

     1. Recall          the words due today (spaced repetition)
     2. Learn new words the next words from your library (Settings → New words per day)
     3. Practise today's words — Quiz, Spell, Match (and Speak where the browser can listen)

   Below it: your numbers, words you keep missing, the week ahead and a
   summary of your library. Every word lives in one library (#/words). */
(function () {
  "use strict";
  const { html, icon } = VS;

  const MODES = [
    { mode: "cards", icon: "cards", name: "Cards", text: "Flip through words" },
    { mode: "quiz", icon: "quiz", name: "Quiz", text: "Mixed questions" },
    { mode: "spell", icon: "spell", name: "Spell", text: "Hear it, type it" },
    { mode: "match", icon: "match", name: "Match", text: "Beat the clock" },
  ];
  const PRACTICE = {
    quiz: { icon: "quiz", name: "Quiz", text: "Meaning, Arabic and fill the gap." },
    spell: { icon: "spell", name: "Spell", text: "Hear each word and type it." },
    match: { icon: "match", name: "Match", text: "Pair English with Arabic against the clock." },
    speak: { icon: "mic", name: "Speak", text: "Say each word out loud; the app listens." },
  };

  /* A first visit: no words of their own and nothing studied yet. */
  const isNewLearner = (t) => !t.started && !VS.allWords().some((w) => w.custom);

  function welcome() {
    const starter = VS.allWords().some((w) => w.source === "starter");
    return html`
      <div class="today-main">
        <h1>Learn your English words — and keep them.</h1>
        <ol class="welcome-steps">
          <li><b>Type a word</b> — the app fills in the meaning, Arabic, example and sound.</li>
          <li><b>Learn</b> a few each day, in short rounds.</li>
          <li><b>Recall</b> them on spaced days, so they stay for good.</li>
        </ol>
        <div class="row">
          <a class="btn btn-primary btn-lg" href="#/add">${icon("plus")} Add your first words</a>
          ${starter ? html`<a class="btn btn-lg" href="#/new/cards">Try the Starter words</a>` : ""}
        </div>
        <p class="hint">Free and open source. No account, no server: your words and progress stay on this device.</p>
      </div>`;
  }

  /* Today's plan as data: each step knows if it's done, open, or waiting. */
  function plan(t) {
    const perDay = VS.newPerDay();
    const newLeft = VS.store.newWords().length;
    const learned = t.learnedToday.length;
    const learnDone = learned >= perDay || (learned > 0 && VS.store.doneToday("learn")) || (!newLeft && learned > 0);
    const steps = [{
      key: "recall", icon: "review", name: "Recall",
      href: "#/recall", done: !t.due && t.started > 0, open: t.due > 0,
      text: t.due ? VS.plural(t.due, "word") + " due — bring them back from memory."
        : t.started ? "Nothing due. Your next words come back on their day." : "Words come back here after you learn them.",
    }, {
      key: "learn", icon: "cards", name: "Learn new words",
      href: "#/new/cards", done: learnDone, open: newLeft > 0,
      text: learnDone ? VS.plural(learned, "new word") + " learned today." + (newLeft ? " Want more? Learn " + Math.min(perDay, newLeft) + " more." : "")
        : newLeft ? "The next " + VS.plural(Math.min(perDay, newLeft), "word") + " from your library."
        : "Every word in your library is started. Add more words to keep learning.",
      again: learnDone && newLeft ? "Learn more" : "",
    }];
    VS.todaySteps().forEach((mode) => {
      const p = PRACTICE[mode];
      steps.push({
        key: mode, icon: p.icon, name: p.name + " today's words", href: "#/today/" + mode,
        done: learned > 0 && VS.store.doneToday(mode), open: learned > 0,
        text: learned ? p.text : "Opens after you learn today's new words.",
      });
    });
    const next = steps.find((s) => s.open && !s.done);
    return { steps, next, learned, newLeft };
  }

  function todayPanel(t, p) {
    if (isNewLearner(t)) return welcome();
    const n = p.next;
    let title, line;
    if (!n) {
      title = html`You're done for today.`;
      const next = VS.store.nextReview();
      line = next ? html`Next recall: ${VS.plural(next.count, "word")} ${VS.ui.whenText(next.date)}. Rest is part of remembering.`
        : p.newLeft ? "Every step is done. You can learn a few more words, or come back tomorrow." : "Add new words to your library to keep going.";
    } else if (n.key === "recall") {
      title = html`<span class="today-count">${t.due}</span> ${t.due === 1 ? "word is" : "words are"} ready for recall.`;
      line = "See the meaning, bring the English word back from memory, then check yourself. A few minutes now saves relearning later.";
    } else if (n.key === "learn") {
      const k = Math.min(VS.newPerDay(), p.newLeft);
      title = html`Learn <span class="today-count">${k}</span> new ${k === 1 ? "word" : "words"} today.`;
      line = "Meet each word once: meaning, Arabic, example and sound. They come back for recall tomorrow.";
    } else {
      title = html`Make today's ${p.learned === 1 ? "word" : VS.plural(p.learned, "word")} stick.`;
      line = "Practise them now, in a few different ways, before they fade.";
    }
    return html`
      <div class="today-main">
        <h1>${title}</h1>
        <p class="muted">${line}</p>
        ${n ? html`<a class="btn btn-primary btn-lg" href="${n.href}">${icon(n.icon)} ${n.key === "recall" ? "Start recall" : n.name}</a>`
          : p.newLeft ? html`<a class="btn btn-lg" href="#/new/cards">${icon("cards")} Learn more words</a>`
          : html`<a class="btn btn-primary btn-lg" href="#/add">${icon("plus")} Add words</a>`}
      </div>`;
  }

  function planList(p) {
    return html`
      <section aria-labelledby="plan-title">
        <div class="section-title"><h2 id="plan-title">Today's plan</h2>
          <span class="hint">${p.next ? "Next: " + p.next.name : "All done for today"}</span></div>
        <ol class="steps">
          ${p.steps.map((s, i) => html`
            <li class="step ${p.next === s ? "is-next" : ""} ${s.done ? "is-done" : ""} ${!s.open && !s.done ? "is-waiting" : ""}">
              <span class="step-n" aria-hidden="true">${s.done ? icon("check", "icon-sm") : i + 1}</span>
              <span class="step-ico" aria-hidden="true">${icon(s.icon)}</span>
              <span class="step-copy"><b>${s.name}</b><span class="hint">${s.text}</span></span>
              ${s.open || s.again
                ? html`<a class="btn ${p.next === s ? "btn-primary" : ""}" href="${s.href}">${s.again || (s.done ? "Again" : "Start")}</a>`
                : html`<span class="sr-only">${s.done ? "Done" : "Not available yet"}</span>`}
            </li>`)}
        </ol>
      </section>`;
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
          <a class="btn btn-quiet" href="#/words?q=${encodeURIComponent(w.word)}">Open in library</a>
          <button class="btn" type="button" data-action="spotlight-next">Next word ${icon("arrow-right", "icon-sm")}</button>
        </div>
      </aside>`;
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
          <a class="btn" href="#/words?tricky=1">${icon("book", "icon-sm")} See them</a>
        </div>
      </section>`;
  }

  /* The library at a glance: how much is new, learning and mastered, and your tags. */
  function librarySummary() {
    const s = VS.store.statsFor(VS.allWords());
    const seg = (n) => (s.total ? (n / s.total) * 100 : 0).toFixed(2) + "%";
    const tags = VS.allTags().slice(0, 8);
    const link = (q, label, n) => html`<a class="lib-count" href="#/words${q ? "?" + q : ""}"><b>${n}</b><span>${label}</span></a>`;
    return html`
      <section class="library-card card" aria-labelledby="lib-title">
        <div class="section-title">
          <h2 id="lib-title">Your library</h2>
          <span class="row">
            <a class="btn btn-quiet" href="#/add">${icon("plus", "icon-sm")} Add words</a>
            <a class="btn" href="#/words">${icon("book", "icon-sm")} Open library</a>
          </span>
        </div>
        <span class="mix-bar" aria-hidden="true">
          <i class="is-mastered" style="width:${seg(s.mastered)}"></i>
          <i class="is-learning" style="width:${seg(s.learning)}"></i>
        </span>
        <div class="lib-counts">
          ${link("", "words", s.total)}
          ${link("status=new", "new", s.new)}
          ${link("status=learning", "learning", s.learning)}
          ${link("status=mastered", "mastered", s.mastered)}
          ${link("status=due", "due today", s.due)}
        </div>
        ${tags.length ? html`<p class="row lib-tags">${tags.map((x) => html`<a class="tag" href="#/words?tag=${encodeURIComponent(x.tag)}">#${x.tag} <small>${x.count}</small></a>`)}</p>` : ""}
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
      const p = plan(t);
      const fresh = !t.started;
      const newcomer = isNewLearner(t);
      return html`
        <div class="page view-enter">
          <section class="today card">
            <div class="today-left">${todayPanel(t, p)}${newcomer ? "" : goal(t)}</div>
            ${spotlight()}
          </section>
          ${fresh ? "" : stats(t)}

          ${backupNudge(t)}
          ${newcomer ? "" : planList(p)}
          ${tricky()}
          ${forecast()}
          ${VS.allWords().length ? librarySummary() : html`<div class="empty"><h2>Your library is empty</h2>
            <p>Add the words you want to learn — they stay on this device.</p><a class="btn btn-primary" href="#/add">${icon("plus")} Add words</a></div>`}

          ${fresh ? "" : html`<section aria-labelledby="all-title">
            <div class="section-title"><h2 id="all-title">Practise your whole library</h2>
              <span class="hint">${VS.plural(t.words, "word")}, weakest first</span></div>
            <div class="mode-grid">
              ${MODES.map((m) => html`
                <a class="mode card" href="#/all/${m.mode}">
                  <span class="mode-ico">${icon(m.icon)}</span>
                  <span><b>${m.name}</b><span class="hint">${m.text}</span></span>
                </a>`)}
            </div>
          </section>`}

          ${newcomer ? "" : html`<section class="how">
            <h2>How it works</h2>
            <ol>
              <li><b>Learn</b> a few new words from your library each day — meaning, example, sound.</li>
              <li><b>Practise</b> them the same day with Quiz, Spell, Match and Speak.</li>
              <li><b>Recall</b> them on later days. Each word you remember waits longer before it comes back: 1, 3, 7, 14, 30, then 60 days. Forget it, and it returns tomorrow.</li>
            </ol>
          </section>`}
        </div>`;
    },
  };
})();
