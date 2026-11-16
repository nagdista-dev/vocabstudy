/* views/library.js — the home screen and the brain of the app: your words.
   ------------------------------------------------------------------
   Top to bottom: today's plan (views/home.js), one line to add a word
   (core/autofill.js fills in the rest), then every word you're learning.

   Search English, Arabic, definitions, examples, tags and your notes.
   Filter by status, level, type, memory box, when you added it, how common it is, tag, notes, tricky words,
   sound and usage traps; sort nine ways. Then act on
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
  let stepsRO = null;   // watches the one-row practice scroller for overflow

  const words = () => F.apply(VS.allWords(), f);
  const query = () => F.query(f);
  const pickHref = (mode) => "#/pick/" + mode + (query() ? "?" + query() : "");
  const narrow = () => matchMedia("(max-width: 420px)").matches;

  /* Status has its own chips; the badge on Filters counts only the
     advanced filters hiding in the sheet. */
  const advanced = () => Object.keys(F.DEFAULTS)
    .filter((k) => !["q", "sort", "status"].includes(k) && f[k] && f[k] !== F.DEFAULTS[k]).length;

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

  /* Advanced filters: a sheet, because on a phone a 500px form would push
     the words off the screen. Filters apply to the list underneath while
     it is open; the footer shows how many words match. */
  function panel() {
    const all = VS.allWords();
    const types = [...new Set(all.map((w) => w.type))].sort();
    const levels = [...new Set(all.map((w) => w.level).filter(Boolean))].sort();
    const tags = VS.allTags();
    const n = words().length;
    return html`
      <dialog class="sheet filter-sheet" id="libPanel" aria-labelledby="filtersTitle">
        <div class="sheet-head">
          <h2 id="filtersTitle">Filters</h2>
          <button class="icon-btn" type="button" data-action="lib-panel-close" aria-label="Close filters">${icon("x")}</button>
        </div>
        <div class="sheet-body filter-body">
          <div class="lib-panel-grid">
            ${select("sort", "Sort", Object.entries(F.SORTS))}
            ${select("level", "Level", [["all", "All levels"], ["A", "A1–A2"], ["B", "B1–B2"], ["C", "C1–C2"]].concat(levels.map((l) => [l, l]), [["none", "No level"]]))}
            ${select("type", "Type", [["all", "All types"]].concat(types.map((t) => [t, t])))}
            ${select("box", "Memory", [["all", "Any memory"]].concat(F.BOXES.map((b, i) => [String(i), i ? "Box " + i + " · waits " + b : "Not studied"])))}
            ${select("added", "Added", Object.entries(F.ADDED))}
            ${select("freq", "How common", [["all", "Any"], ["5", "Top 1,000"], ["4", "Top 3,000"], ["3", "Top 6,000"], ["2", "Top 12,000"], ["1", "Uncommon"], ["0", "Rare"]])}
            ${select("tag", "Tag", [["all", "All tags"]].concat(tags.map((t) => [t.tag, "#" + t.tag + " (" + t.count + ")"]), [["none", "No tag"]]))}
          </div>
          <div class="lib-toggles">
            ${toggle("note", "With my notes")}
            ${toggle("tricky", "Tricky words")}
            ${toggle("trap", "Sound traps")}
            ${toggle("usage", "Usage traps")}
          </div>
        </div>
        <div class="sheet-foot filter-foot">
          <button class="btn btn-quiet" type="button" data-action="lib-clear" ${F.active(f) || f.q ? "" : VS.raw("disabled")}>Clear all</button>
          <button class="btn btn-primary" type="button" data-action="lib-panel-done">
            Show <span data-filter-count>${n}</span> <span data-filter-noun>${n === 1 ? "word" : "words"}</span>
          </button>
        </div>
      </dialog>`;
  }

  /* What you can do with the list you're looking at. */
  function actions(list) {
    const n = list.length;
    const started = list.filter((w) => VS.store.status(w.id) !== "new").length;
    const modes = [["cards", "Cards"], ["quiz", "Quiz"], ["spell", "Spell"], ["match", "Match"], ["write", "Use it"]]
      .concat(VS.listen && VS.listen.supported ? [["speak", "Speak"]] : []);
    if (!n) return "";
    return html`
      <div class="lib-actions">
        <details class="lib-more">
          <summary class="btn btn-tonal">${icon("play", "icon-sm")} Practise ${icon("chevron-right", "icon-sm")}</summary>
          <div class="lib-more-menu">
            ${modes.map(([m, l]) => (m === "match" && n < 2) ? "" : html`<a class="btn btn-quiet" href="${pickHref(m)}">${icon(m === "speak" ? "mic" : m === "write" ? "pen" : m, "icon-sm")} ${l}</a>`)}
          </div>
        </details>
        <details class="lib-more">
          <summary class="btn btn-quiet lib-more-btn" aria-label="More actions for this list">${icon("more")}<span class="lib-more-label">More</span></summary>
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
        <p class="lib-count" aria-live="polite"><b>${VS.plural(list.length, "word")}</b>${desc ? html`<span class="lib-desc hint">${desc}</span>` : ""}</p>
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

  /* Status is the everyday filter, so it stays on the page as a single
     scrollable row of chips — not a two-row form. */
  function statusChips(s) {
    const counts = { all: s.total, new: s.new, learning: s.learning, mastered: s.mastered, due: s.due, started: s.started };
    return html`
      <div class="chip-row" role="group" aria-label="Filter by status">
        ${Object.entries(F.STATUS).map(([v, l]) => html`
          <button class="chip" type="button" data-action="lib-status" data-value="${v}" aria-pressed="${f.status === v}"
            ${v !== "all" && !counts[v] ? VS.raw("disabled") : ""}>
            ${l}<span class="chip-n">${counts[v]}</span>
          </button>`)}
      </div>`;
  }

  /* Thursday and Friday: the week's report is ready (core/week.js). */
  function weekReady() {
    const start = VS.week.reportDue();
    if (!start) return "";
    const last = start !== VS.week.range().start;
    return html`
      <div class="recall-strip week-ready">
        <a class="recall-strip-main" href="#/week?start=${start}">
          ${icon("trophy")}
          <span><b>${last ? "Last week's report" : "Your week is ready"}</b>
            <span class="hint">Saturday to Friday: what you did, and one thing for next week.</span></span>
          ${icon("arrow-right", "icon-sm")}
        </a>
      </div>`;
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

  /* One line to add a word. With an empty library the form gets a label
     and a sentence about auto-fill; once there are words it is a quiet
     utility above the library, not the whole first screen. */
  function addBox(compact) {
    return html`
      <form class="quick-add ${compact ? "is-compact" : ""}" data-form="quick-add" autocomplete="off">
        ${compact ? "" : html`<label class="quick-label" for="quickWord">A word you want to remember</label>`}
        <div class="add-line">
          <span class="field field-xl">
            <input id="quickWord" placeholder="${compact ? "Add a word or phrase" : "Type a word or phrase"}"
              aria-label="An English word or phrase you want to remember"
              spellcheck="false" autocapitalize="off" enterkeyhint="done"/>
          </span>
          <button class="btn ${compact ? "btn-tonal" : "btn-primary"} btn-lg" type="submit" aria-label="Add this word">${icon("plus", "icon-sm")}<span class="add-label">Add</span></button>
        </div>
        ${compact ? "" : html`<p class="hint">${VS.autofill.enabled()
          ? "Press Enter — the app adds the meaning, Arabic, example and sound."
          : "Auto-fill is off: add the details in Add words."}
          <a href="#/add">Paste a list or upload a file</a></p>`}
      </form>`;
  }

  /* An empty library: a first-run page, not an empty list. */
  function firstSteps() {
    return html`
      <ol class="first-steps">
        <li><span class="step-n">1</span><span><b>Add a word you met today</b><span class="hint">In a book, a series, at work — anywhere.</span></span></li>
        <li><span class="step-n">2</span><span><b>Learn it once</b><span class="hint">The meaning, the Arabic, an example and the sound.</span></span></li>
        <li><span class="step-n">3</span><span><b>Recall it on spaced days</b><span class="hint">1, 3, 7, 14, 30, 60 — until it stays.</span></span></li>
      </ol>
      <p class="hint first-note">Free and open source. No account, no server: your words stay on this device.
        <a href="about.html" lang="en">About VocabStudy, in Arabic</a></p>`;
  }

  function updateFilterButton() {
    const btn = VS.$('[data-action="lib-panel"]');
    if (!btn) return;
    btn.setAttribute("aria-expanded", String(panelOpen));
    const pill = VS.$("[data-filter-pill]", btn);
    const n = advanced();
    if (pill) { pill.textContent = n; pill.hidden = !n; }
  }

  function updatePanelCount() {
    const num = VS.$("[data-filter-count]");
    const noun = VS.$("[data-filter-noun]");
    if (num) num.textContent = words().length;
    if (noun) noun.textContent = words().length === 1 ? "word" : "words";
  }

  function refreshResults() {
    const box = VS.$("#libResults");
    if (box) box.innerHTML = String(results());
  }

  VS.views.library = {
    title: () => "Your words",
    crumbs: () => [],

    start(p) { f = F.parse(p.query); limit = PAGE; panelOpen = false; },

    render() {
      const s = VS.store.statsFor(VS.allWords());
      const on = advanced();
      if (!s.total) {
        return html`
          <div class="page home-page view-enter">
            <section class="home-empty">
              <p class="today-kicker">Your vocabulary, remembered</p>
              <h1>Start with <mark class="mark">one word</mark>.</h1>
              <p class="home-empty-copy">Type a word you met today. VocabStudy adds the meaning, Arabic, example and sound — then brings it back on the days you're about to forget it.</p>
            </section>
            ${addBox(false)}
            ${firstSteps()}
          </div>`;
      }
      return html`
        <div class="page home-page view-enter">
          ${VS.today.strip()}
          ${weekReady()}
          ${addBox(true)}
          ${backupNudge()}

          <header class="lib-head">
            <h1>Your words</h1>
            <p class="lib-stats"><b>${s.total}</b> words<span aria-hidden="true">·</span><b>${s.learning}</b> learning<span aria-hidden="true">·</span><b>${s.mastered}</b> mastered</p>
          </header>

          <div class="lib-tools">
            <div class="lib-search-row">
              <label class="field">
                ${icon("search", "icon-sm")}
                <span class="sr-only">Search the library</span>
                <input type="search" id="libSearch" value="${f.q}" placeholder="${narrow() ? "Search words or Arabic" : "Search words, Arabic, tags, notes"}" autocomplete="off"
                       aria-label="Search English, Arabic, definitions, examples, tags and your notes"/>
              </label>
              <button class="btn lib-filter-btn" type="button" data-action="lib-panel" aria-expanded="${panelOpen}" aria-controls="libPanel" aria-label="Filters">
                ${icon("settings", "icon-sm")}<span class="lib-filter-label">Filters</span><span class="pill" data-filter-pill ${on ? "" : VS.raw("hidden")}>${on}</span>
              </button>
            </div>
            ${statusChips(s)}
            ${panel()}
          </div>

          <div id="libResults">${results()}</div>
        </div>`;
    },

    mount(root) {
      if (stepsRO) { stepsRO.disconnect(); stepsRO = null; }
      const search = VS.$("#libSearch", root);
      if (search) search.addEventListener("input", () => { f.q = search.value; limit = PAGE; syncAddress(); refreshResults(); });
      const add = VS.$("#quickWord", root);
      if (add) {
        VS.ui.watchKeyboard(add);
        VS.ui.watchDuplicate(add, add.closest(".add-line"));
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
        if (!VS.allWords().length && matchMedia("(hover: hover)").matches) add.focus({ preventScroll: true });
      }
      const addForm = VS.$("[data-form='quick-add']", root);
      if (addForm) addForm.addEventListener("submit", (e) => {
        e.preventDefault();
        // Pasted a sentence? Let the learner tap the words they mean, and keep the sentence.
        if (add.value.trim().split(/\s+/).length >= 5) {
          VS.capture = { text: add.value.trim(), context: "", source: "" };
          location.hash = "#/add?tab=text";
          return;
        }
        const wasEmpty = !VS.allWords().length;
        const w = VS.addWord({ word: add.value });
        if (!w) return;
        VS.toast(`“${w.word}” is in your library.`);
        VS.app.render();
        // On the first word, let the screen settle on today's plan instead
        // of reopening the keyboard over it.
        if (!wasEmpty) {
          const again = VS.$("#quickWord");
          if (again) again.focus();
        }
      });

      /* The practice row is one line. When it overflows, fade its edge so a
         half-visible chip reads as "scroll me", and stop fading at the end. */
      const steps = VS.$(".today-steps", root);
      if (steps) {
        const updateSteps = () => {
          const over = steps.scrollWidth > steps.clientWidth + 1;
          steps.classList.toggle("is-overflow", over);
          steps.classList.toggle("is-end", !over || steps.scrollLeft + steps.clientWidth >= steps.scrollWidth - 2);
        };
        updateSteps();
        steps.addEventListener("scroll", updateSteps, { passive: true });
        requestAnimationFrame(updateSteps);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateSteps).catch(() => {});
        if (window.ResizeObserver) {
          stepsRO = new ResizeObserver(updateSteps);
          stepsRO.observe(steps);
        }
      }

      const panel = VS.$("#libPanel", root);
      if (panel) {
        if (panelOpen && !panel.open) panel.showModal();
        else if (!panelOpen && panel.open) panel.close();
        panel.addEventListener("close", () => {
          panelOpen = false;
          const btn = VS.$('[data-action="lib-panel"]', root);
          if (btn) btn.setAttribute("aria-expanded", "false");
        });
        // A tap on the dimmed backdrop closes the sheet, like every native one.
        panel.addEventListener("click", (e) => { if (e.target === panel) panel.close(); });
      }
    },

    leave() {
      if (stepsRO) { stepsRO.disconnect(); stepsRO = null; }
    },

    actions: {
      "lib-panel"() { panelOpen = true; VS.app.render(); },
      "lib-panel-close"() {
        const p = VS.$("#libPanel");
        if (p && p.open) p.close(); else { panelOpen = false; VS.app.render(); }
      },
      "lib-panel-done"() {
        const p = VS.$("#libPanel");
        if (p && p.open) p.close(); else { panelOpen = false; VS.app.render(); }
      },
      "lib-status"(el) { f.status = el.dataset.value; limit = PAGE; syncAddress(); VS.app.render(); },
      "lib-clear"() { f = F.parse(""); limit = PAGE; panelOpen = false; syncAddress(); VS.app.render(); },
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

  // Selects and checkboxes in the filter sheet (one listener for the app).
  // While the sheet is open, changing a filter updates the list underneath
  // and the live result count — it must not re-render the page and close it.
  document.addEventListener("change", (e) => {
    const name = e.target.dataset && e.target.dataset.filter;
    if (!name || VS.app.current() !== "library") return;
    f[name] = e.target.type === "checkbox" ? (e.target.checked ? "1" : "") : e.target.value;
    limit = PAGE;
    syncAddress();
    const panel = VS.$("#libPanel");
    if (panel && panel.open) {
      refreshResults();
      updateFilterButton();
      updatePanelCount();
    } else {
      VS.app.render();
    }
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
