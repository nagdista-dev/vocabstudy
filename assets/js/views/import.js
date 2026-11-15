/* views/import.js — "Add words": paste a table, check it, save it.
   ------------------------------------------------------------------
   1. Paste rows copied from Excel / Google Sheets / Notion (or choose
      a .tsv / .csv / .txt file). core/importer.js reads the columns.
   2. Preview: every row with its status (ready / check / can't use).
      Optional: fill empty definitions and IPA from a free dictionary.
   3. Save to this device (appears at once — works on a phone, no
      tools needed) and/or download data/days/ISO.js to add the set to
      the project permanently (then run tools/build.py).
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;

  const TEMPLATE = ["word\tdefinition\texample\ttype\tlevel\tipa\tarabic",
    "Habit\tSomething you do often, almost without thinking.\tI have a habit of reading before bed.\tNoun\tB1\t/ˈhæbɪt/\tعادة"].join("\n");

  const st = { text: "", date: VS.todayKey(), parsed: null, busy: "", saved: "" };

  const usable = () => (st.parsed ? st.parsed.rows.filter((r) => !r.issues.some((i) => i.kind === "error")) : []);
  const clean = (r) => ({ word: r.word, sense: r.sense, type: r.type, level: r.level, ipa: r.ipa,
                          definition: r.definition, example: r.example, arabic: r.arabic });

  function statusOf(r) {
    if (r.issues.some((i) => i.kind === "error")) return ["bad", "Can't use"];
    if (r.issues.some((i) => i.kind === "warn")) return ["warn", "Check"];
    return ["ok", "Ready"];
  }

  function preview() {
    if (!st.parsed) return "";
    const rows = st.parsed.rows;
    if (!rows.length) return html`<div class="empty"><h2>No rows found</h2><p>Paste at least one line under the header.</p></div>`;
    const ready = rows.filter((r) => statusOf(r)[0] === "ok").length;
    const check = rows.filter((r) => statusOf(r)[0] === "warn").length;
    const bad = rows.length - ready - check;
    const missing = rows.filter((r) => !r.definition || !r.ipa).length;
    const existing = VS.day(st.date);
    return html`
      <section class="card import-step" id="importCheck">
        <h2><span class="step-n">2</span> Check</h2>
        <p class="import-summary">
          <span class="badge is-known">${ready} ready</span>
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
            ${icon("check", "icon-sm")} Save ${VS.plural(usable().length, "word")} to this device</button>
          <button class="btn btn-lg" type="button" data-action="import-download" ${usable().length ? "" : VS.raw("disabled")}>
            Download ${st.date}.js</button>
        </div>
        <p class="hint">Saved words appear right away, also on your phone. To make them part of the project for good,
          put the downloaded file in <code>data/days/</code> and run <code>python3 tools/build.py</code>.</p>
        ${st.saved ? html`<p class="import-done" role="status">${icon("check", "icon-sm")} ${st.saved}</p>` : ""}
      </section>`;
  }

  function myAddedSets() {
    const sets = Object.entries(VS.store.userDays());
    if (!sets.length) return "";
    return html`
      <section class="import-mine">
        <div class="section-title"><h2>Sets you added on this device</h2></div>
        <div class="word-list">
          ${sets.sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([iso, words]) => html`
            <div class="mine-row card">
              <a href="${VS.dayHref(iso)}"><b>${VS.day(iso) ? VS.day(iso).label : iso}</b> <span class="hint">${VS.plural(words.length, "word")} added</span></a>
              <span class="row">
                <button class="btn btn-quiet" type="button" data-action="import-export" data-iso="${iso}">Download .js</button>
                <button class="btn btn-quiet danger" type="button" data-action="import-delete" data-iso="${iso}">Remove</button>
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

  VS.views.import = {
    title: () => "Add words",
    crumbs: () => [{ label: "Add words" }],

    render() {
      return html`
        <div class="page import-page view-enter">
          <header class="day-head"><div>
            <p class="hint">Bring in a new set</p>
            <h1>Add words</h1>
          </div></header>

          <section class="card import-step">
            <h2><span class="step-n">1</span> Paste your words</h2>
            <p class="muted">Copy rows from Excel, Google Sheets or Notion — with the header row — and paste them here.
              Columns can be in any order: <b>word</b>, <b>definition</b>, <b>example</b>, <b>type</b>, <b>level</b>, <b>ipa</b>, <b>arabic</b>.
              Only the word is required; empty cells are fine.</p>
            <textarea id="importText" class="import-text" rows="8" spellcheck="false"
              placeholder="${TEMPLATE}">${st.text}</textarea>
            <div class="row">
              <button class="btn btn-primary" type="button" data-action="import-read">Read the table</button>
              <label class="btn">Choose a file<input type="file" id="importFile2" accept=".tsv,.csv,.txt,text/plain,text/csv" hidden></label>
              <button class="btn btn-quiet" type="button" data-action="import-sample">Show an example</button>
              <a class="btn btn-quiet" href="${VS.homeHref.replace("index.html", "")}data/sample/sample-import.tsv" download>Download a sample table</a>
            </div>
          </section>

          ${preview()}
          ${myAddedSets()}
        </div>`;
    },

    mount(root) {
      const text = VS.$("#importText", root);
      text.addEventListener("input", () => { st.text = text.value; });
      const date = VS.$("#importDate", root);
      if (date) date.addEventListener("change", () => { st.date = date.value || VS.todayKey(); st.saved = ""; VS.app.render(); });
      const file = VS.$("#importFile2", root);
      file.addEventListener("change", () => {
        if (!file.files[0]) return;
        file.files[0].text().then((t) => { st.text = t; VS.views.import.actions["import-read"](); });
      });
    },

    actions: {
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
        const words = usable().map(clean);
        VS.store.saveUserWords(st.date, words);
        st.saved = `Saved to ${VS.day(st.date).label}. `;
        VS.sfx.play("done");
        VS.app.render();
        VS.toast("Words added. Open the set to start studying.");
      },
      "import-download"() {
        download(st.date + ".js", VS.importer.toDataFile(st.date, usable().map(clean)));
      },
      "import-export"(el) {
        download(el.dataset.iso + ".js", VS.importer.toDataFile(el.dataset.iso, VS.store.userDays()[el.dataset.iso]));
      },
      "import-delete"(el) {
        const iso = el.dataset.iso;
        if (!confirm("Remove the words you added for " + iso + " from this device? Your progress on them is kept if you add them again.")) return;
        VS.store.deleteUserDay(iso);
        location.reload();          // rebuild the word lists without them
      },
    },
  };
})();
