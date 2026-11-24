/* views/wallet.js — words saved for later.
   ------------------------------------------------------------------
   A learner's reading list, not a second library. Words arrive two ways:
   typed into the field at the top ("save it for later"), or kept from the
   word card while reading, with the sentence that made them tap. Nothing
   here is studied or scheduled until the learner chooses one of two doors:
   Make with AI (Add → With AI, the sentence carried into the prompt) or
   Add myself (the Add form, filled in). The word leaves when it is added.

   One calm column: the title, one field, one list in one frame. Colour
   only where it means something — the accent on actions, the highlighter
   on the word inside its sentence (the learner's memory).

   The wallet is content, not progress (core/store.js): it survives Reset
   progress, travels in the backup, and merges by word. Removing one is a
   loss, so it carries an Undo; clearing the whole wallet asks first. */
(function () {
  "use strict";
  const { html, icon } = VS;
  const st = { q: "", sentence: false };     // the search box, and whether "where you met it" is open

  /** The kept sentence with the kept word highlighted, the way a teacher
      would underline it. Falls back to the plain sentence when the form
      in the sentence is too different to find. */
  function sentence(e) {
    const hit = VS.findIn({ word: e.word }, e.sentence, true);
    if (!hit) return html`${e.sentence}`;
    return html`${hit.before}<mark class="mark">${hit.answer}</mark>${hit.after}`;
  }

  /** One row: the word, its sound and Arabic; the sentence; where and when; two doors. */
  function row(e) {
    const from = e.source ? html`${e.kind === "meaning" ? "From the meaning of" : "From the example for"} <b>${VS.cap(e.source)}</b>` : "";
    return html`
      <li class="wallet-row" data-id="${e.id}">
        <div class="wallet-row-head">
          <h2 class="wallet-name">
            <span class="wallet-word">${VS.cap(e.word)}</span>
            ${e.arabic ? html`<bdi class="wallet-ar" lang="ar" dir="rtl">${e.arabic}</bdi>` : ""}
          </h2>
          <span class="wallet-when">${VS.cap(VS.ui.dateText(e.added))}</span>
        </div>
        ${e.sentence ? html`<p class="wallet-sentence">${sentence(e)}</p>` : ""}
        ${from ? html`<p class="wallet-from">${from}</p>` : ""}
        <div class="wallet-row-foot">
          <div class="wallet-doors">
            <button class="wallet-door is-ai" type="button" data-action="wallet-ai" data-id="${e.id}"
              title="Ask ChatGPT or Claude for its Arabic, definition and example — then check it and add it">
              ${icon("bolt", "icon-sm")}<span>Make with AI</span></button>
            <button class="wallet-door" type="button" data-action="wallet-add" data-id="${e.id}"
              title="Open the Add form with this word${e.sentence ? " and its sentence" : ""} filled in">
              ${icon("pen", "icon-sm")}<span>Add myself</span></button>
          </div>
          <div class="wallet-row-tools">
            ${VS.ui.speakButton(e.word, `Hear “${e.word}”`)}
            <button class="wallet-icon is-remove" type="button" data-action="wallet-remove" data-id="${e.id}"
              aria-label="Remove “${e.word}” from your wallet" title="Remove (you can undo)">${icon("trash", "icon-sm")}</button>
          </div>
        </div>
      </li>`;
  }

  /** Wallet words that are not library words yet (a word added elsewhere leaves quietly). */
  function waiting() {
    VS.store.wallet().filter((e) => VS.byId[VS.wordKey(e.word)]).forEach((e) => VS.store.walletRemove(e.id));
    return VS.store.wallet().slice().reverse();      // newest first: what you just kept is at the top
  }

  /** Keep a typed word. Its Arabic is looked up afterwards (Auto-fill on only) and
      appears on its row; the learner never waits for it. */
  function keep(form) {
    const input = form.querySelector("[name='word']");
    const word = input.value.trim().replace(/\s+/g, " ");
    if (!word) { input.focus(); return; }
    if (/[؀-ۿ]/.test(word)) { VS.toast("Type the English word — its Arabic fills in by itself."); input.focus(); return; }
    const sentenceBox = form.querySelector("[name='sentence']");
    const r = VS.store.walletAdd(word, sentenceBox ? sentenceBox.value : "", "", "");
    if (r.inLibrary) { VS.toast(`“${word}” is already one of your words.`); return; }
    if (r.existed) { VS.toast(`“${word}” is already in your wallet.`); return; }
    if (!r.ok) return;
    VS.sfx.play("pop");
    st.q = ""; st.sentence = false;
    VS.app.render();
    const fresh = document.querySelector(`.wallet-row[data-id="${CSS.escape(r.entry.id)}"]`);
    if (fresh) fresh.classList.add("is-new");
    const again = document.querySelector("[data-form='wallet-keep'] [name='word']");
    if (again) again.focus();
    VS.toast(`Saved “${r.entry.word}” for later.`, { label: "Undo", run: () => { VS.store.walletRemove(r.entry.id); VS.app.render(); } });
    VS.arabicWord(r.entry.word).then((ar) => {
      if (!ar) return;
      VS.store.walletSetArabic(r.entry.id, ar);
      const name = document.querySelector(`.wallet-row[data-id="${CSS.escape(r.entry.id)}"] .wallet-name`);
      if (name && !name.querySelector(".wallet-ar")) name.insertAdjacentHTML("beforeend", String(html`<bdi class="wallet-ar" lang="ar" dir="rtl">${ar}</bdi>`));
    });
  }

  /** The search box: hide the rows that match neither the word, its Arabic nor its sentence. */
  function filter(root) {
    const norm = (t) => String(t || "").toLowerCase().replace(/\s+/g, " ").trim();
    const q = norm(st.q);
    const byId = {};
    VS.store.wallet().forEach((e) => { byId[e.id] = e; });
    let shown = 0;
    root.querySelectorAll(".wallet-row").forEach((li) => {
      const e = byId[li.dataset.id];
      const hit = !q || (e && norm([e.word, e.arabic, e.sentence, e.source].join(" ")).includes(q));
      li.hidden = !hit;
      if (hit) shown++;
    });
    const none = root.querySelector(".wallet-none");
    if (none) { none.hidden = shown > 0; none.querySelector("b").textContent = st.q; }
    const count = root.querySelector(".wallet-count");
    if (count) count.textContent = q ? `${shown} of ${VS.plural(VS.store.wallet().length, "word")}` : VS.plural(VS.store.wallet().length, "word");
  }

  VS.views.wallet = {
    title: () => "Wallet",
    crumbs: () => [{ label: "Wallet" }],

    render() {
      const list = waiting();
      const n = list.length;
      return html`
        <div class="page wallet-page view-enter">
          <header class="wallet-head">
            <h1>Wallet</h1>
            <p>Words you're saving for later. Nothing here is studied until you choose to learn it.</p>
          </header>

          <form class="wallet-keep" data-form="wallet-keep" autocomplete="off" aria-label="Save a word for later">
            <div class="wallet-keep-bar">
              <span class="wallet-keep-ico" aria-hidden="true">${icon("plus", "icon-sm")}</span>
              <label class="wallet-keep-field"><span class="sr-only">A word or phrase to save for later</span>
                <input name="word" dir="ltr" lang="en" placeholder="Save a word for later" spellcheck="false" autocapitalize="off" maxlength="80" enterkeyhint="done" required></label>
              <button class="wallet-keep-btn" type="submit">Save</button>
            </div>
            ${st.sentence
              ? html`<label class="wallet-keep-sentence"><span class="sr-only">Where you met it (optional)</span>
                  <textarea name="sentence" rows="2" dir="auto" maxlength="300" placeholder="Where you met it — the sentence you read or heard (optional)"></textarea></label>`
              : html`<button class="wallet-keep-more" type="button" data-action="wallet-keep-more">Add where you met it</button>`}
          </form>

          <section class="wallet-section" aria-label="Saved words">
            ${n ? html`
              <div class="wallet-bar">
                ${n > 6
                  ? html`<label class="wallet-search">${icon("search", "icon-sm")}<span class="sr-only">Search your wallet</span>
                      <input type="search" data-wallet-q value="${st.q}" placeholder="Search" autocomplete="off" spellcheck="false"></label>`
                  : ""}
                <p class="wallet-count" aria-live="polite">${VS.plural(n, "word")}</p>
                ${n > 1 ? html`<button class="wallet-all" type="button" data-action="wallet-ai-all"
                    title="One prompt for ${n > 30 ? "the 30 newest words" : "every word here"}, each with its sentence">
                    ${icon("bolt", "icon-sm")}<span>Make ${n > 30 ? "30" : "all"} with AI</span></button>` : ""}
              </div>
              <ol class="wallet-list">${list.map(row)}</ol>
              <p class="wallet-none" hidden>Nothing matches “<b></b>”.</p>`
            : html`
              <div class="wallet-empty">
                <span class="wallet-empty-ico" aria-hidden="true">${icon("wallet")}</span>
                <p class="wallet-empty-title">Your wallet is empty</p>
                <p>Type a word above to save it for later. Or, while reading an example or a meaning, tap a word you don't know and keep it — with its sentence.</p>
              </div>`}
          </section>

          ${n ? html`
            <footer class="wallet-end">
              <p>Saved on this device, inside your backup.</p>
              <button class="wallet-clear" type="button" data-action="wallet-clear">Clear wallet</button>
            </footer>` : ""}
        </div>`;
    },

    mount(root) {
      const form = root.querySelector("[data-form='wallet-keep']");
      if (form) form.addEventListener("submit", (e) => { e.preventDefault(); keep(form); });
      const q = root.querySelector("[data-wallet-q]");
      if (q) { q.addEventListener("input", () => { st.q = q.value; filter(root); }); if (st.q) filter(root); }
    },

    actions: {
      "wallet-keep-more"() {
        const typed = (document.querySelector("[data-form='wallet-keep'] [name='word']") || {}).value || "";
        st.sentence = true;
        VS.app.render();
        const w2 = document.querySelector("[data-form='wallet-keep'] [name='word']");
        if (w2) w2.value = typed;
        const t = document.querySelector("[data-form='wallet-keep'] [name='sentence']");
        if (t) t.focus();
      },

      /* Nothing is added from here in one tap: both doors open the Add
         screen with the word and its sentence filled in, and the learner
         checks it there. "Make with AI" opens the With AI tab (the prompt
         carries the sentence, so the AI explains THAT meaning); "Add myself"
         opens the form. The word leaves the wallet once it is added. */
      "wallet-ai"(el) {
        const e = VS.store.wallet().find((x) => x.id === el.dataset.id);
        if (!e) return;
        VS.walletDraft = { ai: true, items: [e] };
        location.hash = "#/add?tab=ai";
      },
      "wallet-ai-all"() {
        const items = waiting().slice(0, 30);
        if (!items.length) return;
        VS.walletDraft = { ai: true, items };
        location.hash = "#/add?tab=ai";
      },
      "wallet-add"(el) {
        const e = VS.store.wallet().find((x) => x.id === el.dataset.id);
        if (!e) return;
        const source = e.source ? (e.kind === "meaning" ? "From the meaning of " : "From the example for ") + VS.cap(e.source) : "";
        VS.walletDraft = { word: e.word, context: e.sentence, source };
        location.hash = "#/add?tab=type";
      },

      "wallet-remove"(el) {
        const gone = VS.store.walletRemove(el.dataset.id);
        if (!gone) return;
        VS.app.render();
        VS.toast(`“${gone.word}” removed from your wallet.`, {
          label: "Undo",
          run: () => { VS.store.walletRestore([gone]); VS.app.render(); },
        });
      },

      async "wallet-clear"() {
        const n = VS.store.wallet().length;
        if (!n) return;
        const yes = await VS.confirm({
          title: `Clear ${VS.plural(n, "word")} from your wallet?`,
          body: "The words and the sentences you kept go too. Your library and your progress are not touched.",
          confirmLabel: "Clear wallet",
        });
        if (!yes) return;
        const gone = VS.store.walletClear();
        VS.app.render();
        VS.toast("Wallet cleared.", {
          label: "Undo",
          run: () => { VS.store.walletRestore(gone); VS.app.render(); },
        });
      },
    },
  };
})();
