/* app.js — boots the app: routing, the app bar, settings and input.
   ------------------------------------------------------------------
   ROUTES (the part after # in the address bar)
     #/                      home (index.html) — or the day, on a day page
     #/recall                daily recall across every day
     #/all/quiz              an activity over every word (cards | quiz | spell | match)
     #/tricky/quiz           an activity over the words you keep missing
     #/words                 the library: every word, searchable
     #/add                   add words: paste a table, preview, save
     #/data                  backup, restore (merge/replace), export words
     #/stats                 progress charts
     #/print/day/ISO         print or save as PDF (also /print/recall, /tricky, /all)
     #/day/2026-11-02        one day: learning path + word list
     #/day/2026-11-02/quiz   an activity: cards | quiz | spell | match | recall

   A VIEW is an object in VS.views with:
     render(params) → markup (required)
     start(params)  → reset its session when the route is entered
     mount(root)    → after the markup is in the page (focus, listeners)
     leave()        → when the route changes (stop timers)
     actions        → handlers for [data-action="name"] clicks
     keys(event)    → keyboard shortcuts while the view is open
     crumbs(params) → breadcrumb items for the app bar

   Clicks are handled ONCE here (event delegation): any element with
   data-action="x" calls the current view's actions.x, or a global one.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;

  const body = document.body;
  const ROOT = body.dataset.root || "";            // "" on index.html, "../" on day pages
  const PAGE_DAY = body.dataset.day || "";          // set on days/*.html
  const MODES = ["cards", "quiz", "spell", "match", "recall"];

  VS.homeHref = ROOT + "index.html";
  VS.dayHref = (iso) => {
    const day = VS.day(iso);
    if (PAGE_DAY && iso === PAGE_DAY) return "#/";
    if (day && !day.built) return (PAGE_DAY ? ROOT + "index.html" : "") + "#/day/" + iso;   // added in the app: no page of its own
    return PAGE_DAY ? iso + ".html" : "days/" + iso + ".html";
  };

  /* ── Routing ──────────────────────────────────────────────────── */
  function parse(hash) {
    const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (parts[0] === "words") return { view: "library" };
    if (parts[0] === "add") return { view: "import" };
    if (parts[0] === "data") return { view: "data" };
    if (parts[0] === "stats") return { view: "stats" };
    if (parts[0] === "print") {
      // An optional last part picks the layout: #/print/day/2026-11-02/test
      if (parts[1] === "day" && parts[2]) return { view: "print", scope: "day", iso: parts[2], layout: parts[3] };
      if (["recall", "tricky", "all"].includes(parts[1])) return { view: "print", scope: parts[1], layout: parts[2] };
    }
    if (parts[0] === "recall") return { view: "recall", scope: "recall" };
    if ((parts[0] === "all" || parts[0] === "tricky") && MODES.includes(parts[1])) return { view: parts[1], scope: parts[0] };
    if (parts[0] === "day" && parts[1]) {
      if (MODES.includes(parts[2])) return { view: parts[2], scope: "day", iso: parts[1] };
      return { view: "day", iso: parts[1] };
    }
    return PAGE_DAY ? { view: "day", iso: PAGE_DAY } : { view: "home" };
  }

  let current = null;     // { name, view, params }
  const viewRoot = VS.$("#view");

  function go() {
    const params = parse(location.hash);
    const view = VS.views[params.view] || VS.views.home;
    if (current && current.view.leave) current.view.leave();
    VS.speech.stop();
    current = { name: params.view, view, params };
    if (view.start) view.start(params);
    window.scrollTo({ top: 0 });
    viewRoot.focus({ preventScroll: true });     // screen readers start at the new screen…
    render();                                    // …unless the view focuses something itself in mount()
  }

  function render() {
    const { view, params } = current;
    viewRoot.innerHTML = String(view.render(params));
    renderBar();
    const title = view.title ? view.title(params) : "";
    // "(12) …" in the tab title: due words stay visible even in a background tab.
    const due = VS.store.totals().due;
    document.title = (due ? "(" + due + ") " : "") +
      (title && title !== "VocabStudy" ? title + " · VocabStudy" : "VocabStudy — vocabulary with spaced recall");
    if (view.mount) view.mount(viewRoot, params);
  }

  VS.app = {
    render,
    params: () => current.params,
    current: () => current && current.name,
  };

  /* ── Navigation ──────────────────────────────────────────────────
     One list of destinations, drawn twice: labelled links in the top bar
     on wide screens, a bottom tab bar on phones and tablets (where the
     thumb is). Activities hide the tab bar so nothing distracts. */
  const NAV = [
    { id: "home", label: "Home", icon: "home", href: () => VS.homeHref + "#/", match: ["home"] },
    { id: "recall", label: "Recall", icon: "review", href: () => "#/recall", match: ["recall"] },
    { id: "library", label: "Library", icon: "book", href: () => "#/words", match: ["library"] },
    { id: "stats", label: "Progress", icon: "chart", href: () => "#/stats", match: ["stats"] },
    { id: "add", label: "Add words", icon: "plus", href: () => "#/add", match: ["import"] },
  ];
  const ACTIVITIES = ["cards", "quiz", "spell", "match", "recall"];

  function navMarkup(due, cls) {
    return NAV.filter((n) => cls === "tab" || n.id !== "home").map((n) => {
      const on = n.match.includes(current.name) && !(n.id === "recall" && current.params.scope === "day");
      const count = n.id === "recall" && due ? html`<span class="count">${due > 99 ? "99+" : due}</span>` : "";
      return html`<a class="${cls}-link" href="${n.href()}" ${on ? VS.raw('aria-current="page"') : ""}
        ${n.id === "recall" ? VS.raw(`aria-label="Recall — ${due ? due + " words due" : "nothing due"}"`) : ""}>
        <span class="${cls}-ico">${icon(n.icon)}${count}</span><span class="${cls}-label">${n.label}</span></a>`;
    });
  }

  /* ── App bar ──────────────────────────────────────────────────── */
  function renderBar() {
    const crumbs = current.view.crumbs ? current.view.crumbs(current.params) : [];
    const due = VS.store.totals().due;
    const crumbsEl = VS.$("#crumbs");
    if (!crumbsEl) return;
    document.body.dataset.mode = ACTIVITIES.includes(current.name) ? "activity" : "browse";
    const barNav = VS.$("#barNav"), tabBar = VS.$("#tabBar");
    if (barNav) barNav.innerHTML = String(html`${navMarkup(due, "bar")}`);
    if (tabBar) tabBar.innerHTML = String(html`${navMarkup(due, "tab")}`);
    crumbsEl.innerHTML = String(html`
      ${crumbs.length ? html`<a href="${VS.homeHref}">All sets</a>` : ""}
      ${crumbs.map((c) => html`<span aria-hidden="true">/</span>${c.href ? html`<a href="${c.href}">${c.label}</a>` : html`<span aria-current="page">${c.label}</span>`}`)}`);
  }

  /* ── Installable app (PWA) ─────────────────────────────────────
     The service worker only runs over http(s) — opened as a file the
     app still works, just without install and offline caching. */
  let installPrompt = null;
  const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => navigator.serviceWorker.register(ROOT + "sw.js").catch(() => {}));
  }
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; });
  window.addEventListener("appinstalled", () => { installPrompt = null; VS.toast("VocabStudy is installed."); });

  function installMarkup() {
    if (isStandalone()) return html`<p class="hint">${icon("check", "icon-sm")} Installed — you're using the app.</p>`;
    if (installPrompt) return html`<button class="btn btn-primary" type="button" data-action="install">Install VocabStudy</button>
      <p class="hint">Opens like an app from your home screen and works offline.</p>`;
    if (isIOS) return html`<p class="hint">On iPhone/iPad: tap <b>Share</b>, then <b>Add to Home Screen</b>.</p>`;
    if (location.protocol === "file:") return html`<p class="hint">Open the online version (GitHub Pages) to install it as an app.</p>`;
    return html`<p class="hint">Use your browser menu → <b>Install app</b> / <b>Add to Home screen</b>.</p>`;
  }

  /* ── Settings ─────────────────────────────────────────────────── */
  function applySettings() {
    const st = VS.store.settings();
    document.documentElement.style.setProperty("--text-scale", st.textScale);
    document.documentElement.dataset.accent = st.accent || "blue";
  }

  const QUIZ_TYPES = [["meaning", "Definition → word"], ["arabic", "Arabic → English"], ["english", "English → Arabic"],
                      ["gap", "Fill the gap"], ["listen", "Listening"]];

  function settingsMarkup() {
    const st = VS.store.settings();
    const choice = (name, value, label) =>
      html`<button type="button" data-action="setting" data-name="${name}" data-value="${value}" aria-pressed="${String(st[name]) === String(value)}">${label}</button>`;
    return html`
      <div class="sheet-head"><h2 id="settingsTitle">Settings</h2>
        <button class="icon-btn" type="button" data-action="close-settings" aria-label="Close">${icon("x")}</button></div>
      <div class="sheet-body">
        <h3 class="sheet-group">Sound</h3>
        <div class="setting"><b>Pronunciation</b><div class="seg">${choice("sound", true, "On")}${choice("sound", false, "Off")}</div></div>
        <div class="setting"><b>Accent</b><div class="seg">${choice("voice", "us", "American")}${choice("voice", "uk", "British")}</div></div>
        <div class="setting"><b>Say new words automatically</b><div class="seg">${choice("autoplay", true, "On")}${choice("autoplay", false, "Off")}</div></div>
        <div class="setting"><b>Speaking speed</b><div class="seg">${choice("rate", 0.7, "Slow")}${choice("rate", 0.9, "Normal")}${choice("rate", 1.1, "Fast")}</div></div>
        <div class="setting"><b>Sound effects</b><div class="seg">${choice("effects", true, "On")}${choice("effects", false, "Off")}</div></div>

        <h3 class="sheet-group">Study</h3>
        <div class="setting"><b>Study cards show first</b><div class="seg">${choice("cardFront", "en", "English word")}${choice("cardFront", "ar", "Arabic meaning")}</div>
          <span class="hint">Arabic first makes you produce the English word — harder, and it sticks better.</span></div>
        <div class="setting"><b>Quiz questions</b>
          <div class="checks">${QUIZ_TYPES.map(([v, l]) => html`<label class="check"><input type="checkbox" data-quiz-type value="${v}" ${(st.quizTypes || []).includes(v) ? VS.raw("checked") : ""}><span>${l}</span></label>`)}</div></div>
        <div class="setting"><b>Round size</b><div class="seg">${choice("roundSize", 10, "10")}${choice("roundSize", 20, "20")}${choice("roundSize", 30, "30")}</div></div>
        <div class="setting"><b>Daily goal</b><div class="seg">${choice("dailyGoal", 50, "50")}${choice("dailyGoal", 150, "150")}${choice("dailyGoal", 300, "300")}${choice("dailyGoal", 600, "600")}${choice("dailyGoal", 0, "Off")}</div><span class="hint">Answers per day, across all activities.</span></div>
        <div class="setting"><b>Break reminder</b><div class="seg">${choice("breakEvery", 25, "25 min")}${choice("breakEvery", 50, "50 min")}${choice("breakEvery", 0, "Off")}</div></div>

        <h3 class="sheet-group">Look</h3>
        <div class="setting"><b>Accent colour</b><div class="seg swatches">
          ${[["blue", "Ink blue"], ["teal", "Teal"], ["violet", "Violet"], ["rose", "Rose"]].map(([v, l]) =>
            html`<button type="button" data-action="setting" data-name="accent" data-value="${v}" aria-pressed="${st.accent === v}"><i class="swatch sw-${v}"></i>${l}</button>`)}
        </div></div>
        <div class="setting"><b>Text size</b><div class="seg">${choice("textScale", 1, "Normal")}${choice("textScale", 1.12, "Large")}${choice("textScale", 1.25, "Larger")}</div></div>

        <h3 class="sheet-group">App &amp; data</h3>
        ${VS.speech.supported ? "" : html`<p class="hint">This browser has no built-in voices, so words can't be read aloud.</p>`}
        <div class="setting"><b>Install as an app</b>${installMarkup()}</div>
        <details class="setting shortcuts">
          <summary><b>Keyboard shortcuts</b></summary>
          <dl>
            <div><dt><kbd>Space</kbd></dt><dd>Flip the card · show the answer</dd></div>
            <div><dt><kbd>1</kbd>–<kbd>4</kbd></dt><dd>Choose an answer · grade a card</dd></div>
            <div><dt><kbd>Enter</kbd></dt><dd>Check · next question</dd></div>
            <div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Still learning · I know it (cards)</dd></div>
            <div><dt><kbd>/</kbd></dt><dd>Search words</dd></div>
          </dl>
        </details>
        <div class="setting"><b>Your data</b>
          <p class="hint">Saved in this browser only. Back it up, restore it on another device, or export your words.</p>
          <a class="btn" href="#/data" data-action="close-settings">Backup &amp; export</a>
        </div>
        <button class="danger-link" type="button" data-action="reset-progress">Reset all progress</button>
      </div>`;
  }

  /* ── Global actions (available on every screen) ─────────────────
     VS.actions is one registry: components loaded earlier (the word
     browser, the print view) add their actions to it too. */
  const GLOBAL = (VS.actions = VS.actions || {});
  Object.assign(GLOBAL, {
    speak(el) { VS.speech.say(el.dataset.say, el); },
    forget(el) { VS.store.forget(el.dataset.id); VS.toast("Word reset to new."); render(); },
    "open-settings"() {
      const dlg = VS.$("#settings");
      dlg.innerHTML = String(settingsMarkup());
      dlg.showModal();
    },
    "close-settings"() { VS.$("#settings").close(); },
    setting(el) {
      const raw = el.dataset.value;
      const value = raw === "true" ? true : raw === "false" ? false : isNaN(raw) ? raw : Number(raw);
      VS.store.setSetting(el.dataset.name, value);
      applySettings();
      VS.$("#settings").innerHTML = String(settingsMarkup());
      if (el.dataset.name === "rate") VS.speech.say("This is how words will sound.");
    },
    install() {
      if (!installPrompt) return;
      installPrompt.prompt();
      installPrompt.userChoice.finally(() => { installPrompt = null; VS.$("#settings").innerHTML = String(settingsMarkup()); });
    },
    "reset-progress"() {
      if (!confirm("Reset all progress? Your recall schedule, streak and scores will be deleted. This cannot be undone.")) return;
      VS.store.resetProgress();
      VS.$("#settings").close();
      VS.toast("Progress reset.");
      go();
    },
  });

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const name = el.dataset.action;
    const handler = (current.view.actions && current.view.actions[name]) || GLOBAL[name];
    if (!handler) return;
    // A speak button inside a <summary> must not also open/close the row.
    if (name === "speak") e.preventDefault();
    handler.call(current.view.actions && current.view.actions[name] ? current.view.actions : GLOBAL, el, e);
  });

  // Quiz question types (Settings): keep at least one switched on.
  document.addEventListener("change", (e) => {
    if (!e.target.matches("[data-quiz-type]")) return;
    const on = VS.$$("[data-quiz-type]").filter((c) => c.checked).map((c) => c.value);
    if (!on.length) { e.target.checked = true; VS.toast("Keep at least one question type."); return; }
    VS.store.setSetting("quizTypes", on);
  });

  // Notes (VS.ui.noteBox) save when the box loses focus — no save button to forget.
  document.addEventListener("change", (e) => {
    const id = e.target.dataset && e.target.dataset.note;
    if (!id) return;
    VS.store.setNote(id, e.target.value);
    VS.toast(e.target.value.trim() ? "Note saved." : "Note removed.");
  });

  // Close the settings sheet when the backdrop is clicked.
  VS.$("#settings")?.addEventListener("click", (e) => { if (e.target.id === "settings") e.target.close(); });

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || VS.$("#settings")?.open) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (tag === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;   // let the focused button act
    if (current.view.keys) current.view.keys(e);
  });

  /* ── Boot ─────────────────────────────────────────────────────────
     Every lookup is optional: a page built from an older template (or a
     stale browser cache) must still start, just without the new button. */
  const fill = (id, markup, href) => {
    const el = VS.$("#" + id);
    if (!el) return;
    if (markup) el.innerHTML = String(markup);
    if (href) el.href = href;
  };
  fill("brandLink", html`${VS.brandMark}<span>VocabStudy</span>`, VS.homeHref);
  fill("settingsBtn", icon("settings"));
  applySettings();
  VS.store.onChange(() => current && renderBar());
  window.addEventListener("hashchange", go);
  go();
})();
