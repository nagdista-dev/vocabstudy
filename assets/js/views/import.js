/* views/import.js — "Add words": three ways to bring words into the app.
   ------------------------------------------------------------------
   Type a word    one word at a time, in a simple form
   Paste a table  rows copied from Excel / Google Sheets / Notion
   Upload files   .js sets (VocabStudy's own format — one set per file,
                  dated by the file) or .tsv / .csv / .txt tables

   Pasted and uploaded words go through a check (ready / check / can't use)
   with an optional dictionary fill for empty definitions and IPA, then
   are saved on this device. Nothing leaves the device unless you
   download it. core/importer.js does the reading; core/store.js keeps them.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;

  const TEMPLATE = ["word\tdefinition\texample\ttype\tlevel\tipa\tarabic",
    "Habit\tSomething you do often, almost without thinking.\tI have a habit of reading before bed.\tNoun\tB1\t/ˈhæbɪt/\tعادة"].join("\n");

  const st = {
    tab: "type",                  // type | paste | files
    text: "", date: VS.todayKey(), parsed: null, busy: "", saved: "",
    files: [],                    // [{ name, iso, rows }] from uploaded .js sets
    form: {},                     // the one-word form
  };

  const ready = (rows) => rows.filter((r) => !r.issues.some((i) => i.kind === "error"));
  const usable = () => (st.parsed ? ready(st.parsed.rows) : []);
  const clean = (r) => ({ word: r.word, sense: r.sense, type: r.type, level: r.level, ipa: r.ipa,
                          definition: r.definition, example: r.example, arabic: r.arabic });

  function statusOf(r) {
    if (r.issues.some((i) => i.kind === "error")) return ["bad", "Can't use"];
    if (r.issues.some((i) => i.kind === "warn")) return ["warn", "Check"];
    return ["ok", "Ready"];
  }

  /* ── Tab 1: type one word ─────────────────────────────────────── */
  function field(name, label, opts) {
    const o = opts || {};
    const value = st.form[name] || o.value || "";
    const control = o.options
      ? html`<select data-form-field="${name}">${o.options.map((v) => html`<option ${v === value ? VS.raw("selected") : ""}>${v}</option>`)}</select>`
      : o.long
        ? html`<textarea data-form-field="${name}" rows="2" placeholder="${o.placeholder || ""}">${value}</textarea>`
        : html`<input data-form-field="${name}" value="${value}" placeholder="${o.placeholder || ""}" ${o.ar ? VS.raw('lang="ar" dir="rtl"') : ""} autocomplete="off"/>`;
    return html`<label class="form-field ${o.wide ? "is-wide" : ""}"><span>${label}${o.required ? html` <b class="req">*</b>` : ""}</span>${control}</label>`;
  }

  function typeTab() {
    return html`
      <form class="word-form" data-form="one-word" autocomplete="off">
        ${field("word", "English word or phrase", { required: true, placeholder: "e.g. Take advantage of" })}
        ${field("arabic", "Arabic meaning", { required: true, ar: true, placeholder: "مثلاً: يستغل - يستفيد من" })}
        ${field("type", "Type", { options: VS.importer.TYPES, value: "Noun" })}
        ${field("level", "Level", { options: VS.importer.LEVELS, value: "B1" })}
        ${field("definition", "Definition (English)", { wide: true, long: true, placeholder: "What it means, in simple English" })}
        ${field("example", "Example sentence", { wide: true, long: true, placeholder: "A sentence that uses the word" })}
        ${field("ipa", "Pronunciation (IPA)", { placeholder: "/ˈhæbɪt/" })}
        ${field("sense", "Sense (optional)", { placeholder: "e.g. tool — if the word has two meanings" })}
        <div class="form-actions is-wide">
          <label class="import-date"><span>Add to the set of</span><input type="date" data-form-field="date" value="${st.form.date || st.date}"/></label>
          <button class="btn" type="button" data-action="form-fill">${icon("bulb", "icon-sm")} Fill definition &amp; IPA</button>
          <button class="btn btn-primary btn-lg" type="submit">${icon("plus", "icon-sm")} Add word</button>
        </div>
        <p class="hint is-wide">Only the word and its Arabic meaning are needed. “Fill” looks up the rest in a free online dictionary.</p>
      </form>`;
  }

  /* ── Tab 2: paste a table ──────────────────────────────────────── */
  function pasteTab() {
    return html`
      <p class="muted">Copy rows from Excel, Google Sheets or Notion — with the header row — and paste them here.
        Columns can be in any order: <b>word</b>, <b>definition</b>, <b>example</b>, <b>type</b>, <b>level</b>, <b>ipa</b>, <b>arabic</b>.
        Only the word is required; empty cells are fine.</p>
      <textarea id="importText" class="import-text" rows="8" spellcheck="false" placeholder="${TEMPLATE}">${st.text}</textarea>
      <div class="row">
        <button class="btn btn-primary" type="button" data-action="import-read">Read the table</button>
        <button class="btn btn-quiet" type="button" data-action="import-sample">Show an example</button>
        <a class="btn btn-quiet" href="data/sample/sample-import.tsv" download>Download a sample table</a>
      </div>`;
  }

  /* ── Tab 3: upload files ───────────────────────────────────────── */
  function filesTab() {
    return html`
      <label class="drop" for="importFiles">
        ${icon("arrow-right", "icon-lg")}
        <b>Choose files</b>
        <span class="hint">VocabStudy sets (<code>.js</code>, one set per file) or tables (<code>.tsv</code>, <code>.csv</code>, <code>.txt</code>). You can pick several at once.</span>
        <input type="file" id="importFiles" multiple accept=".js,.tsv,.csv,.txt,text/plain,text/csv,text/javascript" hidden>
      </label>
      ${st.files.length ? html`
        <div class="file-list">
          ${st.files.map((f) => {
            const ok = ready(f.rows).length;
            const warn = f.rows.filter((r) => statusOf(r)[0] === "warn").length;
            return html`<div class="file-row">
              <span class="file-name"><b>${f.name}</b><span class="hint">${f.iso ? "Set of " + f.iso : "No date in the file — uses the date below"}</span></span>
              <span class="badge is-known">${ok} words</span>
              ${warn ? html`<span class="badge is-learning">${warn} to check</span>` : ""}
            </div>`;
          })}
        </div>
        <label class="import-date"><span>Date for files without one</span><input type="date" id="filesDate" value="${st.date}"/></label>
        <div class="row">
          <button class="btn btn-primary btn-lg" type="button" data-action="files-save">${icon("check", "icon-sm")}
            Save ${VS.plural(st.files.reduce((n, f) => n + ready(f.rows).length, 0), "word")} in ${VS.plural(new Set(st.files.map((f) => f.iso || st.date)).size, "set")}</button>
          <button class="btn btn-quiet" type="button" data-action="files-clear">Clear</button>
        </div>` : ""}
      ${st.saved && st.tab === "files" ? html`<p class="import-done" role="status">${icon("check", "icon-sm")} ${st.saved}</p>` : ""}`;
  }

  /* ── Check + save (paste) ──────────────────────────────────────── */
  function preview() {
    if (!st.parsed || st.tab !== "paste") return "";
    const rows = st.parsed.rows;
    if (!rows.length) return html`<div class="empty"><h2>No rows found</h2><p>Paste at least one line under the header.</p></div>`;
    const readyN = rows.filter((r) => statusOf(r)[0] === "ok").length;
    const check = rows.filter((r) => statusOf(r)[0] === "warn").length;
    const bad = rows.length - readyN - check;
    const missing = rows.filter((r) => !r.definition || !r.ipa).length;
    const existing = VS.day(st.date);
    return html`
      <section class="card import-step" id="importCheck">
        <h2><span class="step-n">2</span> Check</h2>
        <p class="import-summary">
          <span class="badge is-known">${readyN} ready</span>
          ${check ? html`<span class="badge is-learning">${check} to check</span>` : ""}
          ${bad ? html`<span class="badge is-bad">${bad} can't be used</span>` : ""}
          <span class="hint">${st.parsed.hasHeader ? "Columns read from your header row." : "No header row: columns read in the standard order."}</span>
        </p>
        ${missing ? html`
          <div class="import-fill">
            <span>${VS.plural(missing, "word")} ${missing === 1 ? "has" : "have"} no definition or IPA.</span>
            <button class="btn" type="button" data-action="import-fill" ${st.busy ? VS.raw("disabled") : ""}>${icon("bulb", "icon-sm")} ${st.busy || "Fill them from the dictionary"}</button>
            <span class="hint">Online, free (dictionaryapi.dev). Only the English words are sent.</span>
          </div>` : ""}
        <div class="import-table-wrap">
          <table class="import-table">
            <thead><tr><th></th><th>Word</th><th>Type · Level</th><th>Definition</th><th>Example</th><th>IPA</th><th>Arabic</th></tr></thead>
            <tbody>
              ${rows.map((r) => {
                const [cls, label] = statusOf(r);
                return html`
                  <tr class="is-${cls}">
                    <td class="c-status"><span class="row-status is-${cls}" title="${r.issues.map((i) => i.text).join(" · ")}">${label}</span></td>
                    <td class="c-word"><b>${r.word || "—"}</b>${r.sense ? html` <span class="sense">(${r.sense})</span>` : ""}
                      ${r.issues.length ? html`<span class="row-issues">${r.issues.map((i) => i.text).join(" · ")}</span>` : ""}</td>
                    <td data-label="Type · level">${r.type} · ${r.level}</td>
                    <td data-label="Definition">${r.definition || html`<span class="hint">—</span>`}</td>
                    <td data-label="Example">${r.example || html`<span class="hint">—</span>`}</td>
                    <td data-label="IPA" class="ipa">${r.ipa || html`<span class="hint">—</span>`}</td>
                    <td data-label="Arabic" lang="ar">${r.arabic || html`<span class="hint">—</span>`}</td>
                  </tr>`;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card import-step">
        <h2><span class="step-n">3</span> Save</h2>
        <label class="import-date"><span>Study date of this set</span>
          <input type="date" id="importDate" value="${st.date}"/></label>
        ${existing ? html`<p class="hint">${existing.label} already has ${VS.plural(existing.words.length, "word")} — new words are added to it, duplicates skipped.</p>` : ""}
        <div class="row">
          <button class="btn btn-primary btn-lg" type="button" data-action="import-save" ${usable().length ? "" : VS.raw("disabled")}>
            ${icon("check", "icon-sm")} Save ${VS.plural(usable().length, "word")}</button>
        </div>
        ${st.saved ? html`<p class="import-done" role="status">${icon("check", "icon-sm")} ${st.saved}</p>` : ""}
      </section>`;
  }

  /* ── Your sets on this device ─────────────────────────────────── */
  function mySets() {
    const sets = Object.entries(VS.store.userDays());
    if (!sets.length) return "";
    return html`
      <section class="import-mine">
        <div class="section-title"><h2>Your sets on this device</h2>
          <span class="hint">${VS.plural(sets.reduce((n, [, w]) => n + w.length, 0), "word")}</span></div>
        <div class="word-list">
          ${sets.sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([iso, words]) => html`
            <div class="mine-row card">
              <a href="${VS.dayHref(iso)}"><b>${VS.day(iso) ? VS.day(iso).label : iso}</b> <span class="hint">${VS.plural(words.length, "word")}</span></a>
              <span class="row">
                <button class="btn btn-quiet" type="button" data-action="import-export" data-iso="${iso}">Download .js</button>
                <button class="btn btn-quiet danger" type="button" data-action="import-delete" data-iso="${iso}">Delete set</button>
              </span>
            </div>`)}
        </div>
      </section>`;
  }

  function download(name, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function readFiles(list) {
    const files = [];
    for (const file of list) {
      const text = await file.text();
      const data = /\.js$/i.test(file.name) ? VS.importer.parseDataFile(text) : null;
      if (data) files.push({ name: file.name, iso: data.iso, rows: data.rows });
      else {
        const parsed = VS.importer.parse(text);
        const iso = (/(\d{4}-\d{2}-\d{2})/.exec(file.name) || [])[1] || "";
        files.push({ name: file.name, iso, rows: parsed.rows });
      }
    }
    return files;
  }

  const TABS = [["type", "Type a word"], ["paste", "Paste a table"], ["files", "Upload files"]];

  VS.views.import = {
    title: () => "Add words",
    crumbs: () => [{ label: "Add words" }],

    render() {
      return html`
        <div class="page import-page view-enter">
          <header class="day-head"><div>
            <h1>Add words</h1>
            <p class="hint">Your words stay on this device.</p>
          </div></header>

          <section class="card import-step">
            <div class="seg import-tabs" role="tablist" aria-label="How to add words">
              ${TABS.map(([v, l]) => html`<button type="button" role="tab" data-action="import-tab" data-value="${v}" aria-pressed="${st.tab === v}" aria-selected="${st.tab === v}">${l}</button>`)}
            </div>
            ${st.tab === "type" ? typeTab() : st.tab === "paste" ? pasteTab() : filesTab()}
          </section>

          ${preview()}
          ${mySets()}
        </div>`;
    },

    mount(root) {
      const text = VS.$("#importText", root);
      if (text) text.addEventListener("input", () => { st.text = text.value; });
      const date = VS.$("#importDate", root);
      if (date) date.addEventListener("change", () => { st.date = date.value || VS.todayKey(); st.saved = ""; VS.app.render(); });
      const filesDate = VS.$("#filesDate", root);
      if (filesDate) filesDate.addEventListener("change", () => { st.date = filesDate.value || VS.todayKey(); });
      const files = VS.$("#importFiles", root);
      if (files) files.addEventListener("change", async () => {
        st.files = await readFiles([...files.files]);
        st.saved = "";
        VS.app.render();
      });
      VS.$$("[data-form-field]", root).forEach((el) => {
        if (st.form[el.dataset.formField] == null) st.form[el.dataset.formField] = el.value;   // selects start on a default
        el.addEventListener("input", () => { st.form[el.dataset.formField] = el.value; });
      });
      const form = VS.$("[data-form='one-word']", root);
      if (form) form.addEventListener("submit", (e) => { e.preventDefault(); VS.views.import.actions["form-add"](); });
    },

    actions: {
      "import-tab"(el) { st.tab = el.dataset.value; st.saved = ""; VS.app.render(); },

      async "form-fill"(el) {
        if (!st.form.word) { VS.toast("Type the word first."); return; }
        el.disabled = true;
        const w = VS.importer.checkWord(st.form);
        const filled = await VS.importer.fillFromDictionary([w]);
        ["definition", "ipa"].forEach((k) => { if (!st.form[k] && w[k]) st.form[k] = w[k]; });
        VS.toast(filled ? "Filled from the dictionary." : "Nothing found — you may be offline, or it's a phrase.");
        VS.app.render();
      },
      "form-add"() {
        const w = VS.importer.checkWord(st.form);
        if (!w.word || !w.arabic) { VS.toast("The word and its Arabic meaning are needed."); return; }
        const iso = st.form.date || st.date;
        VS.store.saveUserWords(iso, [clean(w)]);
        VS.sfx.play("pop");
        VS.toast(`“${w.word}” added to ${VS.day(iso).label}.`);
        st.form = { date: iso, type: w.type, level: w.level };       // keep the set, type and level for the next word
        VS.app.render();
        const first = VS.$("[data-form-field='word']");
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
      async "import-fill"() {
        st.busy = "Looking up…";
        VS.app.render();
        const filled = await VS.importer.fillFromDictionary(st.parsed.rows, (done, total) => {
          st.busy = `Looking up ${done} / ${total}…`;
          const b = VS.$("[data-action='import-fill']");
          if (b) b.lastChild.textContent = " " + st.busy;
        });
        st.busy = "";
        VS.toast(filled ? `Filled ${VS.plural(filled, "word")}.` : "Nothing found — you may be offline.");
        VS.app.render();
      },
      "import-save"() {
        VS.store.saveUserWords(st.date, usable().map(clean));
        st.saved = `Saved to ${VS.day(st.date).label}.`;
        VS.sfx.play("done");
        VS.app.render();
      },

      "files-save"() {
        let words = 0;
        st.files.forEach((f) => {
          const rows = ready(f.rows).map(clean);
          if (rows.length) { VS.store.saveUserWords(f.iso || st.date, rows); words += rows.length; }
        });
        st.saved = `Saved ${VS.plural(words, "word")}.`;
        st.files = [];
        VS.sfx.play("done");
        VS.app.render();
      },
      "files-clear"() { st.files = []; VS.app.render(); },

      "import-export"(el) {
        download(el.dataset.iso + ".js", VS.importer.toDataFile(el.dataset.iso, VS.store.userDays()[el.dataset.iso]));
      },
      "import-delete"(el) {
        const iso = el.dataset.iso;
        if (!confirm("Delete the set of " + iso + " from this device? Your progress on its words is kept if you add them again.")) return;
        VS.store.deleteUserDay(iso);
        location.reload();          // rebuild the word lists without it
      },
    },
  };
})();
