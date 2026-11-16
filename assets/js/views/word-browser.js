/* views/word-browser.js — a searchable, filterable word list.
   ------------------------------------------------------------------
   One component, used by the day page (that day's words) and by the
   Library (every word). Each owner creates its own instance, so their
   filters don't affect each other:

       const browser = new VS.WordBrowser({ id: "lib", words: () => VS.allWords(), showDay: true });
       browser.markup()      → the toolbar + list (put it in render)
       browser.mount(root)   → wires the search box (call in mount)
       Its buttons work by themselves: "wb-filter" and "wb-more" are
       global actions (VS.actions), and data-wb names the browser clicked.

   Large lists render 60 rows at a time with "Show more", so a library
   of thousands of words stays fast.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;
  const PAGE = 60;

  const SORTS = {
    newest: (a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.word.localeCompare(b.word)),
    az: (a, b) => a.word.localeCompare(b.word),
    weakest: (a, b) => strength(a) - strength(b),
  };
  // Lower = weaker memory: wrong answers pull it down, the box pushes it up.
  function strength(w) {
    const e = VS.store.word(w.id);
    return e.box * 2 - e.wrong + (e.box === 0 ? 100 : 0);   // unstudied words last
  }

  class WordBrowser {
    constructor({ id, words, showDay = false, sort = "az" }) {
      this.id = id;
      this.words = words;
      this.showDay = showDay;
      this.f = { q: "", level: "all", status: "all", sort };
      this.limit = PAGE;
      WordBrowser.all[id] = this;
    }

    /** The instance a clicked control belongs to (its toolbar/list carry data-wb). */
    static from(el) { return WordBrowser.all[el.closest("[data-wb]").dataset.wb]; }

    filtered() {
      const { q, level, status, sort } = this.f;
      const query = q.trim().toLowerCase();
      return this.words()
        .filter((w) => {
          if (level !== "all" && w.level.charAt(0) !== level) return false;
          if (status === "due" ? !VS.store.isDue(w.id) : status !== "all" && VS.store.status(w.id) !== status) return false;
          if (!query) return true;
          return (w.word + " " + w.sense + " " + w.arabic + " " + w.definition + " " + VS.store.note(w.id)).toLowerCase().includes(query);
        })
        .sort(SORTS[sort] || SORTS.az);
    }

    seg(name, options) {
      return html`
        <div class="seg" role="group" aria-label="${name}">
          ${options.map(([value, label]) => html`
            <button type="button" data-action="wb-filter" data-name="${name}" data-value="${value}"
                    aria-pressed="${this.f[name] === value}">${label}</button>`)}
        </div>`;
    }

    listMarkup() {
      const words = this.filtered();
      if (!words.length) return html`<div class="empty"><h2>No words match</h2><p>Try another search or clear the filters.</p></div>`;
      const shown = words.slice(0, this.limit);
      return html`
        ${shown.map((w) => VS.ui.wordRow(w, this.showDay))}
        ${words.length > shown.length
          ? html`<button class="btn btn-block" type="button" data-action="wb-more">
              Show ${Math.min(PAGE, words.length - shown.length)} more <span class="hint">· ${words.length - shown.length} left</span></button>`
          : ""}`;
    }

    markup() {
      const levels = [...new Set(this.words().map((w) => w.level.charAt(0)))].sort();
      return html`
        <div class="word-tools" data-wb="${this.id}">
          <label class="field">
            ${icon("search", "icon-sm")}
            <span class="sr-only">Search words</span>
            <input type="search" data-wb-search placeholder="Search words, Arabic, notes" aria-label="Search English words, Arabic meanings or your notes" value="${this.f.q}" autocomplete="off"/>
          </label>
          ${this.seg("level", [["all", "All levels"]].concat(levels.map((l) => [l, l + "1–" + l + "2"])))}
          ${this.seg("status", [["all", "All"], ["new", "New"], ["learning", "Learning"], ["mastered", "Mastered"], ["due", "Due"]])}
          ${this.showDay ? this.seg("sort", [["az", "A–Z"], ["newest", "Newest"], ["weakest", "Weakest"]]) : ""}
        </div>
        <p class="hint word-count" data-wb-count aria-live="polite"></p>
        <div class="word-list" data-wb="${this.id}" data-wb-list>${this.listMarkup()}</div>`;
    }

    mount(root) {
      this.root = root;
      const input = VS.$("[data-wb-search]", root);
      input.addEventListener("input", () => { this.f.q = input.value; this.limit = PAGE; this.refresh(); });
      this.refresh();
    }

    set(name, value) {
      this.f[name] = value;
      this.limit = PAGE;
      VS.$$(`[data-action="wb-filter"][data-name="${name}"]`, this.root)
        .forEach((b) => b.setAttribute("aria-pressed", b.dataset.value === value));
      this.refresh();
    }

    refresh() {
      if (!this.root) return;
      VS.$("[data-wb-list]", this.root).innerHTML = String(this.listMarkup());
      VS.$("[data-wb-count]", this.root).textContent = VS.plural(this.filtered().length, "word");
    }

    focusSearch() { const i = this.root && VS.$("[data-wb-search]", this.root); if (i) i.focus(); }
  }

  WordBrowser.all = {};
  VS.WordBrowser = WordBrowser;

  // Two actions serve every browser on every screen. data-wb says which one was clicked.
  VS.actions = VS.actions || {};
  VS.actions["wb-filter"] = (el) => WordBrowser.from(el).set(el.dataset.name, el.dataset.value);
  VS.actions["wb-more"] = (el) => { const b = WordBrowser.from(el); b.limit += PAGE; b.refresh(); };
})();
