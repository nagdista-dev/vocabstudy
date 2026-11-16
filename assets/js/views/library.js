/* views/library.js — every word you have, from every day, in one place.
   Search across English, Arabic and your own notes; filter by level and
   memory status; sort A–Z, newest first, or weakest first (the words
   most at risk of being forgotten). The list is the shared word browser. */
(function () {
  "use strict";
  const { html, icon } = VS;

  const browser = new VS.WordBrowser({ id: "lib", words: () => VS.allWords(), showDay: true, sort: "az" });

  VS.views.library = {
    title: () => "Library",
    crumbs: () => [{ label: "Library" }],

    render() {
      const t = VS.store.totals();
      return html`
        <div class="page view-enter">
          <header class="day-head">
            <div>
              <h1>Library</h1>
              <p class="hint">${VS.plural(VS.days.length, "set")}</p>
            </div>
            <dl class="day-stats">
              <div><dt>Words</dt><dd>${t.words}</dd></div>
              <div><dt>Started</dt><dd>${t.started}</dd></div>
              <div><dt>Mastered</dt><dd>${t.mastered}</dd></div>
            </dl>
          </header>
          <div class="row library-actions">
            <a class="btn" href="#/all/quiz">${icon("quiz", "icon-sm")} Quiz everything</a>
            <a class="btn" href="#/add">${icon("plus", "icon-sm")} Add words</a>
            <a class="btn" href="#/print/all">${icon("print", "icon-sm")} Print / PDF</a>
          </div>
          ${browser.markup()}
        </div>`;
    },

    mount(root) { browser.mount(root); },

    keys(e) {
      if (e.key === "/") { e.preventDefault(); browser.focusSearch(); }
    },
  };
})();
