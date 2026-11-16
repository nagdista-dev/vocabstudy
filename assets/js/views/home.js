/* views/home.js — today's plan, shown at the top of the library.
   ------------------------------------------------------------------
   The library is the home screen (views/library.js). Above the words, one
   strip answers "what should I do now?", in the order that builds memory:

     1. Recall           the words due today (spaced repetition)
     2. Learn new words  the next words you added (Settings → New words per day)
     3. Practise today's words — Quiz, Spell, Match (and Speak when it's on)

     VS.today.plan()   → { steps, next, learned, newLeft } — data only
     VS.today.strip()  → the strip's markup
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;

  const PRACTICE = {
    quiz: { icon: "quiz", name: "Quiz" },
    spell: { icon: "spell", name: "Spell" },
    match: { icon: "match", name: "Match" },
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
      if (!p.t.started && !p.newLeft) return ["Add the words you want to remember.", "Type one above — the app does the rest."];
      const next = VS.store.nextReview();
      if (next) return ["You're done for today.", "Next recall: " + VS.plural(next.count, "word") + " " + VS.ui.whenText(next.date) + "."];
      // New words left, but today's allowance is used: say so instead of asking for more words.
      if (p.newLeft) return ["You're done for today.", "That's your " + VS.plural(VS.newPerDay(), "new word") + " for today. More tomorrow."];
      return ["You're done for today.", "Add more words to keep learning."];
    }
    if (n.key === "recall") return [VS.plural(n.count, "word") + " to recall.", "Bring each one back from memory before it fades."];
    if (n.key === "learn") return [VS.plural(n.count, "new word") + " to learn.", "Meet each one once: meaning, Arabic, example and sound."];
    return ["Make today's words stick.", "Practise the " + VS.plural(p.learned, "word") + " you learned today, a few different ways."];
  }

  /* Daily goal: answers across every activity, against Settings → Daily goal. */
  function goal(t) {
    const target = VS.store.settings().dailyGoal || 0;
    if (!target || !t.words) return "";
    const done = t.today.answered || 0;
    const reached = done >= target;
    const pct = Math.min(100, Math.round((done / target) * 100));
    return html`
      <div class="today-goal ${reached ? "is-done" : ""}">
        <p class="today-goal-label">${icon(reached ? "check" : "target", "icon-sm")} <b>${done}</b> / ${target} answers today</p>
        <div class="today-goal-track" role="progressbar" aria-label="Daily goal: ${done} of ${target} answers"
             aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(done, target)}">
          <i style="width:${pct}%"></i>
        </div>
      </div>`;
  }

  function strip() {
    const p = plan();
    const [title, line] = headline(p);
    const tricky = VS.store.trickyWords().length;
    return html`
      <section class="today-strip" aria-labelledby="today-title">
        <div class="today-copy">
          <h2 id="today-title">${title}</h2>
          <p class="hint">${line}</p>
        </div>
        ${p.next ? html`<a class="btn btn-primary btn-lg" href="${p.next.href}">${icon(p.next.icon, "icon-sm")} ${p.next.key === "recall" ? "Start recall" : p.next.key === "learn" ? "Learn them" : p.next.name}</a>` : ""}
        ${goal(p.t)}
        ${p.t.started || p.newLeft ? html`
          <ol class="today-steps" aria-label="Today's plan">
            ${p.steps.map((s) => html`
              <li class="${s.done ? "is-done" : ""} ${p.next === s ? "is-next" : ""}">
                ${s.open || s.done
                  ? html`<a href="${s.href}">${icon(s.done ? "check" : s.icon, "icon-sm")} ${s.name}${s.count ? html` <b>${s.count}</b>` : ""}</a>`
                  : html`<span title="Opens after you learn today's new words">${icon(s.icon, "icon-sm")} ${s.name}</span>`}
              </li>`)}
            ${tricky ? html`<li class="is-tricky"><a href="#/words?tricky=1">${icon("flame", "icon-sm")} Tricky <b>${tricky}</b></a></li>` : ""}
          </ol>` : ""}
      </section>`;
  }

  VS.today = { plan, strip };
})();
