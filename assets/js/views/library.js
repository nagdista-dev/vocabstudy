/* views/library.js — the home screen and the brain of the app: your words.
   ------------------------------------------------------------------
   Top to bottom: one box to add a word ("a word you want to remember" —
   the app fills in the rest, core/autofill.js), today's plan
   (views/home.js), then every word you're learning.

   Search English, Arabic, definitions, examples, tags and your notes.
   Filter by status, level, type, memory box, when you added it, tag, notes, tricky words and sound traps; sort eight ways. Then act on
   exactly that list: practise it, print it, export it, reset it, or
   delete it.

   The filters live in the address (#/words?status=learning&tag=IELTS),
   via core/filters.js — so a list can be bookmarked, and every activity
   started from here works on the same words (#/pick/quiz?…).
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;
  const PAGE = 60;
  const F = VS.filters;

  let f = F.parse("");
  let limit = PAGE;
  let panelOpen = false;

  const words = () => F.apply(VS.allWords(), f);
  const query = () => F.query(f);
  const pickHref = (mode) => "#/pick/" + mode + (query() ? "?" + query() : "");

  /** Keep the address in step with the filters, without a new history entry. */
  function syncAddress() {
    const q = query();
    history.replaceState(null, "", "#/words" + (q ? "?" + q : ""));
  }

  function select(name, label, options) {
    return html`<label class="form-field"><span>${label}</span>
      <select data-filter="${name}">${options.map(([v, l]) => html`<option value="${v}" ${f[name] === v ? VS.raw("selected") : ""}>${l}</option>`)}</select></label>`;
  }
  function toggle(name, label) {
    return html`<label class="check"><input type="checkbox" data-filter="${name}" ${f[name] ? VS.raw("checked") : ""}><span>${label}</span></label>`;
  }

  function panel() {
    const all = VS.allWords();
    const types = [...new Set(all.map((w) => w.type))].sort();
    const levels = [...new Set(all.map((w) => w.level).filter(Boolean))].sort();
    const tags = VS.allTags();
    return html`
      <div class="lib-panel" id="libPanel" ${panelOpen ? "" : VS.raw("hidden")}>
        <div class="lib-panel-grid">
          ${select("level", "Level", [["all", "All levels"], ["A", "A1–A2"], ["B", "B1–B2"], ["C", "C1–C2"]].concat(levels.map((l) => [l, l]), [["none", "No level"]]))}
          ${select("type", "Type", [["all", "All types"]].concat(types.map((t) => [t, t])))}
          ${select("box", "Memory", [["all", "Any memory"]].concat(F.BOXES.map((b, i) => [String(i), i ? "Box " + i + " · waits " + b : "Not studied"])))}
          ${select("added", "Added", Object.entries(F.ADDED))}
          ${select("tag", "Tag", [["all", "All tags"]].concat(tags.map((t) => [t.tag, "#" + t.tag + " (" + t.count + ")"]), [["none", "No tag"]]))}
        </div>
        <div class="row lib-toggles">
          ${toggle("note", "With my notes")}
          ${toggle("tricky", "Tricky words")}
          ${toggle("trap", "Sound traps")}
          <button class="btn btn-quiet" type="button" data-action="lib-clear" ${F.active(f) || f.q ? "" : VS.raw("disabled")}>Clear filters</button>
        </div>
      </div>`;
  }

  /* What you can do with the list you're looking at. */
  function actions(list) {
    const n = list.length;
    const started = list.filter((w) => VS.store.status(w.id) !== "new").length;
    const modes = [["cards", "Cards"], ["quiz", "Quiz"], ["spell", "Spell"], ["match", "Match"]]
      .concat(VS.listen && VS.listen.supported ? [["speak", "Speak"]] : []);
    if (!n) return "";
    return html`
      <div class="lib-actions">
        <details class="lib-more">
          <summary class="btn">Practise ${n === VS.allWords().length ? "all" : "these " + n} ${icon("chevron-right", "icon-sm")}</summary>
          <div class="lib-more-menu">
            ${modes.map(([m, l]) => (m === "match" && n < 2) ? "" : html`<a class="btn btn-quiet" href="${pickHref(m)}">${icon(m === "speak" ? "mic" : m, "icon-sm")} ${l}</a>`)}
          </div>
        </details>
        <details class="lib-more">
          <summary class="btn btn-quiet">More ${icon("chevron-right", "icon-sm")}</summary>
          <div class="lib-more-menu">
            <a class="btn btn-quiet" href="#/print/pick${query() ? "?" + query() : ""}">${icon("print", "icon-sm")} Print or PDF</a>
            <button class="btn btn-quiet" type="button" data-action="lib-export">${icon("book", "icon-sm")} Export CSV</button>
            ${started ? html`<button class="btn btn-quiet" type="button" data-action="lib-reset">${icon("review", "icon-sm")} Reset progress</button>` : ""}
            <button class="btn btn-quiet danger" type="button" data-action="lib-delete">${icon("x", "icon-sm")} Delete ${VS.plural(n, "word")}</button>
          </div>
        </details>
      </div>`;
  }

  function results() {
    const list = words();
    const desc = F.describe(f);
    const shown = list.slice(0, limit);
    return html`
      <div class="lib-bar">
        <p aria-live="polite"><b>${VS.plural(list.length, "word")}</b>${desc ? html` <span class="hint">· ${desc}</span>` : ""}</p>
        ${actions(list)}
      </div>
      ${list.length
        ? html`<div class="word-list">
            ${shown.map((w) => VS.ui.wordRow(w))}
            ${list.length > shown.length
              ? html`<button class="btn btn-block" type="button" data-action="lib-more">
                  Show ${Math.min(PAGE, list.length - shown.length)} more <span class="hint">· ${list.length - shown.length} left</span></button>`
              : ""}
          </div>`
        : html`<div class="empty"><h2>No words match</h2>
            <p>${VS.allWords().length ? "Try another search or clear the filters." : "Your library is empty."}</p>
            ${VS.allWords().length ? html`<button class="btn" type="button" data-action="lib-clear">Clear filters</button>`
              : html`<a class="btn btn-primary" href="#/add">${icon("plus")} Add words</a>`}</div>`}`;
  }

  /* Progress lives in this browser: remind once a week to keep a copy.
     Ignore hides the reminder for a week, so it never nags every visit. */
  function backupNudge() {
    const started = VS.store.totals().started;
    if (started < 20) return "";
    const last = VS.store.lastBackup();
    const days = last ? Math.round((new Date(VS.todayKey()) - new Date(last)) / 864e5) : Infinity;
    if (days < 7) return "";
    const ignored = VS.store.backupNudgeIgnored();
    const sinceIgnored = ignored ? Math.round((new Date(VS.todayKey()) - new Date(ignored)) / 864e5) : Infinity;
    if (sinceIgnored < 7) return "";
    return html`
      <div class="recall-strip">
        <a class="recall-strip-main" href="#/data">
          ${icon("review")}
          <span><b>${last ? "Your last backup was " + days + " days ago" : "You haven't backed up your progress yet"}</b>
            <span class="hint">${VS.plural(started, "word")} of progress live only in this browser. One tap saves a copy.</span></span>
          ${icon("arrow-right", "icon-sm")}
        </a>
        <button class="btn btn-quiet recall-strip-ignore" type="button" data-action="backup-ignore" aria-label="Ignore backup reminder">Ignore</button>
      </div>`;
  }

  function addBox() {
    return html`
      <form class="quick-add" data-form="quick-add" autocomplete="off">
        <label class="quick-label" for="quickWord">A word you want to remember</label>
        <div class="add-line">
          <span class="field field-xl"><input id="quickWord" placeholder="Type a word or phrase" aria-label="An English word or phrase you want to remember"
            spellcheck="false" autocapitalize="off" enterkeyhint="done"/></span>
          <button class="btn btn-primary btn-lg" type="submit">${icon("plus", "icon-sm")} Add</button>
        </div>
        <p class="hint">${VS.autofill.enabled()
          ? "Press Enter — the app adds the meaning, Arabic, example and sound."
          : "Auto-fill is off: add the details in Add words."}
          <a href="#/add">Paste a list or upload a file</a></p>
      </form>`;
  }

  /* An empty library: what happens after you add a word. */
  function firstSteps() {
    return html`
      <ol class="first-steps">
        <li><b>Add a word</b> you met today — in a book, a series, at work.</li>
        <li><b>Learn it</b> once: the meaning, the Arabic, an example and the sound.</li>
        <li><b>Recall it</b> on spaced days — 1, 3, 7, 14, 30, 60 — until it stays.</li>
      </ol>
      <p class="hint first-note">Free and open source. No account, no server: your words stay on this device.</p>`;
  }

  function refreshResults() {
    const box = VS.$("#libResults");
    if (box) box.innerHTML = String(results());
  }

  VS.views.library = {
    title: () => "Your words",
    crumbs: () => [],

    start(p) { f = F.parse(p.query); limit = PAGE; if (F.active(f)) panelOpen = true; },

    render() {
      const s = VS.store.statsFor(VS.allWords());
      const on = F.active(f);
      if (!s.total) {
        return html`<div class="page view-enter">${addBox()}${firstSteps()}</div>`;
      }
      return html`
        <div class="page view-enter">
          ${addBox()}
          ${backupNudge()}
          ${VS.today.strip()}

          <header class="lib-head">
            <h1>Your words</h1>
            <dl class="lib-stats">
              <div><dt>words</dt><dd>${s.total}</dd></div>
              <div><dt>learning</dt><dd>${s.learning}</dd></div>
              <div><dt>mastered</dt><dd>${s.mastered}</dd></div>
            </dl>
          </header>

          <div class="lib-tools">
            <div class="lib-search-row">
              <label class="field">
                ${icon("search", "icon-sm")}
                <span class="sr-only">Search the library</span>
                <input type="search" id="libSearch" value="${f.q}" placeholder="Search words, Arabic, tags, notes" autocomplete="off"
                       aria-label="Search English, Arabic, definitions, examples, tags and your notes"/>
              </label>
              <label class="lib-sort"><span class="sr-only">Sort</span>
                <select data-filter="sort">${Object.entries(F.SORTS).map(([v, l]) => html`<option value="${v}" ${f.sort === v ? VS.raw("selected") : ""}>${l}</option>`)}</select>
              </label>
              <button class="btn" type="button" data-action="lib-panel" aria-expanded="${panelOpen}" aria-controls="libPanel">
                ${icon("settings", "icon-sm")} Filters${on ? html` <span class="pill">${on}</span>` : ""}</button>
            </div>
            <div class="seg" role="group" aria-label="Status">
              ${Object.entries(F.STATUS).map(([v, l]) => html`
                <button type="button" data-action="lib-status" data-value="${v}" aria-pressed="${f.status === v}">${l}</button>`)}
            </div>
            ${panel()}
          </div>

          <div id="libResults">${results()}</div>
        </div>`;
    },

    mount(root) {
      const search = VS.$("#libSearch", root);
      if (search) search.addEventListener("input", () => { f.q = search.value; limit = PAGE; syncAddress(); refreshResults(); });
      const add = VS.$("#quickWord", root);
      VS.ui.watchKeyboard(add);
      // The highlighter grows under exactly what you type (canvas measures the text).
      const ctx = document.createElement("canvas").getContext("2d");
      const mark = () => {
        const cs = getComputedStyle(add);
        ctx.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
        const w = add.value ? ctx.measureText(add.value).width + 8 : 0;
        add.style.setProperty("--mark-w", Math.min(w, add.clientWidth) + "px");
        add.style.backgroundPosition = (parseFloat(cs.paddingLeft) - 4) + "px 0";
      };
      add.addEventListener("input", mark);
      VS.$("[data-form='quick-add']", root).addEventListener("submit", (e) => {
        e.preventDefault();
        const w = VS.addWord({ word: add.value });
        if (!w) return;
        VS.toast(`“${w.word}” is in your library.`);
        VS.app.render();
        const again = VS.$("#quickWord");
        if (again) again.focus();
      });
      if (!VS.allWords().length && matchMedia("(hover: hover)").matches) add.focus({ preventScroll: true });
    },

    actions: {
      "lib-panel"() { panelOpen = !panelOpen; VS.app.render(); },
      "lib-status"(el) { f.status = el.dataset.value; limit = PAGE; syncAddress(); VS.app.render(); },
      "lib-clear"() { f = F.parse(""); limit = PAGE; syncAddress(); VS.app.render(); },
      "lib-more"() { limit += PAGE; refreshResults(); },
      "lib-export"() { VS.exportCSV(words(), query() ? "list" : "library"); },
      "backup-ignore"() {
        VS.store.ignoreBackupNudge();
        VS.toast("Backup reminder hidden for a week.");
        VS.app.render();
      },
      "lib-reset"() {
        const ids = words().filter((w) => VS.store.status(w.id) !== "new").map((w) => w.id);
        if (!confirm(`Start ${VS.plural(ids.length, "word")} over? Their recall schedule goes back to new. Notes are kept.`)) return;
        VS.store.resetWords(ids);
        VS.toast("Progress reset for " + VS.plural(ids.length, "word") + ".");
        VS.app.render();
      },
      "lib-delete"() {
        const ids = words().map((w) => w.id);
        if (!confirm(`Delete ${VS.plural(ids.length, "word")} from your library? Their progress and notes go too. This can't be undone.`)) return;
        VS.store.deleteUserWords(ids);
        VS.toast(VS.plural(ids.length, "word") + " deleted.");
        VS.app.render();
      },
    },

    keys(e) {
      if (e.key === "/" && VS.$("#libSearch")) { e.preventDefault(); VS.$("#libSearch").focus(); }
      else if (e.key === "n") { e.preventDefault(); VS.$("#quickWord").focus(); }   // n = new word
    },
  };

  // A word just filled in by auto-fill: show its details in the list.
  VS.autofill.onFill(() => { if (VS.app.current() === "library") refreshResults(); });

  // Selects and checkboxes in the filter panel (one listener for the app).
  document.addEventListener("change", (e) => {
    const name = e.target.dataset && e.target.dataset.filter;
    if (!name || VS.app.current() !== "library") return;
    f[name] = e.target.type === "checkbox" ? (e.target.checked ? "1" : "") : e.target.value;
    limit = PAGE;
    syncAddress();
    VS.app.render();
  });

  /* The two menus in the word list ("Practise" / "More") are <details>
     elements: only one may be open, and a tap anywhere else closes it.
     Without this, opening the second leaves the first floating over the list. */
  document.addEventListener("click", (e) => {
    if (VS.app.current() !== "library") return;
    if (e.target.closest(".lib-more-menu")) {
      const menu = e.target.closest(".lib-more");
      if (menu) menu.open = false;
      return;
    }
    const summary = e.target.closest(".lib-more > summary");
    if (summary) {
      const mine = summary.parentElement;
      VS.$$(".lib-more[open]").forEach((d) => { if (d !== mine) d.open = false; });
      return;
    }
    VS.$$(".lib-more[open]").forEach((d) => { d.open = false; });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || VS.app.current() !== "library") return;
    VS.$$(".lib-more[open]").forEach((d) => { d.open = false; });
  });

  /* Open the menu upwards when the button is near the bottom of a short
     screen (landscape phones), so it never runs under the tab bar. If even
     that side is too short, cap the menu and let it scroll. */
  document.addEventListener("toggle", (e) => {
    const d = e.target;
    if (!d.matches || !d.matches(".lib-more") || !d.open) return;
    const menu = d.querySelector(".lib-more-menu");
    if (!menu) return;
    menu.style.maxHeight = "";
    const head = d.getBoundingClientRect();
    const height = menu.getBoundingClientRect().height;
    const bar = document.querySelector(".app-bar");
    const tabs = document.querySelector(".tab-bar");
    const topEdge = bar ? bar.getBoundingClientRect().bottom : 0;
    const tabBox = tabs ? tabs.getBoundingClientRect() : null;
    const bottomEdge = tabBox && tabBox.height > 0 && tabBox.top < innerHeight ? tabBox.top : innerHeight;
    const roomBelow = bottomEdge - head.bottom - 12;
    const roomAbove = head.top - topEdge - 12;
    const up = height > roomBelow && roomAbove > roomBelow;
    d.classList.toggle("is-up", up);
    const room = up ? roomAbove : roomBelow;
    if (height > room) menu.style.maxHeight = Math.max(48, room) + "px";
  }, true);
})();
