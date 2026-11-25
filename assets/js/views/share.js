/* views/share.js — Share with: send words to a friend, and receive them.
   ------------------------------------------------------------------
   docs/SHARE.md has the why. Two screens, one file:

   #/share[?filter | ?ids=a,b]   SEND. Choose the words (from where you came:
       the Words page's filter, one word's page, or a source here), say what
       it is (title, your name, a note), choose what goes (Arabic, definition
       and example, part of speech/level/IPA, where you met it — or words
       only), then send: the phone's share sheet, Copy link, Copy as a
       message, a QR code, or a file.

   #/shared?d=<payload>   RECEIVE. Who sent it and why, the words with
       "already yours" marked, a tag, "Use their Arabic", then Add N to my
       words or Save N for later (the wallet). Then: Learn them now.

   The words travel inside the link (core/share.js): no server, no account.
   Progress, notes and your own sentences are never read here.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;
  // Your name, remembered as a setting (VS.store), so the next list is signed for you.
  const myName = () => String(VS.store.settings().shareFrom || "");
  const num = (n) => n.toLocaleString("en-GB");

  /* ═════════════════════════════ SEND ═════════════════════════════ */

  const SOURCES = [
    ["all", "All"], ["new", "New"], ["learning", "Learning"], ["mastered", "Mastered"],
  ];
  let s = null;        // the send screen's state

  function freshSend(params) {
    const q = new URLSearchParams(params.query || "");
    const ids = (q.get("ids") || "").split(",").map((x) => x.trim()).filter((id) => VS.byId[id]);
    q.delete("ids");
    const filter = q.toString();
    const f = VS.filters.parse(filter);
    const source = ids.length ? "chosen" : filter ? "list" : "all";
    s = {
      source, ids, filter, tag: "all", search: "",
      picked: new Set(),
      title: f.tag && f.tag !== "all" ? f.tag : ids.length === 1 ? VS.cap(VS.byId[ids[0]].word) : "",
      from: myName(), note: "",
      inc: { a: true, d: true, p: true, c: false }, wordsOnly: false,
      payload: "", link: "", busy: false, qr: false, timer: 0,
    };
    pool().forEach((w) => s.picked.add(w.id));          // everything you came with starts chosen
  }

  /** The words the source offers (before the search box and the ticks). */
  function pool() {
    if (s.source === "chosen") return s.ids.map((id) => VS.byId[id]).filter(Boolean);
    if (s.source === "list") return VS.filters.apply(VS.allWords(), VS.filters.parse(s.filter));
    const f = VS.filters.parse("");
    if (s.source !== "all") f.status = s.source;
    if (s.tag !== "all") f.tag = s.tag;
    f.sort = "az";
    return VS.filters.apply(VS.allWords(), f);
  }
  const shown = () => {
    const q = s.search.trim().toLowerCase();
    const list = pool();
    return q ? list.filter((w) => (w.word + " " + (w.arabic || "") + " " + (w.definition || "")).toLowerCase().includes(q)) : list;
  };
  const chosen = () => VS.allWords().filter((w) => s.picked.has(w.id));

  /** The letters for core/share.js, from the "What goes" boxes. */
  function keys() {
    if (s.wordsOnly) return "";
    return (s.inc.a ? "a" : "") + (s.inc.d ? "de" : "") + (s.inc.p ? "pli" : "") + (s.inc.c ? "c" : "");
  }

  /** Build the link again (a moment after the last change), then refresh the send panel in place. */
  function relink() {
    clearTimeout(s.timer);
    s.timer = setTimeout(async () => {
      const words = chosen().slice(0, VS.share.LIMITS.words);
      if (!words.length) { s.payload = s.link = ""; paintSend(); return; }
      s.busy = true;
      try {
        s.payload = await VS.share.encode({ title: s.title, from: s.from, note: s.note, keys: keys(), words });
        s.link = VS.share.link(s.payload);
      } catch (e) { s.payload = s.link = ""; }
      s.busy = false;
      paintSend();
    }, 160);
  }

  /** What the send panel says about the link: how many words, how long, what to do if long. */
  function linkState() {
    const n = s.picked.size, L = s.link.length, lim = VS.share.LIMITS;
    if (!n) return { tone: "idle", text: "Choose at least one word." };
    if (n > lim.words) return { tone: "warn", text: `Only the first ${lim.words} words fit in one link. Share the rest in a second one.` };
    if (s.busy || !s.link) return { tone: "idle", text: "Making the link…" };
    if (L > lim.longLink) return { tone: "warn", text: `A long link (${num(L)} characters): some chat apps cut links this long. Try “Words only”, fewer words, or send a file.` };
    return { tone: "ok", text: `${VS.plural(n, "word")} · a link of ${num(L)} characters${L <= lim.qr ? " · fits a QR code" : ""}` };
  }

  /** Update the counts, the link line and the buttons without redrawing the page (keeps focus and scroll). */
  function paintSend() {
    const root = VS.$(".share-page");
    if (!root) return;
    const n = s.picked.size;
    const st = linkState();
    const line = VS.$(".share-status", root);
    if (line) { line.className = "share-status is-" + st.tone; line.querySelector("span").textContent = st.text; }
    VS.$$("[data-share-count]", root).forEach((el) => { el.textContent = VS.plural(n, "word"); });
    VS.$$("[data-share-go]", root).forEach((el) => { el.textContent = "Share " + VS.plural(n, "word"); });
    const count = VS.$(".share-picked", root);
    if (count) count.textContent = `${num(n)} of ${num(pool().length)} chosen`;
    const ready = !!s.link && n > 0 && n <= VS.share.LIMITS.words;
    VS.$$("[data-needs-link]", root).forEach((b) => { b.disabled = !ready; });
    const qrBtn = VS.$('[data-action="share-qr"]', root);
    if (qrBtn) qrBtn.disabled = !ready || s.link.length > VS.share.LIMITS.qr;
    if (s.qr) drawQr();
  }

  async function drawQr() {
    const box = VS.$(".share-qr");
    if (!box) return;
    if (!s.link || s.link.length > VS.share.LIMITS.qr) { box.hidden = true; s.qr = false; return; }
    box.hidden = false;
    try { await VS.loadScript("assets/vendor/qrcode.js", "qrcode"); } catch (e) { box.querySelector("p").textContent = "The QR maker didn't load. Reload the app and try again."; return; }
    const qr = window.qrcode(0, "M");
    qr.addData(s.link, "Byte");
    qr.make();
    const canvas = box.querySelector("canvas");
    const n = qr.getModuleCount(), quiet = 4, total = n + quiet * 2;
    const scale = Math.max(2, Math.floor(560 / total));
    canvas.width = canvas.height = total * scale;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111827";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
  }

  /** A readable message: the title, who, the words with their Arabic, then the link. */
  function message() {
    const words = chosen().slice(0, VS.share.LIMITS.words);
    const head = [s.title || "Words for you", s.from ? "from " + s.from : ""].filter(Boolean).join(" — ");
    const lines = words.map((w, i) => `${i + 1}. ${w.word}${w.arabic && !s.wordsOnly && s.inc.a ? " — " + w.arabic : ""}`);
    return [head, s.note, "", ...lines, "", "Open them in VocabStudy and learn them:", s.link].filter((l, i, a) => l !== "" || (a[i - 1] !== "" && i > 0)).join("\n");
  }

  /** A file for anyone who prefers one: only the fields chosen, never progress or notes. */
  function downloadFile() {
    const words = chosen().slice(0, VS.share.LIMITS.words);
    const cols = ["word"].concat(s.wordsOnly ? [] : [].concat(s.inc.a ? ["arabic"] : [], s.inc.d ? ["definition", "example"] : [], s.inc.p ? ["type", "level", "ipa"] : [], s.inc.c ? ["context"] : []));
    if (s.title) cols.push("tags");
    const cell = (v) => { const t = String(v == null ? "" : v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const rows = words.map((w) => cols.map((c) => cell(c === "tags" ? s.title : w[c])).join(","));
    const blob = new Blob(["﻿" + [cols.join(",")].concat(rows).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vocabstudy-" + (s.title || "shared").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    VS.toast("File saved. Your friend opens it in Add → Upload files.");
  }

  function sourceBar() {
    const tags = VS.allTags();
    const opts = (s.ids.length ? [["chosen", s.ids.length === 1 ? "This word" : "These words"]] : [])
      .concat(s.filter ? [["list", "My list"]] : [], SOURCES);
    return html`
      <div class="share-sources">
        <div class="seg share-seg" role="group" aria-label="Which words">
          ${opts.map(([v, l]) => html`<button type="button" data-action="share-source" data-value="${v}" aria-pressed="${s.source === v}">${l}</button>`)}
        </div>
        ${tags.length && !["chosen", "list"].includes(s.source) ? html`<label class="share-tag"><span class="sr-only">Tag</span>
          <select data-share-tag>
            <option value="all" ${s.tag === "all" ? VS.raw("selected") : ""}>Any tag</option>
            ${tags.map((t) => html`<option value="${t.tag}" ${s.tag === t.tag ? VS.raw("selected") : ""}>#${t.tag} (${t.count})</option>`)}
          </select></label>` : ""}
      </div>`;
  }

  function pickRow(w) {
    const on = s.picked.has(w.id);
    return html`
      <label class="share-row ${on ? "is-on" : ""}">
        <input type="checkbox" data-share-pick="${w.id}" ${on ? VS.raw("checked") : ""}>
        <span class="share-row-main">
          <b class="share-row-word">${VS.cap(w.word)}</b>
          <span class="share-row-meta">${[w.type, w.level].filter(Boolean).join(" · ") || (w.definition ? w.definition.slice(0, 60) + (w.definition.length > 60 ? "…" : "") : "")}</span>
        </span>
        ${w.arabic ? html`<span class="share-row-ar" lang="ar" dir="rtl">${w.arabic}</span>` : ""}
      </label>`;
  }

  function sendScreen() {
    if (!VS.allWords().length) return html`
      <div class="page share-page view-enter">
        <header class="page-head"><div><h1>Share with a friend</h1>
          <p class="hint">Send words as a link, a QR code or a message — your friend opens them and learns them too.</p></div></header>
        <div class="empty">
          <h2>No words to share yet</h2>
          <p>Add a few words first. Then choose any of them here and send them in one link.</p>
          <div class="row empty-actions"><a class="btn btn-primary" href="#/add">Add words</a></div>
        </div>
      </div>`;
    const list = shown();
    const CAP = 400;
    const native = !!navigator.share;
    return html`
      <div class="page share-page view-enter">
        <header class="page-head">
          <div>
            <h1>Share with a friend</h1>
            <p class="hint">Choose words, say what they are, and send them. Your friend opens the link, sees the words and adds the ones they want.</p>
          </div>
        </header>

        <div class="share-grid">
          <section class="share-pick" aria-labelledby="sharePickTitle">
            <div class="share-step-head">
              <h2 id="sharePickTitle"><span class="act-n" aria-hidden="true">1</span> Choose the words</h2>
              <p class="share-picked" aria-live="polite">${num(s.picked.size)} of ${num(pool().length)} chosen</p>
            </div>
            ${sourceBar()}
            <div class="share-tools">
              <label class="field share-search">${icon("search", "icon-sm")}<span class="sr-only">Search these words</span>
                <input type="search" data-share-search value="${s.search}" placeholder="Search" autocomplete="off" spellcheck="false"></label>
              <button class="btn btn-quiet" type="button" data-action="share-all">Select all</button>
              <button class="btn btn-quiet" type="button" data-action="share-none">None</button>
            </div>
            ${list.length
              ? html`<div class="word-list share-list">${list.slice(0, CAP).map(pickRow)}</div>
                  ${list.length > CAP ? html`<p class="hint share-more">Showing ${CAP} of ${num(list.length)}. Search or choose a tag to narrow the list.</p>` : ""}`
              : html`<p class="hint share-none">No words here${s.search ? html` match “${s.search}”` : ""}.</p>`}
          </section>

          <aside class="share-side" aria-label="Send">
            <section class="card share-card" aria-labelledby="shareNoteTitle">
              <h2 id="shareNoteTitle"><span class="act-n" aria-hidden="true">2</span> Say what it is <small>optional</small></h2>
              <label class="form-field"><span>Title</span>
                <input data-share-in="title" value="${s.title}" maxlength="${VS.share.LIMITS.title}" placeholder="IELTS week 3, Friends S1E2…" dir="auto" autocomplete="off"></label>
              <label class="form-field"><span>Your name</span>
                <input data-share-in="from" value="${s.from}" maxlength="${VS.share.LIMITS.from}" placeholder="So they know who sent it" dir="auto" autocomplete="nickname"></label>
              <label class="form-field"><span>A note</span>
                <textarea data-share-in="note" rows="2" maxlength="${VS.share.LIMITS.note}" placeholder="These came up in today's lesson." dir="auto">${s.note}</textarea></label>
            </section>

            <section class="card share-card" aria-labelledby="shareWhatTitle">
              <h2 id="shareWhatTitle"><span class="act-n" aria-hidden="true">3</span> What goes</h2>
              <div class="share-checks ${s.wordsOnly ? "is-off" : ""}">
                ${[["a", "Arabic meaning"], ["d", "Definition and example"], ["p", "Part of speech, level and IPA"], ["c", "Where I met it — my sentence"]].map(([k, l]) => html`
                  <label class="check"><input type="checkbox" data-share-inc="${k}" ${s.inc[k] ? VS.raw("checked") : ""} ${s.wordsOnly ? VS.raw("disabled") : ""}><span>${l}</span></label>`)}
              </div>
              <label class="check share-only"><input type="checkbox" data-share-only ${s.wordsOnly ? VS.raw("checked") : ""}>
                <span><b>Words only</b> — the shortest link; their app fills in the rest.</span></label>
              <p class="share-private">${icon("check", "icon-sm")}<span>Never sent: your progress, notes and your own sentences. The words travel inside the link — no server sees them.</span></p>
            </section>

            <section class="card share-card share-send" aria-labelledby="shareSendTitle">
              <h2 id="shareSendTitle"><span class="act-n" aria-hidden="true">4</span> Send <span data-share-count>${VS.plural(s.picked.size, "word")}</span></h2>
              <p class="share-status is-idle" aria-live="polite">${icon("info", "icon-sm")}<span>Making the link…</span></p>
              <div class="share-actions">
                ${native ? html`<button class="btn btn-primary btn-lg" type="button" data-action="share-native" data-needs-link disabled>${icon("share", "icon-sm")} Share…</button>` : ""}
                <button class="btn ${native ? "" : "btn-primary btn-lg"}" type="button" data-action="share-copy" data-needs-link disabled>${icon("link", "icon-sm")} Copy link</button>
                <button class="btn" type="button" data-action="share-text" data-needs-link disabled>${icon("text", "icon-sm")} Copy message</button>
                <button class="btn" type="button" data-action="share-qr" aria-expanded="${s.qr}" disabled>${icon("qr", "icon-sm")} QR code</button>
                <button class="btn btn-quiet" type="button" data-action="share-file" data-needs-link disabled>${icon("download", "icon-sm")} Download a file</button>
              </div>
              <div class="share-qr" ${s.qr ? "" : VS.raw("hidden")}>
                <canvas role="img" aria-label="QR code for the shared words"></canvas>
                <p class="hint">Your friend points their phone's camera at it. Good for a class: show it on the screen.</p>
              </div>
            </section>
          </aside>
        </div>

        <div class="share-dock" aria-hidden="true">
          <button class="btn btn-primary btn-block" type="button" data-action="share-go" tabindex="-1">${icon("share", "icon-sm")}<span data-share-go>Share ${VS.plural(s.picked.size, "word")}</span></button>
        </div>
      </div>`;
  }

  /* ════════════════════════════ RECEIVE ════════════════════════════ */

  let r = null;        // the receive screen's state

  function freshReceive(params) {
    const q = new URLSearchParams(params.query || "");
    r = { payload: q.get("d") || "", list: null, err: "", picked: new Set(), tag: "", useAr: true, done: null };
    VS.share.decode(r.payload).then((list) => {
      r.list = list;
      r.tag = list.title || (list.from ? "From " + list.from : "Shared");
      list.words.forEach((w, i) => { if (!mine(w)) r.picked.add(i); });
      if (VS.app.current() === "shared") VS.app.render();
    }).catch((e) => { r.err = e.message || "broken"; if (VS.app.current() === "shared") VS.app.render(); });
  }
  /* A shared word is already yours when the library has the same English word
     with the same Arabic meaning. Without Arabic on either side there is no
     way to tell two meanings apart, so it counts as yours. */
  const mine = (w) => {
    const head = VS.wordKey(w.word);
    const twins = VS.words.filter((x) => VS.wordKey(x.word) === head);
    if (!twins.length) return false;
    const ar = VS.arKey(w.arabic);
    return !ar || twins.some((x) => VS.arKey(x.arabic) === ar);
  };

  function receiveRow(w, i) {
    const have = mine(w);
    const on = r.picked.has(i) && !have;
    return html`
      <label class="share-row is-full ${on ? "is-on" : ""} ${have ? "is-mine" : ""}">
        <input type="checkbox" data-shared-pick="${i}" ${on ? VS.raw("checked") : ""} ${have ? VS.raw("disabled") : ""}>
        <span class="share-row-main">
          <span class="share-row-top">
            <b class="share-row-word">${VS.cap(w.word)}</b>
            ${w.type || w.level ? html`<span class="share-row-meta">${[w.type, w.level].filter(Boolean).join(" · ")}</span>` : ""}
            ${have ? html`<span class="share-row-have">${icon("check", "icon-sm")} Already yours</span>` : ""}
          </span>
          ${w.arabic ? html`<span class="share-row-ar-under" lang="ar" dir="rtl">${w.arabic}</span>` : ""}
          ${w.definition ? html`<span class="share-row-def">${w.definition}</span>` : ""}
          ${w.example ? html`<span class="share-row-ex">“${w.example}”</span>` : ""}
          ${w.context ? html`<span class="share-row-met">Where they met it: “${w.context}”</span>` : ""}
        </span>
        ${w.arabic ? html`<span class="share-row-ar" lang="ar" dir="rtl">${w.arabic}</span>` : ""}
        ${VS.ui.speakButton(w.word, `Hear “${w.word}”`)}
      </label>`;
  }

  function receiveScreen() {
    const head = (title, hint) => html`<header class="page-head"><div><h1>${title}</h1>${hint ? html`<p class="hint">${hint}</p>` : ""}</div></header>`;
    if (r.err) return html`
      <div class="page share-page view-enter">
        ${head("This link didn't open", "")}
        <div class="empty">
          <h2>${r.err === "old-browser" ? "This browser is too old to open shared words" : r.err === "version" ? "This link is from a newer VocabStudy" : "The link is incomplete"}</h2>
          <p>${r.err === "old-browser" ? "Open the link in an up-to-date Chrome, Safari, Edge or Firefox."
            : r.err === "version" ? "Reload the app to get the newest version, then open the link again."
            : "Some chat apps cut long links. Ask your friend to send it again with “Words only”, or as a file."}</p>
          <div class="row empty-actions"><a class="btn" href="#/">Go to Today</a></div>
        </div>
      </div>`;
    if (!r.list) return html`<div class="page share-page view-enter">${head("Opening the shared words…", "")}</div>`;
    const L = r.list;
    if (r.done) return html`
      <div class="page share-page view-enter">
        ${head(r.done.kind === "wallet" ? "Saved for later" : "Added to your words", "")}
        <div class="card share-done">
          <span class="share-done-ico" aria-hidden="true">${icon(r.done.kind === "wallet" ? "wallet" : "check")}</span>
          <h2>${r.done.kind === "wallet"
            ? html`${VS.plural(r.done.n, "word")} in your wallet`
            : html`${VS.plural(r.done.n, "word")} added${r.done.tag ? html` with the tag <b>#${r.done.tag}</b>` : ""}`}</h2>
          <p>${r.done.kind === "wallet"
            ? "They wait there, with no schedule, until you choose to learn them."
            : VS.autofill.enabled() ? "Anything missing fills in by itself. You can edit any word later." : "You can edit any word later."}</p>
          <div class="row share-done-actions">
            ${r.done.kind === "wallet"
              ? html`<a class="btn btn-primary btn-lg" href="#/wallet">Open your wallet</a>`
              : html`<a class="btn btn-primary btn-lg" href="#/pick/cards${r.done.tag ? "?tag=" + encodeURIComponent(r.done.tag) : ""}">${icon("play", "icon-sm")} Learn them now</a>
                <a class="btn" href="#/words${r.done.tag ? "?tag=" + encodeURIComponent(r.done.tag) : ""}">See them in Words</a>`}
            ${r.done.kind !== "wallet" && r.done.tag ? html`<a class="btn btn-quiet" href="#/share?tag=${encodeURIComponent(r.done.tag)}">${icon("share", "icon-sm")} Share them on</a>` : ""}
          </div>
        </div>
      </div>`;
    const have = L.words.filter(mine).length;
    const n = r.picked.size;
    return html`
      <div class="page share-page view-enter">
        <header class="page-head">
          <div>
            <h1>${L.title || "Words shared with you"}</h1>
            <p class="hint">${L.from ? html`From <b>${L.from}</b> · ` : ""}${VS.plural(L.words.length, "word")}${have ? html` · ${have} already yours` : ""}</p>
          </div>
        </header>
        ${L.note ? html`<blockquote class="share-note"><p dir="auto">${L.note}</p>${L.from ? html`<footer>— ${L.from}</footer>` : ""}</blockquote>` : ""}

        <div class="share-grid is-receive">
          <section class="share-pick" aria-labelledby="sharedListTitle">
            <div class="share-step-head">
              <h2 id="sharedListTitle">Choose what to add</h2>
              <p class="share-picked" aria-live="polite">${num(n)} of ${num(L.words.length - have)} chosen</p>
            </div>
            <div class="share-tools">
              <button class="btn btn-quiet" type="button" data-action="shared-all">Select all</button>
              <button class="btn btn-quiet" type="button" data-action="shared-none">None</button>
            </div>
            <div class="word-list share-list">${L.words.map(receiveRow)}</div>
          </section>

          <aside class="share-side" aria-label="Add">
            <section class="card share-card">
              <h2>Keep them together</h2>
              <label class="form-field"><span>Tag</span>
                <input data-shared-tag value="${r.tag}" maxlength="40" dir="auto" autocomplete="off"></label>
              <p class="hint share-tag-hint">Find them later in Words, and learn them as one list.</p>
              ${L.keys.includes("a") ? html`<label class="check"><input type="checkbox" data-shared-ar ${r.useAr ? VS.raw("checked") : ""}>
                <span>Use their Arabic meanings${VS.autofill.enabled() ? html` <small>— untick to get your own</small>` : ""}</span></label>` : ""}
            </section>
            <section class="card share-card share-send">
              <button class="btn btn-primary btn-lg btn-block" type="button" data-action="shared-add" ${n ? "" : VS.raw("disabled")}>
                ${icon("plus", "icon-sm")}<span data-shared-label="long">Add ${VS.plural(n, "word")} to my words</span></button>
              <button class="btn btn-block" type="button" data-action="shared-later" ${n ? "" : VS.raw("disabled")}>
                ${icon("wallet", "icon-sm")} Save for later</button>
              <p class="share-private">${icon("check", "icon-sm")}<span>Nothing is added until you choose. The words came inside the link — no server saw them.</span></p>
            </section>
          </aside>
        </div>

        <div class="share-dock" aria-hidden="true">
          <button class="btn btn-primary btn-block" type="button" data-action="shared-add" tabindex="-1" ${n ? "" : VS.raw("disabled")}>
            ${icon("plus", "icon-sm")}<span data-shared-label="short">Add ${VS.plural(n, "word")}</span></button>
        </div>
      </div>`;
  }

  function paintReceive() {
    const root = VS.$(".share-page");
    if (!root || !r || !r.list) return;
    const n = r.picked.size;
    const have = r.list.words.filter(mine).length;
    VS.$$("[data-shared-label]", root).forEach((el) => { el.textContent = "Add " + VS.plural(n, "word") + (el.dataset.sharedLabel === "long" ? " to my words" : ""); });
    const count = VS.$(".share-picked", root);
    if (count) count.textContent = `${num(n)} of ${num(r.list.words.length - have)} chosen`;
    VS.$$('[data-action="shared-add"], [data-action="shared-later"]', root).forEach((b) => { b.disabled = !n; });
  }

  function receivedWords() {
    return r.list.words.filter((w, i) => r.picked.has(i) && !mine(w));
  }

  /* The phone's bottom bar lives on <body>: inside the page, the entrance
     animation's transform would pin a fixed bar to the page, not the screen.
     It shows only while the send panel is out of sight; leaving the screen removes it. */
  function dockUp(root) {
    VS.$$("body > .share-dock").forEach((n) => n.remove());
    const send = VS.$(".share-send", root), dock = VS.$(".share-dock", root);
    if (!send || !dock) return;
    document.body.appendChild(dock);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([en]) => dock.classList.toggle("is-on", !en.isIntersecting && en.boundingClientRect.top > 0)).observe(send);
    }
  }
  const dockDown = () => VS.$$("body > .share-dock").forEach((n) => n.remove());

  /* ════════════════════════════ VIEWS ════════════════════════════ */

  VS.views.share = {
    title: () => "Share with a friend",
    crumbs: () => [{ label: "Share" }],
    start(params) { freshSend(params); },
    render: () => sendScreen(),
    mount(root) {
      if (!VS.$(".share-grid", root)) { dockDown(); return; }
      VS.$("[data-share-search]", root)?.addEventListener("input", (e) => {
        s.search = e.target.value;
        const listBox = VS.$(".share-list", root);
        const list = shown();
        if (listBox) listBox.innerHTML = String(html`${list.slice(0, 400).map(pickRow)}`);
      });
      VS.$("[data-share-tag]", root)?.addEventListener("change", (e) => { s.tag = e.target.value; s.picked = new Set(pool().map((w) => w.id)); VS.app.render(); });
      root.addEventListener("change", (e) => {
        const t = e.target;
        if (t.dataset.sharePick) {
          if (t.checked) s.picked.add(t.dataset.sharePick); else s.picked.delete(t.dataset.sharePick);
          t.closest(".share-row").classList.toggle("is-on", t.checked);
          relink(); paintSend();
        } else if (t.dataset.shareInc) {
          s.inc[t.dataset.shareInc] = t.checked; relink();
        } else if (t.hasAttribute("data-share-only")) {
          s.wordsOnly = t.checked;
          VS.$$("[data-share-inc]", root).forEach((b) => { b.disabled = t.checked; });
          VS.$(".share-checks", root).classList.toggle("is-off", t.checked);
          relink();
        }
      });
      VS.$$("[data-share-in]", root).forEach((el) => el.addEventListener("input", () => {
        s[el.dataset.shareIn] = el.value;
        if (el.dataset.shareIn === "from") VS.store.setSetting("shareFrom", el.value.trim().slice(0, VS.share.LIMITS.from));
        relink();
      }));
      dockUp(root);
      relink();
    },
    leave: dockDown,
    actions: {
      "share-source"(el) { s.source = el.dataset.value; s.tag = "all"; s.search = ""; s.picked = new Set(pool().map((w) => w.id)); VS.app.render(); },
      "share-all"() { shown().forEach((w) => s.picked.add(w.id)); VS.$$("[data-share-pick]").forEach((b) => { b.checked = true; b.closest(".share-row").classList.add("is-on"); }); relink(); paintSend(); },
      "share-none"() { shown().forEach((w) => s.picked.delete(w.id)); VS.$$("[data-share-pick]").forEach((b) => { b.checked = false; b.closest(".share-row").classList.remove("is-on"); }); relink(); paintSend(); },
      "share-go"() { const t = VS.$(".share-send"); if (t) t.scrollIntoView({ block: "start", behavior: "smooth" }); },
      async "share-native"() {
        try { await navigator.share({ title: s.title || "Words for you", text: (s.title || "Words for you") + (s.from ? " — from " + s.from : "") + (s.note ? "\n" + s.note : ""), url: s.link }); }
        catch (e) { if (!e || e.name !== "AbortError") VS.views.share.actions["share-copy"](); }   // no share sheet here: copy instead
      },
      async "share-copy"() {
        try { await navigator.clipboard.writeText(s.link); VS.toast("Link copied. Paste it in any chat."); }
        catch (e) { VS.toast("Couldn't copy here. Use Share…, or select the link from a message."); }
      },
      async "share-text"() {
        try { await navigator.clipboard.writeText(message()); VS.toast("Message copied — the words and the link. Paste it in any chat."); }
        catch (e) { VS.toast("Couldn't copy here. Try Copy link."); }
      },
      "share-qr"(el) {
        s.qr = !s.qr; el.setAttribute("aria-expanded", String(s.qr));
        const box = VS.$(".share-qr"); if (box) box.hidden = !s.qr;
        if (s.qr) drawQr();
      },
      "share-file"() { downloadFile(); },
    },
  };

  VS.views.shared = {
    title: () => (r && r.list && r.list.title) || "Shared with you",
    crumbs: () => [{ label: "Shared with you" }],
    start(params) { freshReceive(params); },
    render: () => receiveScreen(),
    mount(root) {
      if (!r || !r.list || r.done) { dockDown(); return; }
      root.addEventListener("change", (e) => {
        const t = e.target;
        if (t.dataset.sharedPick != null) {
          const i = Number(t.dataset.sharedPick);
          if (t.checked) r.picked.add(i); else r.picked.delete(i);
          t.closest(".share-row").classList.toggle("is-on", t.checked);
          paintReceive();
        } else if (t.hasAttribute("data-shared-ar")) r.useAr = t.checked;
      });
      VS.$("[data-shared-tag]", root)?.addEventListener("input", (e) => { r.tag = e.target.value; });
      dockUp(root);
    },
    leave: dockDown,
    actions: {
      "shared-all"() { r.list.words.forEach((w, i) => { if (!mine(w)) r.picked.add(i); }); VS.app.render(); },
      "shared-none"() { r.picked.clear(); VS.app.render(); },
      "shared-add"() {
        const tag = VS.parseTags(r.tag)[0] || "";
        const source = r.list.from ? "Shared by " + r.list.from : r.list.title ? "Shared: " + r.list.title : "Shared with you";
        const words = receivedWords().map((w) => {
          const out = Object.assign({}, w, { source, tags: tag ? [tag] : [] });
          if (!r.useAr) delete out.arabic;
          return out;
        });
        if (!words.length) return;
        if (!VS.autofill.enabled() && words.some((w) => !w.arabic)) {
          VS.toast("Some words have no Arabic, and auto-fill is off — they're added without it. Edit them in Words.");
        }
        const res = VS.saveWords(words);
        VS.sfx.play("pop");
        r.done = { kind: "words", n: res.added.length, tag };
        VS.app.render();
        window.scrollTo({ top: 0 });
      },
      "shared-later"() {
        const words = receivedWords();
        let n = 0;
        words.forEach((w) => {
          const res = VS.store.walletAdd(w.word, w.context || w.example || "", r.list.from || r.list.title || "", "shared", r.useAr ? w.arabic : "");
          if (res.ok && !res.existed) n++;
        });
        VS.sfx.play("pop");
        r.done = { kind: "wallet", n };
        VS.app.render();
        window.scrollTo({ top: 0 });
      },
    },
  };
})();
