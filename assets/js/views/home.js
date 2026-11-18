/* views/home.js — today's plan, shown at the top of the library.
   ------------------------------------------------------------------
   The library is the home screen (views/library.js). Above the words, one
   card answers "what should I do now?", in the order that builds memory:

     1. Recall           the words due today (spaced repetition)
     2. Learn new words  the next words you added (Settings → New words per day)
     3. Practise today's words — Quiz, Spell, Match (and Speak when it's on)

     VS.today.plan()   → { steps, next, learned, newLeft } — data only
     VS.today.strip()  → the card's markup
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;

  const PRACTICE = {
    quiz: { icon: "quiz", name: "Quiz" },
    spell: { icon: "spell", name: "Spell" },
    match: { icon: "match", name: "Match" },
    write: { icon: "pen", name: "Use it" },
    speak: { icon: "mic", name: "Speak" },
  };

  /* Each step knows whether it's done, open, or still waiting. */
  function plan() {
    const t = VS.store.totals();
    const newLeft = VS.store.newWords().length;
    const remaining = VS.newLeftToday();      // today's allowance, not a per-session batch
    const learnDone = remaining === 0 || (newLeft === 0 && t.newToday > 0);
    const steps = [
      { key: "recall", icon: "review", name: "Recall", href: "#/recall",
        done: !t.due && t.started > 0, open: t.due > 0, count: t.due },
    ];
    // A "Learn" chip exists only while there is something to learn today.
    if (newLeft > 0 || t.newToday > 0) steps.push({
      key: "learn", icon: "cards", name: "Learn", href: "#/new/cards",
      done: learnDone, open: newLeft > 0 && remaining > 0,
      count: learnDone ? 0 : Math.min(remaining, newLeft),
    });
    VS.todaySteps().forEach((mode) => steps.push({
      key: mode, icon: PRACTICE[mode].icon, name: PRACTICE[mode].name, href: "#/today/" + mode,
      done: t.learnedToday.length > 0 && VS.store.doneToday(mode), open: t.learnedToday.length > 0, count: 0,
    }));
    return { t, steps, next: steps.find((s) => s.open && !s.done),
             learned: t.learnedToday.length, newLeft };
  }

  /* One sentence for the next step — the thing to do now. */
  function headline(p) {
    const n = p.next;
    if (!n) {
      if (!p.t.started && !p.newLeft) return {
        markup: html`Add the words you want to remember.`,
        line: "Type one above — the app does the rest.",
      };
      const next = VS.store.nextReview();
      if (next) return {
        markup: html`You're done for today.`,
        line: "Next recall: " + VS.plural(next.count, "word") + " " + VS.ui.whenText(next.date) + ".",
      };
      // New words left, but today's allowance is used: say so instead of asking for more words.
      if (p.newLeft) return {
        markup: html`You're done for today.`,
        line: "That's your " + VS.plural(VS.newPerDay(), "new word") + " for today. More tomorrow.",
      };
      return { markup: html`You're done for today.`, line: "Add more words to keep learning." };
    }
    if (n.key === "recall") return {
      markup: html`<mark class="mark">${VS.plural(n.count, "word")}</mark> to recall.`,
      line: "Bring each one back from memory before it fades.",
    };
    // The very first word: name it, and say how long it takes.
    if (n.key === "learn" && !p.t.started && VS.allWords().length === 1) return {
      markup: html`<mark class="mark">${VS.allWords()[0].word}</mark> is in.`,
      line: "Learn it now — it takes about a minute.",
      cta: "Learn it now",
    };
    if (n.key === "learn") return {
      markup: html`<mark class="mark">${VS.plural(n.count, "new word")}</mark> to learn.`,
      line: "Meet each one once: meaning, Arabic, example and sound.",
    };
    return {
      markup: html`Make today's words stick.`,
      line: "Practise the " + VS.plural(p.learned, "word") + " you learned today, a few different ways.",
    };
  }

  /* Daily goal: answers across every activity, against Settings → Daily goal.
     On the dark hero it is one quiet line with a short track. */
  function goal(t) {
    const target = VS.store.settings().dailyGoal || 0;
    // No goal before the first session: "0 / 50" on day one is a debt, not a goal.
    if (!target || !t.words || !t.started) return "";
    const done = (t.today.answered || 0) + (t.today.met || 0);     // answers, plus new words met on cards
    const reached = done >= target;
    const pct = Math.min(100, Math.round((done / target) * 100));
    return html`
      <div class="today-goal ${reached ? "is-done" : ""}">
        <span class="today-goal-label">${icon(reached ? "check" : "target", "icon-sm")} <span><span class="today-goal-extra">Daily </span>Goal</span> <b>${done}</b><span class="today-goal-sep">/</span>${target}<span class="today-goal-unit"> answers</span></span>
        <span class="today-goal-track" role="progressbar" aria-label="Daily goal: ${done} of ${target} answers"
             aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(done, target)}">
          <i style="width:${pct}%"></i>
        </span>
      </div>`;
  }

  /* Shortcuts to the other things that help today's words stick. The
     primary action above already covers the next step, so it is left out. */
  function shortcuts(p) {
    const keys = ["learn", "quiz", "spell", "match", "write", "speak"];
    const items = p.steps.filter((s) => keys.includes(s.key) &&
      (!p.next || s.key !== p.next.key) && (s.open || (s.done && s.key !== "learn")));
    const quick = p.t.started >= 3 && VS.store.quickWords(10).length >= 2;
    // One next step, then at most three quiet alternatives (critique v10: the
    // hero offered seven ways to start). Open steps before finished ones; the
    // rest stay one tap away in the library's Practise menu.
    items.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
    items.splice(quick ? 2 : 3);
    if (!items.length && !quick) return "";
    return html`
      <ol class="today-steps" aria-label="More ways to practise today's words">
        ${items.map((s) => html`
          <li class="${s.done ? "is-done" : ""}">
            <a href="${s.href}">${icon(s.done ? "check" : s.icon, "icon-sm")}<span>${s.name}</span>${s.count ? html`<b>${s.count}</b>` : ""}</a>
          </li>`)}
        ${quick ? html`<li class="is-quick"><a href="#/quick">${icon("bolt", "icon-sm")}<span>5-minute review</span></a></li>` : ""}
      </ol>`;
  }

  /* ── A reason to come back tomorrow ──────────────────────────────
     The whole method is "come back on the right day", and nothing used to
     say so once the day was done. Now the card says what tomorrow holds,
     and one tap adds a daily reminder to the learner's own calendar: an
     .ics file (iPhone, Android, Outlook all read it). No server, no
     account, no notifications permission — the calendar does the reminding. */
  const reminderAt = () => {               // the hour they study now: "same time tomorrow"
    const h = new Date().getHours();
    return h < 7 ? 20 : h >= 23 ? 21 : h + 1;
  };
  const hourText = (h) => (h % 12 || 12) + (h < 12 ? " AM" : " PM");
  const reminderAdded = () => VS.store.reminder();

  function tomorrow(p) {
    // Once recall and today's new words are done: practice is a bonus, tomorrow is the plan.
    if (!p.t.started || (p.next && (p.next.key === "recall" || p.next.key === "learn"))) return "";
    const n = (VS.store.forecast()[1] || {}).count || 0;
    const min = Math.max(1, Math.round((n * 20) / 60));     // about 20 seconds a word in Recall
    const added = reminderAdded();
    return html`
      <div class="today-tomorrow">
        <p>${n
          ? html`Tomorrow: <b>${VS.plural(n, "word")}</b> to recall · about ${min} min.`
          : html`Nothing due tomorrow — a good day to add new words.`}</p>
        ${added
          ? html`<p class="hint">${icon("check", "icon-sm")} Daily reminder in your calendar (${added}).
              <button class="link-btn" type="button" data-action="daily-reminder">Add it again</button></p>`
          : html`<button class="btn btn-tonal" type="button" data-action="daily-reminder">${icon("clock", "icon-sm")}
              Add a daily reminder to my calendar (${hourText(reminderAt())})</button>
              <span class="hint">Saves a small calendar file — open it to add the reminder.</span>`}
      </div>`;
  }

  /** A daily calendar event with an alert, as a file the calendar app opens. */
  VS.actions["daily-reminder"] = () => {
    const h = reminderAt();
    const d = new Date(); d.setDate(d.getDate() + 1);
    const pad = (x) => String(x).padStart(2, "0");
    const day = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
    const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const url = location.origin + location.pathname;
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//VocabStudy//Daily reminder//EN", "BEGIN:VEVENT",
      "UID:vocabstudy-daily-" + day + "@vocabstudy", "DTSTAMP:" + now,
      "DTSTART:" + day + "T" + pad(h) + "0000", "DURATION:PT10M", "RRULE:FREQ=DAILY",
      "SUMMARY:VocabStudy — recall your words",
      "DESCRIPTION:A few minutes today keeps them for good. Open VocabStudy: " + url,
      "URL:" + url,
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Time for VocabStudy", "TRIGGER:PT0M", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "vocabstudy-daily-reminder.ics";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    VS.store.setReminder(hourText(h));
    VS.toast("Open the file to add the reminder to your calendar.");
    VS.app.render();
  };

  function strip() {
    const p = plan();
    const h = headline(p);
    const streak = p.t.streak || 0;
    const cta = h.cta || p.next && (p.next.key === "recall" ? "Start recall"
      : p.next.key === "learn" ? "Learn new words"
      : "Start " + p.next.name.toLowerCase());
    const goalMarkup = goal(p.t);
    return html`
      <section class="today-hero ${p.next ? "" : "is-done"}" aria-labelledby="today-title">
        ${streak || goalMarkup ? html`
          <div class="today-top">
            ${streak ? html`<span class="today-streak" title="${streak} days in a row">${icon("flame", "icon-sm")} ${streak}-day streak</span>` : html`<span></span>`}
            ${goalMarkup}
          </div>` : ""}
        <div class="today-copy">
          <h1 id="today-title">${h.markup}</h1>
          <p class="today-line">${h.line}</p>
        </div>
        ${p.next ? html`<a class="today-cta" href="${p.next.href}">
          <span>${cta}</span><span class="today-cta-ico">${icon("arrow-right", "icon-sm")}</span>
        </a>` : ""}
        ${shortcuts(p)}
        ${tomorrow(p)}
      </section>`;
  }

  VS.today = { plan, strip };
})();
