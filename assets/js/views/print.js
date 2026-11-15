/* views/print.js — study on paper: print or save as PDF.
   ------------------------------------------------------------------
   Three layouts, each for a different way of studying away from a screen:

     Word sheet   every detail in a table — read and review
     Self-test    prompt | write your answer | fold here | answer
                  Fold the answer column back, test yourself, unfold to check.
                  This is active recall on paper.
     Cut-out cards  8 per page; the back page is mirrored so that
                  double-sided printing (flip on long edge) lines up.

   The browser's own print dialog makes the PDF ("Save as PDF"), so
   there is nothing to install and it works offline. css/views/print.css
   hides the app around the document when printing.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;
  const CARDS_PER_PAGE = 8;

  const opts = { layout: "sheet", direction: "en", examples: true };

  const LAYOUTS = [
    ["sheet", "Word sheet"],
    ["test", "Self-test"],
    ["cards", "Cut-out cards"],
  ];

  function title(scope) {
    const name = { sheet: "Word sheet", test: "Self-test", cards: "Flashcards" }[opts.layout];
    return { name, set: scope.kind === "day" ? scope.day.label + " · " + scope.day.weekday : scope.title };
  }

  /* ── Word sheet ─────────────────────────────────────────────── */
  function sheet(words) {
    return html`
      <table class="p-sheet">
        <thead><tr><th>#</th><th>Word</th><th>Meaning</th><th lang="ar">بالعربي</th></tr></thead>
        <tbody>
          ${words.map((w, i) => html`
            <tr>
              <td class="p-n">${i + 1}</td>
              <td class="p-word">
                <b>${w.word}</b>${w.sense ? html` <span class="p-sense">(${w.sense.toLowerCase()})</span>` : ""}
                <span class="p-ipa ipa">${w.ipa}</span>
                <span class="p-meta">${w.type} · ${w.level}</span>
              </td>
              <td class="p-def">${w.definition}${opts.examples ? html`<i>“${VS.ui.example(w)}”</i>` : ""}</td>
              <td class="p-ar" lang="ar">${w.arabic}</td>
            </tr>`)}
        </tbody>
      </table>`;
  }

  /* ── Self-test (fold) ───────────────────────────────────────── */
  function selfTest(words) {
    const en = opts.direction === "en";
    return html`
      <p class="p-howto">${icon("flip", "icon-sm")} Fold the page along the dashed line so the answers are hidden.
        Write your answer, then unfold to check. Tick the ones you got right.</p>
      <table class="p-test">
        <thead><tr>
          <th>#</th><th>${en ? "Word" : "المعنى"}</th><th>Your answer</th><th class="p-fold"></th><th>${en ? "المعنى" : "Word"}</th><th>✓</th>
        </tr></thead>
        <tbody>
          ${words.map((w, i) => {
            const word = html`<b>${w.word}</b>${w.sense ? html` <span class="p-sense">(${w.sense.toLowerCase()})</span>` : ""}`;
            const ar = html`<span lang="ar">${w.arabic}</span>`;
            return html`
              <tr>
                <td class="p-n">${i + 1}</td>
                <td class="p-prompt">${en ? word : ar}${en ? html`<span class="p-meta">${w.type}</span>` : html`<span class="p-meta">${w.definition}</span>`}</td>
                <td class="p-line"></td>
                <td class="p-fold" aria-hidden="true"></td>
                <td class="p-answer">${en ? ar : word}</td>
                <td class="p-tick"><span></span></td>
              </tr>`;
          })}
        </tbody>
      </table>`;
  }

  /* ── Cut-out cards (front page, then mirrored back page) ────── */
  function cards(words) {
    const pages = [];
    for (let i = 0; i < words.length; i += CARDS_PER_PAGE) pages.push(words.slice(i, i + CARDS_PER_PAGE));
    // On the back of a sheet the columns swap (left ↔ right) so each back
    // lands behind its own front when printed double-sided.
    const mirrored = (page) => {
      const out = [];
      for (let r = 0; r < page.length; r += 2) out.push(page[r + 1] || null, page[r]);
      return out;
    };
    return html`
      <p class="p-howto no-print">${icon("cards", "icon-sm")} Print double-sided and choose “flip on long edge”. Cut along the lines.</p>
      ${pages.map((page) => html`
        <div class="p-cards">
          ${page.map((w) => html`
            <div class="p-card p-front">
              <span class="p-meta">${w.type} · ${w.level}</span>
              <b>${w.word}</b>
              ${w.sense ? html`<span class="p-sense">(${w.sense.toLowerCase()})</span>` : ""}
              <span class="p-ipa ipa">${w.ipa}</span>
            </div>`)}
        </div>
        <div class="p-cards p-backs">
          ${mirrored(page).map((w) => w
            ? html`<div class="p-card p-back">
                <span class="p-ar" lang="ar">${w.arabic}</span>
                <span class="p-def">${w.definition}</span>
                <i>“${VS.ui.example(w)}”</i>
              </div>`
            : html`<div class="p-card p-empty"></div>`)}
        </div>`)}`;
  }

  function seg(name, options) {
    return html`
      <div class="seg" role="group" aria-label="${name}">
        ${options.map(([value, label]) => html`
          <button type="button" data-action="print-opt" data-name="${name}" data-value="${value}" aria-pressed="${String(opts[name]) === value}">${label}</button>`)}
      </div>`;
  }

  VS.views.print = {
    title: () => "Print",
    crumbs: (p) => VS.ui.crumbs(p, "Print"),

    render(p) {
      const scope = VS.scope(p);
      if (!scope) return VS.ui.emptyActivity("#/", "This set was not found.");
      // Paper follows the day's own order (A–Z for long lists), not the random session order.
      const words = scope.kind === "day" ? scope.day.words : scope.words.slice().sort((a, b) => a.word.localeCompare(b.word));
      if (!words.length) return VS.ui.emptyActivity(scope.back, "There are no words to print here.");
      const t = title(scope);
      const pages = opts.layout === "cards" ? Math.ceil(words.length / CARDS_PER_PAGE) * 2 : null;
      return html`
        <div class="page print-page">
          <section class="print-controls card no-print">
            <div>
              <h1>Study on paper</h1>
              <p class="muted">${VS.plural(words.length, "word")} from ${t.set}. Choose a layout, then print it or save it as a PDF.</p>
            </div>
            <div class="print-options">
              <div class="setting"><b>Layout</b>${seg("layout", LAYOUTS)}</div>
              ${opts.layout === "test" ? html`<div class="setting"><b>Test direction</b>${seg("direction", [["en", "English → Arabic"], ["ar", "Arabic → English"]])}</div>` : ""}
              ${opts.layout === "sheet" ? html`<div class="setting"><b>Examples</b>${seg("examples", [["true", "Show"], ["false", "Hide"]])}</div>` : ""}
            </div>
            <div class="row">
              <button class="btn btn-primary btn-lg" type="button" data-action="print-now">${icon("print", "icon-sm")} Print / Save as PDF</button>
              <span class="hint">In the print window, choose “Save as PDF” as the printer.${pages ? " " + pages + " pages." : ""}</span>
            </div>
          </section>

          <article class="print-doc">
            <header class="p-head">
              <span class="p-brand">${VS.brandMark} VocabStudy</span>
              <span><b>${t.name}</b> · ${t.set} · ${VS.plural(words.length, "word")}</span>
            </header>
            ${opts.layout === "sheet" ? sheet(words) : opts.layout === "test" ? selfTest(words) : cards(words)}
          </article>
        </div>`;
    },

    actions: {
      "print-opt"(el) {
        const v = el.dataset.value;
        opts[el.dataset.name] = v === "true" ? true : v === "false" ? false : v;
        VS.app.render();
      },
      "print-now"() { window.print(); },
    },
  };
})();
