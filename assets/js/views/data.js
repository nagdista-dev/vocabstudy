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
  const COLUMNS = ["word", "sense", "type", "level", "ipa", "definition", "example", "arabic", "tags", "synonyms", "context", "source",
                   "added", "status", "box", "next_recall", "right", "wrong", "note"];
  const exportOpts = { which: "all" };

  const wordsFor = (which) => (which === "studied" ? VS.allWords().filter((w) => VS.store.status(w.id) !== "new") : VS.allWords());

  function rows(words) {
    return words.map((w) => {
      const e = VS.store.word(w.id);
      return [w.word, w.sense, w.type, w.level, w.ipa, w.definition, w.example, w.arabic, w.tags.join(", "),
              w.synonyms.join(", "), w.context, w.source, w.added, VS.store.status(w.id), e.box, e.due, e.right, e.wrong, VS.store.note(w.id)];
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
            <p class="hint">${VS.plural(VS.allWords().length, "word")} · ${VS.plural(notes, "note")} · ${t.started} studied. ${lastBackupText()}</p>
          </div></header>

          <section class="card file-card" aria-labelledby="backup-title">
            <div class="file-head">
              <span class="file-type" aria-hidden="true">JSON</span>
              <div class="file-copy">
                <h2 id="backup-title">Full backup</h2>
                <p class="file-name">${VS.backup.fileName()}</p>
              </div>
              <button class="btn btn-primary" type="button" data-action="data-backup">Export backup</button>
            </div>
            <p class="file-meta">Recall schedule, notes, history and settings — one file, opened on any device.</p>
          </section>

          <section class="card data-list" aria-label="Move and export">
            <div class="data-row">
              <div class="data-row-head">
                <h2>Move to another device</h2>
                <p>Show a moving QR code here, read it on the other device. No internet, no account.</p>
              </div>
              <a class="btn" href="#/transfer">${icon("qr", "icon-sm")} Open QR transfer</a>
            </div>

            <div class="data-row">
              <div class="data-row-head">
                <h2>Restore a backup</h2>
                <p><b>Merge</b> keeps the stronger memory of each word from both; <b>Replace</b> makes this device exactly like the file.</p>
              </div>
              <div class="row data-actions">
                <label class="btn">Merge with this device<input type="file" accept=".json,application/json" data-restore="merge" hidden></label>
                <label class="btn">Replace everything<input type="file" accept=".json,application/json" data-restore="replace" hidden></label>
              </div>
            </div>

            <div class="data-row">
              <div class="data-row-head">
                <h2>Export words</h2>
                <p>A spreadsheet with status, memory box, next recall, right and wrong answers, and your notes.</p>
              </div>
              <div class="row data-actions">
                <div class="seg" role="group" aria-label="Which words">
                  ${[["all", "All words"], ["studied", "Studied"]].map(([v, l]) =>
                    html`<button type="button" data-action="data-which" data-value="${v}" aria-pressed="${exportOpts.which === v}">${l}</button>`)}
                </div>
                <button class="btn" type="button" data-action="data-csv">Download CSV</button>
                <button class="btn btn-quiet" type="button" data-action="data-copy">Copy as table</button>
              </div>
              <p class="hint data-count">${VS.plural(wordsFor(exportOpts.which).length, "word")} · any filtered list can be exported from the <a href="#/words">library</a> too</p>
            </div>
          </section>

          <section class="data-start" aria-labelledby="start-over-title">
            <div>
              <h2 id="start-over-title">Start over</h2>
              <p>Delete every word, note and answer on this device and go back to the first day. You'll save a backup first.</p>
            </div>
            <a class="btn btn-danger-quiet" href="#/reset">Start over…</a>
          </section>

          <p class="hint data-foot">A CSV export can be added back with <a href="#/add">Add words</a> → Upload files.
            Print sheets and PDFs are in the <a href="#/print/all">library print screen</a>.</p>
        </div>`;
    },

    mount(root) {
      VS.$$("[data-restore]", root).forEach((input) => input.addEventListener("change", async () => {
        const file = input.files[0];
        if (!file) return;
        const mode = input.dataset.restore;
        if (mode === "replace") {
          const yes = await VS.confirm({
            title: "Replace everything on this device?",
            body: "Words and progress here that the backup doesn't have will be lost. This can't be undone.",
            confirmLabel: "Replace",
          });
          if (!yes) { input.value = ""; return; }
        }
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
        VS.backup.save().then((how) => {
          VS.toast(how === "saved" ? "Backup saved." : "Backup saved to your downloads.");
          VS.app.render();
        }).catch((err) => {
          el.disabled = false;
          el.textContent = label;
          if (err && err.name === "AbortError") return;     // the learner closed the save dialog
          VS.toast(VS.backup.errorText(err));
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
