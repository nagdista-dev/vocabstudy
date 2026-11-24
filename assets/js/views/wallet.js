/* views/wallet.js — words saved for later.
   ------------------------------------------------------------------
   A learner's pocket of slips, not a second library. Words arrive three
   ways: typed into the pocket ("save it for later" — English or Arabic,
   Arabic finding the English word), kept from a word card while reading
   with the sentence that made them tap, or sent by a friend. Nothing here
   is studied or scheduled until the learner chooses one of two doors on a
   slip: Make with AI (Add → With AI, the sentence and the Arabic carried
   into the prompt) or Add now (the library, or the Add form when Auto-fill
   is off). The word leaves when it is added.

   The page has its own shape — a pocket on the desk and the slips it holds —
   but it is built from the app's parts and tokens. Colour only where it
   means something: the accent on actions, the highlighter on the word
   inside its sentence (the learner's memory).

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

  /** Put a looked-up Arabic meaning on a slip that is already on screen. */
  function paintArabic(id, ar) {
    if (!ar) return;
    const slip = document.querySelector(`.wallet-slip[data-id="${CSS.escape(id)}"]`);
    if (!slip) return;
    const had = slip.querySelector(".wallet-ar");
    if (had) { had.textContent = ar; return; }
    const head = slip.querySelector(".wallet-slip-head");
    if (head) head.insertAdjacentHTML("afterend", String(html`<p class="wallet-ar" lang="ar" dir="rtl">${ar}</p>`));
  }

  /**
   * Keep a word — the one door used by the wallet's pocket and Today's
   * compact add box. Arabic is a way in: the English word is picked first
   * and the typed Arabic travels with the slip as its meaning. English gets
   * its Arabic looked up quietly afterwards (Auto-fill on, online only).
   * Returns { ok, entry, word, reason }; every message is shown here so both
   * boxes speak the same way.
   */
  VS.walletCapture = async function (fields) {
    const f = fields || {};
    const input = f.input || null;
    const anchor = f.anchor || input;
    let word = String(f.word || "").trim().replace(/\s+/g, " ");
    if (!word) { if (input) input.focus(); return { ok: false, reason: "empty" }; }
    const typedArabic = VS.isArabicTyping(word) ? word : "";
    if (typedArabic) {
      word = await VS.spelling.chooseEnglish(typedArabic, anchor);
      if (!word) return { ok: false, reason: "arabic" };
      if (input) input.value = word;
    }
    const r = VS.store.walletAdd(word, f.sentence || "", f.source || "", f.kind || "", typedArabic);
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
      VS.toast(`“${VS.cap(r.entry.word)}” is already in your wallet.`);
      return { ok: false, reason: "wallet", entry: r.entry, word };
    }
    if (!r.ok) return { ok: false, reason: "bad", word };
    VS.sfx.play("pop");
    VS.toast(`Saved “${VS.cap(r.entry.word)}” to your wallet.`, {
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
      it (the sentence with the word marked), where it came from and when, and
      the two doors plus remove. */
  function slip(e, i) {
    const lead = e.kind === "shared" ? "Shared by" : e.kind === "meaning" ? "From the meaning of" : "From the example for";
    const from = e.source ? html`${lead} <b>${e.kind === "shared" ? e.source : VS.cap(e.source)}</b><span class="wallet-sep" aria-hidden="true">·</span>` : "";
    return html`
      <li class="wallet-slip" data-id="${e.id}">
        <div class="wallet-slip-head">
          <span class="wallet-slip-n" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
          <h2 class="wallet-word">${VS.cap(e.word)}</h2>
          ${VS.ui.speakButton(e.word, `Hear “${e.word}”`)}
        </div>
        ${e.arabic ? html`<p class="wallet-ar" lang="ar" dir="rtl">${e.arabic}</p>` : ""}
        ${e.sentence ? html`<blockquote class="wallet-sentence">“${sentence(e)}”</blockquote>` : ""}
        <p class="wallet-meta">${from}<span>Saved ${VS.ui.dateText(e.added)}</span></p>
        <div class="wallet-actions">
          <button class="btn btn-tonal wallet-ai" type="button" data-action="wallet-ai" data-id="${e.id}"
            title="Ask ChatGPT or Claude for its Arabic, definition and example — then check it and add it">
            ${icon("bolt", "icon-sm")}<span>Make with AI</span></button>
          <button class="btn btn-quiet" type="button" data-action="wallet-add" data-id="${e.id}"
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
    if (none) { none.hidden = shown > 0; none.querySelector("b").textContent = st.q; }
    const count = root.querySelector(".wallet-count");
    if (count) count.textContent = q ? `${shown} of ${VS.store.wallet().length}` : "";
  }

  VS.views.wallet = {
    title: () => "Wallet",
    crumbs: () => [{ label: "Wallet" }],

    render() {
      const list = waiting();
      const n = list.length;
      return html`
        <div class="page wallet-page view-enter">
          <header class="page-head wallet-head">
            <div>
              <h1>Wallet</h1>
              <p class="hint">${n
                ? html`<b>${VS.plural(n, "word")}</b> waiting. Add one when you're ready — nothing here is studied until you do.`
                : "Words you're saving for later. Nothing here is studied until you choose to learn it."}</p>
            </div>
          </header>

          <div class="wallet-grid">
            <aside class="wallet-pocket" aria-labelledby="walletKeepTitle">
              <span class="wallet-pocket-edge is-back" aria-hidden="true"></span>
              <span class="wallet-pocket-edge is-front" aria-hidden="true"></span>
              <div class="wallet-pocket-in">
                <div class="wallet-pocket-head">
                  <h2 class="wallet-pocket-title" id="walletKeepTitle">Keep a word</h2>
                  ${n ? html`<span class="wallet-pocket-count">${n} saved</span>` : ""}
                </div>
                <form class="wallet-keep" data-form="wallet-keep" autocomplete="off" aria-label="Save a word in your wallet">
                  <div class="wallet-keep-line">
                    <span class="field wallet-keep-field">
                      <input name="word" dir="auto" placeholder="Word or phrase" aria-label="A word or phrase — English or Arabic"
                        spellcheck="false" autocapitalize="off" maxlength="80" enterkeyhint="done" required/>
                    </span>
                    <button class="btn btn-primary wallet-keep-btn" type="submit" aria-label="Save this word in your wallet">
                      ${icon("plus", "icon-sm")}<span>Save</span></button>
                  </div>
                  ${st.sentence
                    ? html`<label class="field wallet-keep-sentence"><span class="sr-only">Where you met it (optional)</span>
                        <textarea name="sentence" rows="2" dir="auto" maxlength="300" placeholder="Where you met it — the sentence you read or heard (optional)"></textarea></label>`
                    : html`<button class="link-btn wallet-keep-more" type="button" data-action="wallet-keep-more">${icon("plus", "icon-sm")}<span>Add where you met it</span></button>`}
                  <p class="wallet-keep-hint">English or Arabic — Arabic finds the English word.</p>
                </form>
                ${n > 1 ? html`
                  <div class="wallet-pocket-foot">
                    <button class="btn btn-tonal wallet-all" type="button" data-action="wallet-ai-all"
                      title="One prompt for ${n > 30 ? "the 30 newest words" : "every word here"}, each with its sentence">
                      ${icon("bolt", "icon-sm")}<span>Make ${n > 30 ? "30" : "all"} with AI</span></button>
                    <p class="hint">One prompt. Each word keeps its sentence.</p>
                  </div>` : ""}
              </div>
            </aside>

            <section class="wallet-slips" aria-label="Words saved for later">
              ${n ? html`
                ${n > 6 ? html`<div class="wallet-tools">
                  <label class="field wallet-search">${icon("search", "icon-sm")}<span class="sr-only">Search your wallet</span>
                    <input type="search" data-wallet-q value="${st.q}" placeholder="Search your wallet" autocomplete="off" spellcheck="false"/></label>
                  <p class="wallet-count" aria-live="polite"></p>
                </div>` : ""}
                <ol class="wallet-slip-list">${list.map((e, i) => slip(e, i))}</ol>
                <p class="wallet-none hint" hidden>Nothing in your wallet matches “<b></b>”.</p>
                <footer class="wallet-end">
                  <p class="hint">Saved on this device, inside your backup.</p>
                  <button class="danger-link" type="button" data-action="wallet-clear">Clear wallet</button>
                </footer>`
              : html`
                <div class="empty wallet-empty">
                  <figure class="desk-photo wallet-print">
                    <img src="assets/img/wallet-page.webp" width="1000" height="668" loading="lazy" decoding="async"
                      alt="A blank notebook and a pen on a pale desk, waiting for a first word.">
                    <figcaption><b>An empty pocket</b> is how every wallet starts. The first word can come from anywhere.</figcaption>
                  </figure>
                  <h2>Your wallet is empty</h2>
                  <p>Keep a word here when you meet it — type it in the pocket, or tap a word you don't know while reading and save it with its sentence.</p>
                  <div class="row empty-actions"><a class="btn" href="#/words">Open your words</a></div>
                </div>`}
            </section>
          </div>
        </div>`;
    },

    mount(root) {
      const form = root.querySelector("[data-form='wallet-keep']");
      if (form) form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = form.querySelector("[name='word']");
        const sentenceBox = form.querySelector("[name='sentence']");
        const r = await VS.walletCapture({
          word: input.value,
          sentence: sentenceBox ? sentenceBox.value : "",
          input,
          anchor: form.querySelector(".wallet-keep-line"),
        });
        if (!r.ok) { if (input) input.focus(); return; }
        st.q = ""; st.sentence = false;
        VS.app.render();
        const fresh = document.querySelector(`.wallet-slip[data-id="${CSS.escape(r.entry.id)}"]`);
        if (fresh) fresh.classList.add("is-new");
        const again = document.querySelector("[data-form='wallet-keep'] [name='word']");
        if (again) again.focus();
      });
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
         screen with the word, its Arabic and its sentence filled in, and the
         learner checks it there. "Make with AI" opens the With AI tab (the
         prompt carries the sentence and Arabic, so the AI explains THAT
         meaning); "Add now" opens the form when Auto-fill is off. The word
         leaves the wallet once it is added. */
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
      /* Add now: the word joins the library immediately, its sentence as
         "where you met it", its Arabic kept, and Auto-fill completes the rest
         in the background; the learner can edit anything later. With
         Auto-fill off nothing may leave the device, so the filled-in Add form
         opens instead. */
      "wallet-add"(el) {
        const e = VS.store.wallet().find((x) => x.id === el.dataset.id);
        if (!e) return;
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
          title: `Remove “${e.word}” from your wallet?`,
          body: e.sentence ? "The sentence you kept with it goes too. You can undo it right after." : "You can undo it right after.",
          confirmLabel: "Remove",
        });
        if (!yes) return;
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
