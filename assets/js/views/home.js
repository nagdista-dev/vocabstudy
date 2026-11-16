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
    const perDay = VS.newPerDay();
    const newLeft = VS.store.newWords().length;
    const learned = t.learnedToday.length;
    const learnDone = learned >= perDay || (learned > 0 && VS.store.doneToday("learn")) || (!newLeft && learned > 0);
    const steps = [
      { key: "recall", icon: "review", name: "Recall", href: "#/recall",
        done: !t.due && t.started > 0, open: t.due > 0, count: t.due },
      { key: "learn", icon: "cards", name: "Learn", href: "#/new/cards",
        done: learnDone, open: newLeft > 0, count: learnDone ? 0 : Math.min(perDay, newLeft) },
    ];
    VS.todaySteps().forEach((mode) => steps.push({
      key: mode, icon: PRACTICE[mode].icon, name: PRACTICE[mode].name, href: "#/today/" + mode,
      done: learned > 0 && VS.store.doneToday(mode), open: learned > 0, count: 0,
    }));
    return { t, steps, next: steps.find((s) => s.open && !s.done), learned, newLeft };
  }

  /* One sentence for the next step — the thing to do now. */
  function headline(p) {
    const n = p.next;
    if (!n) {
      if (!p.t.started && !p.newLeft) return ["Add the words you want to remember.", "Type one above — the app does the rest."];
      const next = VS.store.nextReview();
      return ["You're done for today.", next ? "Next recall: " + VS.plural(next.count, "word") + " " + VS.ui.whenText(next.date) + "." : "Add more words to keep learning."];
    }
    if (n.key === "recall") return [VS.plural(n.count, "word") + " to recall.", "Bring each one back from memory before it fades."];
    if (n.key === "learn") return [VS.plural(n.count, "new word") + " to learn.", "Meet each one once: meaning, Arabic, example and sound."];
    return ["Make today's words stick.", "Practise the " + VS.plural(p.learned, "word") + " you learned today, a few different ways."];
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
        ${p.next ? html`<a class="btn btn-primary btn-lg" href="${p.next.href}">${icon(p.next.icon, "icon-sm")} ${p.next.key === "recall" ? "Start recall" : p.next.key === "learn" ? "Learn them" : p.next.name}</a>`
          : p.newLeft ? html`<a class="btn" href="#/new/cards">${icon("cards", "icon-sm")} Learn more</a>` : ""}
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
