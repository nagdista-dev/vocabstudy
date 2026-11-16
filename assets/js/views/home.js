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
    if (n.key === "learn") return {
      markup: html`<mark class="mark">${VS.plural(n.count, "new word")}</mark> to learn.`,
      line: "Meet each one once: meaning, Arabic, example and sound.",
    };
    return {
      markup: html`Make today's words stick.`,
      line: "Practise the " + VS.plural(p.learned, "word") + " you learned today, a few different ways.",
    };
  }

  /* Daily goal: answers across every activity, against Settings → Daily goal. */
  function goal(t) {
    const target = VS.store.settings().dailyGoal || 0;
    if (!target || !t.words) return "";
    const done = (t.today.answered || 0) + (t.today.met || 0);     // answers, plus new words met on cards
    const reached = done >= target;
    const pct = Math.min(100, Math.round((done / target) * 100));
    return html`
      <div class="today-goal ${reached ? "is-done" : ""}">
        <p class="today-goal-label">${icon(reached ? "check" : "target", "icon-sm")} <span>Daily goal</span> <b>${done}</b><span class="today-goal-sep">/</span>${target}</p>
        <div class="today-goal-track" role="progressbar" aria-label="Daily goal: ${done} of ${target} answers"
             aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(done, target)}">
          <i style="width:${pct}%"></i>
        </div>
      </div>`;
  }

  /* Shortcuts to the other things that help today's words stick. The
     primary action above already covers the next step, so it is left out. */
  function shortcuts(p) {
    const keys = ["learn", "quiz", "spell", "match", "write", "speak"];
    const items = p.steps.filter((s) => keys.includes(s.key) &&
      (!p.next || s.key !== p.next.key) && (s.open || (s.done && s.key !== "learn")));
    if (!items.length) return "";
    return html`
      <ol class="today-steps" aria-label="More ways to practise today's words">
        ${items.map((s) => html`
          <li class="${s.done ? "is-done" : ""}">
            <a href="${s.href}">${icon(s.done ? "check" : s.icon, "icon-sm")}<span>${s.name}</span>${s.count ? html`<b>${s.count}</b>` : ""}</a>
          </li>`)}
      </ol>`;
  }

  function strip() {
    const p = plan();
    const h = headline(p);
    const streak = p.t.streak || 0;
    const cta = p.next && (p.next.key === "recall" ? "Start recall"
      : p.next.key === "learn" ? "Learn new words"
      : "Start " + p.next.name.toLowerCase());
    return html`
      <section class="today-strip" aria-labelledby="today-title">
        <div class="today-top">
          <span class="today-kicker">Today</span>
          ${streak ? html`<span class="today-streak" title="${streak} days in a row">${icon("flame", "icon-sm")} ${streak}-day streak</span>` : ""}
        </div>
        <div class="today-copy">
          <h2 id="today-title">${h.markup}</h2>
          <p class="hint">${h.line}</p>
        </div>
        ${p.next ? html`<a class="btn btn-primary btn-lg btn-block today-cta" href="${p.next.href}">${icon(p.next.icon, "icon-sm")} ${cta}</a>` : ""}
        ${goal(p.t)}
        ${shortcuts(p)}
        ${p.t.started >= 3 ? html`<a class="today-quick" href="#/quick">${icon("bolt", "icon-sm")}<span>Only five minutes? <b>Quick 5</b> — the 10 words that matter most</span></a>` : ""}
      </section>`;
  }

  VS.today = { plan, strip };
})();
