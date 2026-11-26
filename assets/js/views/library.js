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
  let page = "today";   // "today" (#/): the plan and a few recent words · "words" (#/words): the whole library
  const RECENT = 5;
  let stepsRO = null;   // watches the one-row practice scroller for overflow

  const words = () => F.apply(VS.allWords(), f);
  const query = () => F.query(f);
  const pickHref = (mode) => "#/pick/" + mode + (query() ? "?" + query() : "");
  const narrow = () => matchMedia("(max-width: 599px)").matches;

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
          <!-- Three steps instead of eleven controls at once: sort, the four everyday
               "show only" choices, then everything else behind one row. -->
          <div class="lib-panel-grid">
            ${select("sort", "Sort", Object.entries(F.SORTS))}
            ${tags.length ? select("tag", "Tag", [["all", "All tags"]].concat(tags.map((t) => [t.tag, "#" + t.tag + " (" + t.count + ")"]), [["none", "No tag"]])) : ""}
          </div>
          <p class="filter-group-title">Show only</p>
          <div class="lib-toggles">
            ${toggle("note", "With my notes")}
            ${toggle("tricky", "Tricky words")}
            ${toggle("trap", "Sound traps")}
            ${toggle("usage", "Usage traps")}
          </div>
          <details class="filter-more" ${["level", "type", "box", "added", "freq"].some((k) => f[k] !== "all") ? VS.raw("open") : ""}>
            <summary>${icon("chevron-right", "icon-sm filter-more-chev")} More filters</summary>
            <div class="lib-panel-grid">
              ${select("box", "Comes back in", [["all", "Any time"]].concat(F.BOXES.map((b, i) => [String(i), i ? b + " (step " + i + " of 6)" : "Not studied yet"])))}
              ${select("added", "Added", Object.entries(F.ADDED))}
              ${select("freq", "How common", [["all", "Any"], ["5", "Top 1,000"], ["4", "Top 3,000"], ["3", "Top 6,000"], ["2", "Top 12,000"], ["1", "Uncommon"], ["0", "Rare"]])}
              ${select("type", "Type", [["all", "All types"]].concat(types.map((t) => [t, t])))}
              ${levels.length ? select("level", "Level", [["all", "All levels"], ["A", "A1–A2"], ["B", "B1–B2"], ["C", "C1–C2"]].concat(levels.map((l) => [l, l]), [["none", "No level"]])) : ""}
            </div>
          </details>
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
    // Each way to practise says what it asks of you, so the choice is quick.
    const modes = [["cards", "Cards", "Flip and recall", "cards"], ["quiz", "Quiz", "Pick the answer", "quiz"],
      ["spell", "Spell", "Hear it, type it", "spell"], ["match", "Match", "Pair them up", "match"], ["write", "Use it", "In a sentence", "pen"]]
      .concat(VS.listen && VS.listen.supported ? [["speak", "Speak", "Say it aloud", "mic"]] : [])
      .filter(([m]) => !(m === "match" && n < 2));
    if (!n) return "";
    return html`
      <div class="lib-actions">
        <details class="lib-more">
          <summary class="btn lib-practise"><span class="lib-play">${icon("play", "icon-sm")}</span>Practise ${icon("chevron-right", "icon-sm lib-chev")}</summary>
          <div class="lib-more-menu lib-modes-menu">
            <p class="lib-menu-head">Practise ${n === 1 ? "this word" : "these " + n + " words"}</p>
            <div class="lib-modes">
              ${modes.map(([m, l, hint, ico]) => html`<a class="lib-mode" href="${pickHref(m)}">
                <span class="lib-mode-ico">${icon(ico, "icon-sm")}</span><b>${l}</b><small>${hint}</small></a>`)}
            </div>
          </div>
        </details>
        <details class="lib-more">
          <summary class="btn lib-more-btn" aria-label="Manage this list">${icon("more")}<span class="lib-more-label">Manage</span></summary>
          <div class="lib-more-menu">
            <p class="lib-menu-head">${VS.plural(n, "word")}</p>
            <a class="btn btn-quiet" href="#/share${query() ? "?" + query() : ""}">${icon("share", "icon-sm")} Share these words</a>
            <a class="btn btn-quiet" href="#/print/pick${query() ? "?" + query() : ""}">${icon("print", "icon-sm")} Print or PDF</a>
            <button class="btn btn-quiet" type="button" data-action="lib-export">${icon("book", "icon-sm")} Export CSV</button>
            <hr class="lib-menu-sep">
            ${started ? html`<button class="btn btn-quiet" type="button" data-action="lib-reset">${icon("review", "icon-sm")} Reset progress</button>` : ""}
            <button class="btn btn-quiet danger" type="button" data-action="lib-delete">${icon("x", "icon-sm")} Delete ${VS.plural(n, "word")}</button>
          </div>
        </details>
      </div>`;
  }

  /* Below five words the home screen stays one step: the plan, the add box and the
     words. Search, status chips, filters and the Practise menu arrive with the fifth. */
  const EARLY = 5;

  function results() {
    const list = words();
    const desc = F.describe(f);
    const shown = list.slice(0, limit);
    // The first few words are a list, not a database: no count bar, no Practise menu (V2.1).
    const early = VS.allWords().length < EARLY;
    return html`
      ${early ? "" : html`<div class="lib-bar">
        <p class="lib-count" aria-live="polite"><b>${VS.plural(list.length, "word")}</b>${desc ? html`<span class="lib-desc hint">${desc}</span>` : ""}</p>
        ${actions(list)}
      </div>`}
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
        ${Object.entries(F.STATUS)
          // An empty status is not a choice: hide it (unless it is the one chosen).
          // "Started" (learning + mastered) overlaps the two chips beside it: it lives in Filters.
          .filter(([v]) => v === "all" || (counts[v] && v !== "started") || f.status === v)
          .map(([v, l]) => html`
          <button class="chip" type="button" data-action="lib-status" data-value="${v}" aria-pressed="${f.status === v}">
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
        <a class="recall-strip-main week-ready-main" href="#/week?start=${start}">
          <span class="week-ready-ico" aria-hidden="true">${icon("trophy")}</span>
          <span class="week-ready-copy"><b>${last ? "Last week's report" : "Your week is ready"}</b>
            <span class="hint">What you did, and one thing for next week.</span></span>
          <span class="week-ready-cta"><span class="week-ready-cta-label">Open your week</span>${icon("arrow-right", "icon-sm")}</span>
        </a>
      </div>`;
  }

  /* Progress lives in this browser: remind once a week to keep a copy.
     Ignore hides the reminder for a week, so it never nags every visit.
     A slim utility row, not a second hero. */
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
      <div class="backup-row">
        <a class="backup-main" href="#/data">
          <span class="backup-ico">${icon("review", "icon-sm")}</span>
          <span class="backup-copy">
            <b>Back up your words</b>
            <span class="hint">${started} ${started === 1 ? "word" : "words"} · ${last ? days + " days ago" : "never backed up"}</span>
          </span>
          ${icon("arrow-right", "icon-sm backup-arrow")}
        </a>
        <button class="icon-btn backup-dismiss" type="button" data-action="backup-ignore" aria-label="Hide backup reminder for a week">${icon("x", "icon-sm")}</button>
      </div>`;
  }

  /* Desktop rail: the week at a glance, Quick 5, and the numbers that keep
     a learner going. Hidden on phones, where the hero already carries them. */
  function rail() {
    const week = VS.week.summary();
    const max = Math.max(1, ...week.days.map((d) => (d.row ? d.row.answered : 0)));
    const hist = VS.store.history();
    const answered = hist.reduce((n, r) => n + r.answered, 0);
    const right = hist.reduce((n, r) => n + r.right, 0);
    const t = VS.store.totals();
    const quickReady = VS.store.quickWords(10).length >= 2;
    return html`
      <aside class="home-rail" aria-label="Your week and progress">
        <section class="rail-card">
          <div class="rail-head"><h2>This week</h2><a href="#/week">Open ${icon("arrow-right", "icon-sm")}</a></div>
          <ol class="rail-days" aria-label="Answers each day this week">
            ${week.days.map((d) => {
              const n = d.row ? d.row.answered : 0;
              const day = new Date(d.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "narrow" });
              return html`<li class="${d.today ? "is-today" : ""} ${d.future ? "is-future" : ""}" title="${n} answers">
                <span class="rail-bar"><i style="height:${n ? Math.max(8, Math.round((n / max) * 100)) : 0}%"></i></span>
                <small>${d.today ? "Today" : day}</small>
              </li>`;
            })}
          </ol>
          <p class="rail-note"><b>${week.answers}</b> answers · <b>${week.studied}</b> ${week.studied === 1 ? "day" : "days"} studied</p>
        </section>
        ${quickReady ? html`
          <a class="rail-quick" href="#/quick">
            <span class="rail-quick-ico">${icon("bolt")}</span>
            <span class="rail-quick-copy"><b>5-minute review</b><small>Your 10 most important words, in five minutes.</small></span>
            ${icon("arrow-right", "icon-sm")}
          </a>` : ""}
        <section class="rail-card">
          <div class="rail-head"><h2>Your progress</h2><a href="#/stats">Details</a></div>
          <dl class="rail-stats">
            <div><dt>Streak</dt><dd>${t.streak} ${t.streak === 1 ? "day" : "days"}</dd></div>
            <div><dt>Mastered</dt><dd>${t.mastered} / ${t.words}</dd></div>
            <div><dt>Accuracy</dt><dd>${VS.accuracyText(right, answered)}</dd></div>
          </dl>
        </section>
      </aside>`;
  }

  /* One line to add a word. On the first run it is the page's one action:
     a numbered label, the field, and the quiet other ways in (Enter, paste,
     upload). Once there are words it becomes a compact utility. */
  function addBox(compact) {
    const kept = compact ? walletWaiting() : 0;
    const walletDest = compact ? VS.store.walletFolderName("general") : "";
    return html`
      <form class="quick-add ${compact ? "is-compact" : "first-add"}" data-form="quick-add"
        data-capture="${compact ? "wallet" : "library"}" autocomplete="off">
        ${compact ? "" : html`
          <label class="quick-label first-label" for="quickWord"><span class="act-n" aria-hidden="true">1</span> A word you met today</label>
          <p class="first-form-where" id="firstWhere">In a book, a series, at work — anywhere.</p>`}
        <div class="add-line">
          <span class="field field-xl">
            <input id="quickWord" dir="auto" placeholder="${compact ? "Save a word or phrase" : "Type a word"}"
              ${compact
                ? VS.raw('aria-label="A word or phrase — English or Arabic — saved to your wallet"')
                : VS.raw('aria-describedby="firstWhere firstHow"')}
              spellcheck="false" autocapitalize="off" enterkeyhint="done"/>
          </span>
          <button class="btn ${compact ? "btn-tonal" : "btn-primary"} btn-lg" type="submit"
            aria-label="${compact ? "Save this word in your wallet" : "Add this word"}">${icon("plus", "icon-sm")}<span class="add-label">${compact ? "Save" : "Add"}</span></button>
        </div>
        ${compact ? html`<p class="quick-wallet">
          <span>English or Arabic · saves to ${walletDest}</span>
          ${kept ? html`<a href="#/wallet">${VS.plural(kept, "word")} in your wallet ${icon("arrow-right", "icon-sm")}</a>` : ""}
        </p>` : html`<p class="first-form-how" id="firstHow">${VS.autofill.enabled()
          ? html`<span class="first-how-key">Press Add — or </span><span class="first-how-touch">Or </span><a href="#/add">paste a list or upload a file</a>.`
          : html`Auto-fill is off — <a href="#/add">add the details in Add words</a>.`}</p>`}
      </form>`;
  }

  /** Words held in the wallet that are not library words yet. */
  function walletWaiting() {
    return VS.store.wallet().filter((e) => !VS.findWord(e.word)).length;
  }

  /* The example card: what one typed word becomes. The promise is shown,
     not described — meaning, Arabic, example and sound, in the same shape
     as a real word page. */
  function firstCard() {
    return html`
      <div class="first-card" role="group" aria-label="Example card for the word resilient">
        <div class="first-card-head">
          <div class="first-card-word">
            <h3 class="first-card-hw"><mark class="mark">resilient</mark></h3>
            <p class="first-card-meta"><span class="ipa">/rɪˈzɪliənt/</span><span class="first-card-dot" aria-hidden="true">·</span>Adjective</p>
          </div>
          <div class="first-card-side">
            <div class="first-card-translation">
              <p class="first-card-ar-label">Translation</p>
              <p class="first-card-ar" lang="ar" dir="rtl">صامد - مرن</p>
            </div>
            ${VS.speech.supported ? VS.ui.speakButton("resilient", "Hear resilient") : ""}
          </div>
        </div>
        <p class="first-card-def">Able to recover quickly from difficulties.</p>
        <p class="first-card-ex">“Children are often more <mark class="mark">resilient</mark> than we expect.”</p>
      </div>`;
  }

  /* Step three: the six days, drawn as a ruler rather than described. */
  function firstRecall() {
    return html`
      <section class="first-recall" aria-labelledby="first-recall-title">
        <div class="first-recall-copy">
          <h2 class="first-h2" id="first-recall-title"><span class="act-n" aria-hidden="true">3</span> Recall it on spaced days</h2>
          <p class="first-recall-until">Until it stays.</p>
        </div>
        <div class="first-recall-days">
          <p class="first-recall-label">Days after you learn it</p>
          <ol class="recall-days" aria-label="Recall days after learning">
            ${[1, 3, 7, 14, 30, 60].map((day) => html`<li><span class="sr-only">Day </span><b>${day}</b></li>`)}
          </ol>
        </div>
      </section>`;
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
    title: () => (!VS.allWords().length ? "Start with one word" : page === "words" ? "Your words" : "Today"),
    crumbs: () => [],           // Today and Words are main tabs: the nav already says where you are

    start(p) { f = F.parse(p.query); limit = PAGE; panelOpen = false; page = p.words ? "words" : "today"; },

    render() {
      const s = VS.store.statsFor(VS.allWords());
      const on = advanced();
      if (!s.total) {
        return html`
          <div class="page home-page first-run view-enter">
            <div class="first-hero">
              <figure class="desk-photo photo-ribbon">
                <img src="assets/img/desk-writing.webp" width="1400" height="933" fetchpriority="high" decoding="async"
                  alt="A learner writing an English sentence in a notebook, beside a cup of coffee.">
                <figcaption><b>The desk, most days.</b> A word you meet, a page that keeps it.</figcaption>
              </figure>
              <div class="first-copy">
                <h1 class="first-title">Start with <mark class="mark">one word</mark>.</h1>
                <p class="first-lede">Type a word you met today. VocabStudy adds the meaning, Arabic, example and sound — then brings it back on the days you're about to forget it.</p>
                ${addBox(false)}
              </div>
              <section class="first-learn" aria-labelledby="first-learn-title">
                <h2 class="first-h2" id="first-learn-title"><span class="act-n" aria-hidden="true">2</span> Learn it once</h2>
                <p class="hint first-learn-hint">This is the card you'll get — the meaning, the Arabic, an example and the sound.</p>
                ${firstCard()}
              </section>
            </div>
            ${firstRecall()}
            <footer class="first-foot">
              <div class="first-foot-brand">
                ${VS.brandMark}
                <span class="first-foot-name">VocabStudy</span>
              </div>
              <div class="first-foot-copy">
                <p>Free and open source. No account, no server: <b>your words stay on this device</b>.</p>
                <p class="first-credit">Made by ${VS.credit.link()}.</p>
              </div>
              <a class="first-foot-about" href="about.html" hreflang="ar" lang="ar" dir="rtl">اقرأ عن التطبيق بالعربي</a>
            </footer>
          </div>`;
      }
      if (page === "today") {
        // Today: the plan, the add box and the newest few words — the library
        // itself is one tap away, on its own tab.
        const recent = F.apply(VS.allWords(), F.parse("")).slice(0, RECENT);
        return html`
          <div class="page home-page view-enter">
            <div class="home-grid">
              <div class="home-main">
                ${VS.today.strip()}
                ${weekReady()}
                ${addBox(true)}
                ${backupNudge()}
                <section class="home-recent" aria-labelledby="recent-title">
                  <header class="lib-head home-recent-head">
                    <h2 id="recent-title">${s.total > RECENT ? "Newest words" : "Your words"}</h2>
                    ${s.total > RECENT ? html`<a class="home-all" href="#/words">All ${s.total.toLocaleString("en-GB")} words ${icon("arrow-right", "icon-sm")}</a>` : ""}
                  </header>
                  <div class="word-list">${recent.map((w) => VS.ui.wordRow(w))}</div>
                </section>
              </div>
              ${rail()}
            </div>
          </div>`;
      }
      return html`
        <div class="page home-page words-page view-enter">
          <div class="home-grid">
            <div class="home-main">
              <header class="lib-head">
                <div class="words-title">
                  <h1>Your words</h1>
                  <p class="lib-stats"><b>${s.total}</b> words<span aria-hidden="true">·</span><b>${s.learning}</b> learning<span aria-hidden="true">·</span><b>${s.mastered}</b> mastered</p>
                </div>
                <!-- Print & PDF in plain sight (it hid in the ⋯ menu): the words on screen, ready for paper. -->
                <div class="words-head-actions">
                  <a class="btn words-print" href="#/share${query() ? "?" + query() : ""}">${icon("share", "icon-sm")} Share</a>
                  <a class="btn words-print" href="#/print/pick${query() ? "?" + query() : ""}">${icon("print", "icon-sm")} Print &amp; PDF</a>
                </div>
              </header>

              ${s.total < EARLY ? "" : html`<div class="lib-tools">
                <div class="lib-search-row">
                  <label class="field">
                    ${icon("search", "icon-sm")}
                    <span class="sr-only">Search the library</span>
                    <input dir="auto" type="search" id="libSearch" value="${f.q}" placeholder="${narrow() ? "Search words" : "Search your words"}" autocomplete="off"
                           aria-label="Search English, Arabic, definitions, examples, tags and your notes"/>
                  </label>
                  <button class="btn lib-filter-btn" type="button" data-action="lib-panel" aria-expanded="${panelOpen}" aria-controls="libPanel" aria-label="Filters">
                    ${icon("settings", "icon-sm")}<span class="lib-filter-label">Filters</span><span class="pill" data-filter-pill ${on ? "" : VS.raw("hidden")}>${on}</span>
                  </button>
                </div>
                ${statusChips(s)}
                ${panel()}
              </div>`}

                <div id="libResults">${results()}</div>
            </div>
          </div>
        </div>`;
    },

    mount(root) {
      if (stepsRO) { stepsRO.disconnect(); stepsRO = null; }
      const search = VS.$("#libSearch", root);
      if (search) {
        search.addEventListener("input", () => { f.q = search.value; limit = PAGE; syncAddress(); refreshResults(); });
        // Searching on a phone: bring the search row and its results up under
        // the app bar. The hero stays for browsing, but it must not sit between
        // the learner and a list that is updating as they type.
        search.addEventListener("focus", () => {
          if (!matchMedia("(max-width: 1023px)").matches) return;
          const tools = VS.$(".lib-tools", root);
          if (!tools || tools.getBoundingClientRect().top < innerHeight * 0.4) return;
          tools.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        });
      }
      const add = VS.$("#quickWord", root);
      if (add) {
        const addForm = VS.$("[data-form='quick-add']", root);
        const toWallet = addForm && addForm.dataset.capture === "wallet";
        VS.ui.watchKeyboard(add, { lookup: toWallet ? "Save" : "Add" });
        VS.ui.watchDuplicate(add, add.closest(".add-line"), { wallet: toWallet });
        // The highlighter grows under exactly what you type (shared: VS.ui.watchMark).
        VS.ui.watchMark(add);
        add.addEventListener("input", () => VS.spelling.cancel());      // a new word: the old question is gone
      }
      const addForm = VS.$("[data-form='quick-add']", root);
      if (addForm) addForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = add.value.trim();
        if (!text) { add.focus(); return; }
        // Arabic typed: find the English word first («تحدي» → challenge).
        const fromArabic = VS.isArabicTyping(text);
        // Pasted a sentence? Let the learner tap the words they mean, and keep
        // the sentence. Arabic is a word (or a phrase), never that route.
        if (!fromArabic && text.split(/\s+/).length >= 5) {
          VS.capture = { text, context: "", source: "" };
          location.hash = "#/add?tab=text";
          return;
        }
        // Today's box keeps the word in the wallet; the learner decides there
        // when (and how) it becomes a library word.
        if (addForm.dataset.capture === "wallet") {
          const kept = await VS.walletCapture({ word: text, input: add, anchor: add.closest(".add-line") });
          if (!kept.ok) return;
          VS.app.render();
          const again = VS.$("#quickWord");
          if (again) again.focus();
          return;
        }
        // The first-run box still makes the first library word: its example
        // card is the promise the screen is making.
        let word = text;
        if (fromArabic) {
          word = await VS.spelling.chooseEnglish(text, add.closest(".add-line"));
          if (!word) return;
          add.value = word;
        }
        // A typo would be taught as the right answer: ask first (core/spelling.js).
        const typed = VS.addWordReady(word);
        if (!typed) return;
        const fixed = fromArabic ? typed : await VS.spelling.confirm(typed, add.closest(".add-line"));
        if (!fixed) return;
        const wasEmpty = !VS.allWords().length;
        const w = VS.addWord({ word: fixed });
        if (!w) return;
        VS.app.render();
        // On the first word, let the screen settle on today's plan instead
        // of reopening the keyboard over it: the app restores focus to the
        // field, so move it to the new screen.
        if (wasEmpty) {
          root.focus({ preventScroll: true });
        } else {
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
      /* Same affordance for the status chips: the edge fades while there is
         another state off-screen, and clears once you reach "Due". */
      const chips = VS.$(".chip-row", root);
      if (chips) {
        const updateChips = () => {
          const over = chips.scrollWidth > chips.clientWidth + 1;
          chips.classList.toggle("is-overflow", over);
          chips.classList.toggle("is-end", !over || chips.scrollLeft + chips.clientWidth >= chips.scrollWidth - 2);
        };
        updateChips();
        chips.addEventListener("scroll", updateChips, { passive: true });
        requestAnimationFrame(updateChips);
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
      "lib-reset": async () => {
        const ids = words().filter((w) => VS.store.status(w.id) !== "new").map((w) => w.id);
        if (!ids.length) return;
        const yes = await VS.confirm({
          title: `Reset progress for ${VS.plural(ids.length, "word")}?`,
          body: "Their recall schedule goes back to new. Notes and sentences are kept.",
          confirmLabel: "Reset progress",
        });
        if (!yes) return;
        const snap = VS.store.snapshot(ids);
        VS.store.resetWords(ids);
        VS.app.render();
        VS.toast("Progress reset for " + VS.plural(ids.length, "word") + ".", { label: "Undo", run: () => { VS.store.restore(snap); VS.app.render(); } });
      },
      "lib-delete": async () => {
        const ids = words().map((w) => w.id);
        if (!ids.length) return;
        // The whole library, or a big part of it, goes only after a backup file —
        // the same gate as Start over (#/reset). Small deletes keep one confirm + Undo.
        const total = VS.allWords().length;
        const big = ids.length > 20 || (ids.length === total && total >= 10);
        const yes = await VS.confirm({
          title: `Delete ${VS.plural(ids.length, "word")}?`,
          body: big
            ? "Their progress, notes and sentences go too. A backup file is saved first, so you can bring them back."
            : "Their progress, notes and sentences go too.",
          confirmLabel: big ? "Save a backup and delete" : "Delete",
        });
        if (!yes) return;
        if (big) {
          try { await VS.backup.save(); }
          catch (err) { if (!(err && err.name === "AbortError")) VS.toast(VS.backup.errorText(err)); return; }
        }
        const snap = VS.store.snapshot(ids);
        VS.store.deleteUserWords(ids);
        VS.app.render();
        VS.toast(VS.plural(ids.length, "word") + " deleted.", { label: "Undo", run: () => { VS.store.restore(snap); VS.app.render(); } });
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
