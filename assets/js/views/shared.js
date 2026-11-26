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
  const EDIT_FIELDS = [["word", "Word"], ["sense", "Sense (to tell two meanings apart)"], ["arabic", "Arabic"],
                       ["definition", "Definition"], ["example", "Example"],
                       ["type", "Type"], ["level", "Level"], ["ipa", "IPA"],
                       ["tags", "Tags"], ["synonyms", "Similar words"], ["antonyms", "Opposite words"],
                       ["goes", "Goes with (word partners)"], ["memory", "Memory hook"],
                       ["context", "Where you met it (the sentence)"], ["source", "Source (a series, a book, work…)"]];
  const LONG_FIELDS = ["definition", "example", "context", "memory"];
  const LIST_FIELDS = ["tags", "synonyms", "antonyms", "goes"];       // edited as "a, b, c"
  const MISTAKE_FIELDS = [["mistakeWrong", "Wrong", "What a learner may say or write"],
                          ["mistakeRight", "Right", "What a native speaker says"],
                          ["mistakeWhy", "Why", "One short line — the rule, in Arabic if you like"]];
  VS.actions = VS.actions || {};
  VS.actions["word-open"] = (el) => VS.openWordCard(el.dataset.id, { opener: el });
  VS.actions["word-close"] = () => VS.closeWordCard();
  VS.actions["word-edit"] = (el) => {
    const w = VS.byId[el.dataset.id];
    const body = el.closest(".word-card-body");
    if (!w || !body) return;
    body.innerHTML = String(html`
      <div class="word-edit-wrap">
        <div class="word-edit-head">
          <h2 id="wordCardTitle" tabindex="-1">Edit <span>“${VS.cap(w.word)}”</span></h2>
          <p class="hint">Nothing changes until you press Save.</p>
        </div>
        <form class="word-edit" data-edit-id="${w.id}">
          ${VS.aiFill({ action: "ai-copy", id: w.id, paste: "data-ai-answer", done: "Save changes", wide: true })}
          ${EDIT_FIELDS.map(([k, label]) => html`
            <label class="form-field ${LONG_FIELDS.includes(k) ? "is-wide" : ""}"><span>${label}</span>
              ${k === "type" ? html`<select name="type">${VS.importer.TYPES.map((t) => html`<option ${t === w.type ? VS.raw("selected") : ""}>${t}</option>`)}</select>`
                : k === "level" ? html`<select name="level"><option value="">—</option>${VS.importer.LEVELS.map((l) => html`<option ${l === w.level ? VS.raw("selected") : ""}>${l}</option>`)}</select>`
                : k === "tags" ? html`<input dir="auto" name="tags" value="${w.tags.join(", ")}" placeholder="IELTS, work" list="tagList">`
                : k === "synonyms" ? html`<input dir="auto" name="synonyms" value="${w.synonyms.join(", ")}" placeholder="delay, put off">`
                : k === "antonyms" ? html`<input dir="auto" name="antonyms" value="${w.antonyms.join(", ")}" placeholder="hurry, rush">`
                : k === "goes" ? html`<input dir="auto" name="goes" value="${w.goes.join(", ")}" placeholder="heavy rain, light rain">`
                : LONG_FIELDS.includes(k) ? html`<textarea name="${k}" rows="2" dir="auto" ${k === "memory" ? VS.raw('placeholder="A way to remember it — Arabic is fine"') : ""}>${w[k] || ""}</textarea>`
                : html`<input name="${k}" value="${w[k] || ""}" ${k === "arabic" ? VS.raw('lang="ar" dir="rtl"') : ""}>`}
            </label>`)}
          <fieldset class="word-edit-mistake is-wide">
            <legend>Mistake to avoid <span class="hint">— optional; the AI often writes one</span></legend>
            <div class="word-edit-mistake-grid">
              ${MISTAKE_FIELDS.map(([k, label, hint], i) => html`
                <label class="form-field ${i === 2 ? "is-wide" : ""}"><span>${label}</span>
                  <input name="${k}" dir="auto" value="${(w.mistake && w.mistake[k === "mistakeWrong" ? "wrong" : k === "mistakeRight" ? "right" : "why"]) || ""}" placeholder="${hint}"></label>`)}
            </div>
          </fieldset>
          ${VS.ui.tagList()}
          ${VS.autofill.enabled() ? html`<div class="sense-pick is-wide">
            <button class="btn btn-tonal" type="button" data-action="word-senses" data-id="${w.id}">${icon("book", "icon-sm")} Other meanings</button>
            <div class="sense-list" aria-live="polite"></div>
          </div>` : ""}
          <div class="row is-wide">
            <button class="btn btn-primary" type="button" data-action="word-save" data-id="${w.id}">Save changes</button>
            <button class="btn btn-quiet" type="button" data-action="word-cancel" data-id="${w.id}">Cancel</button>
          </div>
        </form>
      </div>`);
    // The Edit button just vanished: keep the keyboard at the form's heading, not on <body>.
    const head = body.querySelector(".word-edit-head h2");
    if (head) head.focus({ preventScroll: true });
  };
  /* ── Fill it in with AI (no key, no account) ──────────────────────
     The learner copies a prompt into any AI chat and pastes the answer
     back. We read "key: value" lines (or JSON), keep only fields that pass
     the same checks as typing, and fill the form — nothing is saved until
     they press Save. */
  /* The learner's own level (Settings → Your English level, A1–C2): chosen by
     them, never guessed, and written into every prompt so the AI's meanings
     and examples are pitched exactly at them. */
  VS.myLevel = () => VS.store.settings().level || "";
  /* The Arab world speaks many Arabics: the learner picks theirs once, and every
     Arabic meaning the AI writes is in it. [value, name for the AI, Arabic label, where] */
  VS.DIALECTS = [
    ["msa", "clear Modern Standard Arabic (الفصحى)", "الفصحى", "لكل العرب"],
    ["eg", "Egyptian Arabic (العامية المصرية)", "مصر", "مصري"],
    ["sa", "Saudi Arabic (اللهجة السعودية / النجدية والحجازية)", "السعودية", "سعودي"],
    ["ae", "Emirati Arabic (اللهجة الإماراتية)", "الإمارات", "إماراتي"],
    ["kw", "Kuwaiti Arabic (اللهجة الكويتية)", "الكويت", "كويتي"],
    ["qa", "Qatari Arabic (اللهجة القطرية)", "قطر", "قطري"],
    ["bh", "Bahraini Arabic (اللهجة البحرينية)", "البحرين", "بحريني"],
    ["om", "Omani Arabic (اللهجة العمانية)", "عُمان", "عماني"],
    ["ye", "Yemeni Arabic (اللهجة اليمنية)", "اليمن", "يمني"],
    ["iq", "Iraqi Arabic (اللهجة العراقية)", "العراق", "عراقي"],
    ["sy", "Syrian Arabic (اللهجة الشامية السورية)", "سوريا", "سوري"],
    ["lb", "Lebanese Arabic (اللهجة اللبنانية)", "لبنان", "لبناني"],
    ["jo", "Jordanian Arabic (اللهجة الأردنية)", "الأردن", "أردني"],
    ["ps", "Palestinian Arabic (اللهجة الفلسطينية)", "فلسطين", "فلسطيني"],
    ["sd", "Sudanese Arabic (اللهجة السودانية)", "السودان", "سوداني"],
    ["ly", "Libyan Arabic (اللهجة الليبية)", "ليبيا", "ليبي"],
    ["tn", "Tunisian Arabic (الدارجة التونسية)", "تونس", "تونسي"],
    ["dz", "Algerian Arabic (الدارجة الجزائرية)", "الجزائر", "جزائري"],
    ["ma", "Moroccan Arabic (الدارجة المغربية)", "المغرب", "مغربي"],
    ["mr", "Hassaniya Arabic of Mauritania (الحسانية)", "موريتانيا", "حساني"],
    ["so", "the Arabic used in Somalia (simple Modern Standard Arabic)", "الصومال", "صومالي"],
    ["dj", "the Arabic used in Djibouti (simple Modern Standard Arabic)", "جيبوتي", "جيبوتي"],
    ["km", "the Arabic used in Comoros (simple Modern Standard Arabic)", "جزر القمر", "قمري"],
  ];
  VS.myDialect = () => VS.DIALECTS.find((d) => d[0] === VS.store.settings().dialect) || null;
  const dialectLabel = (d) => d[0] === "msa" ? d[2] : d[3];
  VS.profileSet = () => !!(VS.myLevel() && VS.myDialect());
  const LEVEL_NAMES = { A1: "Beginner", A2: "Elementary", B1: "Intermediate", B2: "Upper-mid", C1: "Advanced", C2: "Proficient" };
  const meLine = () => "I'm an Arabic speaker learning English at CEFR level " + VS.myLevel() +
    ". Write every definition and example so a " + VS.myLevel() + " learner understands it easily.";
  /** The "arabic:" line of every prompt: meanings in the learner's own Arabic. */
  VS.aiArabicLine = () => {
    const d = VS.myDialect();
    return "arabic: <one short Arabic meaning written in " + (d ? d[1] : "Modern Standard Arabic") +
      (d && !/Standard/.test(d[1]) ? ", the way people there really say it" : "") + " — for THIS meaning only>";
  };
  /** One quiet line where the AI is used: who it writes for, and Change. */
  VS.levelPick = () => {
    const d = VS.myDialect();
    return html`<button type="button" class="me-chip ${VS.profileSet() ? "" : "is-unset"}" data-action="open-profile">
      ${VS.profileSet()
        ? html`<span class="me-chip-level" aria-hidden="true">${VS.myLevel()}</span><span class="me-chip-text">Written for <b>${LEVEL_NAMES[VS.myLevel()] || VS.myLevel()}</b> · <bdi lang="ar" dir="rtl">${dialectLabel(d)}</bdi></span><span class="me-chip-edit">Change</span>`
        : html`${icon("target", "icon-sm")}<span class="me-chip-text">Choose your level and Arabic first</span><span class="me-chip-edit">Choose</span>`}
    </button>`;
  };

  /* ── Your level and your Arabic: asked once, at the start ─────────── */
  function profileMarkup(first) {
    const lv = VS.myLevel(), dv = (VS.myDialect() || [])[0];
    return html`
      <div class="sheet-head"><h2 id="profileTitle">${first ? "Make it yours" : "Your level & Arabic"}</h2>
        ${first ? "" : html`<button class="icon-btn" type="button" data-action="close-profile" aria-label="Close">${icon("x")}</button>`}</div>
      <div class="sheet-body profile-body">
        ${first ? html`<p class="hint">Two quick choices. The AI uses them for every word it writes for you — you can change them any time in Settings.</p>` : ""}
        <fieldset class="profile-set">
          <legend>Your English level</legend>
          <div class="profile-levels">
            ${Object.keys(LEVEL_NAMES).map((l) => html`<button type="button" data-action="profile-pick" data-name="level" data-value="${l}" aria-pressed="${lv === l}">
              <b>${l}</b><small>${LEVEL_NAMES[l]}</small></button>`)}
          </div>
        </fieldset>
        <fieldset class="profile-set">
          <legend>Your Arabic <span class="hint">— where you're from; meanings are written in your dialect</span></legend>
          <div class="profile-dialects">
            ${VS.DIALECTS.map(([v, , place, dia]) => html`<button type="button" data-action="profile-pick" data-name="dialect" data-value="${v}" aria-pressed="${dv === v}" lang="ar" dir="rtl" class="${v === "msa" ? "is-msa" : ""}">
              <b>${place}</b><small>${dia}</small></button>`)}
          </div>
        </fieldset>
        <button class="btn btn-primary profile-done" type="button" data-action="profile-done" ${lv && dv ? "" : VS.raw("disabled")}>${first ? "Start" : "Done"}</button>
      </div>`;
  }
  VS.openProfile = (first) => {
    let dlg = document.getElementById("profile");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "profile";
      dlg.className = "sheet profile-sheet";
      dlg.setAttribute("aria-labelledby", "profileTitle");
      // The first time, the two choices come before anything else (Esc doesn't skip them).
      dlg.addEventListener("cancel", (e) => { if (!VS.profileSet()) e.preventDefault(); });
      document.body.appendChild(dlg);
    }
    dlg.dataset.first = first ? "1" : "";
    dlg.innerHTML = String(profileMarkup(first));
    if (!dlg.open) dlg.showModal();
  };
  VS.actions["open-profile"] = () => {
    const s = document.getElementById("settings");
    if (s && s.open) s.close();
    VS.openProfile(!VS.profileSet());
  };
  VS.actions["profile-pick"] = (el) => {
    VS.store.setSetting(el.dataset.name, el.dataset.value);
    const dlg = document.getElementById("profile");
    dlg.querySelectorAll(`[data-name="${el.dataset.name}"]`).forEach((b) => b.setAttribute("aria-pressed", String(b === el)));
    dlg.querySelector(".profile-done").disabled = !VS.profileSet();
  };
  const closeProfile = () => {
    const dlg = document.getElementById("profile");
    if (dlg) dlg.close();
    VS.app.render();                              // the AI tabs and buttons wake up with the choice
  };
  VS.actions["profile-done"] = closeProfile;
  VS.actions["close-profile"] = () => { if (VS.profileSet()) closeProfile(); };

  /* Every AI answer is a stack of complete word cards — one per meaning.
     The same lines serve one word and many, so a learner who learns one
     prompt has learned them all. */
  const CARD_LINES = [
    "word: <the English base form>",
    "sense: <2–4 English words naming THIS meaning — REQUIRED, never blank and never just the part of speech. E.g. games and sport, music>",
    VS.aiArabicLine(),
    "definition: <one simple English definition, learner-dictionary style>",
    "example: <one natural example sentence, 14 words or fewer, that uses the word in THIS meaning>",
    "type: <Noun, Verb, Adjective, Adverb, Phrase, Phrasal Verb or Idiom>",
    "level: <A1, A2, B1, B2, C1 or C2>",
    "ipa: </IPA/>",
    "synonyms: <up to 4 words with the same meaning, comma-separated, or —>",
    "antonyms: <up to 3 opposites, comma-separated, or —>",
    "goes with: <up to 3 natural word partners for THIS meaning (play the piano), comma-separated, or —>",
    "memory: <a short memory hook in Arabic, 12 words or fewer, that ties this meaning to the word, or —>",
    "# one mistake Arab learners often make with THIS meaning:",
    "wrong: <the wrong sentence, or —>",
    "right: <the correct sentence, or —>",
    "why: <one short line in Arabic explaining the rule, or —>",
  ];
  const answerShape = [
    "",
    "Put ALL the blocks inside ONE markdown code block (```markdown … ```) so I can copy it in one tap — nothing outside it.",
    "Each block has exactly these lines, with a blank line between blocks:",
    ...CARD_LINES,
  ];

  function aiPrompt(w) {
    const fixed = !!(w.context || w.arabic || w.sense);
    const head = [
      meLine() + " Help me with the English word “" + w.word + "”" + (w.sense ? " (" + w.sense + ")" : "") + ".",
      w.context ? "I met it in this sentence: “" + w.context + "” — use THAT meaning." : "",
      w.arabic ? "My current Arabic meaning is: " + w.arabic + " — keep this meaning; fix the Arabic if it is wrong." : "",
      w.sense ? "My label for this meaning is: " + w.sense + "." : "",
    ].filter(Boolean).join("\n");
    return [head, "",
      fixed
        ? "Give exactly ONE block — this one meaning only. Do not add other meanings."
        : "Give each common meaning of “" + w.word + "” its own block — up to 4. Example: play = يلعب (games and sport) is one block; play = يعزف (music) is another. Skip rare meanings. If it has one common meaning, one block only.",
      ...answerShape].join("\n");
  }
  VS.aiPrompt = aiPrompt;

  /** Several words I already know I want — with the sentences they were
      met in and the Arabic meanings the learner already knows. */
  VS.aiPromptMany = (words, contexts, arabics) => {
    const met = words.map((word, i) => {
      const c = (contexts || [])[i];
      const ar = (arabics || [])[i];
      if (!c && !ar) return "";
      return "- " + word + (c ? ": “" + c + "”" : "") + (ar ? " — the meaning I know: " + ar : "");
    }).filter(Boolean);
    return [meLine() + " For EACH of these English words, give a complete word card:", words.join(", "),
      ...(met.length ? ["", "I met some of them in these sentences, and I know some in Arabic — use THAT meaning for those words:", ...met] : []),
      "",
      "One block per word. If a word has two very common, clearly different meanings (like play = يلعب / يعزف), give it two blocks — no more than two per word, each with its own sense and arabic. When I give a sentence or an Arabic meaning, use THAT meaning only.",
      ...answerShape].join("\n");
  };
  /** The most useful words about a topic, at a level. */
  VS.aiPromptTopic = (topic, n) => [
    meLine() + " Choose the " + n + " most useful English words and phrases about “" + topic + "” for my level.",
    /^A/.test(VS.myLevel())
      ? "Pick simple, everyday words people really use in that situation. One block per word, with the meaning that fits this topic:"
      : "Pick words people really use in that situation; skip very basic words I surely know. One block per word, with the meaning that fits this topic:",
    ...answerShape].join("\n");
  /** Arabic I know → the natural English for it. */
  VS.aiPromptArabic = (arabic) => [
    meLine() + " For EACH Arabic word or phrase below, give the most natural English word or phrase with that meaning.",
    "One block per Arabic item. Keep my Arabic in the “arabic” line as I wrote it; the “sense” line names the English meaning.",
    arabic.join("\n"),
    ...answerShape].join("\n");
  /**
   * The AI's answer for several words → [{ word, arabic, … }].
   * Reads a JSON array (or { meanings: [] }), or "key: value" blocks
   * (a new "word:" line starts a new block).
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
    const oa = t.indexOf("{"), ob = t.lastIndexOf("}");
    if (oa >= 0 && ob > oa) {
      try {
        const o = JSON.parse(t.slice(oa, ob + 1));
        const arr = Array.isArray(o.meanings) ? o.meanings : Array.isArray(o.words) ? o.words : null;
        if (arr) return arr.map((x) => VS.parseAiWord(JSON.stringify(x))).filter((x) => x.word);
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
    sense: "sense", "sense label": "sense", "meaning label": "sense",
    definition: "definition", "english definition": "definition", example: "example", "example sentence": "example",
    type: "type", "part of speech": "type", pos: "type", level: "level", cefr: "level", "cefr level": "level",
    ipa: "ipa", pronunciation: "ipa", synonyms: "synonyms", "similar words": "synonyms", similar: "synonyms",
    antonyms: "antonyms", antonym: "antonyms", opposites: "antonyms", "opposite words": "antonyms", opposite: "antonyms",
    "goes with": "goes", collocations: "goes", collocation: "goes", "word partners": "goes", partners: "goes",
    memory: "memory", "memory hook": "memory", "memory trick": "memory", mnemonic: "memory", note: "memory",
    mistake: "mistake", "mistake to avoid": "mistake", "common mistake": "mistake", error: "mistake",
    wrong: "mistakeWrong", "wrong sentence": "mistakeWrong", right: "mistakeRight", "right sentence": "mistakeRight", correct: "mistakeRight",
    why: "mistakeWhy", reason: "mistakeWhy", rule: "mistakeWhy", explanation: "mistakeWhy",
    context: "context", sentence: "context", "where i met it": "context",
  };
  const AI_NONE = /^(?:—|–|-|n\/?a|none|null|nil|nothing|لا يوجد|لا|غير متاح|<.*>)$/i;

  /**
   * A short sense label made from a definition, for answers that skip the
   * sense line: the first clause, at most five words, without the article or
   * the "to" that starts a learner definition.
   */
  VS.senseFrom = function (definition) {
    const first = String(definition || "").split(/[.;:,—–(]/)[0].trim();
    let words = first.split(/\s+/).filter(Boolean);
    while (words.length && /^(?:to|a|an|the|be|being|someone|something)$/i.test(words[0])) words.shift();
    // "leave someone or something behind" is a definition, not a sense:
    // take the filler out, keep the four words that still say the meaning.
    words = words.join(" ")
      .replace(/\b(?:someone|something)\b(?:\s+or\s+(?:someone|something))?/gi, " ")
      .split(/\s+/).filter(Boolean).slice(0, 4);
    while (words.length > 1 && /^(?:so|that|which|who|it|with|from|of|in|on|at|for|about|by|than|without|into|through|during|before|after|over|under|between|around)$/i.test(words[words.length - 1])) words.pop();
    return words.join(" ").replace(/[^\w' -]+$/g, "").toLowerCase();
  };
  /** The AI's answer → { field: value } (only fields that look right). */
  VS.parseAiWord = function (text) {
    let t = String(text || "").replace(/```[a-z]*\n?/gi, "").trim();
    const raw = {};
    let json = null;
    try { json = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); } catch (e) { /* lines below */ }
    if (json && typeof json === "object" && !Array.isArray(json)) {
      Object.keys(json).forEach((k) => {
        const key = AI_KEYS[k.toLowerCase()];
        if (!key) return;
        const v = json[k];
        if (key === "mistake") {
          if (v && typeof v === "object") {
            if (v.wrong) raw.mistakeWrong = v.wrong;
            if (v.right) raw.mistakeRight = v.right;
            if (v.why) raw.mistakeWhy = v.why;
          } else if (v) raw.mistake = v;
        } else raw[key] = Array.isArray(v) ? v.join(", ") : String(v == null ? "" : v);
      });
    } else {
      t.split(/\r?\n/).forEach((line) => {
        const m = /^\s*(?:[-*•]|\u274C|\u2705)?\s*\**\s*([A-Za-z\u0600-\u06FF ]{2,24}?)\s*\**\s*[:：]\s*(.+)$/.exec(line);
        const key = m && AI_KEYS[m[1].trim().toLowerCase()];
        if (key && !raw[key]) raw[key] = m[2].trim();
      });
    }
    const out = {};
    const clean = (v) => String(v).replace(/\*\*/g, "").trim().replace(/^["“'«]+|["”'»]+$/g, "").trim();
    Object.keys(raw).forEach((k) => {
      let v = clean(raw[k]);
      if (!v || AI_NONE.test(v)) return;                                  // "—" and the template itself are not values
      if (k === "arabic" && !/[\u0600-\u06FF]/.test(v)) return;
      if (k === "level") { v = v.toUpperCase().match(/[ABC][12]/); if (!v) return; v = v[0]; }
      if (k === "type") { const hit = VS.importer.TYPES.find((x) => x.toLowerCase() === v.toLowerCase()); if (!hit) return; v = hit; }
      if (k === "ipa") v = "/" + v.replace(/^\/+|\/+$/g, "") + "/";
      if (k === "example" && v.split(/\s+/).length > 22) return;
      if (k === "context") v = v.slice(0, 300);
      if (k === "sense") v = v.replace(/^[([{]+|[)\]}]+$/g, "").slice(0, 60);
      if (k === "synonyms") v = VS.parseTags(v).slice(0, 6).join(", ");
      if (k === "antonyms") v = VS.parseTags(v).slice(0, 4).join(", ");
      if (k === "goes") v = VS.parseTags(v).slice(0, 6).join(", ");
      if (k === "memory") v = v.slice(0, 300);
      out[k] = v.slice(0, 400);
    });
    if (out.mistake && !out.mistakeWrong && !out.mistakeRight && !out.mistakeWhy) {
      const m = VS.cleanMistake(out.mistake);
      if (m) { out.mistakeWrong = m.wrong; out.mistakeRight = m.right; out.mistakeWhy = m.why; }
    }
    delete out.mistake;
    // The sense is the short label beside the headword. If an answer skipped
    // it, take the first phrase of the definition: the card is never bare.
    if (!out.sense && out.definition) out.sense = VS.senseFrom(out.definition);
    return out;
  };
  /**
   * "Fill it in with AI" — one component for Add word and Edit word.
   *   ① Copy the prompt (the button says "Copied" for a moment)
   *   ② Paste the AI's answer → the fields fill in
   * A result line says what filled in; nothing is saved until the learner's own button.
   */
  /**
   * Copy text the reliable way: the Clipboard API when the browser allows it,
   * the old selection trick when it doesn't, and an honest manual sheet when
   * both are blocked. Nothing is ever written into the learner's answer box.
   */
  VS.copyText = async function (text) {
    const value = String(text == null ? "" : text);
    if (!value) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (e) { /* permission denied, insecure context, or an old browser */ }
    try {
      const box = document.createElement("textarea");
      box.value = value;
      box.setAttribute("readonly", "");
      box.style.cssText = "position:fixed;top:0;left:-9999px;width:1px;height:1px;opacity:0";
      document.body.appendChild(box);
      box.focus();
      box.select();
      box.setSelectionRange(0, value.length);
      const ok = document.execCommand("copy");
      box.remove();
      return !!ok;
    } catch (e) {
      return false;
    }
  };

  /** The calm last resort: show the prompt, already selected, and let the learner copy it. */
  VS.copySheet = function (text, title) {
    let dlg = document.getElementById("copySheet");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "copySheet";
      dlg.className = "sheet copy-sheet";
      dlg.setAttribute("aria-labelledby", "copyTitle");
      dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
      document.body.appendChild(dlg);
    }
    dlg.innerHTML = String(html`
      <div class="sheet-head"><h2 id="copyTitle">${title || "Copy the prompt"}</h2>
        <button class="icon-btn" type="button" data-action="copy-close" aria-label="Close">${icon("x")}</button></div>
      <div class="sheet-body copy-sheet-body">
        <p class="hint">Your browser didn't let the button copy it. The text is selected already — press <kbd>Ctrl</kbd>+<kbd>C</kbd> (or <kbd>⌘</kbd>+<kbd>C</kbd> on a Mac), or long-press it and choose Copy.</p>
        <textarea class="copy-text" readonly rows="8" dir="auto" aria-label="The text to copy"></textarea>
        <div class="row">
          <button class="btn btn-tonal" type="button" data-action="copy-retry">${icon("copy", "icon-sm")} Try again</button>
          <button class="btn btn-quiet" type="button" data-action="copy-close">Close</button>
        </div>
      </div>`);
    const box = dlg.querySelector(".copy-text");
    box.value = String(text == null ? "" : text);
    if (!dlg.open) dlg.showModal();
    requestAnimationFrame(() => {
      box.focus({ preventScroll: true });
      box.select();
      box.setSelectionRange(0, box.value.length);
    });
  };

  /** One decision for every copy button: copy, say so, or show the manual sheet. */
  VS.copyWithFeedback = async function (text, btn, title) {
    const ok = await VS.copyText(text);
    if (ok) { VS.aiCopied(btn); return true; }
    VS.copySheet(text, title);
    return false;
  };

  /* ── Share the app itself ───────────────────────────────────────
     A learner's own Arabic, not a translated slogan. Seven ways of saying
     the same simple thing, so the message sounds like the person sending it;
     every dialect in the app maps to one of them. The link is always the
     public app; nothing about the learner travels with it. */
  const APP_SHARE_URL = "https://vocabstudy.nagdista.com/";
  const APP_SHARE_AR = {
    msa: "إذا كنت تتعلم الإنجليزية، جرّب VocabStudy. تطبيق مجاني يحفظ الكلمات التي تصادفك، ويعيدها إليك في الأيام التي تحتاجها. بلا حساب، ويعمل بلا إنترنت. جرّبه من هنا:",
    eg: "لو بتتعلم إنجليزي، جرّب VocabStudy. مجاني، من غير حساب، وبيشتغل من غير نت. بيحفظ الكلمات اللي بتقابلك، ويرجّعهالك في الأيام اللي بتنساها. جرّبه من هنا:",
    gulf: "إذا تتعلم إنجليزي، جرّب VocabStudy. مجاني، بدون حساب، ويشتغل بدون إنترنت. يحفظ الكلمات اللي تقابلك، ويرجّعها لك في الأيام اللي تحتاجها. جرّبه من هنا:",
    lev: "إذا عم تتعلم إنجليزي، جرّب VocabStudy. مجاني، بلا حساب، وبيشتغل بلا إنترنت. بيحفظ الكلمات اللي بتقابلك، وبيارجعلك ياها بالأيام اللي بتنساها. جرّبه من هنا:",
    iq: "إذا تتعلم إنجليزي، جرّب VocabStudy. مجاني، بلا حساب، ويشتغل بلا إنترنت. يحفظ الكلمات اللي تصادفك، ويرجّعها لك بالأيام اللي تحتاجها. جرّبه من هنا:",
    sd: "إذا بتتعلم إنجليزي، جرّب VocabStudy. مجاني، بدون حساب، وبيشتغل بدون إنترنت. بيحفظ الكلمات اللي بتقابلك، ويرجّعها ليك في الأيام اللي بتنساها. جرّبه من هنا:",
    mag: "إذا راك تتعلم إنجليزي، جرّب VocabStudy. مجاني، بلا حساب، ويخدم بلا إنترنت. يحفظ الكلمات اللي تلاقيها، ويرجّعها لك في الأيام اللي تحتاجها. جرّبه من هنا:",
  };
  const APP_SHARE_REGION = {
    eg: "eg",
    sa: "gulf", ae: "gulf", kw: "gulf", qa: "gulf", bh: "gulf", om: "gulf", ye: "gulf",
    iq: "iq",
    sy: "lev", lb: "lev", jo: "lev", ps: "lev",
    sd: "sd",
    ly: "mag", tn: "mag", dz: "mag", ma: "mag",
    mr: "msa", so: "msa", dj: "msa", km: "msa",   // these are taught in simple MSA
  };
  /** The message the learner sends: their dialect, one breath, the link. */
  VS.appShare = function () {
    const d = VS.myDialect();
    const key = APP_SHARE_REGION[(d && d[0]) || "msa"] || "msa";
    const body = APP_SHARE_AR[key];
    return { body, text: body + " " + APP_SHARE_URL, url: APP_SHARE_URL, dialect: d };
  };
  /** A plain link for one channel; the URL is always the app, never the learner. */
  VS.appShareLink = function (channel) {
    const s = VS.appShare();
    const enc = encodeURIComponent;
    if (channel === "whatsapp") return "https://wa.me/?text=" + enc(s.text);
    if (channel === "telegram") return "https://t.me/share/url?url=" + enc(s.url) + "&text=" + enc(s.body);
    if (channel === "x") return "https://twitter.com/intent/tweet?text=" + enc(s.body) + "&url=" + enc(s.url);
    if (channel === "facebook") return "https://www.facebook.com/sharer/sharer.php?u=" + enc(s.url) + "&quote=" + enc(s.body);
    if (channel === "linkedin") return "https://www.linkedin.com/sharing/share-offsite/?url=" + enc(s.url);
    if (channel === "email") return "mailto:?subject=" + enc("VocabStudy — تعلّم الإنجليزية كلمة كلمة") + "&body=" + enc(s.text);
    if (channel === "sms") return "sms:?&body=" + enc(s.text);
    return s.url;
  };

  /** The sheet: the message in the learner's Arabic, then every way to send it. */
  VS.openAppShare = function () {
    let dlg = document.getElementById("appShare");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "appShare";
      dlg.className = "sheet app-share-sheet";
      dlg.setAttribute("aria-labelledby", "appShareTitle");
      dlg.addEventListener("click", (e) => {
        if (e.target === dlg) dlg.close();
        if (e.target.closest("[data-app-share]")) setTimeout(() => dlg.close(), 80);
      });
      document.body.appendChild(dlg);
    }
    const s = VS.appShare();
    const channels = [
      ["whatsapp", "WhatsApp", "whatsapp"],
      ["telegram", "Telegram", "telegram"],
      ["x", "X", "xbrand"],
      ["facebook", "Facebook", "facebook"],
      ["linkedin", "LinkedIn", "linkedin"],
      ["email", "Email", "mail"],
      ["sms", "SMS", "chat"],
    ];
    dlg.innerHTML = String(html`
      <div class="sheet-head"><h2 id="appShareTitle">Share VocabStudy</h2>
        <button class="icon-btn" type="button" data-action="app-share-close" aria-label="Close">${icon("x")}</button></div>
      <div class="sheet-body app-share-body">
        <p class="hint">Send it to a friend in your own Arabic — the message is written the way you speak.</p>
        <blockquote class="app-share-preview" lang="ar" dir="rtl">${s.body}
          <bdi class="app-share-url" dir="ltr">${s.url}</bdi></blockquote>
        ${navigator.share ? html`<button class="btn btn-primary btn-lg app-share-native" type="button" data-action="app-share-native">
          ${icon("share", "icon-sm")} Share with the apps on this phone</button>` : ""}
        <div class="app-share-grid" role="group" aria-label="Send on another app">
          ${channels.map(([ch, label, ico]) => html`<a class="app-share-channel is-${ch}" data-app-share href="${VS.appShareLink(ch)}"
            ${ch === "email" || ch === "sms" ? "" : VS.raw('target="_blank" rel="noopener"')}>${icon(ico)}<span>${label}</span></a>`)}
        </div>
        <div class="app-share-copy-row">
          <button class="btn btn-tonal" type="button" data-action="app-share-copy">${icon("copy", "icon-sm")} Copy the message</button>
          <button class="btn btn-quiet" type="button" data-action="app-share-link">${icon("link", "icon-sm")} Copy the link</button>
        </div>
        <p class="hint app-share-community"><a href="${VS.COMMUNITY_URL}" target="_blank" rel="noopener">${icon("whatsapp", "icon-sm")} Join the VocabStudy community</a></p>
        <p class="hint app-share-free">Free, no account, and it works offline. The link is only the app — nothing about you.</p>
      </div>`);
    if (!dlg.open) dlg.showModal();
  };
  VS.actions["app-share-close"] = () => { const dlg = document.getElementById("appShare"); if (dlg) dlg.close(); };
  VS.actions["app-share-native"] = async () => {
    const s = VS.appShare();
    try {
      await navigator.share({ title: "VocabStudy", text: s.text, url: s.url });
      VS.actions["app-share-close"]();
    } catch (e) {
      if (e && e.name === "AbortError") return;
      VS.copySheet(s.text, "Share VocabStudy");
    }
  };
  VS.actions["app-share-copy"] = async () => {
    const s = VS.appShare();
    if (await VS.copyText(s.text)) VS.toast("Message copied — paste it in any app.");
    else VS.copySheet(s.text, "Share VocabStudy");
  };
  VS.actions["app-share-link"] = async () => {
    const s = VS.appShare();
    if (await VS.copyText(s.url)) VS.toast("Link copied.");
    else VS.copySheet(s.url, "The link");
  };

  /**
   * Opens ChatGPT or Claude in a new tab with the prompt already typed.
   * The clipboard write starts while the click still has focus, and the tab
   * opens in the same turn (awaiting first would lose the tap and let a popup
   * blocker eat it). The manual sheet is only for the one case that needs it:
   * a prompt too long for the URL whose copy also failed. A prompt that is
   * already in the chat never hides behind a "Your prompt" dialog.
   */
  VS.aiOpen = (to, text) => {
    const base = to === "claude" ? "https://claude.ai/new" : "https://chatgpt.com/";
    const fits = text.length < 6000;
    const url = fits ? base + "?q=" + encodeURIComponent(text) : base;
    let copying = null;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) copying = navigator.clipboard.writeText(text);
    } catch (e) { /* an old browser: the URL still carries the prompt */ }
    const win = window.open(url, "_blank");
    if (win) win.opener = null;
    const copied = (ok) => {
      if (!win) {
        if (ok) VS.toast("Your browser blocked the new tab — the prompt is copied. Open the chat and paste it.");
        else VS.copySheet(text, "Your prompt");
        return;
      }
      if (fits) return;                                  // the prompt is in the chat: nothing else to say
      if (ok) VS.toast("The prompt is long, so it's copied too — paste it in the chat.");
      else VS.copySheet(text, "Your prompt");
    };
    if (fits && win) {
      if (copying) copying.catch(() => {});         // a blocked copy is harmless here
      VS.toast("Opened with your prompt — send it, then paste the answer back here.");
      return;
    }
    if (copying) copying.then(copied, () => copied(false));
    else copied(false);
  };
  /**
   * The three ways to ask an AI — one row everywhere (Add words with AI and
   * the "Fill it in with AI" panel): ChatGPT, Claude and Copy. On a phone
   * they stack in two balanced rows; on a computer they sit side by side.
   */
  VS.aiAsk = ({ openAction, copyAction, id, disabled, title }) => {
    const more = id ? VS.raw(' data-id="' + VS.escape(id) + '"') : "";
    const off = disabled ? VS.raw(" disabled") : "";
    const t = (fallback) => title || fallback;
    return html`
      <div class="ai-ask" role="group" aria-label="Ask an AI">
        <button class="btn ai-provider is-chatgpt" type="button" data-action="${openAction}" data-to="chatgpt"${more}${off} title="${t("Open ChatGPT with the prompt ready")}">
          <span class="ai-provider-ico">${icon("openai", "icon-brand")}</span>
          <span class="ai-provider-copy"><b>ChatGPT</b><small>Open with the prompt</small></span>
          ${icon("external", "icon-sm ai-provider-go")}
        </button>
        <button class="btn ai-provider is-claude" type="button" data-action="${openAction}" data-to="claude"${more}${off} title="${t("Open Claude with the prompt ready")}">
          <span class="ai-provider-ico">${icon("claude", "icon-brand")}</span>
          <span class="ai-provider-copy"><b>Claude</b><small>Open with the prompt</small></span>
          ${icon("external", "icon-sm ai-provider-go")}
        </button>
        <button class="btn ai-provider is-copy" type="button" data-action="${copyAction}"${more}${off} title="${t("Copy the prompt for Gemini or any chat")}">
          <span class="ai-provider-ico">${icon("copy", "icon-sm")}</span>
          <span class="ai-provider-copy"><b data-copy-label>Copy prompt</b><small>For Gemini or any chat</small></span>
        </button>
      </div>`;
  };
  VS.aiFill = ({ action, id, paste, done, wide }) => html`
    <details class="ai-fill ${wide ? "is-wide" : ""}">
      <summary>
        <span class="ai-fill-ico">${icon("sparkles", "icon-sm")}</span>
        <span class="ai-fill-title"><b>Fill it in with AI</b><small>Free with ChatGPT, Claude or Gemini</small></span>
        ${icon("chevron-right", "icon-sm ai-fill-chev")}
      </summary>
      <div class="ai-fill-body">
        ${VS.levelPick()}
        <div class="ai-step">
          <span class="ai-step-n" aria-hidden="true">1</span>
          <div class="ai-step-copy"><b>Ask the AI</b><span>Open a chat with the prompt already typed — or copy it for Gemini.</span></div>
        </div>
        ${VS.aiAsk({ openAction: "ai-fill-open", copyAction: action, id })}
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
    const label = btn.querySelector("[data-copy-label]") || btn.querySelector("span");
    btn.classList.add("is-done");
    if (label) {
      if (!label.dataset.rest) label.dataset.rest = label.textContent;
      label.textContent = "Copied";
    }
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.classList.remove("is-done");
      if (label && label.dataset.rest) label.textContent = label.dataset.rest;
    }, 2200);
  };

  /**
   * The moment a word joins the library (every way of adding ends in
   * views/import.js save()): a small card with a check that draws itself, the
   * word, and what happens next — and the new rows glow with the highlighter
   * for a moment. Quiet for reduced motion; replaces the plain "Added" toast.
   */
  VS.justAdded = new Set();
  let addedTimer = null;
  VS.celebrateAdded = (words) => {
    if (!words || !words.length) return;
    words.forEach((w) => VS.justAdded.add(w.id));
    setTimeout(() => words.forEach((w) => VS.justAdded.delete(w.id)), 2600);
    const one = words.length === 1;
    const filling = words.some((w) => !w.arabic);        // the meaning itself still on its way
    let pop = document.getElementById("addedPop");
    if (!pop) {
      pop = document.createElement("div");
      pop.id = "addedPop";
      pop.className = "added-pop";
      pop.setAttribute("role", "status");
      document.body.appendChild(pop);
    }
    pop.innerHTML = String(html`
      <svg class="added-check" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="16"/><path d="M11 18.5l5 5 9-10"/>
      </svg>
      <span class="added-copy">
        <b>${one ? html`Added <span class="added-word">${VS.cap(words[0].word)}</span>` : "Added " + words.length + " words"}</b>
        <small>${filling ? (one ? "Its meaning is filling in — then it's ready in Learn." : "Their meanings are filling in — then they're ready in Learn.")
          : one ? "It's waiting for you in Learn." : "They're waiting for you in Learn."}</small>
      </span>`);
    pop.classList.remove("is-on");
    void pop.offsetWidth;                        // restart the animation for a second add in a row
    pop.classList.add("is-on");
    clearTimeout(addedTimer);
    addedTimer = setTimeout(() => pop.classList.remove("is-on"), 2400);
  };

  VS.actions["ai-fill-open"] = (el) => {
    const w = VS.byId[el.dataset.id];
    if (!w) return;
    if (!VS.profileSet()) { VS.openProfile(true); return; }
    VS.aiOpen(el.dataset.to, aiPrompt(w));
  };
  VS.actions["ai-copy"] = async (el) => {
    const w = VS.byId[el.dataset.id];
    if (!w) return;
    if (!VS.profileSet()) { VS.openProfile(true); return; }
    await VS.copyWithFeedback(aiPrompt(w), el, "Your prompt");
  };
  VS.actions["copy-close"] = () => {
    const dlg = document.getElementById("copySheet");
    if (dlg && dlg.open) dlg.close();
  };
  VS.actions["copy-retry"] = async (el) => {
    const dlg = el.closest("dialog");
    const box = dlg && dlg.querySelector(".copy-text");
    if (!box) return;
    if (await VS.copyText(box.value)) {
      dlg.close();
      VS.toast("Copied. Paste it in the chat.");
    } else {
      VS.toast("Still blocked — the text is selected; press Ctrl+C (⌘C on a Mac).");
      box.focus();
      box.select();
      box.setSelectionRange(0, box.value.length);
    }
  };
  const FIELD_NAMES = {
    synonyms: "similar words", antonyms: "opposites", goes: "word partners", memory: "memory hook",
    sense: "sense", ipa: "IPA", mistakeWrong: "the mistake", mistakeRight: "the fix", mistakeWhy: "the reason",
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
      filled.push(FIELD_NAMES[k] || k);
    });
    const panel = e.target.closest(".ai-fill");
    VS.aiFillStatus(panel, filled, !!e.target.value.trim());
    // In Edit, a complete answer closes the panel: the learner sees the
    // filled fields and Save in one look, instead of a closed drawer over them.
    if (form && filled.length && panel && panel.tagName === "DETAILS") {
      panel.open = false;
      VS.toast(`${VS.plural(filled.length, "field")} filled in — check them, then Save.`);
      const first = form.querySelector(".is-filled");
      if (first) requestAnimationFrame(() => first.focus({ preventScroll: true }));
    }
  });

  VS.actions["word-save"] = (el) => {
    const form = el.closest("form");
    const changes = {};
    EDIT_FIELDS.forEach(([k]) => { changes[k] = form.elements[k].value.trim(); });
    LIST_FIELDS.forEach((k) => { changes[k] = VS.parseTags(changes[k]); });
    changes.mistake = VS.cleanMistake({
      wrong: form.elements.mistakeWrong.value,
      right: form.elements.mistakeRight.value,
      why: form.elements.mistakeWhy.value,
    });
    if (!changes.word || !changes.arabic) { VS.toast("The word and its Arabic meaning are needed."); return; }
    const result = VS.store.editUserWord(el.dataset.id, changes);
    if (result.error === "duplicate") { VS.toast("“" + result.word.word + "” with that Arabic meaning is already in your library."); return; }
    if (result.error === "needsArabic") { VS.toast("“" + result.word.word + "” is already in your library — add this meaning's Arabic to keep a second word."); return; }
    if (result.error) { VS.toast("That word is no longer in your library."); return; }
    location.reload();                 // rebuild every list with the new version
  };
  // Cancel goes back to the word card, with the keyboard on Edit where it was.
  VS.actions["word-cancel"] = (el) => {
    const id = el.dataset.id;
    if (id) refreshWord(id, '[data-action="word-edit"]');
    else VS.app.render();
  };
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
        return html`<li><span class="more-ex-text tap-line" data-sentence="${t}" data-source="${w.word}">${hit
          ? html`${VS.ui.tapWords(hit.before)}<mark class="mark">${hit.answer}</mark>${VS.ui.tapWords(hit.after)}`
          : VS.ui.tapWords(t)}</span>${VS.ui.speakButton(t, "Hear this sentence")}</li>`;
      })}</ul>
      <p class="hint more-ex-credit">Sentences from <a href="https://tatoeba.org" target="_blank" rel="noopener">Tatoeba</a> (CC BY 2.0 FR).</p>`);
  };

  VS.actions["sentence-remove"] = async (el) => {
    const id = el.dataset.id;
    const yes = await VS.confirm({
      title: "Remove this sentence?",
      body: "It's one of your own sentences with this word. You can undo it right after.",
      confirmLabel: "Remove",
    });
    if (!yes) return;
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
     "Other meanings" on the word page opens a short list right where the
     learner is — never the 13-field Edit form. The meaning shown now is
     marked "This one"; any other is one tap: "Use this meaning"
     (VS.store.applySense). */
  const meaningLists = {};
  const meaningBox = (el) => {
    const host = el.closest(".word-entry");
    return host && host.querySelector(".meanings");
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
      ? html`<ol class="meaning-list" aria-label="Meanings of “${w.word}”">${list.map((m, i) => {
          const current = same(m.definition, w.definition);
          const firstFromDictionary = !m.trusted && i > 0 && list[i - 1].trusted;
          return html`${firstFromDictionary ? html`<li class="meaning-group" aria-hidden="true">From the dictionary</li>` : ""}<li class="meaning-item ${current ? "is-current" : ""}">
            <span class="meaning-n" aria-hidden="true">${i + 1}</span>
            <div class="meaning-body">
              <div class="meaning-head">
                ${m.type ? html`<span class="meaning-type">${m.type}</span>` : ""}
                ${m.arabic ? html`<bdi class="meaning-ar" lang="ar" dir="rtl">${m.arabic}</bdi>` : ""}
              </div>
              <p class="meaning-def">${m.definition}</p>
              ${m.example ? html`<p class="meaning-ex">“${m.example}”</p>` : ""}
              <div class="meaning-foot">${current
                ? html`<span class="meaning-this">${icon("check", "icon-sm")} In use</span>`
                : html`<button class="btn btn-tonal meaning-use" type="button" data-action="meaning-use" data-id="${w.id}" data-index="${i}"
                    aria-label="Use this meaning: ${m.arabic || m.definition}">Use this meaning</button>`}</div>
            </div>
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
  /* ── The word card: a word's whole page, over the list ───────────
     A native <dialog> gives the card its own focus trap, Esc handling,
     a backdrop, and the return of focus to the row that opened it. The
     list behind never moves, so the learner keeps their place. */
  let cardId = null;              // the word shown now
  let cardOpener = null;          // the row button focus goes back to
  const cardEl = () => document.getElementById("wordCard");

  function focusView() {
    const target = VS.$("#view h1") || VS.$("#view");
    if (!target) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }

  function ensureWordCard() {
    let dlg = cardEl();
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "wordCard";
    dlg.className = "word-card";
    dlg.tabIndex = -1;
    dlg.setAttribute("aria-labelledby", "wordCardTitle");
    dlg.addEventListener("click", (e) => { if (e.target === dlg) VS.closeWordCard(); });
    // A modal dialog traps Tab in Chromium, but Shift+Tab from the first
    // control can still land on the page behind it. Close that loop here.
    dlg.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const items = [...dlg.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((el) => el.getClientRects().length);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dlg || !dlg.contains(active))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (active === last || !dlg.contains(active))) {
        e.preventDefault(); first.focus();
      }
    });
    dlg.addEventListener("close", () => {
      document.documentElement.classList.remove("word-card-open");
      closePop();
      const opener = cardOpener;
      cardId = null;
      cardOpener = null;
      dlg.innerHTML = "";
      // Back to the row that asked for the card; if it is gone (deleted),
      // the page heading is the next calm place for the keyboard.
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      else focusView();
    });
    // A tag, Share or any other link leaves the card: close it before the
    // new screen is drawn, so the dialog never floats over a different page.
    window.addEventListener("hashchange", () => { if (dlg.open) dlg.close(); });
    document.body.appendChild(dlg);
    return dlg;
  }

  /** Open one word in the card. `opts.opener` is the row button, for focus. */
  VS.openWordCard = (id, opts) => {
    const w = VS.byId[id];
    if (!w) return;
    const dlg = ensureWordCard();
    const rowBtn = VS.$(`.word-row-open[data-id="${CSS.escape(id)}"]`);
    closePop();
    cardId = id;
    cardOpener = (opts && opts.opener) || rowBtn ||
      (document.activeElement && document.activeElement.closest && document.activeElement.closest(".word-row-open")) || null;
    dlg.innerHTML = String(VS.ui.wordCard(w));
    document.documentElement.classList.add("word-card-open");
    if (!dlg.open) dlg.showModal();
    const body = dlg.querySelector(".word-card-body");
    if (body) body.scrollTop = 0;
    dlg.focus({ preventScroll: true });
  };

  VS.closeWordCard = () => {
    const dlg = cardEl();
    if (dlg && dlg.open) dlg.close();
  };

  /* The focused control's twin after a redraw (same action, same word). */
  const CARD_FOCUS_KEYS = ["action", "id", "index", "fix"];
  function cardFocusKey(dlg) {
    const el = document.activeElement;
    if (!el || !dlg.contains(el)) return null;
    if (el.id) return "#" + CSS.escape(el.id);
    const parts = CARD_FOCUS_KEYS.filter((k) => el.dataset[k] !== undefined)
      .map((k) => `[data-${k}="${CSS.escape(el.dataset[k])}"]`);
    return parts.length ? el.tagName.toLowerCase() + parts.join("") : null;
  }

  /** Redraw the open card in place, keeping its scroll and the learner's focus. */
  function refreshWordCard(id, focusSel) {
    const dlg = cardEl();
    if (!dlg || !dlg.open || cardId !== id) return false;
    const w = VS.byId[id];
    if (!w) { dlg.close(); return true; }
    const body = dlg.querySelector(".word-card-body");
    const top = body ? body.scrollTop : 0;
    const key = cardFocusKey(dlg);
    closePop();
    dlg.innerHTML = String(VS.ui.wordCard(w));
    const next = dlg.querySelector(".word-card-body");
    if (next) next.scrollTop = top;
    const target = (focusSel && dlg.querySelector(focusSel)) || (key && dlg.querySelector(key)) ||
      dlg.querySelector(".word-card-close") || next || dlg;
    if (!target.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    return true;
  }

  /** Redraw one word: its row in a list, its open card, or the whole activity. */
  function refreshWord(id, focusSel) {
    const w = VS.byId[id];
    if (!w) { if (cardId === id) VS.closeWordCard(); return; }
    const row = VS.$(`.word-row[data-id="${CSS.escape(id)}"]`);
    if (row) row.outerHTML = String(VS.ui.wordRow(w));
    if (cardId === id) refreshWordCard(id, focusSel);
    else if (!row) VS.app.render();
  }

  /* A flagged word (VS.ui.checkLine): fix the spelling, or say it's right. */
  const reopen = (id) => VS.openWordCard(id);
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
  /* A word met inside an example or a meaning. A tap opens a small card
     under it with the word's Arabic already on its way, and one choice:
     Keep in wallet. Nothing is kept until the learner asks: a stray tap
     while reading must not fill the wallet. */
  let pop = null, popFor = null, scrim = null, spot = null;
  const arCache = {};
  function closePop(back) {
    if (!pop) return;
    pop.remove(); pop = null;
    // The page comes back: the dim fades out, the lifted word goes back into its line.
    [scrim, spot].forEach((n) => { if (!n) return; n.classList.add("is-leaving"); setTimeout(() => n.remove(), 140); });
    scrim = spot = null;
    if (popFor) { popFor.setAttribute("aria-expanded", "false"); if (back) popFor.focus({ preventScroll: true }); }
    popFor = null;
  }
  function placePop() {
    if (!pop || !popFor) return;
    const r = popFor.getBoundingClientRect();
    // The word scrolled out of sight: the card has nothing to point at.
    if (r.bottom < 0 || r.top > window.innerHeight) { closePop(); return; }
    if (spot) Object.assign(spot.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", lineHeight: r.height + "px" });
    const w = pop.offsetWidth, h = pop.offsetHeight, gap = 10, edge = 12;
    const left = Math.max(edge, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - edge));
    const below = r.bottom + gap + h <= window.innerHeight - edge || r.top - gap - h < edge;
    pop.style.left = left + "px";
    pop.style.top = (below ? r.bottom + gap : r.top - gap - h) + "px";
    pop.classList.toggle("is-above", !below);
    pop.style.setProperty("--pop-x", Math.max(18, Math.min(w - 18, r.left + r.width / 2 - left)) + "px");
  }
  /** The Arabic for one English word → { main, alts: [{ pos, terms }] }, or null.
      Google first (it also gives the other meanings by part of speech),
      MyMemory when Google is busy. Only the one word is sent. */
  async function arabicWord(word) {
    const k = word.toLowerCase();
    if (arCache[k]) return arCache[k];
    let out = null;
    try {
      const d = await VS.google.json({ sl: "en", tl: "ar", dt: ["t", "bd"], q: k }, 6000);
      const main = (d.sentences || []).map((x) => x.trans || "").join("").trim();
      // Other meanings by part of speech, each Arabic term once: "ريب شك"
      // after "شك" adds nothing, so a term made only of words already shown is dropped.
      const norm = (t) => String(t || "").replace(/[\u064B-\u0652\u0640]/g, "").replace(/[إأآ]/g, "ا").trim();
      const seenWords = new Set(norm(main).split(/\s+/));
      const alts = (d.dict || []).map((x) => ({
        pos: x.pos || "",
        terms: (x.terms || []).filter((t) => {
          const ws = norm(t).split(/\s+/).filter(Boolean);
          if (!ws.length || ws.every((w) => seenWords.has(w))) return false;
          ws.forEach((w) => seenWords.add(w));
          return true;
        }).slice(0, 4),
      })).filter((x) => x.terms.length).slice(0, 3);
      if (main) out = { main, alts };
    } catch (e) {
      try {
        const res = await fetch("https://api.mymemory.translated.net/get?langpair=en|ar&q=" + encodeURIComponent(k));
        const d = res.ok ? await res.json() : {};
        const t = String((d.responseData && d.responseData.translatedText) || "").trim();
        if (/[؀-ۿ]/.test(t)) out = { main: t, alts: [] };
      } catch (e2) { /* both dictionaries are out of reach */ }
    }
    if (out) arCache[k] = out;
    return out;
  }
  /** The wallet uses the same lookup for a word kept by hand (only while Auto-fill is on). */
  VS.arabicWord = async (word) => {
    if (!VS.autofill.enabled() || !navigator.onLine) return "";
    const found = await arabicWord(word);
    return found ? found.main : "";
  };
  /** The meaning panel: waiting, found, not found, or translation switched off. */
  async function fillMeaning(word) {
    const box = pop && pop.querySelector(".word-pop-meaning");
    if (!box) return;
    const say = (body, cls) => { box.className = "word-pop-meaning " + (cls || ""); box.innerHTML = String(body); placePop(); };
    if (!VS.autofill.enabled()) {
      say(html`<p class="word-pop-msg">Translation is off. Turn on <b>Auto-fill</b> in Settings to see the Arabic here.</p>`, "is-msg");
      return;
    }
    if (!navigator.onLine) { say(html`<p class="word-pop-msg">You're offline — the Arabic will show when you're back online.</p>`, "is-msg"); return; }
    const cached = arCache[word.toLowerCase()];
    if (!cached) say(html`<span class="word-pop-skel" aria-hidden="true"><i></i><i></i></span><span class="sr-only">Translating…</span>`, "is-loading");
    const found = cached || await arabicWord(word);
    if (!pop || !box.isConnected) return;
    if (!found) {
      say(html`<p class="word-pop-msg">The dictionary didn't answer.</p>
        <button class="link-btn word-pop-retry" type="button" data-pop="retry">Try again</button>`, "is-msg");
      return;
    }
    say(html`
      <p class="word-pop-ar" lang="ar" dir="rtl">${found.main}</p>
      ${found.alts.length ? html`<dl class="word-pop-senses">${found.alts.map((a) => html`
        <div class="word-pop-sense">
          <dt class="word-pop-pos">${a.pos || "also"}</dt>
          <dd class="word-pop-terms" lang="ar" dir="rtl">${a.terms.map((t) => html`<span class="word-pop-term">${t}</span>`)}</dd>
        </div>`)}</dl>` : ""}`, "is-found");
  }
  VS.actions["word-pop"] = (el) => {
    if (popFor === el) { closePop(true); return; }
    closePop();
    const word = el.dataset.word;
    const known = VS.findWord(word);
    const id = VS.wordKey(word);
    const kept = VS.store.wallet().some((e) => e.id === id);
    // Inside the word card, the pop-up must live in the dialog too: the
    // dialog is in the browser's top layer, and body children stay behind it.
    const host = el.closest("dialog[open]") || document.body;
    pop = document.createElement("div");
    pop.className = "word-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-modal", "true");
    pop.setAttribute("aria-label", `“${word}”`);
    pop.tabIndex = -1;
    pop.innerHTML = String(html`
      <div class="word-pop-head">
        <p class="word-pop-word">${word}</p>
        ${VS.ui.speakButton(word, `Hear “${word}”`)}
      </div>
      <div class="word-pop-meaning" aria-live="polite"></div>
      <div class="word-pop-foot">
        ${known ? html`<p class="word-pop-state">${icon("check", "icon-sm")} Already one of your words</p>`
          : kept ? html`<p class="word-pop-state">${icon("wallet", "icon-sm")} In your wallet · <a href="#/wallet">Open</a></p>`
          : html`<button class="btn btn-tonal word-pop-keep" type="button" data-pop="keep">${icon("wallet", "icon-sm")} Keep in wallet</button>`}
      </div>`);
    // The card's own buttons; "speak" still goes through the app's click handler.
    pop.addEventListener("click", (e) => {
      const b = e.target.closest("[data-pop]");
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.pop === "retry") { fillMeaning(word); return; }
      const line = el.closest("[data-sentence]");
      const r = VS.store.walletAdd(word, line ? line.dataset.sentence : "", line ? line.dataset.source : "", line ? line.dataset.kind : "",
        arCache[word.toLowerCase()] ? arCache[word.toLowerCase()].main : "");
      if (r.inLibrary) { VS.toast(`“${word}” is already one of your words.`); closePop(); return; }
      if (!r.ok) return;
      el.classList.add("is-kept");
      VS.app.bar();
      b.outerHTML = String(html`<p class="word-pop-state is-new">${icon("check", "icon-sm")} Kept in your wallet · <a href="#/wallet">Open</a></p>`);
      if (!r.existed) VS.sfx.play("pop");
      const open = pop.querySelector(".word-pop-state a");
      if (open) open.focus({ preventScroll: true });     // the button is gone: focus stays in the card
      placePop();
    });
    pop.addEventListener("keydown", (e) => {
      // Inside the word card, Esc must close this small card only — not the
      // card under it. preventDefault stops the dialog's own cancel.
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePop(true); return; }
      // Focus stays inside the card while it is open, like any dialog.
      if (e.key !== "Tab") return;
      const f = [...pop.querySelectorAll("button, a[href]")].filter((n) => !n.disabled);
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === pop)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    // The page behind dims, and the tapped word is lifted above the dim, in
    // its own place and type, so the eye goes from the word to its meaning.
    scrim = document.createElement("div");
    scrim.className = "word-pop-scrim";
    scrim.setAttribute("aria-hidden", "true");
    spot = document.createElement("span");
    spot.className = "word-pop-spot";
    spot.setAttribute("aria-hidden", "true");
    spot.textContent = el.textContent;
    const cs = getComputedStyle(el);
    ["fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing"].forEach((k) => { spot.style[k] = cs[k]; });
    host.append(scrim, spot);
    host.appendChild(pop);
    popFor = el;
    el.setAttribute("aria-expanded", "true");
    fillMeaning(word);
    placePop();
    // Follow the word every frame while open: a card still sliding in, a
    // flip or a late layout shift must not leave the pointer behind.
    let lastTop = NaN, lastLeft = NaN;
    const follow = () => {
      if (!pop || popFor !== el) return;
      const r = el.getBoundingClientRect();
      if (r.top !== lastTop || r.left !== lastLeft) { lastTop = r.top; lastLeft = r.left; placePop(); }
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
    (pop.querySelector(".word-pop-keep") || pop).focus({ preventScroll: true });
  };
  // A tap anywhere else, Escape, a resize or a new screen closes the card;
  // a scroll carries it along with its word.
  document.addEventListener("pointerdown", (e) => {
    if (pop && !pop.contains(e.target) && !(e.target.closest && e.target.closest(".tap-word") === popFor)) closePop();
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pop) closePop(true); });
  window.addEventListener("scroll", () => placePop(), true);
  window.addEventListener("resize", () => closePop());
  window.addEventListener("hashchange", () => closePop());
  VS.actions["word-delete"] = async (el) => {
    const w = VS.byId[el.dataset.id];
    if (!w) return;
    // Always asked first (the learner's rule: nothing is deleted without a yes);
    // Undo still brings it all back right after.
    const yes = await VS.confirm({
      title: `Delete “${w.word}”?`,
      body: "Its progress, note and your sentences go too. You can undo it right after.",
      confirmLabel: "Delete",
    });
    if (!yes) return;
    // A row in the list leaves first, so the gap closing is not a jump cut.
    // The word card has no row, so deleting from the card goes straight on.
    const row = el.closest(".word-row");
    if (row && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      row.classList.add("is-removing");
      await new Promise((done) => setTimeout(done, 170));
    }
    // No reload: the card closes, the list redraws, and Undo puts the word
    // back where it was — with its card open again (V1.1).
    const snap = VS.store.snapshot([w.id]);
    VS.closeWordCard();
    VS.store.deleteUserWords([w.id]);
    VS.app.render();
    focusView();
    VS.toast(`“${w.word}” deleted, with its progress and notes.`, { label: "Undo", run: () => { VS.store.restore(snap); VS.app.render(); VS.openWordCard(w.id); } });
  };
  /* "Reset to new" on one word: its schedule starts again; Undo gives it back. ("Start over" is
     only the whole app's, #/reset.) */
  VS.actions["forget"] = async (el) => {
    const id = el.dataset.id;
    const w = VS.byId[id];
    if (!w) return;
    const yes = await VS.confirm({
      title: `Reset “${w.word}” to new?`,
      body: "Its recall schedule starts again from the first day. Notes and sentences are kept.",
      confirmLabel: "Reset to new",
    });
    if (!yes) return;
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
        // In an add box Arabic is a way in: the button finds the English word (core/spelling.js).
        const verb = opts && typeof opts.lookup === "string" ? opts.lookup : "Add";
        note.textContent = !on ? ""
          : opts && opts.lookup && VS.autofill.enabled() ? "Arabic? Press " + verb + " and pick the English word."
          : "Your keyboard is in Arabic — switch it to English to type this word.";
        note.hidden = !on;
      };
      input.addEventListener("input", update);
      update();
      return () => ARABIC.test(input.value);
    },

    /**
     * The highlighter under an add field grows with exactly what is typed
     * (canvas measures the text). Arabic draws from the right, in its own face.
     */
    watchMark(input) {
      if (!input) return () => {};
      const ctx = document.createElement("canvas").getContext("2d");
      const draw = () => {
        const cs = getComputedStyle(input);
        ctx.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
        const w = input.value ? ctx.measureText(input.value).width + 8 : 0;
        input.style.setProperty("--mark-w", Math.min(w, input.clientWidth) + "px");
        input.style.backgroundPosition = cs.direction === "rtl"
          ? "right " + Math.max(0, parseFloat(cs.paddingRight) - 4) + "px top 0"
          : (parseFloat(cs.paddingLeft) - 4) + "px 0";
      };
      input.addEventListener("input", draw);
      draw();
      return draw;
    },

    /**
     * Watch an "add a word" input: a word already in the library is named
     * while you type, before you press Add — with a link to it. In wallet
     * mode the note says the word needs no saving here, because it is
     * already learned.
     */
    watchDuplicate(input, after, opts) {
      if (!input || !after) return;
      const note = document.createElement("p");
      note.className = "dup-note";
      note.setAttribute("role", "status");
      note.hidden = true;
      after.insertAdjacentElement("afterend", note);
      const update = () => {
        const twins = VS.words.filter((w) => VS.wordKey(w.word) === VS.wordKey(input.value) && input.value.trim());
        const w = twins[0];
        note.hidden = !w;
        note.innerHTML = w ? String(html`${icon("check", "icon-sm")} <span>“${w.word}” is already in your library${twins.length > 1 ? " (" + twins.length + " meanings)" : ""}. ${
            opts && opts.wallet ? "You don't need it in your wallet." : "Add a different Arabic meaning to keep another one."}</span>
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

    /** The short sense that tells two meanings apart. The AI writes one; for
        older or hand-typed words, the first phrase of the definition stands in
        so the headword is never bare. */
    senseOf: (w) => String(w.sense || VS.senseFrom(w.definition || "") || "").trim(),

    /** Headword + sense in brackets, e.g. Axe (tool) — the sense is muted so
        the English word stays the thing being learned. */
    headword(w, cls) {
      const sense = VS.ui.senseOf(w);
      return html`<span class="${cls || ""}">${VS.cap(w.word)}</span>${sense ? html` <span class="sense">(${sense.toLowerCase()})</span>` : ""}`;
    },

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

    /**
     * Every word in a sentence becomes a button: tap one for a small pop-up
     * that translates it or keeps it in the wallet, with this sentence. `o.tab === false` keeps a card's twenty
     * sentence words out of the tab order; the word page leaves them in.
     */
    tapWords(text, o) {
      const opts = o || {};
      const skip = /^(a|an|the|and|or|but|if|so|to|of|in|on|at|by|for|with|from|as|is|are|was|were|be|been|being|am|do|does|did|have|has|had|will|would|can|could|should|may|might|must|i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|its|our|their|this|that|these|those|there|here|not|no|yes|than|then|too|very)$/i;
      return html`${String(text || "").split(/([A-Za-z][A-Za-z'’]*)/).map((t) => {
        if (!/^[A-Za-z]/.test(t) || t.length < 3 || skip.test(t)) return t;
        return VS.raw(`<button class="tap-word" type="button" data-action="word-pop" aria-haspopup="dialog" aria-expanded="false" data-word="${VS.escape(t)}"${opts.tab === false ? ' tabindex="-1"' : ""}>${VS.escape(t)}</button>`);
      })}`;
    },

    /** The English meaning, every word tappable, kept with the meaning as its sentence. */
    defTap(w, o) {
      if (!w.definition) return "";
      return html`<span class="tap-line" data-sentence="${w.definition}" data-source="${w.word}" data-kind="meaning">${VS.ui.tapWords(w.definition, o)}</span>`;
    },

    /** The example with its headword highlighted and every other word tappable. */
    exampleTap(w, o) {
      if (!w.example) return "";
      const hit = VS.findInExample(w, true);
      if (!hit) return html`${w.example}`;
      // The highlighter takes the word's preposition with it ("depend on", "afraid of").
      const prep = VS.ui.prepOf(w);
      const m = prep && new RegExp("^(\\s+" + prep + ")\\b", "i").exec(hit.after);
      const tail = m ? m[1] : "";
      return html`<span class="tap-line" data-sentence="${w.example}" data-source="${w.word}">${VS.ui.tapWords(hit.before, o)}<mark class="mark">${hit.answer}${tail}</mark>${VS.ui.tapWords(hit.after.slice(tail.length), o)}</span>`;
    },

    /** English text that may quote Arabic («يعتمد على»): each Arabic run is isolated,
        so the line reads in the right order in both directions. In an Arabic
        sentence, the English words are isolated too — otherwise the Arabic
        isolates make the bidi algorithm lay the English runs out in the
        wrong order (first word left, second word right). */
    mixed(text) {
      const raw = String(text || "");
      const rtl = this.textDir(raw) === "rtl";
      const AR = "\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF";
      const JOIN = AR + "\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\s،؛؟٪ـ-";
      const run = new RegExp("«?([" + AR + "](?:[" + JOIN + "]*[" + AR + "])?)»?", "g");
      // Split keeps the captured Arabic runs at the odd indices.
      const parts = raw.split(run);
      const english = (s) => {
        let out = "", last = 0, m;
        const words = /[A-Za-z][A-Za-z0-9'’\-]*(?:[ \t]+[A-Za-z][A-Za-z0-9'’\-]*)*/g;
        while ((m = words.exec(s))) {
          out += VS.escape(s.slice(last, m.index)) + '<bdi dir="ltr">' + VS.escape(m[0]) + "</bdi>";
          last = m.index + m[0].length;
        }
        return out + VS.escape(s.slice(last));
      };
      const html = parts.map((s, i) => i % 2
        ? '<bdi class="ar-chip" lang="ar" dir="rtl">' + VS.escape(s) + "</bdi>"
        : rtl ? english(s) : VS.escape(s)).join("");
      return VS.raw(html);
    },

    /** The direction a mixed line should read: its first letter decides.
        `dir="auto"` cannot do this job once the Arabic runs are wrapped in
        `<bdi dir="rtl">` — the parent skips them and finds the English word
        first, laying an Arabic sentence out left to right. */
    textDir(text) {
      const first = String(text || "").match(/[A-Za-z\u0600-\u06FF]/);
      return first && /[\u0600-\u06FF]/.test(first[0]) ? "rtl" : "ltr";
    },

    /** How common the word is (core/frequency.js): a quiet label, no meter.
        `line` adds the teacher's sentence about what that means. */
    freq(w, line) {
      const b = VS.frequency.band(w);
      if (!b) return "";
      const meter = html`<span class="freq" data-level="${b.level}" title="${b.line}">
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
              ${t.wrong ? html`<p class="usage-wrong">${icon("x", "icon-sm")}<span>${t.wrong}</span></p>` : ""}
              ${t.right ? html`<p class="usage-right">${icon("check", "icon-sm")}<span>${t.right}</span></p>` : ""}
              ${t.why ? html`<p class="usage-why" dir="${VS.ui.textDir(t.why)}">${VS.ui.mixed(t.why)}</p>` : ""}
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
          <blockquote dir="auto">${hit ? html`${hit.before}<mark class="mark">${hit.answer}</mark>${hit.after}` : w.context}</blockquote>
        </figure>`;
    },

    /** Sentences the learner wrote with the word (Use it). `withHead` off
        when the section already says "Your sentences". */
    mine(w, removable, withHead) {
      if (!w.mine || !w.mine.length) return "";
      return html`
        <div class="mine">
          ${withHead === false ? "" : html`<p class="mine-head">Your sentences</p>`}
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
            return html`<li class="${unsure ? "is-unsure" : ""}" dir="auto"><span>${body}${unsure
                ? html`<small class="mine-unsure" dir="${fixed ? "ltr" : trap ? VS.ui.textDir(trap.why) : "ltr"}">${fixed
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
      ? html`<div class="rel ${cls || ""}"><span class="rel-label">Goes with</span><span class="rel-chips">${w.goes.map((g) => html`<span class="rel-chip">${g}</span>`)}</span></div>` : ""),

    /** Similar words: another way in to the same meaning. */
    similar: (w, cls) => (w.synonyms && w.synonyms.length
      ? html`<div class="rel ${cls || ""}"><span class="rel-label">Similar</span><span class="rel-chips">${w.synonyms.map((g) => html`<span class="rel-chip">${g}</span>`)}</span></div>` : ""),

    /** Opposites: the other end of the same idea, a second hook in memory. */
    opposites: (w, cls) => (w.antonyms && w.antonyms.length
      ? html`<div class="rel ${cls || ""}"><span class="rel-label">Opposite</span><span class="rel-chips">${w.antonyms.map((g) => html`<span class="rel-chip">${g}</span>`)}</span></div>` : ""),

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
          <span class="note-head">
            <span class="note-label">${icon("bulb", "icon-sm")} My note</span>
            <span class="note-ar" lang="ar" dir="rtl">ملاحظتك</span>
          </span>
          <textarea data-note="${w.id}" rows="2" maxlength="500" dir="auto" aria-label="My note"
            placeholder="A memory trick: anything that helps you remember it">${note}</textarea>
        </label>`;
    },

    /** Tags as small chips that open the library filtered by that tag. */
    tags: (w) => w.tags.map((t) => html`<a class="tag" href="#/words?tag=${encodeURIComponent(t)}">#${t}</a>`),

    /** The small tag on a word row whose spelling looks wrong. */
    checkFlag(w) {
      return w.check && w.check.kind === "spelling" ? html`<span class="word-row-flag">Check spelling</span>` : "";
    },

    /**
     * The line at the top of a word whose spelling looks wrong (core/autofill.js
     * sets the flag): a probable typo with its fix. Everything the app teaches
     * is built on this word, so it asks first.
     */
    checkLine(w) {
      const c = w.check;
      if (!c || c.kind !== "spelling") return "";
      return html`
        <div class="word-check" role="note">
          ${c.fix
            ? html`<span>${icon("bulb", "icon-sm")} No dictionary knows “${w.word}”. Did you mean <b>${c.fix}</b>?</span>
                   <button class="btn btn-primary" type="button" data-action="word-respell" data-id="${w.id}" data-fix="${c.fix}">Change to “${c.fix}”</button>`
            : html`<span>${icon("bulb", "icon-sm")} No dictionary knows “${w.word}”. Check the spelling before you learn it.</span>
                   <button class="btn btn-tonal" type="button" data-action="word-edit" data-id="${w.id}">Edit</button>`}
          <button class="btn btn-quiet" type="button" data-action="word-check-ok" data-id="${w.id}">It's right</button>
        </div>`;
    },

    /**
     * One row in a word list: a button that opens the whole word card, and a
     * delete button beside it (never inside it — a row is one action, delete is
     * another). Three fixed lines keep every row the same height: word + muted
     * sense, one clipped example, one meta line.
     */
    wordRow(w) {
      const s = VS.store.status(w.id);
      const state = s === "mastered" ? "Mastered" : s === "learning" ? "Learning" : "New";
      const waiting = VS.autofill.pending(w.id);
      return html`
        <div class="word-row ${VS.justAdded.has(w.id) ? "just-added" : ""}" data-status="${s}" data-id="${w.id}">
          <button class="word-row-open" type="button" data-action="word-open" data-id="${w.id}" aria-haspopup="dialog">
            <span class="word-row-word">
              <i class="word-row-dot" aria-hidden="true"></i>
              <b title="${w.word}">${VS.cap(w.word)}</b>
              ${VS.ui.senseOf(w) ? html`<span class="sense">(${VS.ui.senseOf(w).toLowerCase()})</span>` : ""}
            </span>
            ${w.example ? html`<span class="word-row-ex" dir="auto" title="${w.example}">${w.example}</span>` : html`<span class="word-row-ex is-empty" aria-hidden="true"></span>`}
            <span class="word-row-meta">
              ${waiting ? html`<span class="word-row-filling">${navigator.onLine ? "Filling in…" : "Fills in when online"}</span>`
                : html`<span class="word-row-state" data-s="${s}">${state}</span>`}<span class="word-row-sep" aria-hidden="true">·</span>
              ${w.check && w.check.kind === "spelling" ? "" : html`<span>${w.type}${w.level ? " · " + w.level : ""}</span>`}
              ${w.check && w.check.kind === "spelling" ? "" : VS.frequency.band(w) ? html`<span class="word-row-freq">${VS.frequency.band(w).label}</span>` : ""}
              ${VS.ui.checkFlag(w)}
              ${VS.store.note(w.id) ? html`<span class="word-row-note" title="You wrote a note on this word">${icon("bulb", "icon-sm")}</span>` : ""}
            </span>
          </button>
          <button class="icon-btn word-row-del" type="button" data-action="word-delete" data-id="${w.id}"
            aria-label="Delete “${w.word}”" title="Delete “${w.word}”">${icon("trash", "icon-sm")}</button>
        </div>`;
    },

    /**
     * The word card: every detail of one word, in one reading column. It is
     * built only when opened, so a list of 1,000 rows stays light; the card
     * itself is the dialog VS.openWordCard puts in the top layer.
     */
    wordCard(w) {
      const s = VS.store.status(w.id);
      const e = VS.store.word(w.id);
      const tips = VS.soundTraps(w);
      const traps = VS.usageTraps(w);
      const mine = w.mine || [];
      const band = VS.frequency.band(w);
      const related = (w.goes && w.goes.length) || (w.synonyms && w.synonyms.length) || (w.antonyms && w.antonyms.length);
      const state = s === "mastered" ? "Mastered" : s === "learning" ? "Learning" : "New";
      // Every chapter is named twice: the English word the app teaches in,
      // and the Arabic gloss that says the same thing in the learner's head.
      const sec = (key, title, ar, body) => html`
        <section class="word-card-sec" data-sec="${key}">
          <h3 class="word-card-sec-title"><span class="word-card-sec-en">${title}</span><span class="word-card-sec-ar" lang="ar" dir="rtl">${ar}</span></h3>
          ${body}
        </section>`;
      const example = w.example
        ? html`
          <figure class="word-example">
            <blockquote dir="auto">“${VS.ui.exampleTap(w)}”</blockquote>
          </figure>
          <div class="word-ex-tools">
            <button class="word-hear" type="button" data-action="speak" data-say="${w.example}" aria-label="Hear the sentence">${icon("volume", "icon-sm")}<span>Hear it</span></button>
            ${VS.ui.moreExamples(w)}
          </div>`
        : html`<p class="hint word-no-ex">No example yet.
            <button class="link-btn" type="button" data-action="word-edit" data-id="${w.id}">Add an example</button></p>`;
      return html`
        <div class="word-card-shell">
          <header class="word-card-head">
            <span class="word-card-state" data-s="${s}"><i class="word-card-dot" aria-hidden="true"></i>${state}</span>
            <button class="icon-btn word-card-close" type="button" data-action="word-close" aria-label="Close “${w.word}”" title="Close">${icon("x")}</button>
          </header>
          <div class="word-card-body">
            <div class="word-entry">
              <div class="word-card-hero">
                <div class="word-card-hero-main">
                  <div class="word-card-title-row">
                    <h2 class="word-card-title" id="wordCardTitle">${VS.ui.headword(w)}</h2>
                    ${VS.ui.speakButton(w.word, `Hear “${w.word}”`)}
                  </div>
                  ${w.ipa ? html`<div class="word-card-sound">${VS.ui.ipa(w)}</div>` : ""}
                  ${(w.type || w.level || band) ? html`
                    <div class="word-card-meta">
                      ${w.type ? html`<span class="word-card-type">${w.type}</span>` : ""}
                      ${w.level ? html`<span class="word-card-level ${VS.levelGroup(w.level)}" title="CEFR level">${w.level}</span>` : ""}
                      ${VS.ui.freq(w)}
                    </div>` : ""}
                </div>
                <div class="word-card-ar">
                  <span class="word-card-ar-label">In Arabic</span>
                  <span class="word-card-ar-dot" aria-hidden="true">·</span>
                  ${w.arabic
                    ? html`<p lang="ar" dir="rtl">${w.arabic}</p>`
                    : html`<p class="word-card-ar-empty">${VS.autofill.pending(w.id) ? (navigator.onLine ? "Filling in…" : "Fills in when online") : "No Arabic meaning yet."}</p>`}
                </div>
                <div class="word-card-hero-foot">
                  ${w.tags.length ? html`<div class="word-tags word-card-tags">${VS.ui.tags(w)}</div>` : ""}
                  ${VS.ui.checkLine(w)}
                  <div class="word-card-actions">
                    <button class="word-card-act word-card-edit" type="button" data-action="word-edit" data-id="${w.id}">${icon("pen", "icon-sm")} Edit</button>
                    <a class="word-card-act word-card-share" href="#/share?ids=${encodeURIComponent(w.id)}">${icon("share", "icon-sm")} Share</a>
                    <button class="word-card-act word-card-delete" type="button" data-action="word-delete" data-id="${w.id}"
                      aria-label="Delete “${w.word}”" title="Delete “${w.word}”">${icon("trash", "icon-sm")} Delete</button>
                  </div>
                </div>
              </div>

              ${sec("meaning", "Meaning", "المعنى", html`
                ${w.definition
                  ? html`<p class="word-definition" dir="auto">${VS.ui.defTap(w)}</p>`
                  : html`<p class="hint">No definition yet.
                      <button class="link-btn" type="button" data-action="word-edit" data-id="${w.id}">Add a definition</button></p>`}
                ${VS.autofill.enabled() ? html`<button class="word-other" type="button" data-action="meaning-list" data-id="${w.id}" aria-expanded="false">${w.definition ? "Other meanings" : "Find a meaning"}</button>` : ""}
                <div class="meanings" aria-live="polite"></div>
                ${example}`)}

              ${w.context ? sec("context", "In context", "في السياق", VS.ui.context(w)) : ""}

              ${sec("memory", "Memory", "الذاكرة", html`
                ${w.memory ? html`<div class="word-memory-hook">
                  ${icon("bulb", "icon-sm")}
                  <div><span>A way to remember</span><p dir="${VS.ui.textDir(w.memory)}">${VS.ui.mixed(w.memory)}</p></div>
                </div>` : ""}
                <div class="word-memory">
                  <div class="word-memory-head">
                    <span class="word-memory-label">${s === "new" ? "First recall" : "Next recall"}</span>
                    <b>${s === "new" ? "not yet" : whenText(e.due)}</b>
                  </div>
                  ${VS.ui.ruler(e.box)}
                  ${s === "new" ? html`<p class="word-memory-note">One right answer starts this word's 1 · 3 · 7 · 14 · 30 · 60 path.</p>` : ""}
                  <div class="word-memory-foot">
                    <span class="word-memory-score">${s === "new" ? `added ${VS.ui.dateText(w.added)}` : `${e.right} right · ${e.wrong} wrong`}</span>
                    ${s === "new" ? "" : html`<button class="word-reset" type="button" data-action="forget" data-id="${w.id}" aria-label="Reset “${w.word}” to new" title="Reset to new — start this word's schedule again">${icon("review", "icon-sm")}</button>`}
                  </div>
                </div>`)}

              ${sec("mine", "Your sentences", "جُملك", html`
                ${mine.length ? VS.ui.mine(w, true, false) : html`<p class="hint">No sentences yet — write one and it can come back in Recall.</p>`}
                <a class="word-write" href="#/word/write?id=${encodeURIComponent(w.id)}">${icon("pen", "icon-sm")} ${mine.length ? "Write another sentence" : "Write a sentence"}</a>`)}

              ${(traps.length || tips.length || related) ? html`
                <section class="word-card-sec" data-sec="extra">
                  <h3 class="word-card-sec-title"><span class="word-card-sec-en">Good to know</span><span class="word-card-sec-ar" lang="ar" dir="rtl">للمعرفة</span></h3>
                  <div class="word-card-grid">
                    ${traps.length ? html`<div class="word-card-block">
                      <h4 class="word-card-subtitle">Mistakes to avoid</h4>
                      ${VS.ui.usage(w)}
                    </div>` : ""}
                    ${tips.length ? html`<div class="word-card-block">
                      <h4 class="word-card-subtitle">Sounds</h4>
                      ${VS.ui.soundTraps(w)}
                    </div>` : ""}
                    ${related ? html`<div class="word-card-block">
                      <h4 class="word-card-subtitle">Related words</h4>
                      ${VS.ui.goes(w)}${VS.ui.similar(w)}${VS.ui.opposites(w)}
                    </div>` : ""}
                  </div>
                </section>` : ""}

              <section class="word-card-sec word-card-note" data-sec="note">
                ${VS.ui.noteBox(w)}
              </section>
            </div>
          </div>
        </div>`;
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
          <header class="summary-head">
            <p class="summary-kicker">Round finished</p>
            <h1 class="summary-title"><span class="mark">${title}</span></h1>
            <p class="summary-lead">${message}</p>
          </header>
          ${teacher ? html`<p class="summary-teacher">${teacher}</p>` : ""}
          <div class="summary-tally">
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
