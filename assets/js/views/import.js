/* views/import.js — "Add words": every word goes into your one library.
   ------------------------------------------------------------------
   Type a word    the fast way: type it, press Enter. The app fills in
                  the rest (core/autofill.js). "More details" lets you
                  type any field yourself — your typing always wins.
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
  const DETAILS = ["arabic", "type", "level", "tags", "definition", "example", "ipa", "sense"];

  const st = {
    tab: "type",                  // type | paste | files
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
      if (VS.byId[id]) r.issues.push({ kind: "dup", text: "already in your library" });
      else if (seen.has(id)) r.issues.push({ kind: "dup", text: "repeated in this list" });
      seen.add(id);
    });
    return rows;
  }
  const savable = (rows) => rows.filter((r) => !r.issues.some((i) => i.kind === "error" || i.kind === "dup"));
  const clean = (r) => {
    const w = {};
    ["word", "sense", "type", "level", "ipa", "definition", "example", "arabic"].forEach((k) => { if (r[k]) w[k] = r[k]; });
    w.tags = VS.parseTags(r.tags);
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
    st.recent = ids.slice().reverse().concat(st.recent.filter((id) => !ids.includes(id))).slice(0, 12);
    VS.autofill.fill(ids);
    return result;
  }

  /**
   * Add one word — the library's add box and the form here both use it.
   * Returns the new word, or null (with a toast saying why).
   */
  VS.addWord = function (fields) {
    const w = VS.importer.checkWord(fields);
    if (!w.word) { VS.toast("Type a word first."); return null; }
    if (VS.isArabicTyping(w.word)) { VS.toast("That's Arabic — switch your keyboard to English."); return null; }
    const existing = VS.byId[VS.wordKey(w.word, w.sense)];
    if (existing) { VS.toast(`“${existing.word}” is already in your library.`); return null; }
    if (!VS.autofill.enabled() && !w.arabic) { VS.toast("Add the Arabic meaning (auto-fill is off)."); return null; }
    const r = save([clean(Object.assign({}, w, { tags: fields.tags }))]);
    VS.sfx.play("pop");
    return r.added[0] || null;
  };

  /* ── Tab 1: type a word ───────────────────────────────────────── */
  function field(name, label, opts) {
    const o = opts || {};
    const value = st.form[name] || "";
    const control = o.options
      ? html`<select data-form-field="${name}"><option value="">${o.empty}</option>${o.options.map((v) => html`<option ${v === value ? VS.raw("selected") : ""}>${v}</option>`)}</select>`
      : o.long
        ? html`<textarea data-form-field="${name}" rows="2" placeholder="${o.placeholder || ""}">${value}</textarea>`
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
            <input data-form-field="word" id="addWord" value="${st.form.word || ""}" placeholder="Type a word or phrase" aria-label="English word or phrase"
                   spellcheck="false" autocapitalize="off" enterkeyhint="done"/>
          </label>
          <button class="btn btn-primary btn-lg" type="submit">${icon("plus", "icon-sm")} Add</button>
        </div>
        <p class="hint">${auto
          ? "Press Enter. The app fills in the Arabic meaning, definition, example and pronunciation — only the word is sent online."
          : html`Auto-fill is off (Settings), so nothing leaves this device. Add the details below.`}</p>
        <details class="add-more" ${!auto || filled ? VS.raw("open") : ""}>
          <summary>${icon("chevron-right", "icon-sm")} More details <span class="hint">(optional)</span></summary>
          <div class="word-form">
            ${field("arabic", "Arabic meaning", { ar: true, placeholder: "مثلاً: يستغل - يستفيد من" })}
            ${field("tags", "Tags", { placeholder: "IELTS, work", list: "tagList" })}
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

  /* Words added on this screen, with auto-fill's progress. */
  function recent() {
    const words = st.recent.map((id) => VS.byId[id]).filter(Boolean);
    if (!words.length) return html`<div id="recentBox"></div>`;
    return html`
      <section class="card import-step" id="recentBox" aria-labelledby="recent-title">
        <div class="section-title"><h2 id="recent-title">Just added</h2>
          <span class="row"><a class="btn btn-quiet" href="#/words?added=today&sort=newest">See in library</a>
          <a class="btn" href="#/new/cards">${icon("cards", "icon-sm")} Learn them</a></span></div>
        <ul class="recent-list" aria-live="polite">
          ${words.map((w) => {
            const waiting = VS.autofill.pending(w.id);
            return html`<li>
              <b>${w.word}</b>
              <span class="hint">${w.type}${w.level ? " · " + w.level : ""}${w.tags.length ? " · #" + w.tags.join(" #") : ""}</span>
              ${w.arabic ? html`<span lang="ar">${w.arabic}</span>`
                : html`<span class="hint">${waiting ? (navigator.onLine ? "Filling in…" : "Fills in when you're online") : "No Arabic found — add it in the library"}</span>`}
            </li>`;
          })}
        </ul>
      </section>`;
  }

  /* ── Tab 2: paste a table ──────────────────────────────────────── */
  function pasteTab() {
    return html`
      <p class="muted">Copy rows from Excel, Google Sheets or Notion — with the header row — and paste them here.
        Columns can be in any order: <b>word</b>, <b>arabic</b>, <b>definition</b>, <b>example</b>, <b>type</b>, <b>level</b>, <b>ipa</b>, <b>tags</b>.
        Only the word is required — a list of words, one per line, works too.</p>
      <textarea id="importText" class="import-text" rows="8" spellcheck="false" placeholder="${TEMPLATE}">${st.text}</textarea>
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
      <section class="card import-step" id="importCheck">
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
          <input id="pasteTags" value="${st.pasteTags || ""}" placeholder="IELTS, work" list="tagList" autocomplete="off"></label>
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

  const TABS = [["type", "Type a word"], ["paste", "Paste a list"], ["files", "Upload files"]];

  VS.views.import = {
    title: () => "Add words",
    crumbs: () => [{ label: "Add words" }],

    render() {
      return html`
        <div class="page import-page view-enter">
          <header class="page-head"><div>
            <h1>Add words</h1>
            <p class="hint">Into your library — ${VS.plural(VS.allWords().length, "word")} so far. Everything stays on this device.</p>
          </div></header>

          <section class="card import-step">
            <div class="seg import-tabs" role="tablist" aria-label="How to add words">
              ${TABS.map(([v, l]) => html`<button type="button" role="tab" data-action="import-tab" data-value="${v}" aria-pressed="${st.tab === v}" aria-selected="${st.tab === v}">${l}</button>`)}
            </div>
            ${st.tab === "type" ? typeTab() : st.tab === "paste" ? pasteTab() : filesTab()}
          </section>

          ${st.tab === "type" ? recent() : preview()}
        </div>`;
    },

    mount(root) {
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
        el.addEventListener("input", () => { st.form[el.dataset.formField] = el.value; });
      });
      VS.ui.watchKeyboard(VS.$("#addWord", root));
      const form = VS.$("[data-form='one-word']", root);
      if (form) form.addEventListener("submit", (e) => { e.preventDefault(); VS.views.import.actions["form-add"](); });
      const first = VS.$("#addWord", root);
      if (first && matchMedia("(hover: hover)").matches) first.focus({ preventScroll: true });
    },

    actions: {
      "import-tab"(el) { st.tab = el.dataset.value; st.saved = ""; VS.app.render(); },

      "form-add"() {
        if (!VS.addWord(st.form)) return;
        st.form = st.form.tags ? { tags: st.form.tags } : {};        // keep the tags for the next word
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
  VS.autofill.onFill(() => {
    const box = VS.app.current() === "import" && st.tab === "type" && VS.$("#recentBox");
    if (box) box.outerHTML = String(recent());
  });
})();
