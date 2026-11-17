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
        return html`<li><span class="more-ex-text">${hit ? html`${hit.before}<mark class="mark">${hit.answer}</mark>${hit.after}` : t}</span>${VS.ui.speakButton(t, "Hear this sentence")}</li>`;
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
            <span class="sense-type">${m.type}${m.arabic ? html` · <bdi lang="ar" dir="rtl">${m.arabic}</bdi>` : ""}</span>
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
  VS.actions["word-sense-pick"] = async (el) => {
    const m = senses[Number(el.dataset.index)];
    const form = el.closest("form");
    if (!m || !form) return;
    // A meaning without Arabic gets its own now — the old Arabic belongs to the old meaning.
    if (!m.arabic) {
      el.disabled = true;
      m.arabic = await VS.autofill.arabicOf(m);
      el.disabled = false;
      if (!m.arabic) form.elements.arabic.value = "";
    }
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
  /* A flagged word (VS.ui.checkLine): fix the spelling, or say it's right. */
  const reopen = (id) => {
    const row = VS.$(`.word-row[data-id="${CSS.escape(id)}"]`);
    if (row) row.open = true;
  };
  VS.actions["word-respell"] = (el) => {
    const id = VS.store.respellUserWord(el.dataset.id, el.dataset.fix);
    if (!id) { VS.toast(`“${el.dataset.fix}” is already in your library.`); return; }
    VS.toast(`Changed to “${el.dataset.fix}”. Filling in its meaning…`);
    VS.autofill.fill([id]);
    VS.app.render();
    reopen(id);
  };
  VS.actions["word-check-ok"] = (el) => {
    VS.store.clearCheck(el.dataset.id);
    const box = el.closest(".word-check");
    if (box) box.remove();
    const flag = VS.$(`.word-row[data-id="${CSS.escape(el.dataset.id)}"] .word-row-flag`);
    if (flag) flag.remove();
  };
  VS.actions["word-delete"] = async (el) => {
    const w = VS.byId[el.dataset.id];
    if (!w) return;
    const yes = await VS.confirm({
      title: `Delete “${w.word}”?`,
      body: "Its progress and note go too. This can't be undone.",
      confirmLabel: "Delete",
    });
    if (!yes) return;
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
    watchKeyboard(input, opts) {
      if (!input) return () => false;
      input.setAttribute("lang", "en");
      let note = input.closest("label, form, .field-wrap");
      note = input.closest(".add-line") ? input.closest(".add-line").parentElement.querySelector(":scope > .kb-warn")
        : note && note.parentElement && note.parentElement.querySelector(".kb-warn");
      if (!note) {
        note = document.createElement("p");
        note.className = "kb-warn";
        note.setAttribute("role", "status");
        // Under the whole add line, not inside the field: inside, it covered what was typed.
        (input.closest(".add-line") || input.closest("label") || input).insertAdjacentElement("afterend", note);
      }
      const update = () => {
        const on = ARABIC.test(input.value);
        // In an add box Arabic is a way in: Add finds the English word (core/spelling.js).
        note.textContent = !on ? ""
          : opts && opts.lookup && VS.autofill.enabled() ? "Arabic? Press Add and pick the English word."
          : "Your keyboard is in Arabic — switch it to English to type this word.";
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
          <figcaption>${icon("book", "icon-sm")}<span>Where you met it${w.source ? html`, <span class="met-source">${w.source}</span>` : ""}</span></figcaption>
          <blockquote>${hit ? html`${hit.before}<mark class="mark">${hit.answer}</mark>${hit.after}` : w.context}</blockquote>
        </figure>`;
    },

    /** Sentences the learner wrote with the word (Use it). */
    mine(w, removable) {
      if (!w.mine || !w.mine.length) return "";
      return html`
        <div class="mine">
          <p class="mine-head">Your sentences</p>
          <ul>${w.mine.map((m, i) => {
            const hit = VS.findIn(w, m, true);
            const unsure = (w.unsure || []).includes(m);
            return html`<li class="${unsure ? "is-unsure" : ""}"><span>${hit ? html`${hit.before}<mark class="mark">${hit.answer}</mark>${hit.after}` : m}${unsure
                ? html`<small class="mine-unsure">May have a mistake — not used in Recall</small>` : ""}</span>
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
      ? html`<p class="similar goes ${cls || ""}"><span>Goes with</span> ${w.goes.join("\u00A0· ")}</p>` : ""),

    /** Similar words: another way in to the same meaning. */
    similar: (w, cls) => (w.synonyms && w.synonyms.length
      ? html`<p class="similar ${cls || ""}"><span>Similar</span> ${w.synonyms.join("\u00A0· ")}</p>` : ""),

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

    /** The small tag on a word row that needs a look: "Check spelling" / "2+ meanings". */
    checkFlag(w) {
      const k = w.check && w.check.kind;
      if (k === "spelling") return html`<span class="word-row-flag">Check spelling</span>`;
      if (k === "meaning") return html`<span class="word-row-flag">Which meaning?</span>`;
      return "";
    },

    /**
     * The line at the top of a flagged word (core/autofill.js sets the flag):
     * a probable typo with its fix, or a word whose meanings differ in Arabic.
     * Everything the app teaches is built on this word, so it asks first.
     */
    checkLine(w) {
      const c = w.check;
      if (!c || (c.kind !== "spelling" && c.kind !== "meaning")) return "";
      if (c.kind === "spelling") return html`
        <div class="word-check" role="note">
          ${c.fix
            ? html`<span>${icon("bulb", "icon-sm")} No dictionary knows “${w.word}”. Did you mean <b>${c.fix}</b>?</span>
                   <button class="btn btn-primary" type="button" data-action="word-respell" data-id="${w.id}" data-fix="${c.fix}">Change to “${c.fix}”</button>`
            : html`<span>${icon("bulb", "icon-sm")} No dictionary knows “${w.word}”. Check the spelling before you learn it.</span>
                   <button class="btn btn-tonal" type="button" data-action="word-edit" data-id="${w.id}">Edit</button>`}
          <button class="btn btn-quiet" type="button" data-action="word-check-ok" data-id="${w.id}">It's right</button>
        </div>`;
      return html`
        <div class="word-check" role="note">
          <span>${icon("book", "icon-sm")} “${w.word}” has more than one meaning. Is this the one you met?</span>
          <button class="btn btn-tonal" type="button" data-action="word-meanings" data-id="${w.id}">Show the others</button>
          <button class="btn btn-quiet" type="button" data-action="word-check-ok" data-id="${w.id}">Yes, this one</button>
        </div>`;
    },

    /** One expandable row in a word list. */
    wordRow(w) {
      const s = VS.store.status(w.id);
      const e = VS.store.word(w.id);
      const state = s === "mastered" ? "Mastered" : s === "learning" ? "Learning" : "New";
      const tips = VS.soundTraps(w);
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
              ${w.check && w.check.kind === "spelling" ? "" : html`<span>${w.type}${w.level ? " · " + w.level : ""}</span>`}
              ${w.check && w.check.kind === "spelling" ? "" : VS.frequency.band(w) ? html`<span class="word-row-freq">${VS.frequency.band(w).label}</span>` : ""}
              ${VS.ui.checkFlag(w)}
              ${VS.store.note(w.id) ? html`<span class="word-row-note" title="You wrote a note on this word">${icon("bulb", "icon-sm")}</span>` : ""}
            </span>
            <span class="word-row-badges">${VS.ui.statusBadge(w)}${VS.ui.levelBadge(w)}</span>
            ${icon("chevron-right", "icon-sm word-row-chev")}
          </summary>
          <div class="word-row-body">
            <div class="word-entry">
              <div class="word-sound">
                <div class="word-sound-main">
                  ${VS.ui.speakButton(w.word)}
                  ${w.ipa ? html`<span class="word-sound-ipa">${VS.ui.ipa(w)}</span>` : ""}
                </div>
                ${tips.length ? html`
                  <details class="word-traps">
                    <summary>
                      <span>Sound tips</span>
                      <span class="word-traps-n">${tips.length}</span>
                      ${icon("chevron-right", "icon-sm word-traps-chev")}
                    </summary>
                    ${VS.ui.soundTraps(w)}
                  </details>` : ""}
              </div>

              <div class="word-main">
                ${VS.ui.checkLine(w)}
                <div class="word-lead">
                  ${w.definition
                    ? html`<p class="word-definition">${w.definition}</p>`
                    : html`<p class="hint">No definition yet.
                        <button class="link-btn" type="button" data-action="word-edit" data-id="${w.id}">Add a definition</button></p>`}
                  ${VS.autofill.enabled() ? html`<button class="word-other" type="button" data-action="word-meanings" data-id="${w.id}">${w.definition ? "Other meanings" : "Find a meaning"}</button>` : ""}
                </div>

                <div class="word-example-block">
                  ${w.example ? html`
                    <figure class="word-example">
                      <blockquote>${VS.ui.quote(w)}</blockquote>
                    </figure>` : html`<p class="hint word-no-ex">No example yet.
                      <button class="link-btn" type="button" data-action="word-edit" data-id="${w.id}">Add an example</button></p>`}
                  <div class="word-ex-tools">
                    ${w.example ? html`<button class="word-hear" type="button" data-action="speak" data-say="${w.example}">
                      ${icon("volume", "icon-sm")}<span>Hear the sentence</span>
                    </button>` : ""}
                    ${VS.ui.moreExamples(w)}
                  </div>
                </div>

                <div class="word-practice">
                  <a class="btn btn-primary word-write" href="#/word/write?id=${encodeURIComponent(w.id)}">${icon("pen", "icon-sm")}
                    ${w.mine.length ? "Another sentence" : "Write a sentence"}</a>
                </div>

                ${VS.ui.context(w)}
                ${VS.ui.mine(w, true)}
                ${VS.usageTraps(w).length ? html`<div class="word-usage">${VS.ui.usage(w)}</div>` : ""}
                ${(w.goes && w.goes.length) || (w.synonyms && w.synonyms.length) ? html`
                  <div class="word-related">
                    ${VS.ui.goes(w)}
                    ${VS.ui.similar(w)}
                  </div>` : ""}
              </div>

              <aside class="word-margin" aria-label="Notes and schedule for this word">
                ${VS.ui.noteBox(w)}
                ${w.tags.length ? html`<div class="word-tags">${VS.ui.tags(w)}</div>` : ""}
                <div class="word-record">
                  ${s === "new"
                    ? html`<span>Added ${VS.ui.dateText(w.added)} · not studied yet</span>`
                    : html`
                      <span>Next recall <b>${whenText(e.due)}</b></span>
                      <span class="word-box-line">
                        <span class="word-boxes" role="img" aria-label="Memory box ${e.box} of 6">
                          ${[1, 2, 3, 4, 5, 6].map((n) => html`<i class="${n <= e.box ? "is-on" : ""}"></i>`)}
                        </span>
                        <span class="word-box-label">Box ${e.box}/6</span>
                      </span>
                      <span class="word-score">${e.right} right · ${e.wrong} wrong</span>`}
                </div>
                <div class="word-manage">
                  ${s === "new" ? "" : html`<button class="word-manage-btn" type="button" data-action="forget" data-id="${w.id}">Start over</button>`}
                  <button class="word-manage-btn" type="button" data-action="word-edit" data-id="${w.id}">Edit</button>
                  <button class="word-manage-btn danger" type="button" data-action="word-delete" data-id="${w.id}">Delete</button>
                </div>
              </aside>
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
    summary({ title, message, stats, words, actions, back }) {
      // Always a way out: "Next: Quiz" is a suggestion, "Done" is a choice.
      actions = actions.filter(Boolean);
      if (!actions.some((a) => a.label === "Done")) actions.push({ href: back || "#/", label: "Done" });
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
              <p><b>${reached === 1 ? "Your first word mastered." : reached.toLocaleString("en-GB") + " words mastered."}</b>
                <span>${reached === 1 ? "You remembered it after two weeks or more — it's yours now."
                  : reached.toLocaleString("en-GB") + " words you remembered after two weeks or more — they're yours now."}</span></p>
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
