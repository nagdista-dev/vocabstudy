/* app.js — boots the app: routing, the app bar, settings and input.
   ------------------------------------------------------------------
   ROUTES (the part after # in the address bar)
     #/                      home = the library: add a word, today's plan, your words
     #/recall                daily recall: the words due today
     #/quick                 Quick 5: the 10 words that matter most, for five minutes
     #/new/cards             learn the next new words from your library
     #/today/quiz            practise the words you first studied today
     #/all/quiz              an activity over the whole library
     #/tricky/quiz           an activity over the words you keep missing
     #/pick/quiz?level=B2    an activity over a filtered list (core/filters.js)
     #/word/write?id=borrow  an activity over one word
                             modes: cards | quiz | spell | match | speak | write
     #/words?tag=IELTS       the library with its filters in the address
     #/add                   add words: type, paste a table, upload files
     #/data                  backup, restore (merge/replace), export words
     #/reset                 start over: backup first, then type RESET
     #/transfer              move words and progress to another device by QR code
     #/stats                 progress charts
     #/week                  your week, Saturday to Friday (ready on Thursday)
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

  const MODES = ["cards", "quiz", "spell", "match", "speak", "write"];
  const SCOPES = ["new", "today", "all", "tricky", "pick", "word"];
  const PRINT_SCOPES = ["recall", "tricky", "all", "today", "new", "pick"];

  VS.homeHref = "index.html";

  /* ── Routing ──────────────────────────────────────────────────── */
  function parse(hash) {
    const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
    const parts = path.split("/").filter(Boolean);
    if (!parts.length || parts[0] === "words") return { view: "library", query };
    if (parts[0] === "add") return { view: "import", query };
    if (parts[0] === "data") return { view: "data" };
    if (parts[0] === "reset") return { view: "reset" };
    if (parts[0] === "transfer") return { view: "transfer" };
    if (parts[0] === "stats") return { view: "stats" };
    if (parts[0] === "week") return { view: "week", query };
    // An optional last part picks the layout: #/print/pick/test?level=B2
    if (parts[0] === "print" && PRINT_SCOPES.includes(parts[1])) return { view: "print", scope: parts[1], layout: parts[2], query };
    if (parts[0] === "recall") return { view: "recall", scope: "recall" };
    if (parts[0] === "quick") return { view: "recall", scope: "quick" };
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
    syncInstallNudge();
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
    applySettings,
    params: () => current.params,
    current: () => current && current.name,
  };

  /* ── Navigation ──────────────────────────────────────────────────
     One list of destinations, drawn twice: labelled links in the top bar
     on wide screens, a bottom tab bar on phones and tablets (where the
     thumb is). Activities hide the tab bar so nothing distracts. */
  const NAV = [
    { id: "home", label: "Today", icon: "home", href: () => "#/", match: ["library"] },
    { id: "recall", label: "Recall", icon: "review", href: () => "#/recall", match: ["recall"] },
    { id: "stats", label: "Progress", icon: "chart", href: () => "#/stats", match: ["stats", "week"] },
    { id: "add", label: "Add", icon: "plus", href: () => "#/add", match: ["import"] },
  ];
  const ACTIVITIES = ["cards", "quiz", "spell", "match", "recall", "speak", "write"];

  function navMarkup(due, cls) {
    return NAV.filter((n) => cls === "tab" || n.id !== "home").map((n) => {
      const on = n.match.includes(current.name) && !(n.id === "recall" && current.params.scope === "day");
      const count = n.id === "recall" && due ? html`<span class="count">${due > 99 ? "99+" : due}</span>` : "";
      return html`<a class="${cls}-link" href="${n.href()}" ${on ? VS.raw('aria-current="page"') : ""}
        ${n.id === "recall" ? VS.raw(`aria-label="Recall — ${due ? due + " words due" : "nothing due"}"`) : ""}>
        <span class="${cls}-ico">${icon(n.icon)}${cls === "tab" ? count : ""}</span><span class="${cls}-label">${n.label}</span>${cls === "bar" ? count : ""}</a>`;
    });
  }

  /* Words due today on the installed app's icon (Badging API, where the
     system supports it): a reminder with no server and no notifications. */
  let badged = -1;
  function appBadge(due) {
    if (due === badged || !("setAppBadge" in navigator)) return;
    badged = due;
    (due ? navigator.setAppBadge(due) : navigator.clearAppBadge()).catch(() => {});
  }

  /* ── App bar ──────────────────────────────────────────────────── */
  function renderBar() {
    const crumbs = current.view.crumbs ? current.view.crumbs(current.params) : [];
    const due = VS.store.totals().due;
    appBadge(due);
    const crumbsEl = VS.$("#crumbs");
    if (!crumbsEl) return;
    // An activity hides the bars so nothing distracts — but only while there is
    // something to do. Its empty state and its results show them again, so no
    // screen is a dead end ("Nothing to recall right now" had no way home).
    const resting = viewRoot.querySelector(".activity > .empty, .activity > .summary");
    document.body.dataset.mode = ACTIVITIES.includes(current.name) && !resting ? "activity" : "browse";
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
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));   // iPadOS reports a Mac
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
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installedNow = true;
    hideNudge();
    VS.toast("VocabStudy is installed.");
  });

  /* ── A quiet invitation to install ─────────────────────────────
     Phones only, and only after the learner has finished a round and is
     back on Today: the first-run lesson is never covered, and it never
     appears within 2.5 s of a touch or scroll (it used to eat a tap). This is a card, not a
     modal — it takes no focus and the app stays usable behind it.
     "Not now" (or the ×) hides it for 30 days; Settings keeps the
     permanent install entry for anyone who wants it sooner. */
  let nudgeShown = false;       // at most one appearance per visit
  let nudgeTimer = 0;
  let installedNow = false;
  const NUDGE_DAYS = 30;
  const phoneOnly = () => matchMedia("(max-width: 700px), ((pointer: coarse) and (max-width: 1023px))").matches;

  function nudgeSnoozed() {
    const last = VS.store.installNudgeDismissed();
    if (!last) return false;
    return Math.round((new Date(VS.todayKey()) - new Date(last)) / 864e5) < NUDGE_DAYS;
  }

  function nudgeWanted() {
    const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    // Only after a finished round, back on Today: the learner has seen what the
    // app does, and isn't in the middle of adding or reading a word.
    return !isStandalone() && !installedNow && phoneOnly() && !nudgeSnoozed() && VS.roundsDone > 0
      && current && current.name === "library" && VS.allWords().length > 0 && !typing
      && !document.querySelector("#settings[open], dialog[open], .update-bar, .toast.is-on, .word-row[open]");
  }

  function removeNudge() {
    const el = VS.$("#installNudge");
    if (el) el.remove();
  }

  function hideNudge() {
    const el = VS.$("#installNudge");
    if (!el) return;
    el.classList.add("is-off");
    setTimeout(removeNudge, 200);
  }

  function nudgeMarkup() {
    const native = !!installPrompt && !isIOS;
    const title = isIOS ? "Add it to your Home Screen" : "Keep it one tap away";
    const text = native
      ? "Open it full screen from your home screen. It still works offline."
      : isIOS
        ? "Tap Share, then Add to Home Screen. It opens full screen and works offline."
        : "Use your browser menu → Install app / Add to Home screen. It opens full screen and works offline.";
    return html`
      <div class="install-nudge-top">
        <span class="install-nudge-ico" aria-hidden="true">${icon(isIOS ? "share" : "download")}</span>
        <div class="install-nudge-copy">
          <p class="install-nudge-kicker">VocabStudy</p>
          <p class="install-nudge-title">${title}</p>
        </div>
        <button class="install-nudge-x" type="button" data-action="install-later" aria-label="Not now">${icon("x", "icon-sm")}</button>
      </div>
      <p class="install-nudge-text">${text}</p>
      <div class="install-nudge-actions">
        <button class="btn btn-primary" type="button" data-action="${native ? "install-now" : "install-got-it"}">${native ? "Install app" : "Got it"}</button>
      </div>`;
  }

  // A card that appears under a moving finger steals the tap meant for the page.
  let lastTouch = 0;
  document.addEventListener("pointerdown", () => { lastTouch = Date.now(); }, { capture: true, passive: true });
  document.addEventListener("scroll", () => { lastTouch = Date.now(); }, { capture: true, passive: true });

  function showNudge() {
    if (!nudgeWanted() || document.visibilityState === "hidden" || VS.$("#installNudge")) return;
    if (Date.now() - lastTouch < 2500) { nudgeTimer = setTimeout(() => { nudgeTimer = 0; showNudge(); }, 2500); return; }
    nudgeShown = true;
    const el = document.createElement("aside");
    el.id = "installNudge";
    el.className = "install-nudge";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", "Install VocabStudy");
    el.innerHTML = String(nudgeMarkup());
    document.body.appendChild(el);
  }

  function syncInstallNudge() {
    clearTimeout(nudgeTimer);
    nudgeTimer = 0;
    if (!nudgeWanted()) { removeNudge(); return; }
    if (nudgeShown) return;
    // Let the screen settle first: a suggestion that jumps out with the page
    // reads as an ad. Three seconds in, the learner is already reading.
    nudgeTimer = setTimeout(() => { nudgeTimer = 0; showNudge(); }, 3500);
  }

  window.addEventListener("resize", () => {
    clearTimeout(syncInstallNudge.timer);
    syncInstallNudge.timer = setTimeout(syncInstallNudge, 250);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncInstallNudge();
  });

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
        <div class="setting"><b>Recorded voice</b><div class="seg">${choice("recorded", true, "On")}${choice("recorded", false, "Off")}</div>
          <span class="hint">A real person saying the word, from the dictionary, when you're online. Offline — or for sentences — your browser's voice speaks.</span></div>
        <div class="setting"><b>Say new words automatically</b><div class="seg">${choice("autoplay", true, "On")}${choice("autoplay", false, "Off")}</div></div>
        <div class="setting"><b>Speaking speed</b><div class="seg">${choice("rate", 0.7, "Slow")}${choice("rate", 0.9, "Normal")}${choice("rate", 1.1, "Fast")}</div></div>
        <div class="setting"><b>Sound effects</b><div class="seg">${choice("effects", true, "On")}${choice("effects", false, "Off")}</div></div>

        <h3 class="sheet-group">Study</h3>
        <div class="setting"><b>Study cards show first</b><div class="seg">${choice("cardFront", "en", "English word")}${choice("cardFront", "ar", "Arabic meaning")}</div>
          <span class="hint">Arabic first makes you produce the English word — harder, and it sticks better.</span></div>
        <div class="setting"><b>Quiz questions</b>
          <div class="checks">${QUIZ_TYPES.map(([v, l]) => html`<label class="check"><input type="checkbox" data-quiz-type value="${v}" ${(st.quizTypes || []).includes(v) ? VS.raw("checked") : ""}><span>${l}</span></label>`)}</div></div>
        <div class="setting"><b>Auto-fill new words</b><div class="seg">${choice("autofill", true, "On")}${choice("autofill", false, "Off")}</div>
          <span class="hint">Fills in the Arabic, definition, example, pronunciation and the words it goes with, from free online dictionaries. Only the English word is sent. Off: no word leaves this device.</span></div>
        <div class="setting"><b>Grammar check</b><div class="seg">${choice("grammar", true, "On")}${choice("grammar", false, "Off")}</div>
          <span class="hint">In Use it, LanguageTool reads your sentence for grammar and spelling (“She don't”, “I didn't went”). Only that sentence is sent, when you press Check.</span></div>
        <div class="setting"><b>New words per day</b><div class="seg">${choice("newPerDay", 5, "5")}${choice("newPerDay", 10, "10")}${choice("newPerDay", 20, "20")}${choice("newPerDay", 30, "30")}</div>
          <span class="hint">How many new words “Learn” brings each day. The rest wait for tomorrow.</span></div>
        ${VS.listen.available ? html`<div class="setting"><b>Speak practice</b><div class="seg">${choice("speak", true, "On")}${choice("speak", false, "Off")}</div>
          <span class="hint">Say words out loud and the app checks them. Your browser does the listening — Chrome and Edge use their online speech service.</span></div>` : ""}
        <div class="setting"><b>Round size</b><div class="seg">${choice("roundSize", 10, "10")}${choice("roundSize", 20, "20")}${choice("roundSize", 30, "30")}</div></div>
        <div class="setting"><b>Daily goal</b><div class="seg">${choice("dailyGoal", 50, "50")}${choice("dailyGoal", 150, "150")}${choice("dailyGoal", 300, "300")}${choice("dailyGoal", 600, "600")}${choice("dailyGoal", 0, "Off")}</div><span class="hint">Answers per day across all activities (each new word you meet counts too). Progress shows on today's plan.</span></div>
        <div class="setting"><b>Break reminder</b><div class="seg">${choice("breakEvery", 25, "25 min")}${choice("breakEvery", 50, "50 min")}${choice("breakEvery", 0, "Off")}</div></div>

        <h3 class="sheet-group">Look</h3>
        <div class="setting"><b>Accent colour</b><div class="seg swatches">
          ${[["blue", "Ink blue"], ["teal", "Teal"], ["sky", "Sky"], ["violet", "Violet"], ["plum", "Plum"], ["rose", "Rose"], ["cocoa", "Cocoa"], ["amber", "Amber"], ["graphite", "Graphite"], ["glass", "Glass"]].map(([v, l]) =>
            html`<button type="button" data-action="setting" data-name="accent" data-value="${v}" aria-pressed="${st.accent === v}"><i class="swatch sw-${v}"></i>${l}</button>`)}
          </div>
          ${st.accent === "glass" ? html`<span class="hint">Liquid Glass is a material, not a tint: actions, bars and today's plan turn translucent while the text stays dark ink.</span>` : ""}
        </div>
        <div class="setting"><b>Text size</b><div class="seg">${choice("textScale", 1, "Normal")}${choice("textScale", 1.12, "Large")}${choice("textScale", 1.25, "Larger")}</div></div>

        <h3 class="sheet-group">App &amp; data</h3>
        ${VS.speech.supported ? "" : html`<p class="hint">This browser has no built-in voices, so words can't be read aloud.</p>`}
        <div class="setting"><b>Install as an app</b>${installMarkup()}</div>
        <div class="setting"><b>About VocabStudy</b><p class="hint">What it does and why, in Arabic — a page to share with a friend.</p>
          <a class="btn" href="about.html">Read it in Arabic</a></div>
        <details class="setting shortcuts">
          <summary><b>Keyboard shortcuts</b></summary>
          <dl>
            <div><dt><kbd>Space</kbd></dt><dd>Flip the card · show the answer</dd></div>
            <div><dt><kbd>1</kbd>–<kbd>4</kbd></dt><dd>Choose an answer · grade a card</dd></div>
            <div><dt><kbd>Enter</kbd></dt><dd>Check · next question</dd></div>
            <div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Still learning · I know it (cards)</dd></div>
            <div><dt><kbd>H</kbd></dt><dd>A hint in recall</dd></div>
            <div><dt><kbd>U</kbd></dt><dd>Undo the last answer (cards, recall)</dd></div>
            <div><dt><kbd>/</kbd></dt><dd>Search words</dd></div>
          </dl>
        </details>
        <div class="setting"><b>Your data</b>
          <p class="hint">Saved in this browser only. Back it up, restore it on another device, or export your words.</p>
          <div class="row"><a class="btn" href="#/data" data-action="close-settings">Backup &amp; export</a>
          <a class="btn" href="#/transfer" data-action="close-settings">${icon("qr", "icon-sm")} Move to another device</a></div>
        </div>
        <div class="setting"><b>Reset progress only</b>
          <p class="hint">Keep your words and settings. Clear the recall schedule, streak and scores.</p>
          <button class="danger-link" type="button" data-action="reset-progress">Reset progress</button>
        </div>
        <div class="setting"><b>Start over</b>
          <p class="hint">Delete every word, note and answer on this device and go back to the first day. You'll save a backup first.</p>
          <a class="btn btn-danger-quiet" href="#/reset" data-action="close-settings">Start over…</a>
        </div>
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
      hideNudge();
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
      installPrompt.userChoice.then((choice) => {
        installPrompt = null;
        if (choice && choice.outcome === "accepted") installedNow = true;
        else VS.store.dismissInstallNudge();      // tried and closed it: no follow-up card
        hideNudge();
        redrawSettings();
      }).catch(() => {
        installPrompt = null;
        hideNudge();
        redrawSettings();
      });
    },
    "install-now"(el) {
      if (!installPrompt) { hideNudge(); return; }
      const prompt = installPrompt;
      el.disabled = true;
      prompt.prompt();
      prompt.userChoice.then((choice) => {
        installPrompt = null;
        if (choice && choice.outcome === "accepted") installedNow = true;
        else VS.store.dismissInstallNudge();       // closing the system sheet is a "not now"
        hideNudge();
      }).catch(() => {
        installPrompt = null;
        hideNudge();
      });
    },
    "install-got-it"() {
      VS.store.dismissInstallNudge();
      hideNudge();
    },
    "install-later"() {
      VS.store.dismissInstallNudge();
      hideNudge();
    },
    "reset-progress": async () => {
      const yes = await VS.confirm({
        title: "Reset progress?",
        body: "Your words and settings stay. The recall schedule, streak and scores will be cleared. This cannot be undone.",
        confirmLabel: "Reset progress",
      });
      if (!yes) return;
      VS.store.resetProgress();
      VS.$("#settings").close();
      VS.toast("Progress reset. Your words are safe.");
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

  // One word open at a time: opening a card closes the one already open,
  // so the library stays one reading column instead of a long stack.
  // (toggle does not bubble; a capture listener still hears it.)
  document.addEventListener("toggle", (e) => {
    const row = e.target;
    if (!row.classList || !row.classList.contains("word-row") || !row.open) return;
    VS.$$(".word-row[open]").forEach((other) => { if (other !== row) other.open = false; });
    hideNudge();                                  // the card must never cover an open word
  }, true);

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
    const strip = VS.$(".today-hero");
    if (strip) strip.outerHTML = String(VS.today.strip());
    syncInstallNudge();
  });

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || VS.$("#settings")?.open) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (tag === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;   // let the focused button act
    if (current.view.keys) current.view.keys(e);
  });

  /* ── Shared to the app ──────────────────────────────────────────
     Share → VocabStudy on a phone (manifest share_target), or the
     bookmarks-bar button on a computer, opens index.html?share-text=…
     The text waits in VS.capture for Add words (views/import.js). */
  function readShare() {
    const q = new URLSearchParams(location.search);
    if (!["share-text", "share-title", "share-url"].some((k) => q.has(k))) return;
    const strip = (s) => String(s || "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
    const url = q.get("share-url") || (String(q.get("share-text") || "").match(/https?:\/\/\S+/) || [])[0] || "";
    let source = strip(q.get("share-title"));
    if (!source && url) { try { source = new URL(url).hostname.replace(/^www\./, ""); } catch (e) { /* not a URL */ } }
    VS.capture = { text: strip(q.get("share-text")).slice(0, 2000), context: strip(q.get("share-context")).slice(0, 800), source: source.slice(0, 80) };
    history.replaceState(null, "", location.pathname + "#/add?from=share");
  }

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
  fill("settingsBtn", icon("gear"));
  applySettings();
  VS.store.onChange(() => current && renderBar());
  VS.autofill.resume();                          // words added offline get filled now
  VS.autofill.review();                          // words saved before the spelling check: typos get flagged
  // Ask the browser to keep this site's data for good (Safari otherwise may clear
  // a site that hasn't been opened for a week). Installed apps are usually granted it.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then((on) => on || navigator.storage.persist()).catch(() => {});
  // How common each word is: a 113 KB list, loaded after the first screen is drawn.
  // Redrawn only if the learner isn't in the middle of something (an open word, a focused field).
  setTimeout(() => VS.frequency.load().then(() => {
    const busy = VS.$(".word-row[open]") || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
    if (current && current.name === "library" && VS.frequency.ready && !busy) render();
  }), 0);
  readShare();
  window.addEventListener("hashchange", go);
  go();
})();
