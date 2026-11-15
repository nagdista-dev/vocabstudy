/* views/shared.js — UI pieces used by more than one screen.
   Each function returns markup built with VS.html (always escaped).
   If two screens need the same piece, it belongs here — never copied. */
(function () {
  "use strict";
  const { html, icon } = VS;

  const STATUS_LABEL = { new: "New", learning: "Learning", mastered: "Mastered" };

  /** "2026-11-18" → "in 3 days" / "today" / "tomorrow" */
  function whenText(date) {
    const days = Math.round((new Date(date + "T12:00:00") - new Date(VS.todayKey() + "T12:00:00")) / 864e5);
    if (days <= 0) return "today";
    if (days === 1) return "tomorrow";
    return "in " + days + " days";
  }

  VS.ui = {
    whenText,

    /** Breadcrumbs for activities: Day › Activity, or just the activity. */
    crumbs(p, name) {
      const day = p.iso && VS.day(p.iso);
      return day ? [{ label: day.label, href: "#/day/" + day.iso }, { label: name }] : [{ label: name }];
    },
    levelBadge: (w) => html`<span class="badge ${VS.levelGroup(w.level)}" title="CEFR level">${w.level}</span>`,

    statusBadge(w) {
      const s = VS.store.status(w.id);
      return s === "new" ? "" : html`<span class="badge is-${s}">${STATUS_LABEL[s]}</span>`;
    },

    speakButton: (text, label) =>
      html`<button class="speak-btn" type="button" data-action="speak" data-say="${text}" aria-label="${label || "Hear " + text}">${icon("volume", "icon-sm")}</button>`,

    /** Headword + optional sense in brackets, e.g. Packed (crowded). */
    headword: (w, cls) =>
      html`<span class="${cls || ""}">${w.word}</span>${w.sense ? html` <span class="sense">(${w.sense.toLowerCase()})</span>` : ""}`,

    /** The example sentence with the word highlighted when we can find it. */
    example(w) {
      const hit = VS.findInExample(w, true);
      return hit ? html`${hit.before}<mark class="mark">${hit.answer}</mark>${hit.after}` : html`${w.example}`;
    },

    /** One expandable row in a word list (day page and review page). */
    /** Your note for a word, editable in place. Saved when you leave the box. */
    noteBox(w) {
      const note = VS.store.note(w.id);
      return html`
        <label class="note">
          <span class="note-label">${icon("bulb", "icon-sm")} My note</span>
          <textarea data-note="${w.id}" rows="2" maxlength="500"
            placeholder="A memory trick, or a sentence about your own life with this word">${note}</textarea>
        </label>`;
    },

    /** One expandable row in a word list. `showDay` adds which set it comes from. */
    wordRow(w, showDay) {
      const s = VS.store.status(w.id);
      const e = VS.store.word(w.id);
      return html`
        <details class="word-row" data-status="${s}">
          <summary>
            <span class="word-row-main">
              <b>${VS.ui.headword(w)}</b>
              <span class="word-row-meta">${w.type}${showDay ? html` · ${VS.day(w.day).label}` : ""}${VS.store.note(w.id) ? html` · ${icon("bulb", "icon-sm")}` : ""}</span>
            </span>
            <span class="word-row-ar" lang="ar">${w.arabic}</span>
            <span class="word-row-badges">${VS.ui.statusBadge(w)}${VS.ui.levelBadge(w)}</span>
            ${icon("chevron-right", "icon-sm word-row-chev")}
          </summary>
          <div class="word-row-body">
            <div class="row">
              ${VS.ui.speakButton(w.word)}
              <span class="ipa">${w.ipa}</span>
            </div>
            <p>${w.definition}</p>
            <p class="word-row-example">“${VS.ui.example(w)}”</p>
            ${VS.ui.noteBox(w)}
            <div class="row word-row-foot">
              <span class="hint">${s === "new"
                ? "Not studied yet"
                : html`Next recall ${whenText(e.due)} · box ${e.box} of 6 · ${e.right} right, ${e.wrong} wrong`}</span>
              ${s === "new" ? "" : html`<button class="btn btn-quiet" type="button" data-action="forget" data-id="${w.id}">${icon("review", "icon-sm")} Start over</button>`}
            </div>
          </div>
        </details>`;
    },

    /** Top of every activity: back link, title, counter and progress bar. */
    activityHead({ back, title, index, total, combo }) {
      const bump = combo !== VS.ui.lastCombo;   // pulse only when the streak just changed
      if (bump && combo >= 3) setTimeout(() => VS.sfx.play("combo", combo), 160);
      VS.ui.lastCombo = combo;
      const pct = total ? Math.round((index / total) * 100) : 0;
      return html`
        <header class="activity-head">
          <div class="row">
            <a class="icon-btn" href="${back}" aria-label="Leave this activity">${icon("x")}</a>
            <h1>${title}</h1>
            ${combo >= 2 ? html`<span class="combo ${bump ? "bump" : ""}" title="Right answers in a row">${icon("flame", "icon-sm")} ${combo} in a row</span>` : ""}
            <span class="count" aria-live="polite">${Math.min(index + 1, total)} / ${total}</span>
          </div>
          <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${index}">
            <i style="--value:${pct}%"></i>
          </div>
        </header>`;
    },

    /** A short burst of highlighter strips — only for a perfect round. */
    celebrate() {
      VS.sfx.play("perfect");
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const box = document.createElement("div");
      box.className = "confetti";
      box.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 36; i++) {
        const piece = document.createElement("i");
        piece.style.left = Math.random() * 100 + "vw";
        piece.style.animationDelay = Math.random() * 300 + "ms";
        piece.style.transform = "rotate(" + Math.random() * 180 + "deg)";
        box.appendChild(piece);
      }
      document.body.appendChild(box);
      setTimeout(() => box.remove(), 2000);
    },

    /** End-of-session screen. `stats` = [{ value, label, tone }], `words` = mistakes to show. */
    summary({ title, message, stats, words, actions }) {
      VS.sfx.play("done");
      return html`
        <section class="summary view-enter" aria-live="polite">
          <h1>${title}</h1>
          <p class="muted">${message}</p>
          <div class="summary-stats">
            ${stats.map((s) => html`<div class="summary-stat ${s.tone ? "is-" + s.tone : ""}"><b>${s.value}</b><span>${s.label}</span></div>`)}
          </div>
          ${words && words.length
            ? html`<h2 class="summary-sub">Words to look at again</h2>
                   <div class="word-list">${words.map(VS.ui.wordRow)}</div>`
            : ""}
          <div class="summary-actions">
            ${actions.filter(Boolean).map((a) =>
              a.href
                ? html`<a class="btn btn-lg ${a.primary ? "btn-primary" : ""}" href="${a.href}">${a.label}</a>`
                : html`<button class="btn btn-lg ${a.primary ? "btn-primary" : ""}" type="button" data-action="${a.action}">${a.label}</button>`
            )}
          </div>
        </section>`;
    },

    /** Shown when an activity has no words to work with. */
    emptyActivity(back, text) {
      return html`
        <div class="activity">
          <div class="empty">
            <h2>Nothing to practise here yet</h2>
            <p>${text}</p>
            <a class="btn btn-primary" href="${back}">Go back</a>
          </div>
        </div>`;
    },
  };
})();
