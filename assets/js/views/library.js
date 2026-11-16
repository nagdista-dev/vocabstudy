/* views/library.js — the brain of the app: every word you're learning.
   ------------------------------------------------------------------
   Search English, Arabic, definitions, examples, tags and your notes.
   Filter by status, level, type, memory box, when you added it, source,
   tag, notes, tricky words and sound traps; sort eight ways. Then act on
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
    const levels = [...new Set(all.map((w) => w.level))].sort();
    const tags = VS.allTags();
    const hasStarter = all.some((w) => !w.custom);
    return html`
      <div class="lib-panel" id="libPanel" ${panelOpen ? "" : VS.raw("hidden")}>
        <div class="lib-panel-grid">
          ${select("level", "Level", [["all", "All levels"], ["A", "A1–A2"], ["B", "B1–B2"], ["C", "C1–C2"]].concat(levels.map((l) => [l, l])))}
          ${select("type", "Type", [["all", "All types"]].concat(types.map((t) => [t, t])))}
          ${select("box", "Memory", [["all", "Any memory"]].concat(F.BOXES.map((b, i) => [String(i), i ? "Box " + i + " · waits " + b : "Not studied"])))}
          ${select("added", "Added", Object.entries(F.ADDED))}
          ${select("tag", "Tag", [["all", "All tags"]].concat(tags.map((t) => [t.tag, "#" + t.tag + " (" + t.count + ")"]), [["none", "No tag"]]))}
          ${hasStarter ? select("source", "Words", Object.entries(F.SOURCE)) : ""}
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
    const mine = list.filter((w) => w.custom).length;
    const started = list.filter((w) => VS.store.status(w.id) !== "new").length;
    const modes = [["cards", "Cards"], ["quiz", "Quiz"], ["spell", "Spell"], ["match", "Match"]]
      .concat(VS.listen && VS.listen.supported ? [["speak", "Speak"]] : []);
    if (!n) return "";
    return html`
      <div class="lib-actions">
        <span class="hint">Practise ${n === VS.allWords().length ? "all" : "these"}:</span>
        ${modes.map(([m, l]) => (m === "match" && n < 2) ? "" : html`<a class="btn" href="${pickHref(m)}">${icon(m === "speak" ? "mic" : m, "icon-sm")} ${l}</a>`)}
        <details class="lib-more">
          <summary class="btn btn-quiet">More ${icon("chevron-right", "icon-sm")}</summary>
          <div class="lib-more-menu">
            <a class="btn btn-quiet" href="#/print/pick${query() ? "?" + query() : ""}">${icon("print", "icon-sm")} Print or PDF</a>
            <button class="btn btn-quiet" type="button" data-action="lib-export">${icon("book", "icon-sm")} Export CSV</button>
            ${started ? html`<button class="btn btn-quiet" type="button" data-action="lib-reset">${icon("review", "icon-sm")} Reset progress</button>` : ""}
            ${mine ? html`<button class="btn btn-quiet danger" type="button" data-action="lib-delete">${icon("x", "icon-sm")} Delete ${mine === n ? VS.plural(mine, "word") : mine + " of mine"}</button>` : ""}
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

  function refreshResults() {
    const box = VS.$("#libResults");
    if (box) box.innerHTML = String(results());
  }

  VS.views.library = {
    title: () => "Library",
    crumbs: () => [{ label: "Library" }],

    start(p) { f = F.parse(p.query); limit = PAGE; if (F.active(f)) panelOpen = true; },

    render() {
      const s = VS.store.statsFor(VS.allWords());
      const on = F.active(f);
      return html`
        <div class="page view-enter">
          <header class="page-head">
            <div>
              <h1>Library</h1>
              <p class="hint">Every word you're learning, in one place.${VS.allTags().length ? " " + VS.plural(VS.allTags().length, "tag") + "." : ""}</p>
            </div>
            <dl class="head-stats">
              <div><dt>Words</dt><dd>${s.total}</dd></div>
              <div><dt>Learning</dt><dd>${s.learning}</dd></div>
              <div><dt>Mastered</dt><dd>${s.mastered}</dd></div>
              <div><dt>Due</dt><dd>${s.due}</dd></div>
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
              <a class="btn btn-primary lib-add" href="#/add">${icon("plus", "icon-sm")} Add</a>
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
      search.addEventListener("input", () => { f.q = search.value; limit = PAGE; syncAddress(); refreshResults(); });
    },

    actions: {
      "lib-panel"() { panelOpen = !panelOpen; VS.app.render(); },
      "lib-status"(el) { f.status = el.dataset.value; limit = PAGE; syncAddress(); VS.app.render(); },
      "lib-clear"() { f = F.parse(""); limit = PAGE; syncAddress(); VS.app.render(); },
      "lib-more"() { limit += PAGE; refreshResults(); },
      "lib-export"() { VS.exportCSV(words(), query() ? "list" : "library"); },
      "lib-reset"() {
        const ids = words().filter((w) => VS.store.status(w.id) !== "new").map((w) => w.id);
        if (!confirm(`Start ${VS.plural(ids.length, "word")} over? Their recall schedule goes back to new. Notes are kept.`)) return;
        VS.store.resetWords(ids);
        VS.toast("Progress reset for " + VS.plural(ids.length, "word") + ".");
        VS.app.render();
      },
      "lib-delete"() {
        const ids = words().filter((w) => w.custom).map((w) => w.id);
        if (!confirm(`Delete ${VS.plural(ids.length, "word")} from your library? Their progress and notes go too. This can't be undone.`)) return;
        VS.store.deleteUserWords(ids);
        VS.toast(VS.plural(ids.length, "word") + " deleted.");
        VS.app.render();
      },
    },

    keys(e) {
      if (e.key === "/") { e.preventDefault(); VS.$("#libSearch").focus(); }
    },
  };

  // Selects and checkboxes in the filter panel (one listener for the app).
  document.addEventListener("change", (e) => {
    const name = e.target.dataset && e.target.dataset.filter;
    if (!name || VS.app.current() !== "library") return;
    f[name] = e.target.type === "checkbox" ? (e.target.checked ? "1" : "") : e.target.value;
    limit = PAGE;
    syncAddress();
    VS.app.render();
  });
})();
