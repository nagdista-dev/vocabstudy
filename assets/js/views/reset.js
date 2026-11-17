/* views/reset.js — "Start over": the one door out of this browser.
   ------------------------------------------------------------------
   A reset is the only action the app cannot undo, so the screen asks
   for two independent signals before it opens the door:

     1. a full backup actually saved from this screen, and
     2. the word RESET typed into the field.

   A backup earlier today is not enough: the learner may have added or
   changed words since. The button stays disabled until both are true,
   and the hint says which one is missing. */
(function () {
  "use strict";
  const { html, icon } = VS;

  let backupSaved = false;   // a fresh backup finished in this visit
  let backupHow = "";        // "saved" (file picker) or "downloaded" (fallback)
  let saving = false;
  let deleting = false;

  const answers = () => VS.store.history().reduce((n, row) => n + row.answered, 0);

  function savedMarkup() {
    return html`${icon("check", "icon-sm")}
      <span class="reset-backup-done">Backup saved.</span>
      <span class="reset-file-name">${VS.backup.fileName()}</span>`;
  }

  function backupMarkup() {
    if (saving) return html`<span class="reset-state">Opening the save dialog…</span>`;
    if (backupSaved) return savedMarkup();
    return html`<span class="reset-file-name">${VS.backup.fileName()}</span>
      <span class="reset-state">No backup saved yet.</span>`;
  }

  function hintFor(typed) {
    if (backupSaved && typed) return "Ready. This clears the words, notes, answers and settings on this device.";
    if (!backupSaved && typed) return "The word matches. Save a backup first to unlock the button.";
    if (backupSaved) return "Now type RESET to unlock the button.";
    return "Save a backup first, then type RESET.";
  }

  VS.views.reset = {
    title: () => "Start over",
    crumbs: () => [{ label: "Start over" }],

    start() {
      backupSaved = false;
      backupHow = "";
      saving = false;
      deleting = false;
    },

    render() {
      const words = VS.allWords().length;
      const notes = Object.keys(VS.store.notesAll()).length;
      return html`
        <div class="page reset-page view-enter">
          <header class="page-head reset-head"><div>
            <h1>Start over</h1>
            <p class="reset-lede">Erase this browser and go back to the first day.</p>
          </div></header>

          <section class="card reset-ledger" aria-labelledby="reset-ledger-title">
            <h2 id="reset-ledger-title">On this device</h2>
            <dl>
              <div><dt>Words</dt><dd>${words}</dd></div>
              <div><dt>Notes</dt><dd>${notes}</dd></div>
              <div><dt>Answers</dt><dd>${answers()}</dd></div>
              <div><dt>Settings</dt><dd>Back to default</dd></div>
            </dl>
            <p class="reset-keep">${icon("check", "icon-sm")} The app stays. Restore this file any time from Backup &amp; export.</p>
          </section>

          <section class="card reset-panel">
            <div class="reset-step">
              <div class="reset-step-head">
                <span class="step-n" aria-hidden="true">1</span>
                <div>
                  <h2>Save a backup first</h2>
                  <p>There is no copy on a server. This file has every word, note and answer, and the reset stays locked until it is saved.</p>
                </div>
              </div>
              <div class="reset-backup">
                <button class="btn btn-primary" type="button" data-action="reset-backup" id="resetBackupBtn">Save backup</button>
                <div class="reset-backup-status" id="resetBackupStatus" role="status" aria-live="polite">${backupMarkup()}</div>
              </div>
            </div>

            <div class="reset-step reset-step-danger">
              <div class="reset-step-head">
                <span class="step-n" aria-hidden="true">2</span>
                <div>
                  <h2>Confirm the reset</h2>
                  <p>This removes everything in the list above from this browser. It cannot be undone here.</p>
                </div>
              </div>
              <div class="reset-confirm">
                <label class="reset-label" for="resetWord">Type <b>RESET</b></label>
                <input class="reset-word" id="resetWord" name="resetWord" type="text" inputmode="text"
                  autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false"
                  aria-describedby="resetHint">
              </div>
              <p class="hint reset-hint" id="resetHint" aria-live="polite">${hintFor(false)}</p>
              <div class="reset-actions">
                <a class="btn reset-cancel" href="#/words">Keep my words</a>
                <button class="btn btn-danger" type="button" data-action="reset-all" id="resetBtn" aria-describedby="resetHint" disabled>Delete everything</button>
              </div>
            </div>
          </section>
        </div>`;
    },

    mount(root) {
      const input = VS.$("#resetWord", root);
      const btn = VS.$("#resetBtn", root);
      const hintEl = VS.$("#resetHint", root);
      const sync = () => {
        const typed = input.value.trim().toUpperCase() === "RESET";
        btn.disabled = !(backupSaved && typed);
        const hint = hintFor(typed);
        if (hintEl.textContent !== hint) hintEl.textContent = hint;
        input.closest(".reset-confirm").classList.toggle("is-matched", typed);
      };
      input.addEventListener("input", sync);
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();                 // the typed word unlocks; the button is the deliberate act
      });
      sync();
    },

    actions: {
      "reset-backup"(el) {
        if (saving) return;
        saving = true;
        el.disabled = true;
        const label = el.textContent;
        el.textContent = "Saving…";
        const status = VS.$("#resetBackupStatus");
        status.innerHTML = String(html`<span class="reset-state">Opening the save dialog…</span>`);
        VS.backup.save().then((how) => {
          saving = false;
          backupSaved = true;
          backupHow = how;
          el.disabled = false;
          el.textContent = "Save another copy";
          status.innerHTML = String(savedMarkup());
          VS.toast(how === "saved" ? "Backup saved." : "Backup saved to your downloads.");
          const input = VS.$("#resetWord");
          if (input) input.dispatchEvent(new Event("input"));
        }).catch((err) => {
          saving = false;
          el.disabled = false;
          el.textContent = backupSaved ? "Save another copy" : label;
          if (backupSaved) {
            status.innerHTML = String(savedMarkup());
            if (!(err && err.name === "AbortError")) VS.toast(VS.backup.errorText(err));
            return;
          }
          status.innerHTML = err && err.name === "AbortError"
            ? String(html`<span class="reset-state">No backup saved. Nothing was deleted.</span>`)
            : String(html`<span class="reset-state">${VS.backup.errorText(err)}</span>`);
        });
      },

      "reset-all"(el) {
        if (deleting || !backupSaved) return;
        const input = VS.$("#resetWord");
        if (!input || input.value.trim().toUpperCase() !== "RESET") return;
        deleting = true;
        el.disabled = true;
        el.textContent = "Deleting…";
        VS.speech.stop();
        VS.store.startOver();
        VS.capture = null;
        VS.app.applySettings();
        VS.toast(backupHow === "downloaded"
          ? "A clean start. Your backup is in your downloads."
          : "A clean start. Your backup is where you saved it.");
        location.replace("#/");
      },
    },
  };
})();
