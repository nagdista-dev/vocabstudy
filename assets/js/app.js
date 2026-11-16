/* app.js — boots the app: routing, the app bar, settings and input.
   ------------------------------------------------------------------
   ROUTES (the part after # in the address bar)
     #/                      home = the library: add a word, today's plan, your words
     #/recall                daily recall: the words due today
     #/new/cards             learn the next new words from your library
     #/today/quiz            practise the words you first studied today
     #/all/quiz              an activity over the whole library
     #/tricky/quiz           an activity over the words you keep missing
     #/pick/quiz?level=B2    an activity over a filtered list (core/filters.js)
                             modes: cards | quiz | spell | match | speak
     #/words?tag=IELTS       the library with its filters in the address
     #/add                   add words: type, paste a table, upload files
     #/data                  backup, restore (merge/replace), export words
     #/stats                 progress charts
     #/print/pick?level=B2   print or save as PDF (also /print/recall, /tricky, /all, /today, /new)

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

  const MODES = ["cards", "quiz", "spell", "match", "speak"];
  const SCOPES = ["new", "today", "all", "tricky", "pick"];
  const PRINT_SCOPES = ["recall", "tricky", "all", "today", "new", "pick"];

  VS.homeHref = "index.html";

  /* ── Routing ──────────────────────────────────────────────────── */
  function parse(hash) {
    const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
    const parts = path.split("/").filter(Boolean);
    if (!parts.length || parts[0] === "words") return { view: "library", query };
    if (parts[0] === "add") return { view: "import" };
    if (parts[0] === "data") return { view: "data" };
    if (parts[0] === "stats") return { view: "stats" };
    // An optional last part picks the layout: #/print/pick/test?level=B2
    if (parts[0] === "print" && PRINT_SCOPES.includes(parts[1])) return { view: "print", scope: parts[1], layout: parts[2], query };
    if (parts[0] === "recall") return { view: "recall", scope: "recall" };
    if (SCOPES.includes(parts[0]) && MODES.includes(parts[1])) return { view: parts[1], scope: parts[0], query };
    return { view: "library", query: "" };
  }

  let current = null;     // { name, view, params }
  let entering = false;   // true for the first render of a screen: only then does it fade in
  const viewRoot = VS.$("#view");

  function go() {
    const params = parse(location.hash);
    const view = VS.views[params.view] || VS.views.library;
    if (current && current.view.leave) current.view.leave();
    VS.speech.stop();
    current = { name: params.view, view, params };
    if (view.start) view.start(params);
    window.scrollTo({ top: 0 });
    viewRoot.focus({ preventScroll: true });     // screen readers start at the new screen…
    entering = true;
    render();                                    // …unless the view focuses something itself in mount()
  }

  /* ── Keep keyboard focus across re-renders ─────────────────────
     Re-rendering replaces the markup, so the focused button vanishes and
     focus would fall back to <body>: a keyboard user loses their place
     after every answer. Remember what was focused, then focus its twin. */
  const FOCUS_KEYS = ["action", "id", "grade", "side", "name", "value", "mode", "filter"];
  function focusKey(root) {
    const el = document.activeElement;
    if (!el || el === root || !root.contains(el)) return null;
    if (el.id) return "#" + CSS.escape(el.id);
    const parts = FOCUS_KEYS.filter((k) => el.dataset[k] !== undefined)
      .map((k) => `[data-${k}="${CSS.escape(el.dataset[k])}"]`);
    return parts.length ? el.tagName.toLowerCase() + parts.join("") : null;
  }
  function restoreFocus(key, root) {
    const now = document.activeElement;
    if (!key || (now && now !== document.body && now !== root && root.contains(now))) return;  // mount() chose focus itself
    const el = root.querySelector(key);
    if (el && !el.disabled) el.focus({ preventScroll: true });
  }

  function render() {
    const { view, params } = current;
    const focused = focusKey(viewRoot);
    viewRoot.innerHTML = String(view.render(params));
    // A filter, an answer or a setting re-renders the same screen: it must
    // not fade in again (that reads as a flicker), so the entrance runs once.
    const page = viewRoot.firstElementChild;
    if (!entering && page) page.classList.remove("view-enter");
    entering = false;
    renderBar();
    const title = view.title ? view.title(params) : "";
    // "(12) …" in the tab title: due words stay visible even in a background tab.
    const due = VS.store.totals().due;
    document.title = (due ? "(" + due + ") " : "") +
      (title && title !== "VocabStudy" ? title + " · VocabStudy" : "VocabStudy — vocabulary with spaced recall");
    if (view.mount) view.mount(viewRoot, params);
    restoreFocus(focused, viewRoot);
  }

  /* Redraw the settings sheet in place: same scroll position, same focus. */
  function redrawSettings() {
    const dlg = VS.$("#settings");
    const body = VS.$(".sheet-body", dlg);
    const top = body ? body.scrollTop : 0, dlgTop = dlg.scrollTop;
    const focused = focusKey(dlg);
    dlg.innerHTML = String(settingsMarkup());
    const nextBody = VS.$(".sheet-body", dlg);
    if (nextBody) nextBody.scrollTop = top;
    dlg.scrollTop = dlgTop;
    restoreFocus(focused, dlg);
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
    { id: "home", label: "Words", icon: "book", href: () => "#/", match: ["library"] },
    { id: "recall", label: "Recall", icon: "review", href: () => "#/recall", match: ["recall"] },
    { id: "stats", label: "Progress", icon: "chart", href: () => "#/stats", match: ["stats"] },
    { id: "add", label: "Add words", icon: "plus", href: () => "#/add", match: ["import"] },
  ];
  const ACTIVITIES = ["cards", "quiz", "spell", "match", "recall", "speak"];

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
    document.body.dataset.mode = ACTIVITIES.includes(current.name) || current.name === "print" ? "activity" : "browse";
    const barNav = VS.$("#barNav"), tabBar = VS.$("#tabBar");
    if (barNav) barNav.innerHTML = String(html`${navMarkup(due, "bar")}`);
    if (tabBar) tabBar.innerHTML = String(html`${navMarkup(due, "tab")}`);
    crumbsEl.innerHTML = String(html`
      ${crumbs.length ? html`<a href="#/">Words</a>` : ""}
      ${crumbs.map((c) => html`<span aria-hidden="true">/</span>${c.href ? html`<a href="${c.href}">${c.label}</a>` : html`<span aria-current="page">${c.label}</span>`}`)}`);
  }

  /* ── Installable app (PWA) ─────────────────────────────────────
     The service worker only runs over http(s) — opened as a file the
     app still works, just without install and offline caching. */
  let installPrompt = null;
  const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
    // A new version was published: the new service worker takes over, and we
    // offer a reload instead of switching code under the learner's feet.
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return;                 // first install, nothing to announce
      if (document.querySelector(".update-bar")) return;
      const bar = document.createElement("div");
      bar.className = "update-bar";
      bar.setAttribute("role", "status");
      bar.innerHTML = String(html`<span>A new version is ready.</span>
        <button class="btn btn-primary" type="button" data-action="reload">Update now</button>`);
      document.body.appendChild(bar);
    });
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
        <div class="setting"><b>Auto-fill new words</b><div class="seg">${choice("autofill", true, "On")}${choice("autofill", false, "Off")}</div>
          <span class="hint">Fills in the Arabic, definition, example and pronunciation from free online dictionaries. Only the English word is sent. Off: nothing ever leaves this device.</span></div>
        <div class="setting"><b>New words per day</b><div class="seg">${choice("newPerDay", 5, "5")}${choice("newPerDay", 10, "10")}${choice("newPerDay", 20, "20")}${choice("newPerDay", 30, "30")}</div>
          <span class="hint">How many new words “Learn” brings each day. The rest wait for tomorrow.</span></div>
        ${VS.listen.available ? html`<div class="setting"><b>Speak practice</b><div class="seg">${choice("speak", true, "On")}${choice("speak", false, "Off")}</div>
          <span class="hint">Say words out loud and the app checks them. Your browser does the listening — Chrome and Edge use their online speech service.</span></div>` : ""}
        <div class="setting"><b>Round size</b><div class="seg">${choice("roundSize", 10, "10")}${choice("roundSize", 20, "20")}${choice("roundSize", 30, "30")}</div></div>
        <div class="setting"><b>Daily goal</b><div class="seg">${choice("dailyGoal", 50, "50")}${choice("dailyGoal", 150, "150")}${choice("dailyGoal", 300, "300")}${choice("dailyGoal", 600, "600")}${choice("dailyGoal", 0, "Off")}</div><span class="hint">Answers per day, across all activities. Progress shows on today's plan.</span></div>
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
      </div>
      <div class="sheet-foot"><button class="btn btn-primary" type="button" data-action="close-settings">Done</button></div>`;
  }

  /* ── Global actions (available on every screen) ─────────────────
     VS.actions is one registry: components loaded earlier (the word
     browser, the print view) add their actions to it too. */
  const GLOBAL = (VS.actions = VS.actions || {});
  Object.assign(GLOBAL, {
    speak(el) { VS.speech.say(el.dataset.say, el); },
    reload() { location.reload(); },
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
      redrawSettings();
      if (el.dataset.name === "rate") VS.speech.say("This is how words will sound.");
    },
    install() {
      if (!installPrompt) return;
      installPrompt.prompt();
      installPrompt.userChoice.finally(() => { installPrompt = null; redrawSettings(); });
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

  // Today's plan depends on settings (daily goal, new words per day): redraw just the strip.
  VS.$("#settings")?.addEventListener("close", () => {
    if (!current || current.name !== "library") return;
    const strip = VS.$(".today-strip");
    if (strip) strip.outerHTML = String(VS.today.strip());
  });

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
  VS.autofill.resume();                          // words added offline get filled now
  window.addEventListener("hashchange", go);
  go();
})();
