/* core/backup.js — the full backup, saved the same way from every screen.
   ------------------------------------------------------------------
   A backup is the only copy of a learner's words that leaves this
   browser. "Backup & export" and "Start over" both go through here so
   the file name, the contents and the moment we call it saved can
   never drift apart.

   Chrome and Edge open the system save dialog. Browsers without it get
   a normal download. Cancelling the dialog rejects with AbortError and
   is deliberately not treated as a save. */
(function () {
  "use strict";

  function download(name, text, type) {
    const blob = new Blob([type === "text/csv" ? "\ufeff" + text : text], { type: type + ";charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /** The full backup, indented so it stays readable if opened by hand. */
  function text() {
    return JSON.stringify(JSON.parse(VS.store.exportJSON()), null, 2);
  }

  function fileName() {
    return "vocabstudy-backup-" + VS.todayKey() + ".json";
  }

  /**
   * Save the backup where the learner chooses.
   * Resolves "saved" (file picker) or "downloaded" (fallback).
   * Rejects with AbortError when the learner closes the dialog.
   */
  async function save() {
    const name = fileName();
    if (typeof window.showSaveFilePicker !== "function") {
      download(name, text(), "application/json");
      VS.store.markBackup();
      return "downloaded";
    }
    let handle;
    try {
      // Open the dialog before any other async work: showSaveFilePicker
      // needs the click's activation, and a learner who cancels pays nothing.
      handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: "VocabStudy backup", accept: { "application/json": [".json"] } }],
      });
    } catch (err) {
      // A page that cannot show the picker (a framed or restricted context)
      // still gets its backup through a normal download.
      if (err && err.name === "SecurityError") {
        download(name, text(), "application/json");
        VS.store.markBackup();
        return "downloaded";
      }
      throw err;
    }
    const body = text();
    const writable = await handle.createWritable();
    try {
      await writable.write(body);
      await writable.close();
    } catch (err) {
      try { await writable.abort(); } catch (ignore) { /* already closed */ }
      throw err;
    }
    VS.store.markBackup();
    return "saved";
  }

  function errorText(err) {
    if (err && err.name === "NotAllowedError") return "Saving was blocked. Try again, or choose a different folder.";
    if (err && err.name === "QuotaExceededError") return "There isn't enough space to save the backup.";
    return "Couldn't save the backup. Try again.";
  }

  VS.backup = { text, save, errorText, fileName };
})();
