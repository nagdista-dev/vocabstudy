/* views/import.js — "Add words": every word goes into your one library.
   ------------------------------------------------------------------
   Type a word    the fast way: type it, press Enter. The app fills in
                  the rest (core/autofill.js). "More details" lets you
                  type any field yourself — your typing always wins.
   From text      paste a paragraph (an article, subtitles, an email) and
                  tap the words you don't know; each keeps the sentence it
                  came from. Shared text lands here too: Share → VocabStudy
                  on a phone, or the bookmarks-bar button on a computer.
   Paste a table  rows copied from Excel / Google Sheets / Notion
   Upload files   .tsv / .csv / .txt tables (a CSV export reads back in)

   The library holds each word once: words already in it are marked
   "In your library" and skipped. Everything is saved on this device.
   core/importer.js reads tables; core/store.js keeps the words.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;

  const TEMPLATE = ["word\tdefinition\texample\ttype\tlevel\tipa\tarabic\ttags",
    "Habit\tSomething you do often, almost without thinking.\tI have a habit of reading before bed.\tNoun\tB1\t/ˈhæbɪt/\tعادة\tdaily life"].join("\n");
  const DETAILS = ["arabic", "type", "level", "tags", "context", "source", "definition", "example", "ipa", "sense"];

  const st = {
    tab: "ai",                    // ai | type | text | paste | files
    ai: { mode: "words", words: "", topic: "", count: 10, ar: "", answer: "", rows: [], tags: "", ctx: {} },   // ctx: words from the wallet → { id, context, source }   // With AI
    collect: { text: "", source: "", picked: new Set(), done: "" },   // From text
    text: "", parsed: null, saved: "",
    files: [],                    // [{ name, rows }]
    form: {},                     // the one-word form
    recent: [],                   // ids added on this screen, newest first
  };

  /* A row can be saved when it has a word, isn't in the library already,
     and isn't repeated earlier in the same table. */
  function mark(rows) {
    const seen = new Set();
    rows.forEach((r) => {
      r.issues = r.issues.filter((i) => i.kind !== "dup");
      if (!r.word) return;
      const id = VS.wordKey(r.word, r.sense);
      // A likely typo (core/spelling.js, from the common-words list, nothing sent): a warning, never a block.
      r.issues = r.issues.filter((i) => !i.spell);
      const fix = !r.definition && VS.spelling.local(r.word);
      if (fix) r.issues.push({ kind: "warn", spell: true, text: `spelling? did you mean “${fix}”` });
      if (VS.byId[id]) r.issues.push({ kind: "dup", text: "already in your library" });
      else if (seen.has(id)) r.issues.push({ kind: "dup", text: "repeated in this list" });
      seen.add(id);
    });
    return rows;
  }
  const savable = (rows) => rows.filter((r) => !r.issues.some((i) => i.kind === "error" || i.kind === "dup"));
  const clean = (r) => {
    const w = {};
    ["word", "sense", "type", "level", "ipa", "definition", "example", "arabic", "context", "source"].forEach((k) => { if (r[k]) w[k] = r[k]; });
    w.tags = VS.parseTags(r.tags);
    if (r.synonyms) w.synonyms = VS.parseTags(r.synonyms).slice(0, 6);
    return w;
  };

  function statusOf(r) {
    if (r.issues.some((i) => i.kind === "error")) return ["bad", "Can't use"];
    if (r.issues.some((i) => i.kind === "dup")) return ["dup", "In library"];
    if (r.issues.some((i) => i.kind === "warn")) return ["warn", "Check"];
    return ["ok", "Ready"];
  }

  /** Save words, then let auto-fill complete them in the background. */
  function save(words) {
    const auto = VS.autofill.enabled();
    const result = VS.store.saveUserWords(words.map((w) => {
      const missing = !w.arabic || !w.definition || !w.example || !w.ipa || !w.type;
      return auto && missing ? Object.assign({}, w, { auto: "todo" }) : w;
    }));
    const ids = result.added.map((w) => w.id);
    // A kept word that just became a library word leaves the wallet.
    result.added.forEach((w) => VS.store.walletRemove(VS.wordKey(w.word)));
    st.recent = ids.slice().reverse().concat(st.recent.filter((id) => !ids.includes(id))).slice(0, 12);
    VS.autofill.fill(ids);
    VS.celebrateAdded(result.added);
    return result;
  }

  /**
   * Add one word — the library's add box and the form here both use it.
   * Returns the new word, or null (with a toast saying why).
   */
  VS.addWord = function (fields) {
    const w = VS.importer.checkWord(fields);
    if (!VS.addWordReady(w.word, w.sense)) return null;
    if (!VS.autofill.enabled() && !w.arabic) { VS.toast("Add the Arabic meaning (auto-fill is off)."); return null; }
    const r = save([clean(Object.assign({}, w, { tags: fields.tags }))]);
    VS.sfx.play("pop");
    return r.added[0] || null;
  };

  /**
   * The quick checks before a word is added (and before its spelling is
   * checked): something typed, not Arabic, not in the library already.
   * Returns the trimmed word, or "" with a toast saying why.
   */
  VS.addWordReady = function (word, sense) {
    const t = String(word || "").trim();
    if (!t) { VS.toast("Type a word first."); return ""; }
    if (VS.isArabicTyping(t)) { VS.toast("That's Arabic — switch your keyboard to English."); return ""; }
    const existing = VS.byId[VS.wordKey(t, sense)];
    if (existing) { VS.toast(`“${existing.word}” is already in your library.`); return ""; }
    return t;
  };

  /* ── Tab 1: type a word ───────────────────────────────────────── */
  function field(name, label, opts) {
    const o = opts || {};
    const value = st.form[name] || "";
    const control = o.options
      ? html`<select data-form-field="${name}"><option value="">${o.empty}</option>${o.options.map((v) => html`<option ${v === value ? VS.raw("selected") : ""}>${v}</option>`)}</select>`
      : o.long
        ? html`<textarea data-form-field="${name}" rows="2" dir="auto" placeholder="${o.placeholder || ""}">${value}</textarea>`
        : html`<input data-form-field="${name}" value="${value}" placeholder="${o.placeholder || ""}" ${o.ar ? VS.raw('lang="ar" dir="rtl"') : ""} ${o.list ? VS.raw('list="' + o.list + '"') : ""} autocomplete="off"/>`;
    return html`<label class="form-field ${o.wide ? "is-wide" : ""}"><span>${label}</span>${control}</label>`;
  }

  function typeTab() {
    const auto = VS.autofill.enabled();
    const filled = DETAILS.some((k) => st.form[k]);
    return html`
      <form class="add-form" data-form="one-word" autocomplete="off">
        <div class="add-line">
          <label class="field field-xl">
            <span class="sr-only">English word or phrase</span>
            <input data-form-field="word" id="addWord" dir="auto" value="${st.form.word || ""}" placeholder="Word or phrase" aria-label="English word or phrase"
                   spellcheck="false" autocapitalize="off" enterkeyhint="done"/>
          </label>
          <button class="btn btn-primary btn-lg" type="submit" aria-label="Add this word">${icon("plus", "icon-sm")}<span class="add-label">Add</span></button>
        </div>
        <p class="hint">${auto
          ? (navigator.onLine
            ? "Press Add (or Enter). The app fills in the Arabic meaning, definition, example and pronunciation."
            : "You're offline — the word is saved now, and its meaning is filled in when you're back online.")
          : html`Auto-fill is off (Settings), so nothing leaves this device. Add the details below.`}</p>
        <details class="add-more" ${!auto || filled || st.openDetails ? VS.raw("open") : ""}>
          <summary>${icon("chevron-right", "icon-sm")} More details <span class="hint">(optional)</span></summary>
          <div class="word-form">
            ${field("arabic", "Arabic meaning", { ar: true, placeholder: "مثلاً: يستغل - يستفيد من" })}
            ${field("tags", "Tags", { placeholder: "IELTS, work", list: "tagList" })}
            ${field("context", "Where you met it", { wide: true, long: true, placeholder: "The sentence you saw it in — it's the best reminder there is" })}
            ${field("source", "Source", { placeholder: "A series, a book, an email…" })}
            ${field("type", "Type", { options: VS.importer.TYPES, empty: auto ? "Auto" : "—" })}
            ${field("level", "Level (CEFR)", { options: VS.importer.LEVELS, empty: "—" })}
            ${field("definition", "Definition (English)", { wide: true, long: true, placeholder: "What it means, in simple English" })}
            ${field("example", "Example sentence", { wide: true, long: true, placeholder: "A sentence that uses the word" })}
            ${field("ipa", "Pronunciation (IPA)", { placeholder: "/ˈhæbɪt/" })}
            ${field("sense", "Sense", { placeholder: "e.g. tool — only if the word has two meanings" })}
          </div>
          ${VS.ui.tagList()}
        </details>
      </form>`;
  }

  /* ── Tab 5: with AI — the word, the prompt, the answer, a review, Add ──
     Any AI chat (ChatGPT, Claude, Gemini) fills the details; the learner
     checks them in plain fields and adds the word. Nothing is added before Add. */
  /** The words typed in step 1: one per line or separated by commas, no repeats. */
  function aiWords() {
    const seen = new Set();
    return st.ai.words.split(/[\n,،;]+/).map((x) => x.trim()).filter((x) => {
      const k = x.toLowerCase();
      if (!x || seen.has(k)) return false;
      seen.add(k); return true;
    }).slice(0, 30);
  }

  /** Step 4: one card per word from the AI's answer — edit, untick, then add them all. */
  function aiReview() {
    const rows = st.ai.rows;
    if (!rows.length) return html`<p class="hint ai-review-empty">The words appear here, ready to check, once you paste the answer.</p>`;
    const n = rows.filter((r) => r.keep && !r.dup).length;
    return html`
      <ul class="ai-rows">
        ${rows.map((r, i) => html`
          <li class="ai-row ${r.dup ? "is-dup" : ""} ${r.keep && !r.dup ? "" : "is-off"}">
            <label class="ai-row-head">
              <input type="checkbox" data-ai-keep="${i}" ${r.keep && !r.dup ? VS.raw("checked") : ""} ${r.dup ? VS.raw("disabled") : ""}>
              <b>${VS.cap(r.word)}</b>
              <span class="ai-row-meta">${[r.type, r.level].filter(Boolean).join(" · ")}</span>
              ${r.dup ? html`<span class="ai-row-dup">Already in your words</span>` : ""}
            </label>
            ${r.context ? html`<p class="ai-row-context">${icon("book", "icon-sm")}<span>${r.context}</span></p>` : ""}
            <div class="ai-row-fields">
              <input dir="rtl" lang="ar" data-ai-row="${i}" data-ai-k="arabic" value="${r.arabic || ""}" placeholder="Arabic meaning" aria-label="Arabic meaning of ${r.word}">
              <textarea rows="2" dir="auto" data-ai-row="${i}" data-ai-k="definition" placeholder="Definition" aria-label="Definition of ${r.word}">${r.definition || ""}</textarea>
              <textarea rows="2" dir="auto" data-ai-row="${i}" data-ai-k="example" placeholder="Example sentence" aria-label="Example for ${r.word}">${r.example || ""}</textarea>
            </div>
          </li>`)}
      </ul>
      <div class="ai-add-foot">
        <label class="form-field ai-tags"><span>Tags for all (optional)</span>
          <input dir="auto" data-ai-tags value="${st.ai.tags}" placeholder="IELTS, work" list="tagList" autocomplete="off"></label>
        ${VS.ui.tagList()}
        <button class="btn btn-primary btn-lg ai-add-btn" type="button" data-action="ai-add" ${n ? "" : VS.raw("disabled")}>${icon("plus", "icon-sm")}
          ${n === 1 ? "Add 1 word" : "Add " + n + " words"}</button>
        <span class="hint">Nothing is added until you press Add.</span>
      </div>`;
  }

  /* ── The three AI tabs: With AI (your words) · By topic · From Arabic ──
     Same four steps on each — what to start from, ask the AI (open a chat with
     the prompt typed, or copy it), paste its answer, check a card per word —
     so learning one teaches all three. */
  const AI_TAB_MODE = { ai: "words", "ai-topic": "topic", "ai-ar": "arabic" };
  const aiArabic = () => st.ai.ar.split(/[\n,،;]+/).map((x) => x.trim()).filter(Boolean).slice(0, 30);
  function aiReady() {
    const m = st.ai.mode;
    if (!VS.profileSet()) return false;        // level and Arabic come first: the AI writes for them
    return m === "topic" ? !!st.ai.topic.trim() : m === "arabic" ? aiArabic().length > 0 : aiWords().length > 0;
  }
  function aiPromptNow() {
    const m = st.ai.mode;
    if (m === "topic") return VS.aiPromptTopic(st.ai.topic.trim(), st.ai.count);
    if (m === "arabic") return VS.aiPromptArabic(aiArabic());
    const words = aiWords();
    // Words from the wallet bring the sentence they were met in: the AI must use THAT meaning.
    const met = (w) => st.ai.ctx[w.toLowerCase()];
    if (words.length === 1) return VS.aiPrompt({ word: words[0], context: met(words[0]) ? met(words[0]).context : "" });
    return VS.aiPromptMany(words, words.map((w) => (met(w) ? met(w).context : "")));
  }
  const aiSelect = (name, values, current) => html`<select data-ai-in="${name}">${values.map((v) => html`<option value="${v}" ${String(v) === String(current) ? VS.raw("selected") : ""}>${v}</option>`)}</select>`;
  function aiStepOne() {
    const m = st.ai.mode;
    if (m === "topic") return html`
      <div class="ai-in-row">
        <label class="ai-in ai-in-wide"><span class="sr-only">Topic</span>
          <input dir="auto" data-ai-in="topic" value="${st.ai.topic}" placeholder="a job interview, travel, football, السفر…" autocomplete="off"></label>
        <label class="ai-in"><span>How many</span>${aiSelect("count", [5, 10, 15, 20], st.ai.count)}</label>
      </div>`;
    if (m === "arabic") return html`
      <label class="ai-add-words"><span class="sr-only">Arabic words</span>
        <textarea rows="3" dir="rtl" lang="ar" data-ai-in="ar" placeholder="أجّل، فرصة، يستلف">${st.ai.ar}</textarea></label>`;
    return html`
      <label class="ai-add-words"><span class="sr-only">English words</span>
        <textarea id="aiWords" rows="3" dir="auto" data-ai-words spellcheck="false" autocapitalize="off"
          placeholder="resilient, deadline, take off">${st.ai.words}</textarea></label>`;
  }
  const AI_ONE = {
    words: ["Your words", "One word, or many — one per line or separated by commas."],
    topic: ["Your topic", "The AI picks the most useful words about it, at your level."],
    arabic: ["Arabic words", "The AI finds the natural English for each one."],
  };
  function aiTab() {
    const ready = aiReady();
    const off = ready ? "" : VS.raw('disabled title="' + (VS.profileSet() ? "Fill in step 1 first" : "Choose your level and Arabic first") + '"');
    return html`
      <div class="ai-add">
        ${VS.levelPick()}
        <div class="ai-step">
          <span class="ai-step-n" aria-hidden="true">1</span>
          <div class="ai-step-copy"><b>${AI_ONE[st.ai.mode][0]}</b><span>${AI_ONE[st.ai.mode][1]}</span></div>
        </div>
        ${aiStepOne()}

        <div class="ai-step">
          <span class="ai-step-n" aria-hidden="true">2</span>
          <div class="ai-step-copy"><b>Ask the AI</b><span>Open a chat with the prompt already typed — or copy it for Gemini.</span></div>
        </div>
        <div class="ai-ask">
          <button class="btn btn-tonal ai-copy-btn ai-ask-btn ${ready ? "is-ready" : ""}" type="button" data-action="ai-open" data-to="chatgpt" ${off} title="Open ChatGPT with the prompt ready"><span>ChatGPT</span>${icon("arrow-right", "icon-sm")}</button>
          <button class="btn ai-ask-btn" type="button" data-action="ai-open" data-to="claude" ${off} title="Open Claude with the prompt ready"><span>Claude</span>${icon("arrow-right", "icon-sm")}</button>
          <button class="btn btn-quiet ai-ask-btn ai-copy-only" type="button" data-action="add-ai-copy" ${off}>${icon("text", "icon-sm")}<span>Copy</span></button>
        </div>

        <div class="ai-step">
          <span class="ai-step-n" aria-hidden="true">3</span>
          <div class="ai-step-copy"><b>Paste its answer</b><span>Copy the AI's reply and paste it here.</span></div>
        </div>
        <div class="ai-fill">
          <textarea class="ai-fill-input" rows="4" dir="auto" data-ai-add aria-label="The AI's answer"
            placeholder="word: …&#10;arabic: …&#10;definition: …">${st.ai.answer}</textarea>
          <p class="ai-fill-status" aria-live="polite" hidden></p>
        </div>

        <div class="ai-step">
          <span class="ai-step-n" aria-hidden="true">4</span>
          <div class="ai-step-copy"><b>Check, then add</b><span>Change anything, or untick a word to skip it.</span></div>
        </div>
        <div class="ai-review" id="aiReview">${aiReview()}</div>
      </div>`;
  }

  /* The newest words, so this screen shows your shelf even in a fresh
     session — not only the words added since the last reload. */
  function recent() {
    const seen = new Set();
    const words = [];
    const push = (w) => { if (w && !seen.has(w.id)) { seen.add(w.id); words.push(w); } };
    st.recent.map((id) => VS.byId[id]).forEach(push);
    if (words.length < 6) VS.allWords().slice().reverse().forEach(push);
    if (!words.length) return html`
      <section class="card import-next import-side" id="recentBox" aria-labelledby="next-title">
        <h2 id="next-title">What happens after your first word</h2>
        <ol class="import-next-list">
          <li><span class="import-next-when">Today</span><p>The meaning, Arabic and example fill in for you.</p></li>
          <li><span class="import-next-when">Tomorrow</span><p>It comes back in Recall — say how well you remembered it.</p></li>
          <li><span class="import-next-when">Then</span><p>3 days, 1 week, 2 weeks. Each return makes it harder to forget.</p></li>
        </ol>
      </section>`;
    // A side column on a computer (always open); on a phone one folded line that
    // opens on a tap — the add form keeps the screen.
    const open = st.recentOpen || matchMedia("(min-width: 600px)").matches;
    return html`
      <section class="card import-step import-side recent-card" id="recentBox" aria-labelledby="recent-title">
        <details class="recent-fold" ${open ? VS.raw("open") : ""}>
        <summary class="section-title recent-head">
          <h2 id="recent-title">${st.recent.length ? "Just added" : "Newest words"}</h2>
          <span class="recent-count">${VS.plural(VS.allWords().length, "word")}</span>
          ${icon("chevron-right", "icon-sm recent-chev")}
        </summary>
        <ul class="recent-list" aria-live="polite">
          ${words.slice(0, 6).map((w) => {
            const waiting = VS.autofill.pending(w.id);
            const s = VS.store.status(w.id);
            return html`<li class="${VS.justAdded.has(w.id) ? "just-added" : ""}">
              <a class="recent-row" href="#/words?q=${encodeURIComponent(w.word)}">
                <span class="recent-word"><i class="recent-dot" data-s="${s}" aria-hidden="true"></i><b title="${w.word}">${VS.cap(w.word)}</b></span>
                <span class="recent-ar" lang="ar" title="${w.arabic || ""}">${w.arabic || (waiting ? "…" : "—")}</span>
                <span class="recent-meta">${waiting ? html`<span>Filling in…</span>` : html`<span class="recent-state" data-s="${s}">${s === "new" ? "New" : s === "learning" ? "Learning" : "Mastered"}</span>`}${[w.type, w.level].filter(Boolean).map((x) => " · " + x).join("")}</span>
              </a>
            </li>`;
          })}
        </ul>
        <div class="recent-foot">
          ${VS.newLeftToday() && VS.store.newWords().length ? html`<a class="btn btn-tonal recent-learn" href="#/new/cards">${icon("cards", "icon-sm")} Learn the new ones</a>` : ""}
          <a class="recent-all" href="#/words">All words ${icon("arrow-right", "icon-sm")}</a>
        </div>
        </details>
      </section>`;
  }

  document.addEventListener("toggle", (e) => {
    if (e.target.classList && e.target.classList.contains("recent-fold") && !matchMedia("(min-width: 600px)").matches) st.recentOpen = e.target.open;
  }, true);

  /* ── Tab 2: from text — tap the words you don't know ───────────── */

  /** "It depends on you." → [{ text: "It", word: true, at: 0 }, { text: " " }, …] */
  function tokens(text) {
    const out = [];
    const re = /[A-Za-z][A-Za-z'’-]*[A-Za-z]|[A-Za-z]/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ text: text.slice(last, m.index) });
      out.push({ text: m[0], word: true, at: m.index });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last) });
    return out;
  }

  /** The sentence around a position in a text: the context a word is kept with. */
  function sentenceAt(text, at) {
    const start = Math.max(text.lastIndexOf(". ", at), text.lastIndexOf("? ", at), text.lastIndexOf("! ", at), text.lastIndexOf("\n", at));
    const ends = [". ", "? ", "! ", "\n"].map((e) => text.indexOf(e, at)).filter((i) => i >= 0);
    const end = ends.length ? Math.min(...ends) + 1 : text.length;
    return text.slice(start < 0 ? 0 : start + 1, end).replace(/\s+/g, " ").trim().slice(0, 300);
  }

  /* "ran out of" → "run out of": a phrase is learned in its base form. (Single
     words are turned into their base by auto-fill, which can ask a dictionary.) */
  let pastToBase = null;
  function baseOfPhrase(text) {
    const parts = text.split(" ");
    if (parts.length < 2) return text;
    if (!pastToBase) {
      pastToBase = {};
      Object.entries(VS.IRREGULAR).forEach(([base, forms]) => forms.forEach((f) => { if (f !== base) pastToBase[f] = base; }));
    }
    const first = parts[0].toLowerCase();
    const base = pastToBase[first] || (/[^aeiou]ied$/.test(first) ? first.slice(0, -3) + "y" : "");
    return base ? [base].concat(parts.slice(1)).join(" ") : text;
  }

  /** Picked words; neighbours become one phrase ("run" + "out" + "of" → "run out of"). */
  /** Are two picked words next to each other (only a space or hyphen between)? */
  function adjacentPicks() {
    const list = tokens(st.collect.text);
    return [...st.collect.picked].some((i) => st.collect.picked.has(i + 2) && list[i + 1] && /^[\s-]{1,2}$/.test(list[i + 1].text));
  }

  function pickedPhrases() {
    const c = st.collect;
    const list = tokens(c.text);
    const out = [];
    let cur = null;
    list.forEach((t, i) => {
      if (t.word && c.picked.has(i)) {
        // Neighbours become one phrase only when the learner asks ("Join…"): two unknown words side by side stay two.
        if (cur && !c.join) { out.push(cur); cur = null; }
        if (cur) cur.text += cur.gap + t.text; else cur = { text: t.text, at: t.at };
        cur.gap = "";
      } else if (!t.word && cur && /^[\s-]+$/.test(t.text) && t.text.length <= 2) {
        cur.gap = t.text.includes("-") ? "-" : " ";
      } else if (cur) { out.push(cur); cur = null; }
    });
    if (cur) out.push(cur);
    return out.map((p) => ({ word: baseOfPhrase(p.text), context: sentenceAt(c.text, p.at) }));
  }

  /* The meaning of each picked word, before it is added: one request for all
     of them (only those words are sent), cached for the visit. Words already
     in the library show the Arabic they have. */
  const gloss = {};
  async function glossPicked() {
    if (!VS.autofill.enabled() || !navigator.onLine) return;
    const todo = pickedPhrases().map((p) => p.word).filter((w) => !(w in gloss) && !VS.byId[VS.wordKey(w)]);
    if (!todo.length) return;
    todo.forEach((w) => { gloss[w] = ""; });
    try {
      const data = await VS.google.json({ sl: "en", tl: "ar", dt: ["t"], q: todo.join("\n") });
      const lines = (data.sentences || []).map((x) => x.trans || "").join("").split("\n");
      todo.forEach((w, i) => { gloss[w] = String(lines[i] || "").replace(/[.。]+$/, "").trim(); });
    } catch (e) { todo.forEach((w) => delete gloss[w]); return; }
    const chips = VS.$(".collect-chips");
    if (chips) chips.outerHTML = String(chipsMarkup(pickedPhrases()));
  }
  const chipsMarkup = (phrases) => html`<p class="row collect-chips">${phrases.map((p) => {
    const known = VS.byId[VS.wordKey(p.word)];
    const ar = known ? known.arabic : gloss[p.word];
    return html`<span class="${known ? "collect-chip is-known" : "collect-chip"}"><b>${p.word}</b>${ar ? html`<bdi lang="ar" dir="rtl">${ar}</bdi>` : ""}</span>`;
  })}</p>`;

  function collectPick() {
    const c = st.collect;
    const list = tokens(c.text);
    if (!list.some((t) => t.word)) return html`<p class="hint">Paste some English above, then tap the words you want to keep.</p>`;
    const phrases = pickedPhrases();
    return html`
      <p class="collect-text" lang="en">${list.map((t, i) => {
        if (!t.word) return i > 0 && list[i - 1].word ? t.text.replace(/^[^\s]+/, "") : t.text;   // its leading punctuation went with the word before
        // A word keeps the punctuation right after it ("sick.") on its line.
        const tail = ((list[i + 1] && !list[i + 1].word && list[i + 1].text.match(/^[^\s]+/)) || [""])[0];
        return html`<span class="tok-wrap"><button type="button" class="${VS.byId[VS.wordKey(t.text)] ? "tok is-known" : "tok"}" data-action="collect-tok" data-i="${i}" aria-pressed="${c.picked.has(i)}">${t.text}</button>${tail}</span>`;
      })}</p>
      ${adjacentPicks() ? html`<label class="check collect-join"><input type="checkbox" data-collect-join ${st.collect.join ? VS.raw("checked") : ""}>
        <span>Join words next to each other into one phrase</span></label>` : ""}
      <p class="hint">Tap each word you don't know.${list.some((t) => t.word && VS.byId[VS.wordKey(t.text)]) ? " Dotted words are already in your library." : ""}</p>
      ${phrases.length ? html`
        <div class="collect-picked">
          ${chipsMarkup(phrases)}
          <label class="form-field"><span>Source (optional)</span>
            <input dir="auto" id="collectSource" value="${c.source}" placeholder="A series, an article, an email…" autocomplete="off"></label>
          <div class="row">
            <button class="btn btn-primary btn-lg" type="button" data-action="collect-save">${icon("plus", "icon-sm")}
              Add ${VS.plural(phrases.filter((p) => !VS.byId[VS.wordKey(p.word)]).length, "word")}</button>
            <button class="btn btn-quiet" type="button" data-action="collect-clear">Clear picks</button>
          </div>
        </div>` : ""}`;
  }

  /* On a computer: a bookmark that sends the selected words of any page here. */
  function bookmarklet() {
    const app = location.origin + VS.cleanPath();
    if (!/^https?:/.test(app)) return "";
    const code = "javascript:(function(){var g=getSelection(),s=String(g).trim(),n=g.anchorNode,e=n&&(n.nodeType===1?n:n.parentElement),"
      + "b=e&&e.closest('p,li,td,blockquote,h1,h2,h3,span,div'),c=b?b.innerText.trim().slice(0,600):'';"
      + "window.open('" + app + "?share-text='+encodeURIComponent(s)+'&share-context='+encodeURIComponent(c)"
      + "+'&share-title='+encodeURIComponent(document.title)+'&share-url='+encodeURIComponent(location.href),'vocabstudy');})()";
    return html`
      <details class="capture-help">
        <summary>${icon("bulb", "icon-sm")} Add words from any website, in one tap</summary>
        <p><b>On a phone:</b> install VocabStudy (Settings → Install), then select a word in Chrome or any app and tap <b>Share → VocabStudy</b>.</p>
        <p><b>On a computer:</b> drag this button to your bookmarks bar. Select a word on any page — an article, YouTube subtitles, an email — and click it.</p>
        <p><a class="btn btn-tonal bookmarklet" href="${VS.raw(VS.escape(code))}" draggable="true" data-action="bookmarklet-tip">${icon("plus", "icon-sm")} Add to VocabStudy</a></p>
      </details>`;
  }

  function textTab() {
    const c = st.collect;
    return html`
      <p class="muted">Paste a paragraph — from an article, subtitles, an email — then <b>tap the words you don't know</b>. Each one keeps the sentence it came from: the best reminder there is.</p>
      <label class="form-field"><span class="sr-only">English text</span>
        <textarea dir="auto" id="collectText" class="collect-input" rows="${c.text ? 2 : 4}" spellcheck="false" lang="en" placeholder="Paste or type some English here">${c.text}</textarea></label>
      ${c.source ? html`<p class="hint">From ${c.source}</p>` : ""}
      <div id="collectPick">${collectPick()}</div>
      ${c.done ? html`<p class="import-done" role="status">${icon("check", "icon-sm")} ${c.done} <a href="#/new/cards">Learn them</a></p>` : ""}
      ${bookmarklet()}`;
  }

  /* Text shared to the app (core: VS.capture, read at start-up in app.js):
     a word or two goes to "Type" with its sentence; more goes to "From text". */
  function takeCapture() {
    const cap = VS.capture;
    if (!cap) return;
    VS.capture = null;
    const words = cap.text.split(/\s+/).filter(Boolean);
    if (cap.text && words.length <= 4 && !/[.!?]\s/.test(cap.text)) {
      st.tab = "type";
      const at = cap.context ? cap.context.toLowerCase().indexOf(cap.text.toLowerCase()) : -1;
      st.form = { word: cap.text.replace(/^[^A-Za-z]+|[^A-Za-z'’]+$/g, ""), context: at >= 0 ? sentenceAt(cap.context, at) : "", source: cap.source };
      st.openDetails = true;
    } else {
      st.tab = "text";
      st.collect = { text: cap.text || cap.context || "", source: cap.source, picked: new Set(), done: "" };
    }
  }

  /* A word from the wallet arrives with its sentence when auto-fill is
     off: nothing may leave the device, so the learner adds the details. */
  function takeWalletDraft() {
    const d = VS.walletDraft;
    if (!d) return;
    VS.walletDraft = null;
    if (d.ai) {
      // "Make with AI": the With AI tab, the words typed, each one's sentence kept for the prompt.
      st.tab = "ai";
      st.ai.ctx = {};
      d.items.forEach((e) => { st.ai.ctx[e.word.toLowerCase()] = {
        id: e.id, context: e.sentence || "",
        source: e.source ? (e.kind === "meaning" ? "From the meaning of " : "From the example for ") + VS.cap(e.source) : "",
      }; });
      Object.assign(st.ai, { words: d.items.map((e) => e.word).join("\n"), answer: "", rows: [] });
      return;
    }
    st.tab = "type";
    st.form = { word: d.word, context: d.context, source: d.source };
    st.openDetails = true;
  }
  /** The wallet entry a row from the AI belongs to: by the word typed, or by its base form. */
  function walletMatch(word) {
    const k = String(word || "").toLowerCase();
    if (st.ai.ctx[k]) return st.ai.ctx[k];
    const key = VS.wordKey(word);
    const all = Object.values(st.ai.ctx);
    return all.find((c) => c.id === key) || all.find((c) => c.context && VS.findIn({ word }, c.context)) || null;
  }

  /* ── Tab 3: paste a table ──────────────────────────────────────── */
  function pasteTab() {
    return html`
      <p class="muted">Copy rows from Excel, Google Sheets or Notion — with the header row — and paste them here.
        Columns can be in any order: <b>word</b>, <b>arabic</b>, <b>definition</b>, <b>example</b>, <b>type</b>, <b>level</b>, <b>ipa</b>, <b>tags</b>.
        Only the word is required — a list of words, one per line, works too.</p>
      <textarea dir="auto" id="importText" class="import-text" rows="8" spellcheck="false" placeholder="${TEMPLATE}">${st.text}</textarea>
      <div class="row">
        <button class="btn btn-primary" type="button" data-action="import-read">Read the list</button>
        <button class="btn btn-quiet" type="button" data-action="import-sample">Show an example</button>
        <a class="btn btn-quiet" href="assets/sample-import.tsv" download>Download a sample table</a>
      </div>`;
  }

  /* ── Tab 3: upload files ───────────────────────────────────────── */
  function filesTab() {
    const rows = st.files.flatMap((f) => f.rows);
    return html`
      <label class="drop" for="importFiles">
        ${icon("arrow-right", "icon-lg")}
        <b>Choose files</b>
        <span class="hint">Tables (<code>.csv</code>, <code>.tsv</code>, <code>.txt</code>) — including a VocabStudy CSV export. You can pick several at once.</span>
        <input type="file" id="importFiles" multiple accept=".tsv,.csv,.txt,text/plain,text/csv" hidden>
      </label>
      ${st.files.length ? html`
        <div class="file-list">
          ${st.files.map((f) => {
            const ok = savable(f.rows).length;
            const dup = f.rows.filter((r) => statusOf(r)[0] === "dup").length;
            return html`<div class="file-row">
              <span class="file-name"><b>${f.name}</b><span class="hint">${VS.plural(f.rows.length, "row")}</span></span>
              <span class="badge is-known">${ok} new</span>
              ${dup ? html`<span class="badge">${dup} already in library</span>` : ""}
            </div>`;
          })}
        </div>
        <div class="row">
          <button class="btn btn-primary btn-lg" type="button" data-action="files-save" ${savable(rows).length ? "" : VS.raw("disabled")}>${icon("check", "icon-sm")}
            Add ${VS.plural(savable(rows).length, "word")} to your library</button>
          <button class="btn btn-quiet" type="button" data-action="files-clear">Clear</button>
        </div>` : ""}
      ${st.saved && st.tab === "files" ? html`<p class="import-done" role="status">${icon("check", "icon-sm")} ${st.saved}</p>` : ""}`;
  }

  /* ── Check + save (paste) ──────────────────────────────────────── */
  function preview() {
    if (!st.parsed || st.tab !== "paste") return "";
    const rows = mark(st.parsed.rows);
    if (!rows.length) return html`<div class="empty"><h2>No rows found</h2><p>Paste at least one word.</p></div>`;
    const count = (k) => rows.filter((r) => statusOf(r)[0] === k).length;
    const n = savable(rows).length;
    return html`
      <section class="card import-step import-side" id="importCheck">
        <h2><span class="step-n">2</span> Check</h2>
        <p class="import-summary">
          <span class="badge is-known">${count("ok")} ready</span>
          ${count("warn") ? html`<span class="badge is-learning">${count("warn")} to check</span>` : ""}
          ${count("dup") ? html`<span class="badge">${count("dup")} already in library</span>` : ""}
          ${count("bad") ? html`<span class="badge is-bad">${count("bad")} can't be used</span>` : ""}
          <span class="hint">${st.parsed.hasHeader ? "Columns read from your header row." : "No header row: columns read in the standard order."}</span>
        </p>
        <div class="import-table-wrap">
          <table class="import-table">
            <thead><tr><th></th><th>Word</th><th>Type · Level</th><th>Definition</th><th>Example</th><th>IPA</th><th>Arabic</th></tr></thead>
            <tbody>
              ${rows.map((r) => {
                const [cls, label] = statusOf(r);
                const empty = html`<span class="hint">${VS.autofill.enabled() ? "auto" : "—"}</span>`;
                return html`
                  <tr class="is-${cls}">
                    <td class="c-status"><span class="row-status is-${cls}" title="${r.issues.map((i) => i.text).join(" · ")}">${label}</span></td>
                    <td class="c-word"><b>${r.word || "—"}</b>${r.sense ? html` <span class="sense">(${r.sense})</span>` : ""}
                      ${r.issues.length ? html`<span class="row-issues">${r.issues.map((i) => i.text).join(" · ")}</span>` : ""}</td>
                    <td data-label="Type · level">${r.type || empty}${r.level ? " · " + r.level : ""}</td>
                    <td data-label="Definition">${r.definition || empty}</td>
                    <td data-label="Example">${r.example || empty}</td>
                    <td data-label="IPA" class="ipa">${r.ipa || empty}</td>
                    <td data-label="Arabic" lang="ar">${r.arabic || empty}</td>
                  </tr>`;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card import-step">
        <h2><span class="step-n">3</span> Save</h2>
        <label class="form-field"><span>Tags for all of them (optional)</span>
          <input dir="auto" id="pasteTags" value="${st.pasteTags || ""}" placeholder="IELTS, work" list="tagList" autocomplete="off"></label>
        ${VS.ui.tagList()}
        <div class="row">
          <button class="btn btn-primary btn-lg" type="button" data-action="import-save" ${n ? "" : VS.raw("disabled")}>
            ${icon("check", "icon-sm")} Add ${VS.plural(n, "word")} to your library</button>
        </div>
        ${st.saved ? html`<p class="import-done" role="status">${icon("check", "icon-sm")} ${st.saved}</p>` : ""}
      </section>`;
  }

  async function readFiles(list) {
    const files = [];
    for (const file of list) {
      const text = await file.text();
      files.push({ name: file.name, rows: mark(VS.importer.parse(text).rows) });
    }
    return files;
  }

  /* Seven ways in, in two labelled rows so nothing wraps or repeats:
     with AI (your words · a topic · from Arabic) and by yourself. */
  const TAB_GROUPS = [
    ["With AI", "bolt", [["ai", "Your words", "Words"], ["ai-topic", "By topic", "Topic"], ["ai-ar", "From Arabic", "Arabic"]]],
    ["Yourself", "pen", [["type", "Type a word", "Type"], ["text", "From text", "Text"], ["paste", "Paste a list", "List"], ["files", "Upload files", "File"]]],
  ];
  const TABS = TAB_GROUPS.flatMap((g) => g[2]);
  const groupOf = (tab) => Math.max(0, TAB_GROUPS.findIndex((g) => g[2].some(([v]) => v === tab)));
  const lastIn = {};            // the way last opened in each group, so switching back returns there
  const isAiTab = (t) => t in AI_TAB_MODE;

  VS.views.import = {
    title: () => "Add words",
    crumbs: () => [],           // a main tab: the nav already says where you are

    start(p) {
      const tab = new URLSearchParams(p.query || "").get("tab");
      if (TABS.some(([v]) => v === tab)) st.tab = tab;
      takeWalletDraft();
      takeCapture();
    },

    render() {
      if (isAiTab(st.tab)) st.ai.mode = AI_TAB_MODE[st.tab];
      return html`
        <div class="page import-page ${st.tab === "type" || isAiTab(st.tab) ? "is-type" : ""} view-enter">
          <header class="page-head"><div>
            <h1>Add words</h1>
            <p class="hint">${VS.plural(VS.allWords().length, "word")} so far. Only the English word is looked up online — your words stay on this device.</p>
          </div></header>

          <section class="card import-step import-main">
            <!-- Two big tabs side by side — With AI | Yourself — and, under the open one, its ways. -->
            <div class="import-ways">
              <div class="import-groups" role="tablist" aria-label="How to add words">
                ${TAB_GROUPS.map(([label, ico], i) => html`<button type="button" role="tab" data-action="import-group" data-value="${i}"
                  aria-pressed="${groupOf(st.tab) === i}" aria-selected="${groupOf(st.tab) === i}">${icon(ico, "icon-sm")}<span>${label}</span></button>`)}
              </div>
              <div class="seg import-tabs is-${TAB_GROUPS[groupOf(st.tab)][2].length}" role="tablist" aria-label="${TAB_GROUPS[groupOf(st.tab)][0]}">
                ${TAB_GROUPS[groupOf(st.tab)][2].map(([v, l, short]) => html`<button type="button" role="tab" data-action="import-tab" data-value="${v}" aria-pressed="${st.tab === v}" aria-selected="${st.tab === v}"><span class="tab-long">${l}</span><span class="tab-short">${short}</span></button>`)}
              </div>
            </div>
            ${st.tab === "type" ? typeTab() : isAiTab(st.tab) ? aiTab() : st.tab === "text" ? textTab() : st.tab === "paste" ? pasteTab() : filesTab()}
          </section>

          ${st.tab === "type" || isAiTab(st.tab) ? recent() : preview()}
        </div>`;
    },

    mount(root) {
      const collect = VS.$("#collectText", root);
      if (collect) collect.addEventListener("input", () => {
        st.collect.text = collect.value;
        st.collect.picked = new Set();
        st.collect.done = "";
        const box = VS.$("#collectPick");
        if (box) box.innerHTML = String(collectPick());
      });
      // "Join words next to each other into one phrase": the learner's choice, never a guess.
      root.addEventListener("change", (e) => {
        if (!e.target.matches || !e.target.matches("[data-collect-join]")) return;
        st.collect.join = e.target.checked;
        const box = VS.$("#collectPick");
        if (box) box.innerHTML = String(collectPick());
        glossPicked();
      });
      const text = VS.$("#importText", root);
      if (text) text.addEventListener("input", () => { st.text = text.value; });
      const tags = VS.$("#pasteTags", root);
      if (tags) tags.addEventListener("input", () => { st.pasteTags = tags.value; });
      const files = VS.$("#importFiles", root);
      if (files) files.addEventListener("change", async () => {
        st.files = await readFiles([...files.files]);
        st.saved = "";
        VS.app.render();
      });
      VS.$$("[data-form-field]", root).forEach((el) => {
        el.addEventListener("input", () => {
          st.form[el.dataset.formField] = el.value;
          if (el.dataset.formField === "word") VS.spelling.cancel();
        });
      });
      // With AI: words typed, answer pasted, cards edited — all kept in st.ai.
      // Step 1 → the step-2 buttons wake up together (once, with a pulse on the main one).
      const askBtns = VS.$$(".ai-ask .ai-ask-btn, .ai-add > .ai-step .ai-copy-btn", root);
      const wake = () => {
        const ready = aiReady();
        askBtns.forEach((btn) => {
          if (ready && btn.disabled) {
            btn.disabled = false; btn.removeAttribute("title");
            if (btn.classList.contains("ai-copy-btn")) { btn.classList.add("is-ready", "just-ready"); setTimeout(() => btn.classList.remove("just-ready"), 1000); }
          } else if (!ready && !btn.disabled) {
            btn.disabled = true; btn.title = !VS.profileSet() ? "Choose your level and Arabic first" : st.ai.mode === "words" ? "Type a word first" : "Fill in step 1 first";
            btn.classList.remove("is-ready", "just-ready");
          }
        });
      };
      const words = VS.$("[data-ai-words]", root);
      if (words) words.addEventListener("input", () => { st.ai.words = words.value; wake(); });
      VS.$$("[data-ai-in]", root).forEach((el) => {
        const keep = () => { const k = el.dataset.aiIn; st.ai[k] = k === "count" ? Number(el.value) : el.value; wake(); };
        el.addEventListener("input", keep);
        el.addEventListener("change", keep);
      });
      const aiBox = VS.$("[data-ai-add]", root);
      const review = VS.$("#aiReview", root);
      const readAnswer = () => {
        st.ai.answer = aiBox.value;
        const typed = aiWords();
        let rows = VS.parseAiWords(aiBox.value);
        // One typed word and an answer without a "word:" line: it's that word.
        if (st.ai.mode === "words" && rows.length === 1 && !rows[0].word && typed.length === 1) rows[0].word = typed[0];
        rows = rows.filter((r) => r.word && !VS.isArabicTyping(r.word));
        st.ai.rows = rows.map((r) => {
          const row = Object.assign({ keep: true, dup: !!VS.byId[VS.wordKey(r.word, "")] }, r);
          const m = walletMatch(r.word);
          if (m) { row.walletId = m.id; if (m.context) row.context = m.context; if (m.source) row.source = m.source; }
          return row;
        });
        if (review) review.innerHTML = String(aiReview());
        const fine = st.ai.rows.filter((r) => !r.dup);
        VS.aiFillStatus(aiBox.closest(".ai-fill"), fine.map((r) => r.word), !!aiBox.value.trim());
        const status = aiBox.closest(".ai-fill").querySelector(".ai-fill-status");
        if (status && fine.length) status.innerHTML = String(html`${icon("check", "icon-sm")}<span><b>${VS.plural(fine.length, "word")} ready</b> — check them below.</span>`);
      };
      if (aiBox) aiBox.addEventListener("input", readAnswer);
      if (review) {
        review.addEventListener("input", (e) => {
          const i = e.target.dataset.aiRow;
          if (i != null) st.ai.rows[Number(i)][e.target.dataset.aiK] = e.target.value;
          if (e.target.matches("[data-ai-tags]")) st.ai.tags = e.target.value;
        });
        review.addEventListener("change", (e) => {
          const i = e.target.dataset.aiKeep;
          if (i == null) return;
          st.ai.rows[Number(i)].keep = e.target.checked;
          review.innerHTML = String(aiReview());
        });
      }
      VS.ui.watchKeyboard(VS.$("#addWord", root), { lookup: true });
      VS.ui.watchDuplicate(VS.$("#addWord", root), VS.$("#addWord", root) && VS.$("#addWord", root).closest(".add-line"));
      const form = VS.$("[data-form='one-word']", root);
      if (form) form.addEventListener("submit", (e) => { e.preventDefault(); VS.views.import.actions["form-add"](); });
      const first = VS.$("#addWord", root);
      if (first && matchMedia("(hover: hover)").matches) first.focus({ preventScroll: true });
    },

    actions: {
      async "add-ai-copy"(el) {
        if (!aiReady()) { VS.toast(!VS.profileSet() ? "Choose your level and Arabic first." : st.ai.mode === "words" ? "Type your words first." : "Fill in step 1 first."); return; }
        if (st.ai.mode === "words" && aiWords().some((w) => VS.isArabicTyping(w))) { VS.toast("Type the English words — the AI adds the Arabic."); return; }
        const text = aiPromptNow();
        try { await navigator.clipboard.writeText(text); VS.aiCopied(el); }
        catch (e) {
          const box = VS.$("[data-ai-add]");
          if (box) { box.value = text; box.select(); }
          VS.toast("Copy the selected text, then replace it with the AI's answer.");
        }
      },
      /* A new chat with the prompt already typed (both read ?q=). The prompt is
         copied too, so a long one — or Gemini — still works with one paste. */
      "ai-open"(el) {
        if (!aiReady()) { VS.toast(!VS.profileSet() ? "Choose your level and Arabic first." : "Fill in step 1 first."); return; }
        if (st.ai.mode === "words" && aiWords().some((w) => VS.isArabicTyping(w))) { VS.toast("Arabic? Use “From Arabic”."); return; }
        VS.aiOpen(el.dataset.to, aiPromptNow());
      },
      "import-group"(el) {
        const g = Number(el.dataset.value);
        if (g === groupOf(st.tab)) return;
        const tab = lastIn[g] || TAB_GROUPS[g][2][0][0];
        Object.assign(st.ai, { answer: "", rows: [] });
        st.tab = tab; lastIn[g] = tab; st.saved = ""; VS.app.render();
      },
      "import-tab"(el) {
        if (el.dataset.value !== st.tab) Object.assign(st.ai, { answer: "", rows: [] });
        st.tab = el.dataset.value; lastIn[groupOf(st.tab)] = st.tab; st.saved = ""; VS.app.render();
      },
      "ai-add"() {
        const tags = VS.parseTags(st.ai.tags);
        const words = st.ai.rows.filter((r) => r.keep && !r.dup).map((r) => {
          const w = { word: r.word, tags: tags.slice() };
          ["arabic", "definition", "example", "type", "level", "ipa", "context", "source"].forEach((k) => { if (r[k]) w[k] = String(r[k]).trim(); });
          if (r.synonyms) w.synonyms = VS.parseTags(r.synonyms).slice(0, 6);
          return w;
        });
        if (!words.length) return;
        const r = save(words);
        // A wallet word the AI turned into its base form ("postponed" → "postpone") leaves the wallet too.
        const addedKeys = new Set(r.added.map((w) => VS.wordKey(w.word)));
        st.ai.rows.forEach((row) => { if (row.walletId && addedKeys.has(VS.wordKey(row.word))) VS.store.walletRemove(row.walletId); });
        VS.sfx.play("pop");
        // Added: every field is empty again, ready for the next words (tags kept on purpose).
        Object.assign(st.ai, { words: "", topic: "", ar: "", answer: "", rows: [], ctx: {} });
        VS.app.render();
      },

      "collect-tok"(el) {
        const i = Number(el.dataset.i);
        const c = st.collect;
        if (c.picked.has(i)) c.picked.delete(i); else c.picked.add(i);
        c.done = "";
        const src = VS.$("#collectSource");
        if (src) c.source = src.value;
        const box = VS.$("#collectPick");
        if (box) box.innerHTML = String(collectPick());
        glossPicked();
        const again = VS.$(`[data-action="collect-tok"][data-i="${i}"]`);
        if (again) again.focus({ preventScroll: true });
      },
      "collect-clear"() { st.collect.picked = new Set(); VS.app.render(); },
      "collect-save"() {
        const c = st.collect;
        const src = VS.$("#collectSource");
        if (src) c.source = src.value.trim();
        const fresh = pickedPhrases().filter((p) => !VS.byId[VS.wordKey(p.word)]);
        if (!fresh.length) { VS.toast("Those words are already in your library."); return; }
        const r = save(fresh.map((p) => ({ word: p.word, context: p.context, source: c.source, tags: [] })));
        c.picked = new Set(); c.text = ""; c.source = "";
        c.done = `Added ${VS.plural(r.added.length, "word")}, each with its sentence.`;
        VS.sfx.play("done");
        VS.app.render();
      },
      "bookmarklet-tip"(el, e) {
        // A click inside the app does nothing useful: it's meant for the bookmarks bar.
        e.preventDefault();
        VS.toast("Drag this button to your bookmarks bar.");
      },

      async "form-add"() {
        const input = VS.$("#addWord");
        // Arabic typed: find the English word first («تحدي» → challenge).
        const fromArabic = VS.isArabicTyping(st.form.word);
        if (fromArabic) {
          const en = await VS.spelling.chooseEnglish(st.form.word, input && input.closest(".add-line"));
          if (!en) return;
          st.form.word = en;
          if (input) input.value = en;
        }
        if (!VS.addWordReady(st.form.word, st.form.sense)) return;
        // A typo would be taught as the right answer: ask first (core/spelling.js).
        const word = fromArabic ? st.form.word : await VS.spelling.confirm(st.form.word, input && input.closest(".add-line"));
        if (!word) return;
        st.form.word = word;
        if (!VS.addWord(st.form)) return;
        st.form = st.form.tags ? { tags: st.form.tags } : {};        // keep the tags for the next word
        st.openDetails = false;
        VS.app.render();
        const first = VS.$("#addWord");
        if (first) first.focus();
      },

      "import-read"() {
        st.parsed = VS.importer.parse(st.text);
        st.saved = "";
        VS.app.render();
        const check = VS.$("#importCheck");
        if (check) check.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      "import-sample"() {
        st.text = TEMPLATE;
        st.parsed = VS.importer.parse(st.text);
        VS.app.render();
      },
      "import-save"() {
        const tags = VS.parseTags(st.pasteTags);
        const words = savable(mark(st.parsed.rows)).map(clean).map((w) => Object.assign(w, { tags: [...new Set(w.tags.concat(tags))] }));
        const r = save(words);
        st.saved = `Added ${VS.plural(r.added.length, "word")} to your library.` + (VS.autofill.enabled() ? " Missing details are filling in." : "");
        st.parsed = null;
        st.text = "";
        VS.sfx.play("done");
        VS.app.render();
      },

      "files-save"() {
        const r = save(savable(st.files.flatMap((f) => f.rows)).map(clean));
        st.saved = `Added ${VS.plural(r.added.length, "word")} to your library.`;
        st.files = [];
        VS.sfx.play("done");
        VS.app.render();
      },
      "files-clear"() { st.files = []; VS.app.render(); },
    },
  };

  // Each filled word updates "Just added" while you're on this screen.
  // Only the list is redrawn, so typing the next word isn't interrupted.
  VS.autofill.onFill((id, oldId) => {
    if (oldId && oldId !== id) st.recent = st.recent.map((r) => (r === oldId ? id : r));
    const box = VS.app.current() === "import" && (st.tab === "type" || isAiTab(st.tab)) && VS.$("#recentBox");
    if (box) box.outerHTML = String(recent());
  });
})();
