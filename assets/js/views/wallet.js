/* views/wallet.js — words saved for later, filed in folders.
   ------------------------------------------------------------------
   A learner's pocket of slips, not a second library. Words arrive three
   ways: typed into the pocket ("save it for later" — English or Arabic,
   Arabic kept exactly as written), kept from a word card while reading
   with the sentence that made them tap, or sent by a friend. Nothing here
   is studied or scheduled until the learner chooses one of two doors on a
   slip: Make with AI (Add → With AI for English, Add → From Arabic for an
   Arabic slip, the sentence and the Arabic carried into the prompt) or Add
   now (the library, or the Add form when Auto-fill is off). The word leaves
   when it is added.

   Folders are a filing cabinet, not a second wallet: General is where quick
   saves land, Shared is where a friend's words land, and the learner can
   make more (a film, a book, work) and move slips between them. A word still
   exists once in the whole wallet. The chosen folder lives in the address
   (#/wallet?folder=film), so it survives a refresh and can be linked.

   The page has its own shape — a pocket on the desk and the slips it holds —
   but it is built from the app's parts and tokens. Colour only where it
   means something: the accent on actions, the highlighter on the word
   inside its sentence (the learner's memory).

   The wallet is content, not progress (core/store.js): it and its folders
   survive Reset progress, travel in the backup, and merge by word. Removing
   one is a loss, so it carries an Undo; clearing a folder asks first and
   touches only that folder. */
(function () {
  "use strict";
  const { html, icon } = VS;

  const st = {
    q: "",                 // the search box
    sentence: false,       // whether "where you met it" is open
    folder: "all",         // "all" or a folder id
    draft: "",             // the pocket's typed word, kept across folder switches
    draftSentence: "",     // …and its optional sentence
    createName: "",        // the New folder field in the sheet
    createError: "",
    rename: "",            // the folder id being renamed in the sheet
    renameName: "",
    renameError: "",
    moveId: "",            // the slip being moved
  };

  const folders = () => VS.store.walletFolders();
  const folderName = (id) => VS.store.walletFolderName(id);
  const folderHref = (id) => "#/wallet" + (id && id !== "all" ? "?folder=" + encodeURIComponent(id) : "");
  const validFolder = (id) => id === "all" || !!VS.store.walletFolder(id);
  const destId = () => (st.folder === "all" ? "general" : st.folder);
  const destName = () => folderName(destId());
  let folderRO = null;            // watches the chip row for the edge fade

  /** The kept sentence with the kept word highlighted, the way a teacher
      would underline it. Falls back to the plain sentence when the form
      in the sentence is too different to find. */
  function sentence(e) {
    const hit = VS.findIn({ word: e.word }, e.sentence, true);
    if (!hit) return html`${e.sentence}`;
    return html`${hit.before}<mark class="mark">${hit.answer}</mark>${hit.after}`;
  }

  /** Put a looked-up Arabic meaning on a slip that is already on screen. */
  function paintArabic(id, ar) {
    if (!ar) return;
    const slip = document.querySelector(`.wallet-slip[data-id="${CSS.escape(id)}"]`);
    if (!slip) return;
    const had = slip.querySelector(".wallet-ar");
    if (had) { had.textContent = ar; return; }
    const head = slip.querySelector(".wallet-slip-head");
    if (head) head.insertAdjacentHTML("afterend", String(html`
      <div class="wallet-translation">
        <p class="wallet-ar-label">Translation</p>
        <p class="wallet-ar" lang="ar" dir="rtl">${ar}</p>
      </div>`));
  }

  /**
   * Keep a word — the one door used by the wallet's pocket and Today's
   * compact add box. Arabic is not a lookup: it is a slip in its own right,
   * saved exactly as the learner wrote it. The English comes later, through
   * Make with AI or Add now, both of which open Add → From Arabic. English
   * gets its Arabic looked up quietly afterwards (Auto-fill on, online only).
   * `folder` is optional: a shared word defaults to Shared, everything else
   * to General. Returns { ok, entry, word, reason }; every message is shown
   * here so both boxes speak the same way.
   */
  VS.walletCapture = async function (fields) {
    const f = fields || {};
    const input = f.input || null;
    let word = String(f.word || "").trim().replace(/\s+/g, " ");
    if (!word) { if (input) input.focus(); return { ok: false, reason: "empty" }; }
    const typedArabic = VS.isArabicTyping(word) ? word : "";
    const r = VS.store.walletAdd(word, f.sentence || "", f.source || "", typedArabic ? "ar" : (f.kind || ""), typedArabic, f.folder || "");
    if (r.inLibrary) {
      VS.toast(`“${VS.cap(word)}” is already one of your words.`);
      return { ok: false, reason: "library", word };
    }
    if (r.existed) {
      // The same English word kept earlier: the Arabic typed now still belongs to it.
      if (typedArabic) {
        VS.store.walletSetArabic(r.entry.id, typedArabic);
        paintArabic(r.entry.id, r.entry.arabic);     // the store keeps the first Arabic it was given
      }
      VS.toast(`“${VS.cap(r.entry.word)}” is already in your wallet — in ${folderName(r.entry.folder)}.`);
      return { ok: false, reason: "wallet", entry: r.entry, word };
    }
    if (!r.ok) return { ok: false, reason: "bad", word };
    VS.sfx.play("pop");
    VS.toast(`Saved “${VS.cap(r.entry.word)}” to ${folderName(r.entry.folder)}.`, {
      label: "Undo",
      run: () => { VS.store.walletRemove(r.entry.id); VS.app.render(); },
    });
    // The meaning fills in by itself, unless Auto-fill is off (nothing leaves the device).
    if (!typedArabic && VS.autofill.enabled() && navigator.onLine) {
      VS.arabicWord(r.entry.word).then((ar) => {
        if (!ar) return;
        VS.store.walletSetArabic(r.entry.id, ar);
        paintArabic(r.entry.id, ar);
      });
    }
    return { ok: true, entry: r.entry, word: r.entry.word };
  };

  /** One slip: its number, the word and its sound, the Arabic, where you met
      it (the sentence with the word marked), where it came from and when, its
      folder tag, and the two doors plus remove. */
  function slip(e, i) {
    const lead = e.kind === "shared" ? "Shared by" : e.kind === "meaning" ? "From the meaning of" : "From the example for";
    const from = e.source ? html`${lead} <b>${e.kind === "shared" ? e.source : VS.cap(e.source)}</b>` : "";
    const isArabic = VS.isArabicTyping(e.word);
    const inName = folderName(e.folder);
    return html`
      <li class="wallet-slip ${isArabic ? "is-arabic" : ""}" data-id="${e.id}">
        <div class="wallet-slip-head">
          <span class="wallet-slip-n" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
          <h2 class="wallet-word ${isArabic ? "is-arabic" : ""}" ${isArabic ? VS.raw('lang="ar" dir="rtl"') : ""}>${VS.cap(e.word)}</h2>
          ${isArabic ? "" : VS.ui.speakButton(e.word, `Hear “${e.word}”`)}
        </div>
        ${isArabic
          ? html`<p class="wallet-next">${icon("arrow-right", "icon-sm")}<span>English comes next — Make with AI or Add now.</span></p>`
          : e.arabic ? html`
            <div class="wallet-translation">
              <p class="wallet-ar-label">Translation</p>
              <p class="wallet-ar" lang="ar" dir="rtl">${e.arabic}</p>
            </div>` : ""}
        ${e.sentence ? html`<blockquote class="wallet-sentence" dir="auto">“${sentence(e)}”</blockquote>` : ""}
        <div class="wallet-meta">
          <button class="wallet-folder-tag" type="button" data-action="wallet-move" data-id="${e.id}"
            aria-label="Move “${VS.cap(e.word)}” — in ${inName}. Change folder" title="Change folder">
            ${icon("folder", "icon-sm")}<span>${inName}</span></button>
          <span class="wallet-sep" aria-hidden="true">·</span>
          <span class="wallet-meta-text">${from}${from ? html`<span class="wallet-sep" aria-hidden="true">·</span>` : ""}<span>Saved ${VS.ui.dateText(e.added)}</span></span>
        </div>
        <div class="wallet-actions">
          <button class="btn btn-tonal wallet-ai" type="button" data-action="wallet-ai" data-id="${e.id}"
            title="Ask ChatGPT or Claude for its Arabic, definition and example — then check it and add it">
            ${icon("bolt", "icon-sm")}<span>Make with AI</span></button>
          <button class="btn wallet-add" type="button" data-action="wallet-add" data-id="${e.id}"
            title="${VS.autofill.enabled()
              ? "Add it to your words now — its meaning, Arabic and example fill in by themselves. Edit it any time."
              : "Open the Add form with this word filled in (Auto-fill is off)"}">
            ${icon("plus", "icon-sm")}<span>Add now</span></button>
          <button class="icon-btn wallet-remove" type="button" data-action="wallet-remove" data-id="${e.id}"
            aria-label="Remove “${e.word}” from your wallet" title="Remove from your wallet">${icon("trash", "icon-sm")}</button>
        </div>
      </li>`;
  }

  /** Wallet words that are not library words yet (a word added elsewhere leaves quietly). */
  function waiting() {
    VS.store.wallet().filter((e) => VS.findWord(e.word)).forEach((e) => VS.store.walletRemove(e.id));
    return VS.store.wallet().slice().reverse();      // newest first: what you just kept is at the top
  }

  /** The whole wallet, the selected folder's words, and the counts for the
      chips and the folder sheet — all from one read. */
  function snapshot() {
    const all = waiting();
    const counts = { all: all.length, by: {} };
    all.forEach((e) => { counts.by[e.folder] = (counts.by[e.folder] || 0) + 1; });
    const list = st.folder === "all" ? all : all.filter((e) => e.folder === st.folder);
    return { all, list, counts };
  }

  /** The search box: hide the slips that match neither the word, its Arabic nor its sentence. */
  function filter(root) {
    const norm = (t) => String(t || "").toLowerCase().replace(/\s+/g, " ").trim();
    const q = norm(st.q);
    const byId = {};
    VS.store.wallet().forEach((e) => { byId[e.id] = e; });
    let shown = 0;
    root.querySelectorAll(".wallet-slip").forEach((li) => {
      const e = byId[li.dataset.id];
      const hit = !q || (e && norm([e.word, e.arabic, e.sentence, e.source].join(" ")).includes(q));
      li.hidden = !hit;
      if (hit) shown++;
    });
    const none = root.querySelector(".wallet-none");
    if (none) {
      none.hidden = shown > 0;
      const term = none.querySelector("[data-wallet-q-term]");
      if (term) term.textContent = st.q;
    }
    const count = root.querySelector(".wallet-count");
    if (count) count.textContent = q ? `${shown} of ${snapshot().list.length}` : "";
  }

  /** Keep the chosen folder honest: a deleted id falls back to All and the
      address is cleaned, so a stale link never shows an empty lie. */
  function ensureFolder() {
    if (validFolder(st.folder)) return;
    st.folder = "all";
    st.q = "";
    if (/[?&]folder=/.test(location.hash)) history.replaceState(null, "", VS.cleanPath() + "#/wallet");
  }

  /* ── The folder sheet: create, rename, delete ──────────────────── */
  const folderError = (code) => code === "empty" ? "Give the folder a name."
    : code === "reserved" ? "“All” is the view that shows every folder — choose another name."
    : code === "duplicate" ? "A folder with that name already exists."
    : code === "limit" ? "You have reached the folder limit — delete one first."
    : code === "builtin" ? "General and Shared can be renamed, not deleted."
    : code === "missing" ? "That folder is no longer here."
    : "That folder could not be saved.";

  function folderRow(f, n) {
    const builtin = f.id === "general" || f.id === "shared";
    if (st.rename === f.id) {
      return html`<li class="wallet-folder-row is-renaming" data-folder="${f.id}">
        <form class="wallet-folder-rename" data-form="wallet-folder-rename">
          <label class="form-field"><span>Rename “${f.name}”</span>
            <input name="name" data-rename-input maxlength="40" dir="auto" value="${st.renameName}" autocomplete="off"></label>
          ${st.renameError ? html`<p class="wallet-form-error" role="alert">${st.renameError}</p>` : ""}
          <div class="row wallet-folder-row-actions">
            <button class="btn btn-primary" type="submit">Save</button>
            <button class="btn btn-quiet" type="button" data-action="wallet-folder-rename-cancel">Cancel</button>
          </div>
        </form>
      </li>`;
    }
    return html`<li class="wallet-folder-row" data-folder="${f.id}">
      <span class="wallet-folder-ico" aria-hidden="true">${icon("folder", "icon-sm")}</span>
      <span class="wallet-folder-name">${f.name}</span>
      ${builtin ? html`<span class="wallet-folder-badge">Default</span>` : ""}
      <span class="wallet-folder-n">${n}</span>
      <button class="icon-btn" type="button" data-action="wallet-folder-rename" data-id="${f.id}"
        aria-label="Rename “${f.name}”" title="Rename">${icon("pen", "icon-sm")}</button>
      ${builtin ? "" : html`<button class="icon-btn wallet-folder-del" type="button" data-action="wallet-folder-delete" data-id="${f.id}"
        aria-label="Delete “${f.name}”" title="Delete">${icon("trash", "icon-sm")}</button>`}
    </li>`;
  }

  function folderSheetMarkup() {
    const { counts } = snapshot();
    return html`
      <div class="sheet-head"><h2 id="walletFoldersTitle">Folders</h2>
        <button class="icon-btn" type="button" data-action="wallet-folders-close" aria-label="Close">${icon("x")}</button></div>
      <div class="sheet-body wallet-folder-sheet">
        <form class="wallet-folder-create" data-form="wallet-folder-create">
          <label class="form-field"><span>New folder</span>
            <input name="name" data-new-folder maxlength="40" dir="auto" value="${st.createName}"
              placeholder="Film, Work, IELTS…" autocomplete="off"></label>
          ${st.createError ? html`<p class="wallet-form-error" role="alert">${st.createError}</p>` : ""}
          <button class="btn btn-primary" type="submit">${icon("plus", "icon-sm")}<span>Create folder</span></button>
        </form>
        <div class="wallet-folder-list-wrap">
          <h3 class="sheet-group">Your folders</h3>
          <ul class="wallet-folder-list">${folders().map((f) => folderRow(f, counts.by[f.id] || 0))}</ul>
        </div>
        <p class="hint">General is where quick saves land. Shared is for words a friend sends. Both can be renamed.</p>
      </div>
      <div class="sheet-foot"><button class="btn" type="button" data-action="wallet-folders-close">Done</button></div>`;
  }

  function ensureFolderDialog() {
    let dlg = document.getElementById("walletFolders");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "walletFolders";
    dlg.className = "sheet wallet-sheet";
    dlg.setAttribute("aria-labelledby", "walletFoldersTitle");
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => { st.rename = ""; st.renameError = ""; });
    dlg.addEventListener("input", (e) => {
      if (e.target.matches("[data-new-folder]")) { st.createName = e.target.value; st.createError = ""; }
      if (e.target.matches("[data-rename-input]")) { st.renameName = e.target.value; st.renameError = ""; }
      const form = e.target.closest("form");
      const err = form && form.querySelector(".wallet-form-error");
      if (err) err.remove();
    });
    dlg.addEventListener("submit", (e) => {
      e.preventDefault();
      if (e.target.matches("[data-form='wallet-folder-create']")) createFolder();
      else if (e.target.matches("[data-form='wallet-folder-rename']")) renameFolder();
    });
    document.body.appendChild(dlg);
    return dlg;
  }

  function drawFolders(focusSel) {
    const dlg = document.getElementById("walletFolders");
    if (!dlg) return;
    const top = dlg.scrollTop;
    dlg.innerHTML = String(folderSheetMarkup());
    dlg.scrollTop = top;
    if (focusSel) {
      const el = dlg.querySelector(focusSel);
      if (el) { el.focus(); if (el.select) el.select(); }
    }
  }

  function openFolderSheet() {
    st.createName = "";
    st.createError = "";
    st.rename = "";
    st.renameName = "";
    st.renameError = "";
    const dlg = ensureFolderDialog();
    drawFolders();
    dlg.showModal();
    const input = dlg.querySelector("[data-new-folder]");
    if (input) input.focus();
  }

  function closeFolderSheet() {
    const dlg = document.getElementById("walletFolders");
    if (dlg && dlg.open) dlg.close();
    st.rename = "";
    st.renameError = "";
  }

  function createFolder() {
    const dlg = document.getElementById("walletFolders");
    const input = dlg && dlg.querySelector("[data-new-folder]");
    const name = input ? input.value : st.createName;
    const r = VS.store.walletFolderCreate(name);
    if (!r.ok) {
      st.createName = name;
      st.createError = folderError(r.error);
      drawFolders("[data-new-folder]");
      return;
    }
    st.createName = "";
    st.createError = "";
    closeFolderSheet();
    st.folder = r.folder.id;
    st.q = "";
    const href = folderHref(r.folder.id);
    if (location.hash === href) VS.app.render(); else location.hash = href;
    VS.toast(`Folder “${r.folder.name}” created — new words save there.`);
  }

  function renameFolder() {
    if (!st.rename) return;
    const dlg = document.getElementById("walletFolders");
    const input = dlg && dlg.querySelector("[data-rename-input]");
    const name = input ? input.value : st.renameName;
    const id = st.rename;
    const r = VS.store.walletFolderRename(id, name);
    if (!r.ok) {
      st.renameName = name;
      st.renameError = folderError(r.error);
      drawFolders("[data-rename-input]");
      return;
    }
    st.rename = "";
    st.renameName = "";
    st.renameError = "";
    VS.app.render();
    drawFolders(`[data-action="wallet-folder-rename"][data-id="${id}"]`);
    VS.toast(`Renamed to “${r.folder.name}”.`);
  }

  /* ── The move sheet: one radio per folder ──────────────────────── */
  function ensureMoveDialog() {
    let dlg = document.getElementById("walletMove");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "walletMove";
    dlg.className = "sheet wallet-sheet";
    dlg.setAttribute("aria-labelledby", "walletMoveTitle");
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => { st.moveId = ""; });
    dlg.addEventListener("submit", (e) => { e.preventDefault(); moveEntry(); });
    document.body.appendChild(dlg);
    return dlg;
  }

  function moveMarkup(e, counts) {
    return html`
      <div class="sheet-head"><h2 id="walletMoveTitle">Move “${VS.cap(e.word)}”</h2>
        <button class="icon-btn" type="button" data-action="wallet-move-close" aria-label="Close">${icon("x")}</button></div>
      <form data-form="wallet-move">
        <div class="sheet-body wallet-move-body">
          <fieldset class="wallet-move-list">
            <legend class="sr-only">Choose a folder</legend>
            ${folders().map((f) => html`
              <label class="wallet-move-row">
                <input type="radio" name="folder" value="${f.id}" ${f.id === e.folder ? VS.raw("checked") : ""}>
                <span class="wallet-move-name">${f.name}</span>
                <span class="wallet-move-n">${counts.by[f.id] || 0}</span>
              </label>`)}
          </fieldset>
        </div>
        <div class="sheet-foot">
          <button class="btn" type="button" data-action="wallet-move-close">Cancel</button>
          <button class="btn btn-primary" type="submit">Move</button>
        </div>
      </form>`;
  }

  function openMove(id) {
    const e = VS.store.wallet().find((x) => x.id === id);
    if (!e) return;
    st.moveId = id;
    const dlg = ensureMoveDialog();
    dlg.innerHTML = String(moveMarkup(e, snapshot().counts));
    dlg.showModal();
    const checked = dlg.querySelector("input[name='folder']:checked");
    if (checked) checked.focus();
  }

  function focusMoveTag(id) {
    const tag = document.querySelector(`.wallet-slip[data-id="${CSS.escape(id)}"] [data-action="wallet-move"]`);
    if (tag) { tag.focus({ preventScroll: true }); return; }
    const view = VS.$("#view");
    if (view) view.focus({ preventScroll: true });
  }

  function moveEntry() {
    const dlg = document.getElementById("walletMove");
    if (!dlg || !st.moveId) return;
    const picked = dlg.querySelector("input[name='folder']:checked");
    if (!picked) return;
    const id = st.moveId;
    const r = VS.store.walletSetFolder(id, picked.value);
    dlg.close();
    st.moveId = "";
    if (!r.ok) return;
    if (r.unchanged) { focusMoveTag(id); return; }
    VS.app.render();
    VS.toast(`Moved to “${folderName(picked.value)}”.`, {
      label: "Undo",
      run: () => { VS.store.walletSetFolder(id, r.from); VS.app.render(); focusMoveTag(id); },
    });
    focusMoveTag(id);
  }

  VS.views.wallet = {
    title: () => (st.folder === "all" ? "Wallet" : folderName(st.folder) + " · Wallet"),
    crumbs: () => (st.folder === "all"
      ? [{ label: "Wallet" }]
      : [{ label: "Wallet", href: "#/wallet" }, { label: folderName(st.folder) }]),

    start(p) {
      const wanted = new URLSearchParams(p.query || "").get("folder") || "all";
      const next = validFolder(wanted) ? wanted : "all";
      if (next !== st.folder) st.q = "";
      st.folder = next;
      if (next !== wanted) history.replaceState(null, "", VS.cleanPath() + "#/wallet");
    },

    leave() {
      if (folderRO) { folderRO.disconnect(); folderRO = null; }
      ["walletFolders", "walletMove"].forEach((id) => {
        const dlg = document.getElementById(id);
        if (dlg && dlg.open) dlg.close();
      });
      st.moveId = "";
      st.rename = "";
      st.renameError = "";
    },

    render() {
      ensureFolder();
      const { list, counts } = snapshot();
      const n = list.length;
      const total = counts.all;
      const inAll = st.folder === "all";
      const name = inAll ? "" : folderName(st.folder);
      const dest = destName();
      return html`
        <div class="page wallet-page view-enter">
          <header class="page-head wallet-head">
            <div>
              <h1>Wallet</h1>
              <p class="hint">${inAll
                ? total
                  ? html`<b>${VS.plural(total, "word")}</b> waiting. Add one when you're ready — nothing here is studied until you do.`
                  : "Words you're saving for later. Nothing here is studied until you choose to learn it."
                : n
                  ? html`<b>${VS.plural(n, "word")}</b> in <b>${name}</b>. Add one when you're ready — nothing here is studied until you do.`
                  : html`No words in <b>${name}</b> yet. Save one in the pocket, or move one here from another folder.`}</p>
            </div>
          </header>

          <nav class="wallet-folders" aria-label="Wallet folders">
            <a class="chip wallet-folder-chip" href="#/wallet" ${inAll ? VS.raw('aria-current="page"') : ""}>
              <span class="wallet-folder-name">All</span><span class="chip-n">${counts.all}</span></a>
            ${folders().map((f) => html`
              <a class="chip wallet-folder-chip" href="${folderHref(f.id)}" ${st.folder === f.id ? VS.raw('aria-current="page"') : ""}>
                <span class="wallet-folder-name">${f.name}</span><span class="chip-n">${counts.by[f.id] || 0}</span></a>`)}
            <button class="chip wallet-folder-new" type="button" data-action="wallet-folders">
              ${icon("plus", "icon-sm")}<span>New folder</span></button>
          </nav>

          <div class="wallet-grid">
            <aside class="wallet-pocket" aria-labelledby="walletKeepTitle">
              <span class="wallet-pocket-edge is-back" aria-hidden="true"></span>
              <span class="wallet-pocket-edge is-front" aria-hidden="true"></span>
              <div class="wallet-pocket-in">
                <div class="wallet-pocket-head">
                  <h2 class="wallet-pocket-title" id="walletKeepTitle">Keep a word</h2>
                  ${n ? html`<span class="wallet-pocket-count">${n} saved</span>` : ""}
                </div>
                <p class="wallet-dest">${icon("folder", "icon-sm")}<span>Saving to <b>${dest}</b></span></p>
                <form class="wallet-keep" data-form="wallet-keep" autocomplete="off" aria-label="Save a word in your wallet">
                  <div class="wallet-keep-line">
                    <span class="field wallet-keep-field">
                      <input name="word" dir="auto" value="${st.draft}" placeholder="Word or phrase" aria-label="A word or phrase — English or Arabic"
                        spellcheck="false" autocapitalize="off" maxlength="80" enterkeyhint="done" required/>
                    </span>
                    <button class="btn btn-primary wallet-keep-btn" type="submit" aria-label="Save this word in your wallet">
                      ${icon("plus", "icon-sm")}<span>Save</span></button>
                  </div>
                  ${st.sentence
                    ? html`<label class="field wallet-keep-sentence"><span class="sr-only">Where you met it (optional)</span>
                        <textarea name="sentence" rows="2" dir="auto" maxlength="300" placeholder="Where you met it — the sentence you read or heard (optional)">${st.draftSentence}</textarea></label>`
                    : html`<button class="link-btn wallet-keep-more" type="button" data-action="wallet-keep-more">${icon("plus", "icon-sm")}<span>Add where you met it</span></button>`}
                  <p class="wallet-keep-hint">English or Arabic — Arabic is saved exactly as you write it.</p>
                </form>
                ${n > 1 ? html`
                  <div class="wallet-pocket-foot">
                    <button class="btn btn-tonal wallet-all" type="button" data-action="wallet-ai-all"
                      title="One prompt for ${n > 30 ? "the 30 newest words" : "every word"} ${inAll ? "here" : "in " + name}, each with its sentence">
                      ${icon("bolt", "icon-sm")}<span>Make ${n > 30 ? "30" : "all"} with AI</span></button>
                    <p class="hint">One prompt. Each word keeps its sentence.</p>
                  </div>` : ""}
              </div>
            </aside>

            <section class="wallet-slips" aria-label="${inAll ? "Words saved for later" : "Words in " + name}">
              ${n ? html`
                ${n > 6 ? html`<div class="wallet-tools">
                  <label class="field wallet-search">${icon("search", "icon-sm")}<span class="sr-only">Search ${inAll ? "your wallet" : name}</span>
                    <input type="search" data-wallet-q value="${st.q}" placeholder="Search ${inAll ? "your wallet" : name}" autocomplete="off" spellcheck="false"/></label>
                  <p class="wallet-count" aria-live="polite"></p>
                </div>` : ""}
                <ol class="wallet-slip-list">${list.map((e, i) => slip(e, i))}</ol>
                <p class="wallet-none hint" hidden>${inAll ? "Nothing in your wallet" : html`Nothing in <b>${name}</b>`} matches “<b data-wallet-q-term></b>”.</p>
                <footer class="wallet-end">
                  <p class="hint">Saved on this device, inside your backup.</p>
                  <button class="btn btn-danger-quiet wallet-clear" type="button" data-action="wallet-clear">
                    ${icon("trash", "icon-sm")}<span>${inAll ? "Clear wallet" : "Clear folder"}</span></button>
                </footer>`
              : total === 0 ? html`
                <div class="empty wallet-empty">
                  <figure class="desk-photo wallet-print">
                    <img src="assets/img/wallet-page.webp" width="1000" height="668" loading="lazy" decoding="async"
                      alt="A blank notebook and a pen on a pale desk, waiting for a first word.">
                    <figcaption><b>An empty pocket</b> is how every wallet starts. The first word can come from anywhere.</figcaption>
                  </figure>
                  <h2>Your wallet is empty</h2>
                  <p>Keep a word here when you meet it — type it in the pocket, or tap a word you don't know while reading and save it with its sentence. New words land in <b>${dest}</b>.</p>
                  <div class="row empty-actions"><a class="btn" href="#/words">Open your words</a></div>
                </div>`
              : html`
                <div class="empty wallet-empty wallet-folder-empty">
                  <span class="wallet-empty-mark" aria-hidden="true">${icon("folder", "icon-lg")}</span>
                  <h2>Nothing in “${name}” yet</h2>
                  <p>Save a word in the pocket above and it lands here. Or move one in from another folder with the folder tag on its slip.</p>
                  <div class="row empty-actions"><a class="btn" href="#/wallet">Show all words</a></div>
                </div>`}
            </section>
          </div>
        </div>`;
    },

    mount(root) {
      const form = root.querySelector("[data-form='wallet-keep']");
      if (form) {
        const input = form.querySelector("[name='word']");
        const sentenceBox = form.querySelector("[name='sentence']");
        if (input) input.addEventListener("input", () => { st.draft = input.value; });
        if (sentenceBox) sentenceBox.addEventListener("input", () => { st.draftSentence = sentenceBox.value; });
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const r = await VS.walletCapture({
            word: input.value,
            sentence: sentenceBox ? sentenceBox.value : "",
            folder: destId(),
            input,
            anchor: form.querySelector(".wallet-keep-line"),
          });
          if (!r.ok) { if (input) input.focus(); return; }
          st.q = ""; st.sentence = false; st.draft = ""; st.draftSentence = "";
          VS.app.render();
          const fresh = document.querySelector(`.wallet-slip[data-id="${CSS.escape(r.entry.id)}"]`);
          if (fresh) fresh.classList.add("is-new");
          const again = document.querySelector("[data-form='wallet-keep'] [name='word']");
          if (again) again.focus();
        });
      }
      const q = root.querySelector("[data-wallet-q]");
      if (q) { q.addEventListener("input", () => { st.q = q.value; filter(root); }); if (st.q) filter(root); }

      /* The chip row is one line on a phone. Fade its edge while a folder is
         off-screen, clear the fade at the end, and bring the chosen folder
         into view when a link opens the wallet deep in the row. */
      const nav = root.querySelector(".wallet-folders");
      if (nav) {
        if (folderRO) { folderRO.disconnect(); folderRO = null; }
        const update = () => {
          const over = nav.scrollWidth > nav.clientWidth + 1;
          nav.classList.toggle("is-overflow", over);
          nav.classList.toggle("is-end", !over || nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 2);
        };
        const reveal = () => {
          const current = nav.querySelector('[aria-current="page"]');
          if (!current || nav.scrollWidth <= nav.clientWidth + 1) return;
          const box = nav.getBoundingClientRect();
          const chip = current.getBoundingClientRect();
          if (chip.left < box.left) nav.scrollLeft -= box.left - chip.left + 16;
          else if (chip.right > box.right) nav.scrollLeft += chip.right - box.right + 16;
        };
        requestAnimationFrame(() => { reveal(); update(); });
        nav.addEventListener("scroll", update, { passive: true });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(update).catch(() => {});
        if (window.ResizeObserver) {
          folderRO = new ResizeObserver(update);
          folderRO.observe(nav);
        }
      }
    },

    actions: {
      "wallet-keep-more"() {
        const input = document.querySelector("[data-form='wallet-keep'] [name='word']");
        if (input) st.draft = input.value;
        st.sentence = true;
        VS.app.render();
        const t = document.querySelector("[data-form='wallet-keep'] [name='sentence']");
        if (t) t.focus();
      },

      "wallet-folders"() { openFolderSheet(); },
      "wallet-folders-close"() { closeFolderSheet(); },
      "wallet-folder-rename"(el) {
        const f = VS.store.walletFolder(el.dataset.id);
        if (!f) return;
        st.rename = f.id;
        st.renameName = f.name;
        st.renameError = "";
        drawFolders("[data-rename-input]");
      },
      "wallet-folder-rename-cancel"() {
        const id = st.rename;
        st.rename = "";
        st.renameError = "";
        drawFolders(`[data-action="wallet-folder-rename"][data-id="${id}"]`);
      },
      async "wallet-folder-delete"(el) {
        const f = VS.store.walletFolder(el.dataset.id);
        if (!f) return;
        const n = snapshot().counts.by[f.id] || 0;
        const general = folderName("general");
        const yes = await VS.confirm({
          title: `Delete “${f.name}”?`,
          body: n
            ? `${VS.plural(n, "word")} in it move to ${general}. Nothing is lost, and your other folders are not touched.`
            : "The folder is empty. Nothing is lost, and your other folders are not touched.",
          confirmLabel: "Delete folder",
        });
        if (!yes) return;
        const r = VS.store.walletFolderDelete(f.id);
        if (!r.ok) return;
        if (st.folder === f.id) {
          st.folder = "all";
          st.q = "";
          history.replaceState(null, "", VS.cleanPath() + "#/wallet");
        }
        VS.app.render();
        drawFolders("[data-new-folder]");
        VS.toast(r.moved
          ? `“${f.name}” deleted. ${VS.plural(r.moved, "word")} moved to ${general}.`
          : `“${f.name}” deleted.`);
      },

      "wallet-move"(el) { openMove(el.dataset.id); },
      "wallet-move-close"() {
        const dlg = document.getElementById("walletMove");
        if (dlg && dlg.open) dlg.close();
        st.moveId = "";
      },

      /* Nothing is added from here in one tap: both doors open the Add
         screen with the word, its Arabic and its sentence filled in, and the
         learner checks it there. "Make with AI" opens the With AI tab (the
         prompt carries the sentence and Arabic, so the AI explains THAT
         meaning); "Add now" opens the form when Auto-fill is off. The word
         leaves the wallet once it is added. */
      "wallet-ai"(el) {
        const e = VS.store.wallet().find((x) => x.id === el.dataset.id);
        if (!e) return;
        // An Arabic slip goes straight to "From Arabic": that prompt asks the
        // AI for the natural English, which is exactly what the slip needs.
        if (VS.isArabicTyping(e.word)) {
          VS.walletDraft = { ar: e.word, items: [e] };
          location.hash = "#/add?tab=ai-ar";
          return;
        }
        VS.walletDraft = { ai: true, items: [e] };
        location.hash = "#/add?tab=ai";
      },
      "wallet-ai-all"() {
        const items = snapshot().list.slice(0, 30);
        if (!items.length) return;
        // A folder batch suggests the folder's name as the batch tag, so the
        // words can be studied together after they are added. It is visible
        // and editable on the Add screen, never a hidden write.
        const tag = st.folder === "all" ? "" : folderName(st.folder);
        const arabic = items.filter((e) => VS.isArabicTyping(e.word));
        const english = items.filter((e) => !VS.isArabicTyping(e.word));
        if (!english.length) {
          VS.walletDraft = { ar: arabic.map((e) => e.word).join("\n"), items: arabic };
          location.hash = "#/add?tab=ai-ar";
          return;
        }
        if (arabic.length) VS.toast("English slips go to With AI. The Arabic ones wait here for From Arabic.");
        VS.walletDraft = { ai: true, items: english, tag };
        location.hash = "#/add?tab=ai";
      },
      /* Add now: the word joins the library immediately, its sentence as
         "where you met it", its Arabic kept, and Auto-fill completes the rest
         in the background; the learner can edit anything later. With
         Auto-fill off nothing may leave the device, so the filled-in Add form
         opens instead. */
      "wallet-add"(el) {
        const e = VS.store.wallet().find((x) => x.id === el.dataset.id);
        if (!e) return;
        // The library needs an English headword. An Arabic slip opens the
        // same "From Arabic" route as Make with AI, ready to ask.
        if (VS.isArabicTyping(e.word)) {
          VS.walletDraft = { ar: e.word, items: [e] };
          location.hash = "#/add?tab=ai-ar";
          return;
        }
        const source = e.source ? (e.kind === "meaning" ? "From the meaning of " : "From the example for ") + VS.cap(e.source) : "";
        const fields = { word: e.word, context: e.sentence, source, arabic: e.arabic || "" };
        if (!VS.autofill.enabled()) {
          VS.walletDraft = fields;
          location.hash = "#/add?tab=type";
          return;
        }
        const w = VS.addWord(fields);
        if (!w) return;
        VS.app.render();
        VS.toast(`“${w.word}” added to your words — its meaning fills in by itself. Edit it any time.`, {
          label: "Undo",
          run: () => { VS.store.deleteUserWords([w.id]); VS.store.walletRestore([e]); VS.app.render(); },
        });
      },

      async "wallet-remove"(el) {
        const e = VS.store.wallet().find((x) => x.id === el.dataset.id);
        if (!e) return;
        const yes = await VS.confirm({
          title: `Remove “${VS.cap(e.word)}” from your wallet?`,
          body: e.sentence ? "The sentence you kept with it goes too. You can undo it right after." : "You can undo it right after.",
          confirmLabel: "Remove",
        });
        if (!yes) return;
        const gone = VS.store.walletRemove(el.dataset.id);
        if (!gone) return;
        VS.app.render();
        VS.toast(`“${VS.cap(gone.word)}” removed from your wallet.`, {
          label: "Undo",
          run: () => { VS.store.walletRestore([gone]); VS.app.render(); },
        });
      },

      async "wallet-clear"() {
        const inAll = st.folder === "all";
        const name = folderName(st.folder);
        const n = snapshot().list.length;
        if (!n) return;
        const yes = await VS.confirm({
          title: inAll ? `Clear ${VS.plural(n, "word")} from your wallet?` : `Clear ${VS.plural(n, "word")} from “${name}”?`,
          body: inAll
            ? "The words and the sentences you kept go too. Your library and your progress are not touched."
            : `Only the words in “${name}” go. Words in your other folders, your library and your progress are not touched.`,
          confirmLabel: inAll ? "Clear wallet" : "Clear folder",
        });
        if (!yes) return;
        const gone = VS.store.walletClear(inAll ? undefined : st.folder);
        VS.app.render();
        VS.toast(inAll ? "Wallet cleared." : `“${name}” cleared.`, {
          label: "Undo",
          run: () => { VS.store.walletRestore(gone); VS.app.render(); },
        });
      },
    },
  };
})();
