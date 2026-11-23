/* views/shared.js — UI pieces used by more than one screen.
   Each function returns markup built with VS.html (always escaped).
   If two screens need the same piece, it belongs here — never copied. */
(function () {
  "use strict";
  const { html, icon } = VS;


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
  /* The open word's small buttons: one section open at a time; the same button closes it. */
  VS.actions["word-sec"] = (el) => {
    const entry = el.closest(".word-entry");
    if (!entry) return;
    const wasOpen = el.getAttribute("aria-expanded") === "true";
    entry.querySelectorAll(".word-sec[aria-expanded]").forEach((b) => b.setAttribute("aria-expanded", "false"));
    entry.querySelectorAll(".word-panel").forEach((p) => { p.hidden = true; });
    if (wasOpen) return;
    el.setAttribute("aria-expanded", "true");
    const panel = entry.querySelector('.word-panel[data-panel="' + el.dataset.sec + '"]');
    if (panel) {
      panel.hidden = false;
      const field = el.dataset.sec === "note" && panel.querySelector("textarea");
      if (field && !field.value) field.focus();
    }
  };
  VS.actions["word-edit"] = (el) => {
    const w = VS.byId[el.dataset.id];
    const body = el.closest(".word-row-body");
    if (!w || !body) return;
    body.innerHTML = String(html`
      <form class="word-edit" data-edit-id="${w.id}">
        ${VS.aiFill({ action: "ai-copy", id: w.id, paste: "data-ai-answer", done: "Save changes", wide: true })}
        ${EDIT_FIELDS.map(([k, label]) => html`
          <label class="form-field ${LONG_FIELDS.includes(k) ? "is-wide" : ""}"><span>${label}</span>
            ${k === "type" ? html`<select name="type">${VS.importer.TYPES.map((t) => html`<option ${t === w.type ? VS.raw("selected") : ""}>${t}</option>`)}</select>`
              : k === "level" ? html`<select name="level"><option value="">—</option>${VS.importer.LEVELS.map((l) => html`<option ${l === w.level ? VS.raw("selected") : ""}>${l}</option>`)}</select>`
              : k === "tags" ? html`<input dir="auto" name="tags" value="${w.tags.join(", ")}" placeholder="IELTS, work" list="tagList">`
              : k === "synonyms" ? html`<input dir="auto" name="synonyms" value="${w.synonyms.join(", ")}" placeholder="delay, put off">`
              : LONG_FIELDS.includes(k) ? html`<textarea name="${k}" rows="2" dir="auto">${w[k] || ""}</textarea>`
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
          <button class="btn btn-quiet" type="button" data-action="word-cancel" data-id="${w.id}">Cancel</button>
        </div>
      </form>`);
  };
  /* ── Fill it in with AI (no key, no account) ──────────────────────
     The learner copies a prompt into any AI chat and pastes the answer
     back. We read "key: value" lines (or JSON), keep only fields that pass
     the same checks as typing, and fill the form — nothing is saved until
     they press Save. */
  function aiPrompt(w) {
    const lines = [
      "I'm an Arabic speaker learning English (B1–C1). Help me with the English word “" + w.word + "”" + (w.sense ? " (" + w.sense + ")" : "") + ".",
      w.context ? "I met it in this sentence: “" + w.context + "” — use THAT meaning." : "",
      w.arabic ? "My current Arabic meaning is: " + w.arabic + " (fix it if it's wrong)." : "",
      "",
      "Reply with ONE markdown code block (```markdown … ```) so I can copy it in one tap. Inside it, exactly these lines; nothing outside the block:",
      "word: <the base form>",
      "arabic: <short Arabic meaning; Egyptian Arabic is welcome; several meanings separated by \" - \">",
      "definition: <one simple English definition, learner-dictionary style>",
      "example: <one natural example sentence, 14 words or fewer, that uses the word>",
      "type: <Noun, Verb, Adjective, Adverb, Phrase, Phrasal Verb or Idiom>",
      "level: <A1, A2, B1, B2, C1 or C2>",
      "ipa: </IPA/>",
      "synonyms: <up to 4, comma-separated>",
    ];
    return lines.filter((l, i) => l || i === 3).join("\n");
  }
  VS.aiPrompt = aiPrompt;
  /** One prompt for several new words: one block per word, a blank line between. */
  /* Every multi-word prompt asks for the same blocks, in one copyable markdown block. */
  const aiBlocks = (withContext) => [
    "",
    "Put ALL the blocks inside ONE markdown code block (```markdown … ```) so I can copy it in one tap — nothing outside it.",
    "Each block has exactly these lines, with a blank line between blocks:",
    "word: <the English base form>",
    "arabic: <short Arabic meaning; Egyptian Arabic is welcome; several meanings separated by \" - \">",
    "definition: <one simple English definition, learner-dictionary style>",
    "example: <one natural example sentence, 14 words or fewer, that uses the word>",
    ...(withContext ? ["context: <the exact sentence from my text where the word appears>"] : []),
    "type: <Noun, Verb, Adjective, Adverb, Phrase, Phrasal Verb or Idiom>",
    "level: <A1, A2, B1, B2, C1 or C2>",
    "ipa: </IPA/>",
  ];
  const ME = "I'm an Arabic speaker learning English (B1–C1).";
  /** Several words I already know I want. */
  VS.aiPromptMany = (words) => [ME + " For EACH of these English words, give one block:", words.join(", "), ...aiBlocks(false)].join("\n");
  /** The most useful words about a topic, at a level. */
  VS.aiPromptTopic = (topic, n, level) => [
    ME + " Choose the " + n + " most useful English words and phrases about “" + topic + "” for a " + level + " learner.",
    "Pick words people really use in that situation; skip very basic words I surely know. One block per word:",
    ...aiBlocks(false)].join("\n");
  /** The words worth learning in a text — or in a photo the learner attaches in the AI chat. */
  VS.aiPromptText = (text, n) => [
    ME + " From " + (text ? "the text below" : "the photo or screenshot I'm attaching") + ", pick up to " + n + " words or phrases worth learning.",
    "Skip easy everyday words. One block per word:",
    ...aiBlocks(true),
    ...(text ? ["", "TEXT:", text] : [])].join("\n");
  /** Arabic I know → the natural English for it. */
  VS.aiPromptArabic = (arabic) => [
    ME + " For EACH Arabic word or phrase below, give the most natural English word or phrase with that meaning, as one block.",
    "Keep my Arabic in the “arabic” line (you may add a closer meaning after \" - \").",
    arabic.join("\n"),
    ...aiBlocks(false)].join("\n");
  /**
   * The AI's answer for several words → [{ word, arabic, … }].
   * Reads a JSON array, or "key: value" blocks (a new "word:" line starts a new block).
   */
  VS.parseAiWords = function (text) {
    const t = String(text || "").replace(/```[a-z]*\n?/gi, "").trim();
    if (!t) return [];
    const a = t.indexOf("["), b = t.lastIndexOf("]");
    if (a >= 0 && b > a) {
      try {
        const arr = JSON.parse(t.slice(a, b + 1));
        if (Array.isArray(arr)) return arr.map((o) => VS.parseAiWord(JSON.stringify(o))).filter((o) => o.word);
      } catch (e) { /* not JSON: read the lines */ }
    }
    const blocks = [];
    let cur = [];
    const isWordLine = (line) => /^\s*[-*•]?\s*\**\s*(word|headword)\s*\**\s*[:：]/i.test(line);
    t.split(/\r?\n/).forEach((line) => {
      if (isWordLine(line) && cur.some(isWordLine)) { blocks.push(cur); cur = []; }
      cur.push(line);
    });
    blocks.push(cur);
    return blocks.map((lines) => VS.parseAiWord(lines.join("\n"))).filter((o) => o.word || o.arabic || o.definition);
  };
  const AI_KEYS = {
    word: "word", headword: "word", arabic: "arabic", "arabic meaning": "arabic", meaning: "arabic", "المعنى": "arabic", "عربي": "arabic",
    definition: "definition", "english definition": "definition", example: "example", "example sentence": "example",
    type: "type", "part of speech": "type", pos: "type", level: "level", cefr: "level", "cefr level": "level",
    ipa: "ipa", pronunciation: "ipa", synonyms: "synonyms", "similar words": "synonyms", similar: "synonyms",
    context: "context", sentence: "context", "where i met it": "context",
  };
  /** The AI's answer → { field: value } (only fields that look right). */
  VS.parseAiWord = function (text) {
    let t = String(text || "").replace(/```[a-z]*\n?/gi, "").trim();
    const raw = {};
    try {
      const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
      Object.keys(j).forEach((k) => { if (AI_KEYS[k.toLowerCase()]) raw[AI_KEYS[k.toLowerCase()]] = Array.isArray(j[k]) ? j[k].join(", ") : String(j[k]); });
    } catch (e) {
      t.split(/\r?\n/).forEach((line) => {
        const m = /^\s*[-*•]?\s*\**\s*([A-Za-z\u0600-\u06FF ]{2,20}?)\s*\**\s*[:：]\s*(.+)$/.exec(line);
        const key = m && AI_KEYS[m[1].trim().toLowerCase()];
        if (key && !raw[key]) raw[key] = m[2].trim();
      });
    }
    const out = {};
    const clean = (v) => String(v).replace(/\*\*/g, "").trim().replace(/^["“'«]+|["”'»]+$/g, "").trim();
    Object.keys(raw).forEach((k) => {
      let v = clean(raw[k]);
      if (!v || /^<.*>$/.test(v)) return;                                 // the template itself, pasted back
      if (k === "arabic" && !/[\u0600-\u06FF]/.test(v)) return;
      if (k === "level") { v = v.toUpperCase().match(/[ABC][12]/); if (!v) return; v = v[0]; }
      if (k === "type") { const hit = VS.importer.TYPES.find((x) => x.toLowerCase() === v.toLowerCase()); if (!hit) return; v = hit; }
      if (k === "ipa") v = "/" + v.replace(/^\/+|\/+$/g, "") + "/";
      if (k === "example" && v.split(/\s+/).length > 22) return;
      if (k === "context") v = v.slice(0, 300);
      if (k === "synonyms") v = VS.parseTags(v).slice(0, 6).join(", ");
      out[k] = v.slice(0, 400);
    });
    return out;
  };
  /**
   * "Fill it in with AI" — one component for Add word and Edit word.
   *   ① Copy the prompt (the button says "Copied" for a moment)
   *   ② Paste the AI's answer → the fields fill in
   * A result line says what filled in; nothing is saved until the learner's own button.
   */
  VS.aiFill = ({ action, id, paste, done, wide }) => html`
    <details class="ai-fill ${wide ? "is-wide" : ""}">
      <summary>
        <span class="ai-fill-ico">${icon("bolt", "icon-sm")}</span>
        <span class="ai-fill-title"><b>Fill it in with AI</b><small>Free with ChatGPT, Claude or Gemini</small></span>
        ${icon("chevron-right", "icon-sm ai-fill-chev")}
      </summary>
      <div class="ai-fill-body">
        <div class="ai-step">
          <span class="ai-step-n" aria-hidden="true">1</span>
          <div class="ai-step-copy"><b>Copy the prompt</b><span>Paste it into your AI chat.</span></div>
          <button class="btn btn-tonal ai-copy-btn is-ready" type="button" data-action="${action}" ${id ? VS.raw('data-id="' + VS.escape(id) + '"') : ""}>${icon("text", "icon-sm")}<span>Copy</span></button>
        </div>
        <div class="ai-step">
          <span class="ai-step-n" aria-hidden="true">2</span>
          <div class="ai-step-copy"><b>Paste its answer</b><span>The fields fill in by themselves.</span></div>
        </div>
        <textarea class="ai-fill-input" rows="3" dir="auto" ${VS.raw(paste)} aria-label="The AI's answer"
          placeholder="arabic: …&#10;definition: …&#10;example: …"></textarea>
        <p class="ai-fill-status" aria-live="polite" hidden></p>
        <p class="ai-fill-foot">Nothing is saved until you press <b>${done}</b>.</p>
      </div>
    </details>`;
  /** The result line under the paste box, and the brief "Copied" on the button. */
  VS.aiFillStatus = (box, filled, hasText) => {
    const status = box && box.querySelector(".ai-fill-status");
    if (!status) return;
    status.hidden = !hasText;
    status.classList.toggle("is-ok", filled.length > 0);
    status.innerHTML = filled.length
      ? String(html`${icon("check", "icon-sm")}<span><b>${VS.plural(filled.length, "field")} filled in</b> — ${filled.join(", ")}. Check them below.</span>`)
      : "Nothing usable yet — paste the whole answer.";
  };
  VS.aiCopied = (btn) => {
    if (!btn) return;
    const label = btn.querySelector("span");
    btn.classList.add("is-done");
    if (label) label.textContent = "Copied";
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.classList.remove("is-done"); if (label) label.textContent = "Copy"; }, 2200);
  };

  VS.actions["ai-copy"] = async (el) => {
    const w = VS.byId[el.dataset.id];
    if (!w) return;
    const text = aiPrompt(w);
    try { await navigator.clipboard.writeText(text); VS.aiCopied(el); }
    catch (e) {
      const box = el.closest(".ai-fill").querySelector("[data-ai-answer]");
      box.value = text; box.select();
      VS.toast("Copy the selected text, then replace it with the AI's answer.");
    }
  };
  document.addEventListener("input", (e) => {
    if (!e.target.matches || !e.target.matches("[data-ai-answer]")) return;
    const form = e.target.closest("form.word-edit");
    const found = VS.parseAiWord(e.target.value);
    const filled = [];
    Object.keys(found).forEach((k) => {
      const f = form && form.elements[k];
      if (!f) return;
      if (k === "word" && f.value.trim().toLowerCase() === found[k].toLowerCase()) return;
      f.value = found[k];
      f.classList.add("is-filled");
      filled.push(k === "synonyms" ? "similar words" : k);
    });
    VS.aiFillStatus(e.target.closest(".ai-fill"), filled, !!e.target.value.trim());
  });

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
  // Cancel goes back to the word page, open where it was — not to a closed list.
  VS.actions["word-cancel"] = (el) => { const id = el.dataset.id; if (id) refreshWord(id); else VS.app.render(); };
  VS.actions["sentence-fix"] = (el) => {
    const id = el.dataset.id, i = Number(el.dataset.index);
    const w = VS.byId[id];
    const m = w && w.mine[i];
    const trap = m && VS.findUsageMistakes(m)[0];
    const fixed = trap && VS.fixSentence(m, trap);
    if (!fixed) return;
    const snap = VS.store.snapshot([id]);
    VS.store.replaceSentence(id, i, fixed);
    refreshWord(id);
    VS.toast("Sentence fixed — it can come back in Recall now.", { label: "Undo", run: () => { VS.store.restore(snap); refreshWord(id); } });
  };
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
    const id = el.dataset.id;
    const snap = VS.store.snapshot([id]);
    VS.store.removeSentence(id, Number(el.dataset.index));
    refreshWord(id);
    VS.toast("Sentence removed.", { label: "Undo", run: () => { VS.store.restore(snap); refreshWord(id); } });
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
  /* ── The meanings of a word, inline (V0.5 / V2.4) ────────────────
     "Other meanings", "Show the others" and "Another meaning" on the Meet card
     all open the same short list right where the learner is — never the
     13-field Edit form. The meaning shown now is marked "This one"; any other
     is one tap: "Use this meaning" (VS.store.applySense). "Yes" confirms. */
  const meaningLists = {};
  const meaningBox = (el) => {
    const host = el.closest(".meaning-ask, .word-main, .word-check");
    const scope = host && host.closest(".word-main, .meaning-ask") || host;
    return scope && scope.querySelector(".meanings");
  };
  const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  VS.actions["meaning-list"] = async (el) => {
    const w = VS.byId[el.dataset.id];
    const box = meaningBox(el);
    if (!w || !box) return;
    const opener = el.classList.contains("word-other") ? el : null;
    if (box.dataset.open === "1") {                                                        // a second tap closes it
      box.innerHTML = ""; box.dataset.open = "";
      if (opener) { opener.setAttribute("aria-expanded", "false"); opener.textContent = w.definition ? "Other meanings" : "Find a meaning"; }
      return;
    }
    box.dataset.open = "1";
    if (opener) { opener.setAttribute("aria-expanded", "true"); opener.textContent = "Hide meanings"; }
    box.innerHTML = String(html`<p class="hint">Looking up “${w.word}”…</p>`);
    let list = [];
    try { list = await VS.autofill.senses(w.word, w.context); } catch (e) { list = []; }
    // The same meaning can come from two dictionaries: keep the first of each definition.
    const seen = new Set();
    list = list.filter((m) => m.definition && !seen.has(m.definition.toLowerCase()) && seen.add(m.definition.toLowerCase())).slice(0, 6);
    // Checked meanings first; then at most three from the dictionary, apart, so a learner who met
    // another meaning still finds it — without the dictionary's rarest ones (a duel…) on top.
    if (list.some((m) => m.trusted)) list = list.filter((m) => m.trusted).concat(list.filter((m) => !m.trusted).slice(0, 3));
    meaningLists[w.id] = list;
    // Only the meaning already shown: say so, instead of listing it again.
    if (list.length === 1 && same(list[0].definition, w.definition)) {
      box.innerHTML = String(html`<p class="hint">That's the only meaning we found for “${w.word}”.</p>`);
      return;
    }
    box.innerHTML = String(list.length
      ? html`<ol class="meaning-list">${list.map((m, i) => {
          const current = same(m.definition, w.definition);
          const firstFromDictionary = !m.trusted && i > 0 && list[i - 1].trusted;
          return html`${firstFromDictionary ? html`<li class="meaning-group" aria-hidden="true">From the dictionary</li>` : ""}<li class="${current ? "is-current" : ""}">
            <p class="meaning-head"><span class="meaning-type">${m.type}</span>${m.arabic ? html`<bdi class="meaning-ar" lang="ar" dir="rtl">${m.arabic}</bdi>` : ""}</p>
            <p class="meaning-def">${m.definition}</p>
            ${m.example ? html`<p class="meaning-ex">“${m.example}”</p>` : ""}
            ${current
              ? html`<p class="meaning-this">${icon("check", "icon-sm")} This one</p>`
              : html`<button class="btn btn-tonal" type="button" data-action="meaning-use" data-id="${w.id}" data-index="${i}"
                  aria-label="Use this meaning: ${m.arabic || m.definition}">Use this meaning</button>`}
          </li>`;
        })}</ol>`
      : html`<p class="hint">${navigator.onLine ? "No other meanings found." : "You're offline — try again when you're online."}</p>`);
  };
  VS.actions["meaning-use"] = async (el) => {
    const id = el.dataset.id;
    const m = (meaningLists[id] || [])[Number(el.dataset.index)];
    if (!m) return;
    el.disabled = true;
    // A meaning without Arabic gets its own now — the old Arabic belongs to the old meaning.
    if (!m.arabic) m.arabic = await VS.autofill.arabicOf(m);
    const snap = VS.store.snapshot([id]);
    VS.store.applySense(id, m);
    refreshWord(id, ".word-definition");
    VS.toast("Meaning changed.", { label: "Undo", run: () => { VS.store.restore(snap); refreshWord(id); } });
  };
  VS.actions["meaning-yes"] = (el) => {
    VS.store.confirmMeaning(el.dataset.id);
    refreshWord(el.dataset.id, ".word-definition, .flash-def");
    VS.toast("Meaning confirmed.");
  };
  /** Redraw one word where it is: its open row in a list, or the whole activity. */
  function refreshWord(id, focusSel) {
    const row = VS.$(`.word-row[data-id="${CSS.escape(id)}"]`);
    const w = VS.byId[id];
    let scope = document;
    if (row && w) {
      row.outerHTML = String(VS.ui.wordRow(w));
      const again = VS.$(`.word-row[data-id="${CSS.escape(id)}"]`);
      if (again) { again.open = true; VS.ui.fillRow(again); scope = again; }
    } else {
      VS.app.render();
    }
    // Keep the keyboard and screen reader where the learner was, not lost on <body>.
    const target = (focusSel && scope.querySelector(focusSel)) || (scope !== document && scope.querySelector("summary"));
    if (target) {
      if (!target.hasAttribute("tabindex") && !/^(A|BUTTON|SUMMARY|INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
  }

  /* A flagged word (VS.ui.checkLine): fix the spelling, or say it's right. */
  const reopen = (id) => {
    const row = VS.$(`.word-row[data-id="${CSS.escape(id)}"]`);
    if (row) { row.open = true; VS.ui.fillRow(row); }
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
      body: "Its progress, note and your sentences go too.",
      confirmLabel: "Delete",
    });
    if (!yes) return;
    // No reload: the list redraws, and Undo puts the word back where it was (V1.1).
    const snap = VS.store.snapshot([w.id]);
    VS.store.deleteUserWords([w.id]);
    VS.app.render();
    VS.toast(`“${w.word}” deleted.`, { label: "Undo", run: () => { VS.store.restore(snap); VS.app.render(); refreshWord(w.id); } });
  };
  /* "Reset to new" on one word: its schedule starts again; Undo gives it back. ("Start over" is
     only the whole app's, #/reset.) */
  VS.actions["forget"] = (el) => {
    const id = el.dataset.id;
    const w = VS.byId[id];
    if (!w) return;
    const snap = VS.store.snapshot([id]);
    VS.store.forget(id);
    refreshWord(id);
    VS.toast(`“${w.word}” reset to new.`, { label: "Undo", run: () => { VS.store.restore(snap); refreshWord(id); } });
  };

  /* Arabic keyboard left on: the most common "mistake" that isn't one. */
  const ARABIC = /[؀-ۿ]/;
  VS.isArabicTyping = (text) => ARABIC.test(text || "");

  /* The keyboard was left on Arabic (V2.18): the learner pressed the right keys,
     the phone wrote Arabic letters. "شؤفعشممغ" is "actually" on the standard
     Arabic layout (Windows/Mac 101, the one Arab phones copy). Mapped back
     key by key, so the answer counts and the learner learns why it looked odd. */
  const AR_KEYS = { "ض": "q", "ص": "w", "ث": "e", "ق": "r", "ف": "t", "غ": "y", "ع": "u", "ه": "i", "خ": "o", "ح": "p",
    "ج": "[", "د": "]", "ش": "a", "س": "s", "ي": "d", "ب": "f", "ل": "g", "ا": "h", "ت": "j", "ن": "k", "م": "l",
    "ك": ";", "ط": "'", "ئ": "z", "ء": "x", "ؤ": "c", "ر": "v", "ى": "n", "ة": "m", "و": ",", "ز": ".", "ظ": "/" };
  VS.fromArabicKeys = (text) => String(text || "").replace(/لا/g, "b")
    .replace(/[\u0600-\u06FF]/g, (ch) => AR_KEYS[ch] || ch).replace(/[[\];',./]/g, "");

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
    /**
     * The ruler (V4.2): where a word stands on the spaced days 1·3·7·14·30·60 —
     * the same six days the first run promises. Days already reached wear the
     * highlighter (memory); the day the word is on now is solid. `compact`
     * drops the numbers for a one-line list (the end of Recall).
     */
    ruler(box, compact) {
      const days = [1, 3, 7, 14, 30, 60];
      const at = Math.max(0, Math.min(6, box || 0));
      const label = at ? "On the ruler: day " + days[at - 1] + " of 1, 3, 7, 14, 30, 60" : "Not on the ruler yet";
      return html`<ol class="ruler-mini ${compact ? "is-compact" : ""}" role="img" aria-label="${label}">${days.map((d, i) => {
        const cls = i + 1 === at ? "is-now" : i + 1 < at ? "is-past" : "";
        return html`<li class="${cls}">${compact ? "" : html`<b>${d}</b>`}</li>`;
      })}</ol>`;
    },
    levelBadge: (w) => (w.level ? html`<span class="badge ${VS.levelGroup(w.level)}" title="CEFR level">${w.level}</span>` : ""),

    speakButton: (text, label) =>
      html`<button class="speak-btn" type="button" data-action="speak" data-say="${text}" aria-label="${label || "Hear " + text}">${icon("volume", "icon-sm")}</button>`,

    /** Headword + optional sense in brackets, e.g. Axe (tool) — the sense tells two meanings apart. */
    headword: (w, cls) =>
      html`<span class="${cls || ""}">${VS.cap(w.word)}</span>${w.sense ? html` <span class="sense">(${w.sense.toLowerCase()})</span>` : ""}`,

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
      if (!hit) return html`${w.example}`;
      // The highlighter takes the word's preposition with it ("depend on", "afraid of")
      // when the word's usage trap is about that preposition: that pair is the lesson.
      const prep = VS.ui.prepOf(w);
      const m = prep && new RegExp("^(\\s+" + prep + ")\\b", "i").exec(hit.after);
      return m
        ? html`${hit.before}<mark class="mark">${hit.answer}${m[1]}</mark>${hit.after.slice(m[1].length)}`
        : html`${hit.before}<mark class="mark">${hit.answer}</mark>${hit.after}`;
    },

    /** The preposition a word's usage trap teaches ("depend" → "on"), or "". */
    prepOf(w) {
      const t = VS.usageTraps(w).find((x) => x.kind === "prep");
      if (!t) return "";
      const hit = VS.findIn(w, t.right, true);
      const m = hit && /^\s+(on|in|at|to|of|for|with|about|from|by|into)\b/i.exec(hit.after);
      return m ? m[1].toLowerCase() : "";
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
      // Dictionaries write the English r two ways (/ɹ/ and /r/): learners see one.
      return html`<span class="ipa">${VS.ipaText(w)}</span>${st ? html`
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
            const unsure = VS.sentenceUnsure(w, m);
            // Kept against a warning: show the teacher's red pen on the mistake and the fix, one tap away.
            const trap = unsure ? VS.findUsageMistakes(m)[0] : null;
            const fixed = trap ? VS.fixSentence(m, trap) : "";
            const found = trap && trap.bad.exec(" " + m + " ");
            const bad = found ? found[0].trim() : "";
            const at = bad ? m.indexOf(bad) : -1;
            const body = unsure && at >= 0
              ? html`${m.slice(0, at)}<del class="pen-wrong">${bad}</del>${m.slice(at + bad.length)}`
              : hit ? html`${hit.before}<mark class="mark">${hit.answer}</mark>${hit.after}` : m;
            return html`<li class="${unsure ? "is-unsure" : ""}"><span>${body}${unsure
                ? html`<small class="mine-unsure">${fixed
                    ? html`One thing to fix: <b>${fixed}</b>`
                    : trap ? html`${VS.ui.mixed(trap.why)}` : "May have a mistake — not used in Recall"}</small>
                  ${fixed && removable ? html`<button class="link-btn mine-fix" type="button" data-action="sentence-fix" data-id="${w.id}" data-index="${i}">Use the fix</button>` : ""}` : ""}</span>
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
          <textarea data-note="${w.id}" rows="2" maxlength="500" dir="auto"
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
          <button class="btn btn-tonal" type="button" data-action="meaning-list" data-id="${w.id}">Show the others</button>
          <button class="btn btn-quiet" type="button" data-action="meaning-yes" data-id="${w.id}">Yes, this one</button>
        </div>`;
    },

    /** One expandable row in a word list. */
    wordRow(w) {
      const s = VS.store.status(w.id);
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
              ${w.check && w.check.kind === "spelling" ? "" : html`<span>${w.type}${w.level ? " · " + w.level : ""}</span>`}
              ${w.check && w.check.kind === "spelling" ? "" : VS.frequency.band(w) ? html`<span class="word-row-freq">${VS.frequency.band(w).label}</span>` : ""}
              ${VS.ui.checkFlag(w)}
              ${VS.store.note(w.id) ? html`<span class="word-row-note" title="You wrote a note on this word">${icon("bulb", "icon-sm")}</span>` : ""}
            </span>
            ${icon("chevron-right", "icon-sm word-row-chev")}
          </summary>
          <div class="word-row-body" data-lazy="1"></div>
        </details>`;
    },

    /**
     * A word's page — built when its row opens (VS.ui.fillRow), not with the list:
     * 23 closed words used to carry 2,505 elements; 1,000 would freeze a phone.
     */
    wordBody(w) {
      const s = VS.store.status(w.id);
      const e = VS.store.word(w.id);
      const tips = VS.soundTraps(w);
      const traps = VS.usageTraps(w);
      const note = VS.store.note(w.id);
      const mine = w.mine || [];
      const related = (w.goes && w.goes.length) || (w.synonyms && w.synonyms.length);
      // The open word, short on purpose (v10 final): the essentials are always in
      // view — sound, meaning, one example, where it stands — and everything else
      // waits behind one row of small buttons, one section open at a time.
      const sec = (key, label, n, ico) => html`<button class="word-sec" type="button" data-action="word-sec" data-sec="${key}" aria-expanded="false">
          ${icon(ico, "icon-sm")}<span>${label}</span>${n ? html`<b>${n}</b>` : ""}</button>`;
      return html`
          <div class="word-row-body">
            <div class="word-entry">
              <div class="word-bar">
                <div class="word-sound-main">
                  ${VS.ui.speakButton(w.word)}
                  ${w.ipa ? html`<span class="word-sound-ipa">${VS.ui.ipa(w)}</span>` : ""}
                </div>
                <details class="lib-more word-menu">
                  <summary class="icon-btn" aria-label="Manage “${w.word}”">${icon("more")}</summary>
                  <div class="lib-more-menu">
                    <button class="btn btn-quiet" type="button" data-action="word-edit" data-id="${w.id}">${icon("pen", "icon-sm")} Edit word</button>
                    ${s === "new" ? "" : html`<button class="btn btn-quiet" type="button" data-action="forget" data-id="${w.id}">${icon("review", "icon-sm")} Reset to new</button>`}
                    <button class="btn btn-quiet word-menu-danger" type="button" data-action="word-delete" data-id="${w.id}">${icon("x", "icon-sm")} Delete</button>
                  </div>
                </details>
              </div>

              ${VS.ui.checkLine(w)}
              ${VS.ui.context(w)}

              <div class="word-lead">
                ${w.definition
                  ? html`<p class="word-definition">${w.definition}</p>`
                  : html`<p class="hint">No definition yet.
                      <button class="link-btn" type="button" data-action="word-edit" data-id="${w.id}">Add a definition</button></p>`}
                ${VS.autofill.enabled() ? html`<button class="word-other" type="button" data-action="meaning-list" data-id="${w.id}" aria-expanded="false">${w.definition ? "Other meanings" : "Find a meaning"}</button>` : ""}
              </div>
              <div class="meanings" aria-live="polite"></div>

              <div class="word-example-block">
                ${w.example ? html`
                  <figure class="word-example">
                    <blockquote>${VS.ui.quote(w)}</blockquote>
                    <button class="icon-btn word-hear" type="button" data-action="speak" data-say="${w.example}" aria-label="Hear the sentence">${icon("volume", "icon-sm")}</button>
                  </figure>` : html`<p class="hint word-no-ex">No example yet.
                    <button class="link-btn" type="button" data-action="word-edit" data-id="${w.id}">Add an example</button></p>`}
                <div class="word-ex-tools">${VS.ui.moreExamples(w)}</div>
              </div>

              <div class="word-memory">
                ${s === "new"
                  ? html`<p class="word-memory-line"><span>Not studied yet</span><span class="word-memory-sep" aria-hidden="true">·</span><span>added ${VS.ui.dateText(w.added)}</span></p>`
                  : html`<p class="word-memory-line"><span>Next recall</span> <b>${whenText(e.due)}</b></p>
                    <span class="word-memory-right" title="${e.right} right · ${e.wrong} wrong">${VS.ui.ruler(e.box, true)}<span class="word-memory-score">${e.right} right · ${e.wrong} wrong</span></span>`}
              </div>

              <div class="word-secs" role="group" aria-label="More about this word">
                ${traps.length ? sec("mistakes", "Mistakes", traps.length, "target") : ""}
                ${mine.length ? sec("mine", "Sentences", mine.length, "pen")
                  : html`<a class="word-sec" href="#/word/write?id=${encodeURIComponent(w.id)}" title="Write a sentence with this word">${icon("pen", "icon-sm")}<span>Use it</span></a>`}
                ${related ? sec("related", "Goes with", 0, "match") : ""}
                ${tips.length ? sec("sound", "Sounds", tips.length, "volume") : ""}
                ${sec("note", "Note", note ? "✓" : 0, "bulb")}
              </div>
              ${traps.length ? html`<div class="word-panel" data-panel="mistakes" hidden>${VS.ui.usage(w)}</div>` : ""}
              ${mine.length ? html`<div class="word-panel" data-panel="mine" hidden>
                  ${VS.ui.mine(w, true)}
                  <a class="btn btn-tonal word-write" href="#/word/write?id=${encodeURIComponent(w.id)}">${icon("pen", "icon-sm")} Write another sentence</a>
                </div>` : ""}
              ${related ? html`<div class="word-panel word-related" data-panel="related" hidden>${VS.ui.goes(w)}${VS.ui.similar(w)}</div>` : ""}
              ${tips.length ? html`<div class="word-panel" data-panel="sound" hidden>${VS.ui.soundTraps(w)}</div>` : ""}
              <div class="word-panel" data-panel="note" hidden>
                ${VS.ui.noteBox(w)}
                ${w.tags.length ? html`<div class="word-tags">${VS.ui.tags(w)}</div>` : ""}
              </div>
            </div>
          </div>`;
    },

    /** Fill an open row's page if it is still empty. Safe to call twice. */
    fillRow(row) {
      const body = row && row.querySelector(":scope > .word-row-body[data-lazy]");
      const w = row && VS.byId[row.dataset.id];
      if (!body || !w) return;
      body.outerHTML = String(VS.ui.wordBody(w));
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
    /**
     * One counter for every activity (V2.2): `total` is the words in the round and
     * never grows; a word coming back is counted in `again` ("3 of 8 · 2 to try
     * again"), and the bar only moves forward.
     */
    activityHead({ back, title, sub, index, total, combo, undo, again }) {
      const bump = combo !== VS.ui.lastCombo;   // pulse only when the streak just changed
      if (bump && combo >= 3) setTimeout(() => VS.sfx.play("combo", combo), 160);
      VS.ui.lastCombo = combo;
      const pos = Math.min(index, total);
      const pct = total ? Math.round((pos / total) * 100) : 0;
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
            <span class="count" aria-live="polite">${index >= total && again ? html`Once more` : html`${Math.min(index + 1, total)} of ${total}`}${again ? html`<span class="count-again"><span class="count-long"> · ${again} to try again</span><span class="count-short" aria-hidden="true"> · +${again}</span></span>` : ""}</span>
          </div>
          <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${pos}">
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
    summary({ title, message, stats, words, actions, back, moved, teacher }) {
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
              <p><b>${reached === 1 ? (VS.milestones.firstWord() ? "“" + VS.milestones.firstWord() + "” is yours now." : "Your first word mastered.") : reached.toLocaleString("en-GB") + " words mastered."}</b>
                <span>${reached === 1 ? "You remembered it after a week or more — it's yours now."
                  : reached.toLocaleString("en-GB") + " words you remembered after a week or more — they're yours now."}</span></p>
            </div>` : ""}
          <h1>${title}</h1>
          <p class="muted">${message}</p>
          ${teacher ? html`<p class="summary-teacher">${teacher}</p>` : ""}
          <div class="summary-stats">
            ${stats.map((s) => html`<div class="summary-stat ${s.tone ? "is-" + s.tone : ""}"><b>${s.value}</b><span>${s.label}</span></div>`)}
          </div>
          ${moved && moved.length ? html`
            <div class="summary-moved">
              <h2 class="summary-sub">Moving forward</h2>
              <ul>${moved.slice(0, 8).map((m) => html`<li><mark class="mark">${VS.cap(m.word)}</mark>${VS.ui.ruler(m.box, true)}<span>comes back ${m.when}</span></li>`)}</ul>
              ${moved.length > 8 ? html`<p class="hint">and ${moved.length - 8} more</p>` : ""}
            </div>` : ""}
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
            <h1>Nothing to practise here yet</h1>
            <p>${text}</p>
            <a class="btn btn-primary" href="${back}">${label || "Go back"}</a>
          </div>
        </div>`;
    },
  };
})();
