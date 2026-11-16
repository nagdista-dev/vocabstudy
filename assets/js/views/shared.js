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

  /* Edit / delete your own words (global actions, so they work in every list). */
  const EDIT_FIELDS = [["word", "Word"], ["sense", "Sense"], ["arabic", "Arabic"], ["type", "Type"], ["level", "Level"],
                       ["ipa", "IPA"], ["tags", "Tags"], ["definition", "Definition"], ["example", "Example"]];
  VS.actions = VS.actions || {};
  VS.actions["word-edit"] = (el) => {
    const w = VS.byId[el.dataset.id];
    const body = el.closest(".word-row-body");
    if (!w || !body) return;
    body.innerHTML = String(html`
      <form class="word-edit" data-edit-id="${w.id}">
        ${EDIT_FIELDS.map(([k, label]) => html`
          <label class="form-field ${k === "definition" || k === "example" ? "is-wide" : ""}"><span>${label}</span>
            ${k === "type" ? html`<select name="type">${VS.importer.TYPES.map((t) => html`<option ${t === w.type ? VS.raw("selected") : ""}>${t}</option>`)}</select>`
              : k === "level" ? html`<select name="level">${VS.importer.LEVELS.map((l) => html`<option ${l === w.level ? VS.raw("selected") : ""}>${l}</option>`)}</select>`
              : k === "tags" ? html`<input name="tags" value="${w.tags.join(", ")}" placeholder="IELTS, work" list="tagList">`
              : html`<input name="${k}" value="${w[k] || ""}" ${k === "arabic" ? VS.raw('lang="ar" dir="rtl"') : ""}>`}
          </label>`)}
        ${VS.ui.tagList()}
        <div class="row is-wide">
          <button class="btn btn-primary" type="button" data-action="word-save" data-id="${w.id}">Save changes</button>
          <button class="btn btn-quiet" type="button" data-action="word-cancel">Cancel</button>
        </div>
      </form>`);
  };
  VS.actions["word-save"] = (el) => {
    const form = el.closest("form");
    const changes = {};
    EDIT_FIELDS.forEach(([k]) => { changes[k] = form.elements[k].value.trim(); });
    changes.tags = VS.parseTags(changes.tags);
    if (!changes.word || !changes.arabic) { VS.toast("The word and its Arabic meaning are needed."); return; }
    const result = VS.store.editUserWord(el.dataset.id, changes);
    if (result.error === "duplicate") { VS.toast("“" + result.word.word + "” is already in your library."); return; }
    location.reload();                 // rebuild every list with the new version
  };
  VS.actions["word-cancel"] = () => VS.app.render();
  VS.actions["word-delete"] = (el) => {
    const w = VS.byId[el.dataset.id];
    if (!w || !confirm(`Delete “${w.word}” from your library? Its progress and note go too. This can't be undone.`)) return;
    VS.store.deleteUserWords([w.id]);
    location.reload();
  };

  /* Arabic keyboard left on: the most common "mistake" that isn't one. */
  const ARABIC = /[؀-ۿ]/;
  VS.isArabicTyping = (text) => ARABIC.test(text || "");

  VS.ui = {
    whenText,

    /**
     * Watch an English input: Arabic letters show a calm note under it
     * ("Your keyboard is in Arabic") instead of letting the answer fail.
     * Returns a function that tells whether the current text is Arabic.
     */
    watchKeyboard(input) {
      if (!input) return () => false;
      input.setAttribute("lang", "en");
      let note = input.closest("label, form, .field-wrap");
      note = note && note.parentElement && note.parentElement.querySelector(".kb-warn");
      if (!note) {
        note = document.createElement("p");
        note.className = "kb-warn";
        note.setAttribute("role", "status");
        (input.closest("label") || input).insertAdjacentElement("afterend", note);
      }
      const update = () => {
        const on = ARABIC.test(input.value);
        note.textContent = on ? "Your keyboard is in Arabic — switch it to English to type this word." : "";
        note.hidden = !on;
      };
      input.addEventListener("input", update);
      update();
      return () => ARABIC.test(input.value);
    },

    /** "2026-11-16" → "today" / "yesterday" / "16 Nov" / "16 Nov 2025" */
    dateText(iso) {
      if (!iso) return "";
      if (iso === VS.todayKey()) return "today";
      if (iso === VS.yesterdayKey()) return "yesterday";
      const d = new Date(iso + "T12:00:00");
      const sameYear = d.getFullYear() === new Date().getFullYear();
      return d.toLocaleDateString("en-GB", sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
    },

    /** Suggestions for tag inputs: every tag already in the library. */
    tagList: () => html`<datalist id="tagList">${VS.allTags().map((t) => html`<option value="${t.tag}">`)}</datalist>`,

    /** Breadcrumbs for activities: Library › Activity for a filtered list, else just the activity. */
    crumbs(p, name) {
      return p.scope === "pick" || p.scope === "all"
        ? [{ label: "Library", href: "#/words" + (p.query ? "?" + p.query : "") }, { label: name }]
        : [{ label: name }];
    },
    levelBadge: (w) => html`<span class="badge ${VS.levelGroup(w.level)}" title="CEFR level">${w.level}</span>`,

    statusBadge(w) {
      const s = VS.store.status(w.id);
      return s === "new" ? "" : html`<span class="badge is-${s}">${STATUS_LABEL[s]}</span>`;
    },

    speakButton: (text, label) =>
      html`<button class="speak-btn" type="button" data-action="speak" data-say="${text}" aria-label="${label || "Hear " + text}">${icon("volume", "icon-sm")}</button>`,

    /** Headword + optional sense in brackets, e.g. Axe (tool) — the sense tells two meanings apart. */
    headword: (w, cls) =>
      html`<span class="${cls || ""}">${w.word}</span>${w.sense ? html` <span class="sense">(${w.sense.toLowerCase()})</span>` : ""}`,

    /** Pronunciation tips for Arabic speakers (core/sound-traps.js): P/B, V/F, silent letters… */
    soundTraps(w, cls) {
      const tips = VS.soundTraps(w);
      if (!tips.length) return "";
      return html`<ul class="traps ${cls || ""}" aria-label="Pronunciation tips">
        ${tips.map((t) => html`<li>${icon("volume", "icon-sm")}<span><b>${t.title}.</b> ${t.text}</span></li>`)}</ul>`;
    },

    /** The example sentence with the word highlighted when we can find it. */
    example(w) {
      const hit = VS.findInExample(w, true);
      return hit ? html`${hit.before}<mark class="mark">${hit.answer}</mark>${hit.after}` : html`${w.example}`;
    },

    /** One expandable row in a word list (day page and review page). */
    /** A small progress ring (SVG). `pct` 0–100; `label` sits in the middle. */
    ring(pct, label, size) {
      const r = 16, c = 2 * Math.PI * r;
      return html`
        <span class="ring" style="--size:${size || 56}px" role="img" aria-label="${pct}% mastered">
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <circle class="ring-bg" cx="20" cy="20" r="${r}"></circle>
            <circle class="ring-fill" cx="20" cy="20" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct / 100)).toFixed(1)}"></circle>
          </svg>
          <b>${label == null ? pct + "%" : label}</b>
        </span>`;
    },

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

    /** Tags as small chips that open the library filtered by that tag. */
    tags: (w) => w.tags.map((t) => html`<a class="tag" href="#/words?tag=${encodeURIComponent(t)}">#${t}</a>`),

    /** One expandable row in a word list. */
    wordRow(w) {
      const s = VS.store.status(w.id);
      const e = VS.store.word(w.id);
      return html`
        <details class="word-row" data-status="${s}">
          <summary>
            <span class="word-row-main">
              <b>${VS.ui.headword(w)}</b>
              <span class="word-row-meta">${w.type}${w.custom ? "" : " · Starter"}${w.tags.length ? " · " + w.tags.map((t) => "#" + t).join(" ") : ""}${VS.store.note(w.id) ? html` · ${icon("bulb", "icon-sm")}` : ""}</span>
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
            ${VS.ui.soundTraps(w)}
            <p>${w.definition}</p>
            <p class="word-row-example">“${VS.ui.example(w)}”</p>
            ${w.tags.length ? html`<p class="row word-row-tags">${VS.ui.tags(w)}</p>` : ""}
            ${VS.ui.noteBox(w)}
            <div class="row word-row-foot">
              <span class="hint">${s === "new"
                ? "Added " + VS.ui.dateText(w.added) + " · not studied yet"
                : html`Next recall ${whenText(e.due)} · box ${e.box} of 6 · ${e.right} right, ${e.wrong} wrong`}</span>
              <span class="row">
                ${s === "new" ? "" : html`<button class="btn btn-quiet" type="button" data-action="forget" data-id="${w.id}">${icon("review", "icon-sm")} Start over</button>`}
                ${w.custom ? html`
                  <button class="btn btn-quiet" type="button" data-action="word-edit" data-id="${w.id}">Edit</button>
                  <button class="btn btn-quiet danger" type="button" data-action="word-delete" data-id="${w.id}">Delete</button>` : ""}
              </span>
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
    emptyActivity(back, text, label) {
      return html`
        <div class="activity">
          <div class="empty">
            <h2>Nothing to practise here yet</h2>
            <p>${text}</p>
            <a class="btn btn-primary" href="${back}">${label || "Go back"}</a>
          </div>
        </div>`;
    },
  };
})();
