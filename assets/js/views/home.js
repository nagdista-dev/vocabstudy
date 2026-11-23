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
        <span class="today-goal-label">${icon(reached ? "check" : "target", "icon-sm")} <span class="today-goal-word"><span class="today-goal-extra">Daily </span>goal</span> <b>${done}</b><span class="today-goal-sep">/</span>${target}<span class="today-goal-unit"> answers</span></span>
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
  const reminderAdded = () => VS.store.reminder();

  function tomorrow(p) {
    // Once recall and today's new words are done: practice is a bonus, tomorrow is the plan.
    if (!p.t.started || (p.next && (p.next.key === "recall" || p.next.key === "learn"))) return "";
    const n = (VS.store.forecast()[1] || {}).count || 0;
    const min = Math.max(1, Math.round((n * 20) / 60));     // about 20 seconds a word in Recall
    // The reminder offer shows until it is added or put away (×) — then the card
    // keeps just tomorrow's line. It stays in Settings → Daily reminder for later.
    const offer = !reminderAdded() && !VS.store.settings().reminderHidden;
    return html`
      <div class="today-tomorrow ${offer ? "" : "is-quiet"}">
        <p>${n
          ? html`Tomorrow: <b>${VS.plural(n, "word")}</b> to recall · about ${min} min.`
          : html`Nothing due tomorrow — a good day to add new words.`}</p>
        ${offer ? html`
          <div class="today-remind-row">
            <button class="btn today-remind" type="button" data-action="daily-reminder" title="Choose the time and the days, then add it to your calendar">${icon("clock", "icon-sm")}
              Set a study reminder</button>
            <button class="icon-btn today-remind-x" type="button" data-action="reminder-hide" aria-label="Hide the reminder offer">${icon("x", "icon-sm")}</button>
          </div>` : ""}
      </div>`;
  }

  VS.actions["reminder-hide"] = () => {
    VS.store.setSetting("reminderHidden", true);
    VS.app.render();
    VS.toast("Hidden. It's in Settings → Daily reminder whenever you want it.");
  };

  /* ── The study reminder: you choose the time and the days first ──
     A weekly repeating event on the days you pick (Sat → Fri, the app's week),
     so it fits your week — work days only, weekends only, or every day. */
  const DAYS = [["SA", "Sat"], ["SU", "Sun"], ["MO", "Mon"], ["TU", "Tue"], ["WE", "Wed"], ["TH", "Thu"], ["FR", "Fri"]];
  const JS_DAY = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const pad = (x) => String(x).padStart(2, "0");
  const rem = { time: "", days: null };            // the choice being made in the sheet
  const timeText = (t) => { const [h, m] = t.split(":").map(Number); return (h % 12 || 12) + (m ? ":" + pad(m) : "") + (h < 12 ? " AM" : " PM"); };
  const daysText = (days) => days.length === 7 ? "every day"
    : DAYS.filter(([d]) => days.includes(d)).map(([, l]) => l).join(" · ");

  function reminderMarkup() {
    const presets = [["Every day", DAYS.map(([d]) => d)], ["Sun – Thu", ["SU", "MO", "TU", "WE", "TH"]], ["Mon – Fri", ["MO", "TU", "WE", "TH", "FR"]]];
    const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
    return html`
      <div class="sheet-head"><h2 id="reminderTitle">Study reminder</h2>
        <button class="icon-btn" type="button" data-action="close-reminder" aria-label="Close">${icon("x")}</button></div>
      <div class="sheet-body remind-body">
        <p class="hint">Your calendar reminds you — on the days and at the time you choose. Change it any time.</p>
        <label class="remind-time"><span>Time</span>
          <input type="time" id="remindTime" value="${rem.time}" step="300"></label>
        <fieldset class="remind-days">
          <legend>Days</legend>
          <div class="remind-presets">${presets.map(([l, d]) => html`<button type="button" class="chip" data-action="remind-preset" data-days="${d.join(",")}" aria-pressed="${same(rem.days, d)}">${l}</button>`)}</div>
          <div class="remind-week">${DAYS.map(([d, l]) => html`<button type="button" data-action="remind-day" data-day="${d}" aria-pressed="${rem.days.includes(d)}">${l}</button>`)}</div>
        </fieldset>
        <p class="remind-sum" aria-live="polite">${rem.days.length
          ? html`${icon("clock", "icon-sm")}<span><b>${timeText(rem.time)}</b>, ${daysText(rem.days)}</span>`
          : "Pick at least one day."}</p>
        <button class="btn btn-primary" type="button" data-action="remind-add" ${rem.days.length ? "" : VS.raw("disabled")}>${icon("plus", "icon-sm")} Add to my calendar</button>
        <span class="hint">A small file opens in your calendar app — one tap there adds it.</span>
      </div>`;
  }
  const drawReminder = () => {
    const dlg = document.getElementById("reminder");
    if (!dlg) return;
    dlg.innerHTML = String(reminderMarkup());
    VS.$("#remindTime", dlg).addEventListener("change", (e) => { if (e.target.value) { rem.time = e.target.value; drawSum(); } });
  };
  const drawSum = () => {     // the line under the days, without redrawing the time field the learner is in
    const dlg = document.getElementById("reminder");
    const tmp = document.createElement("div");
    tmp.innerHTML = String(reminderMarkup());
    dlg.querySelector(".remind-sum").innerHTML = tmp.querySelector(".remind-sum").innerHTML;
  };

  /** Opens the reminder sheet with the last choice (or now + 1 h, every day). */
  VS.actions["daily-reminder"] = () => {
    const st = VS.store.settings();
    rem.time = st.reminderTime || pad(reminderAt()) + ":00";
    rem.days = Array.isArray(st.reminderDays) && st.reminderDays.length ? st.reminderDays.slice() : DAYS.map(([d]) => d);
    const settings = document.getElementById("settings");
    if (settings && settings.open) settings.close();
    let dlg = document.getElementById("reminder");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "reminder";
      dlg.className = "sheet";
      dlg.setAttribute("aria-labelledby", "reminderTitle");
      document.body.appendChild(dlg);
    }
    drawReminder();
    dlg.showModal();
  };
  VS.actions["close-reminder"] = () => document.getElementById("reminder").close();
  VS.actions["remind-day"] = (el) => {
    const d = el.dataset.day;
    rem.days = rem.days.includes(d) ? rem.days.filter((x) => x !== d) : rem.days.concat(d);
    keepTime(); drawReminder();
  };
  VS.actions["remind-preset"] = (el) => { rem.days = el.dataset.days.split(","); keepTime(); drawReminder(); };
  const keepTime = () => { const t = VS.$("#remindTime"); if (t && t.value) rem.time = t.value; };

  /** The calendar file: a weekly event on the chosen days, with an alert. */
  VS.actions["remind-add"] = () => {
    keepTime();
    if (!rem.days.length || !rem.time) return;
    const [h, m] = rem.time.split(":").map(Number);
    // The first chosen day still ahead (today counts if the time hasn't passed).
    const d = new Date();
    for (let i = 0; i < 8; i++) {
      const c = new Date(); c.setDate(c.getDate() + i); c.setHours(h, m, 0, 0);
      if (c > new Date() && rem.days.some((x) => JS_DAY[x] === c.getDay())) { d.setTime(c.getTime()); break; }
    }
    const day = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
    const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const url = location.origin + location.pathname;
    const byday = DAYS.map(([x]) => x).filter((x) => rem.days.includes(x)).join(",");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//VocabStudy//Study reminder//EN", "BEGIN:VEVENT",
      "UID:vocabstudy-reminder-" + now + "@vocabstudy", "DTSTAMP:" + now,
      "DTSTART:" + day + "T" + pad(h) + pad(m) + "00", "DURATION:PT10M", "RRULE:FREQ=WEEKLY;WKST=SA;BYDAY=" + byday,
      "SUMMARY:VocabStudy — recall your words",
      "DESCRIPTION:A few minutes today keeps them for good. Open VocabStudy: " + url,
      "URL:" + url,
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Time for VocabStudy", "TRIGGER:PT0M", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    VS.lastIcs = ics;                                // for checking in the browser console
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "vocabstudy-reminder.ics";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    VS.store.setSetting("reminderTime", rem.time);
    VS.store.setSetting("reminderDays", rem.days.slice());
    VS.store.setReminder(timeText(rem.time) + ", " + daysText(rem.days));
    document.getElementById("reminder").close();
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
