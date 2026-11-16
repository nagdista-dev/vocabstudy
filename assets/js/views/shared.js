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
                       ["ipa", "IPA"], ["tags", "Tags"], ["synonyms", "Similar words"], ["definition", "Definition"], ["example", "Example"],
                       ["context", "Where you met it (the sentence)"], ["source", "Source (a series, a book, work…)"]];
  const LONG_FIELDS = ["definition", "example", "context"];
  const LIST_FIELDS = ["tags", "synonyms"];       // edited as "a, b, c"
  VS.actions = VS.actions || {};
  VS.actions["word-edit"] = (el) => {
    const w = VS.byId[el.dataset.id];
    const body = el.closest(".word-row-body");
    if (!w || !body) return;
    body.innerHTML = String(html`
      <form class="word-edit" data-edit-id="${w.id}">
        ${EDIT_FIELDS.map(([k, label]) => html`
          <label class="form-field ${LONG_FIELDS.includes(k) ? "is-wide" : ""}"><span>${label}</span>
            ${k === "type" ? html`<select name="type">${VS.importer.TYPES.map((t) => html`<option ${t === w.type ? VS.raw("selected") : ""}>${t}</option>`)}</select>`
              : k === "level" ? html`<select name="level"><option value="">—</option>${VS.importer.LEVELS.map((l) => html`<option ${l === w.level ? VS.raw("selected") : ""}>${l}</option>`)}</select>`
              : k === "tags" ? html`<input name="tags" value="${w.tags.join(", ")}" placeholder="IELTS, work" list="tagList">`
              : k === "synonyms" ? html`<input name="synonyms" value="${w.synonyms.join(", ")}" placeholder="delay, put off">`
              : LONG_FIELDS.includes(k) ? html`<textarea name="${k}" rows="2">${w[k] || ""}</textarea>`
              : html`<input name="${k}" value="${w[k] || ""}" ${k === "arabic" ? VS.raw('lang="ar" dir="rtl"') : ""}>`}
          </label>`)}
        ${VS.ui.tagList()}
        ${VS.autofill.enabled() ? html`<div class="sense-pick is-wide">
          <button class="btn btn-tonal" type="button" data-action="word-senses" data-id="${w.id}">${icon("book", "icon-sm")} Other meanings</button>
          <span class="hint">Not the meaning you met? Tap the right one.</span>
          <div class="sense-list" aria-live="polite"></div>
        </div>` : ""}
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
    LIST_FIELDS.forEach((k) => { changes[k] = VS.parseTags(changes[k]); });
    if (!changes.word || !changes.arabic) { VS.toast("The word and its Arabic meaning are needed."); return; }
    const result = VS.store.editUserWord(el.dataset.id, changes);
    if (result.error === "duplicate") { VS.toast("“" + result.word.word + "” is already in your library."); return; }
    location.reload();                 // rebuild every list with the new version
  };
  VS.actions["word-cancel"] = () => VS.app.render();
  /* More examples: one word in several real sentences builds more ways back to it.
     Tatoeba (tatoeba.org, free, no account) is a collection of sentences written
     by people; only the word is sent, and only when the learner taps. Its Arabic
     translations are left out: they're volunteer work and too uneven to teach from. */
  const exampleCache = {};
  VS.actions["word-examples"] = async (el) => {
    const w = VS.byId[el.dataset.id];
    const box = el.parentElement.querySelector(".more-ex-list");
    if (!w || !box) return;
    if (!navigator.onLine) { box.innerHTML = String(html`<p class="hint">More examples need the internet.</p>`); return; }
    let c = exampleCache[w.id];
    if (!c) {
      el.disabled = true;
      box.innerHTML = String(html`<p class="hint">Finding sentences with “${w.word}”…</p>`);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);      // Tatoeba can be slow; never hang
      try {
        const res = await fetch("https://api.tatoeba.org/unstable/sentences?lang=eng&sort=relevance&limit=40&q=" + encodeURIComponent(w.word), { signal: ctrl.signal });
        const data = res.ok ? await res.json() : {};
        const known = new Set([w.example, w.context].concat(w.mine).filter(Boolean).map(VS.normalise));
        const list = (data.data || []).map((x) => String(x.text || "").trim())
          .filter((t) => { const n = t.split(/\s+/).length; return n >= 4 && n <= 18 && VS.findIn(w, t) && !known.has(VS.normalise(t)); });
        c = exampleCache[w.id] = { list: [...new Set(list)], at: 0 };
      } catch (e) {
        c = null;
      }
      clearTimeout(timer);
      el.disabled = false;
      if (!c) { box.innerHTML = String(html`<p class="hint">The sentence library didn't answer. Try again in a moment.</p>`); return; }
    }
    if (!c.list.length) { box.innerHTML = String(html`<p class="hint">No more sentences found for “${w.word}”.</p>`); return; }
    const shown = c.list.slice(c.at, c.at + 3);
    c.at = c.at + 3 >= c.list.length ? 0 : c.at + 3;
    el.textContent = c.list.length > 3 ? "Other examples" : "More examples";
    box.innerHTML = String(html`
      <ul class="more-ex-items">${shown.map((t) => {
        const hit = VS.findIn(w, t, true);
        return html`<li>${hit ? html`${hit.before}<mark class="mark">${hit.answer}</mark>${hit.after}` : t}${VS.ui.speakButton(t, "Hear this sentence")}</li>`;
      })}</ul>
      <p class="hint more-ex-credit">Sentences from <a href="https://tatoeba.org" target="_blank" rel="noopener">Tatoeba</a> (CC BY 2.0 FR).</p>`);
  };

  VS.actions["sentence-remove"] = (el) => {
    VS.store.removeSentence(el.dataset.id, Number(el.dataset.index));
    const row = el.closest(".word-row");
    const w = VS.byId[el.dataset.id];
    if (row && w) { row.outerHTML = String(VS.ui.wordRow(w)); const again = VS.$(`.word-row[data-id="${CSS.escape(w.id)}"]`); if (again) again.open = true; }
    VS.toast("Sentence removed.");
  };

  /* Other meanings: a word has many senses, and the dictionary's first one may
     not be the one the learner met. List them all; one tap picks and saves. */
  let senses = [];
  VS.actions["word-senses"] = async (el) => {
    const w = VS.byId[el.dataset.id];
    const box = el.parentElement.querySelector(".sense-list");
    if (!w || !box) return;
    el.disabled = true;
    box.innerHTML = String(html`<p class="hint">Looking up “${w.word}”…</p>`);
    try { senses = await VS.autofill.senses(w.word); } catch (e) { senses = []; }
    el.disabled = false;
    box.innerHTML = String(senses.length
      ? html`<ol class="senses">${senses.slice(0, 8).map((m, i) => html`
          <li><button type="button" class="sense-opt" data-action="word-sense-pick" data-index="${i}" aria-pressed="false">
            <span class="sense-type">${m.type}${m.arabic && (!i || senses[i - 1].type !== m.type) ? html` · <span lang="ar">${m.arabic}</span>` : ""}</span>
            <b>${m.definition || "(no definition)"}</b>
            ${m.example ? html`<i>“${m.example}”</i>` : ""}
          </button></li>`)}</ol>`
      : html`<p class="hint">${navigator.onLine ? "No other meanings found." : "You're offline — try again when you're online."}</p>`);
  };
  // "Not the meaning you met?" in a word's details: open Edit with the meanings listed.
  VS.actions["word-meanings"] = (el) => {
    const body = el.closest(".word-row-body");
    VS.actions["word-edit"](el);
    const btn = body && body.querySelector('[data-action="word-senses"]');
    if (btn) { VS.actions["word-senses"](btn); btn.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
  };
  VS.actions["word-sense-pick"] = (el) => {
    const m = senses[Number(el.dataset.index)];
    const form = el.closest("form");
    if (!m || !form) return;
    const set = (name, value) => { if (form.elements[name] && value) form.elements[name].value = value; };
    // A sense replaces everything it describes: definition, example, type, Arabic, similar words.
    form.elements.example.value = m.example || "";
    set("definition", m.definition);
    set("type", m.type);
    set("arabic", m.arabic);
    form.elements.synonyms.value = (m.synonyms || []).join(", ");
    VS.$$(".sense-opt", form).forEach((b) => b.setAttribute("aria-pressed", String(b === el)));
    // One tap is the choice: save it (with any other change made in the form).
    VS.actions["word-save"](form.querySelector('[data-action="word-save"]'));
  };
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

    /**
     * Watch an "add a word" input: a word already in the library is named
     * while you type, before you press Add — with a link to it.
     */
    watchDuplicate(input, after) {
      if (!input || !after) return;
      const note = document.createElement("p");
      note.className = "dup-note";
      note.setAttribute("role", "status");
      note.hidden = true;
      after.insertAdjacentElement("afterend", note);
      const update = () => {
        const w = VS.byId[VS.wordKey(input.value)];
        note.hidden = !w;
        note.innerHTML = w ? String(html`${icon("check", "icon-sm")} <span>“${w.word}” is already in your library.</span>
          <a href="#/words?q=${encodeURIComponent(w.word)}">Show it</a>`) : "";
      };
      input.addEventListener("input", update);
      update();
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

    /** Breadcrumbs for activities: Words › Your list › Activity for a filtered list. */
    crumbs(p, name) {
      return p.scope === "pick" && p.query
        ? [{ label: "Your list", href: "#/words?" + p.query }, { label: name }]
        : [{ label: name }];
    },
    levelBadge: (w) => (w.level ? html`<span class="badge ${VS.levelGroup(w.level)}" title="CEFR level">${w.level}</span>` : ""),

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

    /** The example in quotes — or nothing at all when the word has none yet. */
    quote: (w) => (w.example ? html`“${VS.ui.example(w)}”` : ""),

    /** English text that may quote Arabic («يعتمد على»): each Arabic run is isolated,
        so the line reads in the right order in both directions. */
    mixed(text) {
      const safe = VS.escape(text);
      // «» around Arabic would flip in an English line; the isolated chip replaces them.
      return VS.raw(safe.replace(/«?([\u0600-\u06FF][\u0600-\u06FF\u064B-\u065F\s،-]*[\u0600-\u06FF]|[\u0600-\u06FF])»?/g,
        (_, ar) => '<bdi class="ar-chip" lang="ar" dir="rtl">' + ar + "</bdi>"));
    },

    /** How common the word is (core/frequency.js): five bars, like signal strength.
        `line` adds the teacher's sentence about what that means. */
    freq(w, line) {
      const b = VS.frequency.band(w);
      if (!b) return "";
      const meter = html`<span class="freq" data-level="${b.level}" title="${b.line}">
        <span class="freq-bars" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => html`<i class="${i <= b.level ? "is-on" : ""}"></i>`)}</span>
        <span class="freq-label">${b.label}</span></span>`;
      return line ? html`<p class="freq-row">${meter}<span class="hint">${b.line}</span></p>` : meter;
    },

    /** The IPA, with the stress drawn as a teacher would: o O o o. */
    ipa(w) {
      if (!w.ipa) return "";
      const st = VS.stress(w.ipa);
      return html`<span class="ipa">${w.ipa}</span>${st ? html`
        <span class="stress" role="img" title="Say the big one louder and longer"
          aria-label="Stress on syllable ${st.stressed + 1} of ${st.count}">${Array.from({ length: st.count }, (_, i) =>
            html`<i class="${i === st.stressed ? "is-on" : ""}"></i>`)}</span>` : ""}`;
    },

    /**
     * What Arab learners get wrong with this word (core/usage-traps.js):
     * the mistake, the fix, and why. `limit` keeps a card short.
     */
    usage(w, limit, cls) {
      const traps = VS.usageTraps(w).slice(0, limit || 3);
      if (!traps.length) return "";
      return html`
        <div class="usage ${cls || ""}" aria-label="What Arab learners often get wrong">
          ${traps.map((t) => html`
            <div class="usage-trap">
              <p class="usage-kind">${t.label}</p>
              <p class="usage-wrong">${icon("x", "icon-sm")}<span>${t.wrong}</span></p>
              <p class="usage-right">${icon("check", "icon-sm")}<span>${t.right}</span></p>
              <p class="usage-why">${VS.ui.mixed(t.why)}</p>
            </div>`)}
        </div>`;
    },

    /** Where the learner met the word: their own sentence, the strongest cue there is. */
    context(w, cls) {
      if (!w.context) return "";
      const hit = VS.findIn(w, w.context, true);
      return html`
        <figure class="met ${cls || ""}">
          <figcaption>${icon("bulb", "icon-sm")} Where you met it${w.source ? html` · <span class="met-source">${w.source}</span>` : ""}</figcaption>
          <blockquote>${hit ? html`${hit.before}<mark class="mark">${hit.answer}</mark>${hit.after}` : w.context}</blockquote>
        </figure>`;
    },

    /** Sentences the learner wrote with the word (Use it). */
    mine(w, removable) {
      if (!w.mine || !w.mine.length) return "";
      return html`
        <div class="mine">
          <p class="mine-head">${icon("pen", "icon-sm")} Your sentences</p>
          <ul>${w.mine.map((m, i) => {
            const hit = VS.findIn(w, m, true);
            return html`<li><span>${hit ? html`${hit.before}<mark class="mark">${hit.answer}</mark>${hit.after}` : m}</span>
              ${removable ? html`<button class="icon-btn mine-del" type="button" data-action="sentence-remove" data-id="${w.id}" data-index="${i}" aria-label="Remove this sentence">${icon("x", "icon-sm")}</button>` : ""}</li>`;
          })}</ul>
        </div>`;
    },

    /** "More examples": real sentences from Tatoeba, fetched only when the learner asks. */
    moreExamples: (w) => html`
      <div class="more-ex">
        <button class="link-btn" type="button" data-action="word-examples" data-id="${w.id}">More examples</button>
        <div class="more-ex-list" aria-live="polite"></div>
      </div>`,

    /** The words it goes with ("heavy rain", "subtle difference"): English puts words together its own way. */
    goes: (w, cls) => (w.goes && w.goes.length
      ? html`<p class="similar goes ${cls || ""}"><span>Goes with</span> ${w.goes.join(" · ")}</p>` : ""),

    /** Similar words: another way in to the same meaning. */
    similar: (w, cls) => (w.synonyms && w.synonyms.length
      ? html`<p class="similar ${cls || ""}"><span>Similar</span> ${w.synonyms.join(" · ")}</p>` : ""),

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
            placeholder="A memory trick: anything that helps you remember it">${note}</textarea>
        </label>`;
    },

    /** Tags as small chips that open the library filtered by that tag. */
    tags: (w) => w.tags.map((t) => html`<a class="tag" href="#/words?tag=${encodeURIComponent(t)}">#${t}</a>`),

    /** One expandable row in a word list. */
    wordRow(w) {
      const s = VS.store.status(w.id);
      const e = VS.store.word(w.id);
      const state = s === "mastered" ? "Mastered" : s === "learning" ? "Learning" : "New";
      return html`
        <details class="word-row ${w.word.length > 14 ? "is-long" : ""}" data-status="${s}" data-id="${w.id}">
          <summary>
            <span class="word-row-word">
              <i class="word-row-dot" aria-hidden="true"></i>
              <b>${VS.ui.headword(w)}</b>
            </span>
            ${w.arabic ? html`<span class="word-row-ar" lang="ar">${w.arabic}</span>`
              : html`<span class="word-row-ar hint">${VS.autofill.pending(w.id) ? (navigator.onLine ? "Filling in…" : "Fills in when online") : "No meaning yet"}</span>`}
            <span class="word-row-meta">
              <span class="word-row-state" data-s="${s}">${state}</span><span class="word-row-sep" aria-hidden="true">·</span>
              <span>${w.type}${w.level ? " · " + w.level : ""}</span>
              ${VS.frequency.band(w) ? html`<span class="word-row-freq">${VS.frequency.band(w).label}</span>` : ""}
              ${w.tags.length ? html`<span class="word-row-tagline">${w.tags.map((t) => "#" + t).join(" ")}</span>` : ""}
              ${VS.store.note(w.id) ? html`<span class="word-row-note" title="You wrote a note on this word">${icon("bulb", "icon-sm")}</span>` : ""}
            </span>
            <span class="word-row-badges">${VS.ui.statusBadge(w)}${VS.ui.levelBadge(w)}</span>
            ${icon("chevron-right", "icon-sm word-row-chev")}
          </summary>
          <div class="word-row-body">
            <div class="row">
              ${VS.ui.speakButton(w.word)}
              ${VS.ui.ipa(w)}
            </div>
            ${VS.ui.freq(w, true)}
            ${VS.ui.soundTraps(w)}
            ${w.definition ? html`<p>${w.definition}</p>` : ""}
            ${VS.autofill.enabled() ? html`<button class="link-btn" type="button" data-action="word-meanings" data-id="${w.id}">Not the meaning you met?</button>` : ""}
            ${VS.ui.context(w)}
            ${w.example ? html`<p class="word-row-example">${VS.ui.quote(w)}</p>` : ""}
            ${VS.ui.mine(w, true)}
            ${VS.ui.usage(w)}
            ${VS.ui.goes(w)}
            ${VS.ui.similar(w)}
            ${VS.ui.moreExamples(w)}
            <a class="btn btn-tonal word-row-use" href="#/word/write?id=${encodeURIComponent(w.id)}">${icon("pen", "icon-sm")}
              ${w.mine.length ? "Write another sentence" : "Use it in a sentence"}</a>
            ${w.tags.length ? html`<p class="row word-row-tags">${VS.ui.tags(w)}</p>` : ""}
            ${VS.ui.noteBox(w)}
            <div class="row word-row-foot">
              <span class="hint">${s === "new"
                ? "Added " + VS.ui.dateText(w.added) + " · not studied yet"
                : html`Next recall ${whenText(e.due)} · box ${e.box} of 6 · ${e.right} right, ${e.wrong} wrong`}</span>
              <span class="row">
                ${s === "new" ? "" : html`<button class="btn btn-quiet" type="button" data-action="forget" data-id="${w.id}">${icon("review", "icon-sm")} Start over</button>`}
                                  <button class="btn btn-quiet" type="button" data-action="word-edit" data-id="${w.id}">Edit</button>
                  <button class="btn btn-quiet danger" type="button" data-action="word-delete" data-id="${w.id}">Delete</button>
              </span>
            </div>
          </div>
        </details>`;
    },

    /**
     * The correct spelling, letter by letter: green for letters you wrote in
     * the right order, red (underlined) for letters you missed or got wrong.
     * Uses the longest common subsequence, so one missing letter in the middle
     * doesn't turn every letter after it red ("recieve" vs "receive").
     */
    letters(typed, answer) {
      const a = [...answer.toLowerCase()];
      const t = [...typed.toLowerCase()];
      const L = Array.from({ length: a.length + 1 }, () => new Array(t.length + 1).fill(0));
      for (let i = a.length - 1; i >= 0; i--)
        for (let j = t.length - 1; j >= 0; j--)
          L[i][j] = a[i] === t[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      const hit = new Set();
      for (let i = 0, j = 0; i < a.length && j < t.length;) {
        if (a[i] === t[j]) { hit.add(i); i++; j++; }
        else if (L[i + 1][j] >= L[i][j + 1]) i++;
        else j++;
      }
      return [...answer].map((ch, i) =>
        ch === " " ? html`<span class="ch-space"> </span>` : html`<span class="${hit.has(i) ? "ch-ok" : "ch-bad"}">${ch}</span>`);
    },

    /** Top of every activity: one exit, a short title with its scope, and
        the round's progress. `undo`: show "Undo" — takes back a mis-tap.
        `sub`: the quiet scope line ("Whole library", "Due today"). */
    activityHead({ back, title, sub, index, total, combo, undo }) {
      const bump = combo !== VS.ui.lastCombo;   // pulse only when the streak just changed
      if (bump && combo >= 3) setTimeout(() => VS.sfx.play("combo", combo), 160);
      VS.ui.lastCombo = combo;
      const pct = total ? Math.round((index / total) * 100) : 0;
      return html`
        <header class="activity-head">
          <div class="row">
            <a class="icon-btn" href="${back}" aria-label="Leave this activity">${icon("x")}</a>
            <div class="activity-title">
              <h1>${title}</h1>
              ${sub ? html`<p class="activity-sub">${sub}</p>` : ""}
            </div>
            ${combo >= 2 ? html`<span class="combo ${bump ? "bump" : ""}" title="Right answers in a row">${icon("flame", "icon-sm")} <b>${combo}</b><span class="combo-word"> in a row</span></span>` : ""}
            ${undo ? html`<button class="btn btn-quiet btn-undo" type="button" data-action="undo" title="Take back the last answer (U)" aria-label="Undo the last answer">${icon("undo", "icon-sm")}<span>Undo</span></button>` : ""}
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
      // Results are a new screen. Start at the top even if the smooth scroll
      // from the last answer is still running (it would otherwise leave the
      // summary 40–50px down the page).
      requestAnimationFrame(() => {
        if (document.querySelector(".summary")) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      });
      // A milestone reached in this session (100, 500, 1000… mastered) is celebrated once.
      const reached = VS.milestones.claim();
      if (reached) setTimeout(VS.ui.celebrate, 250);
      return html`
        <section class="summary view-enter" aria-live="polite">
          ${reached ? html`
            <div class="milestone-hit">
              ${icon("trophy", "icon-lg")}
              <p><b>${reached.toLocaleString("en-GB")} words mastered.</b>
                <span>${reached.toLocaleString("en-GB")} words you remembered after two weeks or more — they're yours now.</span></p>
            </div>` : ""}
          <h1>${title}</h1>
          <p class="muted">${message}</p>
          <div class="summary-stats">
            ${stats.map((s) => html`<div class="summary-stat ${s.tone ? "is-" + s.tone : ""}"><b>${s.value}</b><span>${s.label}</span></div>`)}
          </div>
          <div class="summary-actions">
            ${actions.filter(Boolean).map((a) =>
              a.href
                ? html`<a class="btn btn-lg ${a.primary ? "btn-primary" : ""}" href="${a.href}">${a.label}</a>`
                : html`<button class="btn btn-lg ${a.primary ? "btn-primary" : ""}" type="button" data-action="${a.action}">${a.label}</button>`
            )}
          </div>
          ${words && words.length
            ? html`<h2 class="summary-sub">Words to look at again</h2>
                   <div class="word-list">${words.map(VS.ui.wordRow)}</div>`
            : ""}
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
