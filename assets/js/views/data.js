/* views/data.js — "Backup & export": your data, in your hands.
   ------------------------------------------------------------------
   Everything lives in this browser, so this screen makes it easy to
   keep a copy, move to another device, or take your words elsewhere:

     Full backup (.json)   choose where to save: progress, settings, notes, words
     Restore               replace everything, or merge with this device
     Export words          CSV for Excel / Sheets, with your progress
     Copy as table         tab-separated, ready to paste into a sheet
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;

  // The columns read back by Add words (word … tags), then your progress.
  const COLUMNS = ["word", "sense", "type", "level", "ipa", "definition", "example", "arabic", "tags", "synonyms",
                   "added", "status", "box", "next_recall", "right", "wrong", "note"];
  const exportOpts = { which: "all" };

  const wordsFor = (which) => (which === "studied" ? VS.allWords().filter((w) => VS.store.status(w.id) !== "new") : VS.allWords());

  function rows(words) {
    return words.map((w) => {
      const e = VS.store.word(w.id);
      return [w.word, w.sense, w.type, w.level, w.ipa, w.definition, w.example, w.arabic, w.tags.join(", "),
              w.synonyms.join(", "), w.added, VS.store.status(w.id), e.box, e.due, e.right, e.wrong, VS.store.note(w.id)];
    });
  }

  const csvCell = (v) => { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const tsvCell = (v) => String(v == null ? "" : v).replace(/[\t\n]/g, " ");

  function download(name, text, type) {
    // A BOM makes Excel open the Arabic text as UTF-8.
    const blob = new Blob([type === "text/csv" ? "﻿" + text : text], { type: type + ";charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /** The full backup, indented so it stays readable if opened by hand. */
  function backupText() {
    return JSON.stringify(JSON.parse(VS.store.exportJSON()), null, 2);
  }

  /**
   * Save the backup where the learner chooses. Chrome and Edge open the
   * system save dialog; browsers without it fall back to a normal download.
   * Cancelling the dialog rejects with AbortError — the caller stays quiet.
   */
  async function saveBackup() {
    const name = "backup-" + VS.todayKey() + ".json";
    if (typeof window.showSaveFilePicker !== "function") {
      download(name, backupText(), "application/json");
      return "downloaded";
    }
    let handle;
    try {
      // Open the dialog first: building the JSON must not use up the click.
      handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: "VocabStudy backup", accept: { "application/json": [".json"] } }],
      });
    } catch (err) {
      // A page that cannot show the picker (a framed or restricted context)
      // still gets its backup through a normal download.
      if (err && err.name === "SecurityError") {
        download(name, backupText(), "application/json");
        return "downloaded";
      }
      throw err;
    }
    const text = backupText();
    const writable = await handle.createWritable();
    try {
      await writable.write(text);
      await writable.close();
    } catch (err) {
      try { await writable.abort(); } catch (ignore) {}
      throw err;
    }
    return "saved";
  }

  function saveErrorText(err) {
    if (err && err.name === "NotAllowedError") return "Saving was blocked. Try again, or choose a different folder.";
    if (err && err.name === "QuotaExceededError") return "There isn't enough space to save the backup.";
    return "Couldn't save the backup. Try again.";
  }

  /** Download any list of words as CSV — the library uses it for "Export these". */
  VS.exportCSV = function (words, name) {
    const lines = [COLUMNS.join(",")].concat(rows(words).map((r) => r.map(csvCell).join(",")));
    download("vocabstudy-" + (name || "words") + "-" + VS.todayKey() + ".csv", lines.join("\r\n"), "text/csv");
  };

  function lastBackupText() {
    const last = VS.store.lastBackup();
    if (!last) return "Never backed up on this device.";
    const days = Math.round((new Date(VS.todayKey()) - new Date(last)) / 864e5);
    return "Last backup: " + (days === 0 ? "today" : days === 1 ? "yesterday" : days + " days ago") + ".";
  }

  VS.views.data = {
    title: () => "Backup & export",
    crumbs: () => [{ label: "Backup & export" }],

    render() {
      const t = VS.store.totals();
      const notes = Object.keys(VS.store.notesAll()).length;
      return html`
        <div class="page data-page view-enter">
          <header class="page-head"><div>
            <h1>Backup &amp; export</h1>
            <p class="hint">Everything is saved in this browser only.</p>
          </div></header>

          <section class="card data-card">
            <div class="data-ico">${icon("review")}</div>
            <div>
              <h2>Full backup</h2>
              <p class="muted">One file with everything: your recall schedule for ${VS.plural(t.started, "word")}, ${VS.plural(notes, "note")},
                your ${VS.plural(VS.allWords().length, "word")}, your history and settings. Keep it somewhere safe — or open it on another device.</p>
              <p class="hint">${lastBackupText()}</p>
            </div>
            <div class="row">
              <button class="btn btn-primary" type="button" data-action="data-backup">Export backup</button>
            </div>
          </section>

          <section class="card data-card">
            <div class="data-ico">${icon("arrow-right")}</div>
            <div>
              <h2>Restore a backup</h2>
              <p class="muted"><b>Merge</b> keeps the stronger memory of each word from both this device and the file —
                use it to combine phone and laptop. <b>Replace</b> makes this device exactly like the file.</p>
            </div>
            <div class="row">
              <label class="btn btn-primary">Merge with this device<input type="file" accept=".json,application/json" data-restore="merge" hidden></label>
              <label class="btn">Replace everything<input type="file" accept=".json,application/json" data-restore="replace" hidden></label>
            </div>
          </section>

          <section class="card data-card">
            <div class="data-ico">${icon("book")}</div>
            <div>
              <h2>Export words</h2>
              <p class="muted">A spreadsheet of your words with your progress: status, memory box, next recall date, right and wrong answers and your notes.</p>
              <div class="seg" role="group" aria-label="Which words">
                ${[["all", "All words"], ["studied", "Studied"]].map(([v, l]) =>
                  html`<button type="button" data-action="data-which" data-value="${v}" aria-pressed="${exportOpts.which === v}">${l}</button>`)}
              </div>
              <p class="hint">${VS.plural(wordsFor(exportOpts.which).length, "word")} · any filtered list can be exported from the <a href="#/words">Library</a> too</p>
            </div>
            <div class="row">
              <button class="btn btn-primary" type="button" data-action="data-csv">Download CSV (Excel)</button>
              <button class="btn" type="button" data-action="data-copy">Copy as table</button>
            </div>
          </section>

          <p class="hint data-foot">A CSV export can be added back with <a href="#/add">Add words</a> → Upload files.
            Print sheets and PDFs are in the <a href="#/words">Library</a>.</p>
        </div>`;
    },

    mount(root) {
      VS.$$("[data-restore]", root).forEach((input) => input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;
        const mode = input.dataset.restore;
        if (mode === "replace" && !confirm("Replace everything on this device with the backup? Progress made here since that backup will be lost.")) return;
        file.text().then((text) => {
          const ok = mode === "merge" ? VS.store.mergeJSON(text) : VS.store.importJSON(text);
          if (!ok) { VS.toast("That file is not a VocabStudy backup."); return; }
          VS.toast(mode === "merge" ? "Backup merged." : "Backup restored.");
          setTimeout(() => location.reload(), 600);      // reload so added words and settings apply everywhere
        });
      }));
    },

    actions: {
      "data-backup"(el) {
        const label = el.textContent;
        el.disabled = true;
        el.textContent = "Saving…";
        saveBackup().then((how) => {
          VS.store.markBackup();
          VS.toast(how === "saved" ? "Backup saved." : "Backup saved to your downloads.");
          VS.app.render();
        }).catch((err) => {
          el.disabled = false;
          el.textContent = label;
          if (err && err.name === "AbortError") return;     // the learner closed the save dialog
          VS.toast(saveErrorText(err));
        });
      },
      "data-which"(el) { exportOpts.which = el.dataset.value; VS.app.render(); },
      "data-csv"() { VS.exportCSV(wordsFor(exportOpts.which)); },
      "data-copy"() {
        const lines = [COLUMNS.join("\t")].concat(rows(wordsFor(exportOpts.which)).map((r) => r.map(tsvCell).join("\t")));
        navigator.clipboard.writeText(lines.join("\n"))
          .then(() => VS.toast("Copied — paste it into Google Sheets or Excel."))
          .catch(() => VS.toast("Copying isn't allowed here — use Download CSV."));
      },
    },
  };
})();
