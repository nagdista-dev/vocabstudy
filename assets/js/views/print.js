/* views/print.js — study on paper: print or save as PDF.
   ------------------------------------------------------------------
   Left: what to print and how. Right: a live preview of the paper.
   The browser's print dialog makes the PDF ("Save as PDF"), so it works
   offline with nothing to install. css/views/print.css hides the app
   and the controls when printing.

   WHICH WORDS   a filtered list from the library · due today · tricky ·
                 still learning · today's words · new words · everything —
                 then level / type filters, order and a limit.
   LAYOUTS (each trains something different)
     sheet     every detail in a table           read and review
     compact   word — meaning, in columns        a fast review list
     test      prompt | answer | fold | key      active recall on paper
     gap       sentences with blanks + word bank use the word in context
     match     numbers ↔ letters + answer key    recognise meanings
     write     lines to write your own sentence  produce the word (strongest)
     cards     8 per page, mirrored backs        cut-out flashcards
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;
  const CARDS_PER_PAGE = 8;
  const MATCH_GROUP = 10;

  const LAYOUTS = [
    ["sheet", "Word sheet", "Every detail in a table"],
    ["compact", "Compact list", "Word and meaning, in columns"],
    ["test", "Self-test", "Fold the page to hide the answers"],
    ["gap", "Fill the gap", "Sentences with a word bank"],
    ["match", "Matching", "Pair numbers with letters"],
    ["write", "Write a sentence", "Use each word yourself"],
    ["cards", "Cut-out cards", "Double-sided flashcards"],
  ];
  const SHOW = [["ipa", "IPA"], ["definition", "Definition"], ["example", "Example"], ["arabic", "Arabic"], ["notes", "My notes"]];

  // Options persist while the app is open, so you can tweak and re-print.
  const opts = {
    source: "all", query: "", level: "all", type: "all", order: "file", limit: "all",
    layout: "sheet", direction: "en", size: "normal", nameLine: true, answers: true,
    show: new Set(["ipa", "definition", "example", "arabic", "notes"]),
  };
  let lastRoute = "";
  let listening = false;
  let watching = false;

  /** Set the starting source from the route the learner came from. */
  function fromRoute(p) {
    const key = JSON.stringify(p);
    if (key === lastRoute) return;
    lastRoute = key;
    opts.query = p.scope === "pick" ? p.query || "" : "";
    // From "all", start with what's worth printing today: the words due, when there are any.
    opts.source = { pick: "pick", recall: "due", tricky: "tricky", today: "today", new: "new" }[p.scope] || (VS.store.totals().due ? "due" : "all");
    if (p.layout && LAYOUTS.some((l) => l[0] === p.layout)) opts.layout = p.layout;
  }

  /* ── Choosing the words ─────────────────────────────────────── */
  function pickWords() {
    let words;
    switch (opts.source) {
      case "due": words = VS.store.dueWords(); break;
      case "tricky": words = VS.store.trickyWords(); break;
      case "learning": words = VS.allWords().filter((w) => VS.store.status(w.id) === "learning"); break;
      case "pick": words = VS.filters.apply(VS.allWords(), VS.filters.parse(opts.query)); break;
      case "today": words = VS.scope({ scope: "today" }).words; break;
      case "new": words = VS.scope({ scope: "new" }).words; break;
      default: words = VS.allWords();
    }
    words = words.filter((w) =>
      (opts.level === "all" || w.level.charAt(0) === opts.level) &&
      (opts.type === "all" || w.type === opts.type));
    if (opts.order === "az") words = words.slice().sort((a, b) => a.word.localeCompare(b.word));
    if (opts.order === "random") words = VS.shuffle(words);
    if (opts.order === "weakest") words = words.slice().sort((a, b) => VS.store.strength(a.id) - VS.store.strength(b.id));
    if (opts.limit !== "all") words = words.slice(0, Number(opts.limit));
    return words;
  }

  function sourceLabel() {
    if (opts.source === "pick") return VS.filters.describe(VS.filters.parse(opts.query)) || "Library";
    return { due: "Due for recall", tricky: "Tricky words", learning: "Still learning", today: "Today's words",
             new: "New words", all: "Whole library" }[opts.source];
  }

  /* ── Small pieces shared by layouts ─────────────────────────── */
  const has = (field) => opts.show.has(field);
  const word = (w) => html`<b class="p-w">${w.word}</b>${w.sense ? html` <span class="p-sense">(${w.sense.toLowerCase()})</span>` : ""}`;
  const note = (w) => (has("notes") && VS.store.note(w.id) ? html`<span class="p-note">✎ ${VS.store.note(w.id)}</span>` : "");

  function answerKey(title, rows) {
    if (!opts.answers) return "";
    return html`
      <section class="p-answers">
        <p class="p-fold-hint">Fold along the dashed line to hide the answers.</p>
        <section class="p-key">
          <h3>${title}</h3>
          <ol>${rows.map((r) => html`<li>${r}</li>`)}</ol>
        </section>
      </section>`;
  }

  /* ── Layouts ────────────────────────────────────────────────── */
  const LAYOUT = {
    sheet(words) {
      const meaning = has("definition") || has("example") || has("notes");
      return html`
        <table class="p-table p-sheet">
          <thead><tr><th>#</th><th>Word</th>${meaning ? html`<th>Meaning</th>` : ""}${has("arabic") ? html`<th class="p-ar-h" lang="ar">بالعربي</th>` : ""}</tr></thead>
          <tbody>
            ${words.map((w, i) => html`
              <tr>
                <td class="p-n">${i + 1}</td>
                <td class="p-word">${word(w)}${has("ipa") ? html`<span class="p-ipa ipa">${VS.ipaText(w)}</span>` : ""}<span class="p-meta">${w.type}${w.level ? " · " + w.level : ""}</span></td>
                ${meaning ? html`<td class="p-def">${has("definition") ? w.definition : ""}${has("example") && w.example ? html`<i>${VS.ui.quote(w)}</i>` : ""}${note(w)}</td>` : ""}
                ${has("arabic") ? html`<td class="p-ar" lang="ar">${w.arabic}</td>` : ""}
              </tr>`)}
          </tbody>
        </table>`;
    },

    compact(words) {
      return html`
        <ol class="p-compact">
          ${words.map((w) => html`
            <li>${word(w)}${has("ipa") ? html` <span class="ipa">${VS.ipaText(w)}</span>` : ""}
              ${has("arabic") ? html`<span class="p-ar" lang="ar">${w.arabic}</span>` : ""}
              ${has("definition") ? html`<span class="p-meta">${w.definition}</span>` : ""}</li>`)}
        </ol>`;
    },

    test(words) {
      const en = opts.direction === "en";
      return html`
        <p class="p-howto">Fold the page along the dashed line so the answers are hidden. Write your answer, unfold, tick the ones you got right.</p>
        <table class="p-table p-test">
          <thead><tr><th>#</th><th>${en ? "Word" : "Meaning"}</th><th>Your answer</th><th class="p-fold"></th><th>${en ? "Meaning" : "Word"}</th><th>✓</th></tr></thead>
          <tbody>
            ${words.map((w, i) => {
              const ar = html`<span class="p-ar" lang="ar">${w.arabic}</span>`;
              return html`
                <tr>
                  <td class="p-n">${i + 1}</td>
                  <td class="p-prompt">${en ? html`${word(w)}<span class="p-meta">${w.type}</span>` : html`${ar}${has("definition") ? html`<span class="p-meta">${w.definition}</span>` : ""}`}</td>
                  <td class="p-line"><span class="p-answer-rule"></span></td>
                  <td class="p-fold" aria-hidden="true"></td>
                  <td class="p-answer">${en ? ar : word(w)}</td>
                  <td class="p-tick"><span></span></td>
                </tr>`;
            })}
          </tbody>
        </table>`;
    },

    gap(words) {
      const items = words.map((w) => ({ w, hit: VS.findInExample(w) })).filter((x) => x.hit);
      const skipped = words.length - items.length;
      const tight = (t) => /^[,.;:!?]/.test(t.trimStart());
      return html`
        <p class="p-howto">Write the right word in each gap. Change its form if the sentence needs it (past tense, plural…).</p>
        <div class="p-bank"><b>Word bank</b>${VS.shuffle(items).map((x) => html`<span>${x.w.word}</span>`)}</div>
        <ol class="p-gaps">
          ${items.map((x) => html`<li>${x.hit.before.trimEnd()}<span class="p-blank${tight(x.hit.after) ? " is-tight" : ""}"></span>${x.hit.after.trimStart()}${has("arabic") ? html` <span class="p-ar p-hint-ar" lang="ar">(${x.w.arabic})</span>` : ""}</li>`)}
        </ol>
        ${skipped ? html`<p class="p-meta no-print">${VS.plural(skipped, "word")} left out: the example doesn't contain the word.</p>` : ""}
        ${answerKey("Answers", items.map((x) => x.hit.answer))}`;
    },

    match(words) {
      const groups = [];
      for (let i = 0; i < words.length; i += MATCH_GROUP) groups.push(words.slice(i, i + MATCH_GROUP));
      const keys = [];
      const body = groups.map((g, gi) => {
        const right = VS.shuffle(g);
        const letter = (w) => String.fromCharCode(97 + right.indexOf(w));
        g.forEach((w) => keys.push(letter(w)));
        return html`
          <div class="p-match">
            <ol start="${gi * MATCH_GROUP + 1}">${g.map((w) => html`<li><span class="p-box"></span>${word(w)}</li>`)}</ol>
            <ol type="a">${right.map((w) => html`<li><span class="p-ar" lang="ar">${w.arabic}</span>${has("definition") ? html`<span class="p-meta">${w.definition}</span>` : ""}</li>`)}</ol>
          </div>`;
      });
      return html`
        <p class="p-howto">Write the letter of the right meaning in the box next to each word.</p>
        ${body}
        ${answerKey("Answers", keys)}`;
    },

    write(words) {
      return html`
        <p class="p-howto">Write a sentence of your own with each word — about your life, your work, your plans. That is how a word becomes yours.</p>
        <ol class="p-write">
          ${words.map((w) => html`
            <li>
              <div class="p-write-head">${word(w)}${has("ipa") ? html` <span class="ipa">${VS.ipaText(w)}</span>` : ""}
                ${has("arabic") ? html`<span class="p-ar" lang="ar">${w.arabic}</span>` : ""}</div>
              ${has("definition") ? html`<span class="p-meta">${w.definition}</span>` : ""}
              ${has("example") && w.example ? html`<span class="p-meta"><i>e.g. “${w.example}”</i></span>` : ""}
              <span class="p-rule"></span><span class="p-rule"></span>
            </li>`)}
        </ol>`;
    },

    cards(words) {
      const pages = [];
      for (let i = 0; i < words.length; i += CARDS_PER_PAGE) pages.push(words.slice(i, i + CARDS_PER_PAGE));
      // On the back of a sheet the columns swap, so each back lands behind its front
      // when printed double-sided ("flip on long edge").
      const mirrored = (page) => {
        const out = [];
        for (let r = 0; r < page.length; r += 2) out.push(page[r + 1] || null, page[r]);
        return out;
      };
      // Fill the last row with empty cells so every card keeps its dashed
      // cutting lines, even when the list doesn't divide by 8.
      const padded = (page) => page.length % 2 ? page.concat(null) : page;
      return html`
        <p class="p-howto no-print">Print double-sided and choose “flip on long edge”. Cut along the dashed lines.</p>
        ${pages.map((page) => html`
          <div class="p-cards">
            ${padded(page).map((w) => w ? html`
              <div class="p-card p-front">
                <span class="p-meta">${w.type}${w.level ? " · " + w.level : ""}</span>
                <b class="p-w">${w.word}</b>
                ${w.sense ? html`<span class="p-sense">(${w.sense.toLowerCase()})</span>` : ""}
                ${has("ipa") ? html`<span class="p-ipa ipa">${VS.ipaText(w)}</span>` : ""}
              </div>` : html`<div class="p-card p-empty"></div>`)}
          </div>
          <div class="p-cards p-backs">
            ${mirrored(page).map((w) => w
              ? html`<div class="p-card p-back">
                  ${has("arabic") ? html`<span class="p-ar" lang="ar">${w.arabic}</span>` : ""}
                  ${has("definition") ? html`<span class="p-def">${w.definition}</span>` : ""}
                  ${has("example") && w.example ? html`<i>${VS.ui.quote(w)}</i>` : ""}
                  ${note(w)}
                </div>`
              : html`<div class="p-card p-empty"></div>`)}
          </div>`)}`;
    },
  };

  /* ── Controls ───────────────────────────────────────────────── */
  function seg(name, options) {
    return html`
      <div class="seg" role="group" aria-label="${name}">
        ${options.map(([value, label]) => html`
          <button type="button" data-action="print-opt" data-name="${name}" data-value="${value}" aria-pressed="${String(opts[name]) === String(value)}">${label}</button>`)}
      </div>`;
  }
  function check(name, value, label, on) {
    return html`<label class="check"><input type="checkbox" data-print-toggle="${name}" value="${value}" ${on ? VS.raw("checked") : ""}><span>${label}</span></label>`;
  }
  function select(name, options) {
    return html`<select data-print-select="${name}">${options.map(([v, l]) => html`<option value="${v}" ${String(opts[name]) === v ? VS.raw("selected") : ""}>${l}</option>`)}</select>`;
  }

  function controls(words) {
    const types = [...new Set(VS.allWords().map((w) => w.type))].sort();
    const layout = opts.layout;
    const fields = {
      sheet: SHOW, compact: [SHOW[0], SHOW[1], SHOW[3]], test: [SHOW[1]], gap: [SHOW[3]],
      match: [SHOW[1]], write: SHOW.slice(0, 4), cards: SHOW,
    }[layout];
    return html`
      <aside class="print-controls card no-print" aria-label="Print options">
        <div class="print-options">
        <h1>Print &amp; PDF</h1>
        <p class="print-lead hint">Choose a layout, then download the PDF or print. Everything is made on this device.</p>

        <fieldset><legend>Words</legend>
          ${seg("source", (opts.query ? [["pick", "My list"]] : []).concat([["all", "All"], ["due", "Due today"], ["learning", "Learning"],
            ["tricky", "Tricky"], ["today", "Today's"], ["new", "New"]]))}
          ${opts.source === "pick" ? html`<p class="hint">From the library: ${sourceLabel()} · <a href="#/words?${opts.query}">change the list</a></p>` : ""}
          <!-- The usual sheet needs two choices (words, layout); the rest waits behind "More options". -->
          <details class="print-more" ${opts.level !== "all" || opts.type !== "all" || opts.order !== "file" || opts.limit !== "all" ? VS.raw("open") : ""}>
            <summary>${icon("chevron-right", "icon-sm print-more-chev")} More options</summary>
            <div class="ctl-grid">
              ${VS.allWords().some((w) => w.level) ? html`<label><span>Level</span>${select("level", [["all", "All levels"], ["A", "A1–A2"], ["B", "B1–B2"], ["C", "C1–C2"]])}</label>` : ""}
              <label><span>Type</span>${select("type", [["all", "All types"]].concat(types.map((t) => [t, t])))}</label>
              <label><span>Order</span>${select("order", [["file", "As listed"], ["az", "A–Z"], ["random", "Random"], ["weakest", "Weakest first"]])}</label>
              <label><span>How many</span>${select("limit", [["all", "All"], ["10", "10"], ["20", "20"], ["30", "30"], ["50", "50"]])}</label>
            </div>
          </details>
        </fieldset>

        <fieldset><legend>Layout</legend>
          <div class="layout-pick">
            ${LAYOUTS.map(([v, name, desc]) => html`
              <button type="button" class="layout-opt" data-action="print-opt" data-name="layout" data-value="${v}" aria-pressed="${layout === v}">
                <b>${name}</b><span>${desc}</span></button>`)}
          </div>
          ${layout === "test" ? html`<div class="setting"><b>Direction</b>${seg("direction", [["en", "English → Arabic"], ["ar", "Arabic → English"]])}</div>` : ""}
        </fieldset>

        <fieldset><legend>Show</legend>
          <div class="checks">${fields.map(([v, l]) => check("show", v, l, opts.show.has(v)))}</div>
          <div class="checks">
            ${check("nameLine", "1", "Name, date and score lines", opts.nameLine)}
            ${["gap", "match"].includes(layout) ? check("answers", "1", "Answer key", opts.answers) : ""}
          </div>
          <div class="setting"><b>Text size</b>${seg("size", [["small", "Small"], ["normal", "Normal"], ["large", "Large"]])}</div>
        </fieldset>
        </div>

        <div class="print-go">
          <button class="btn btn-primary btn-lg btn-block" type="button" data-action="pdf-download" ${words.length ? "" : VS.raw("disabled")}>${icon("arrow-right", "icon-sm")} Download PDF</button>
          <button class="btn btn-block" type="button" data-action="print-now" aria-label="Print" ${words.length ? "" : VS.raw("disabled")}>${icon("print", "icon-sm")} <span class="print-now-label">Print</span></button>
          <p class="hint">${VS.plural(words.length, "word")} · A4${layout === "cards" ? " · print double-sided, flip on long edge" : ""}.</p>
        </div>
      </aside>`;
  }

  /* ── Download as a PDF file (no print dialog) ─────────────────────
     html2pdf.js (html2canvas + jsPDF, MIT) draws the paper preview into an
     A4 PDF exactly as you see it — Arabic included. It ships with the app
     (assets/vendor/, see tools/vendor.py) and loads only the first time
     you press the button. Page breaks follow the same rules as printing. */
  const loadPdfLib = () => VS.loadScript("assets/vendor/html2pdf.bundle.min.js", "html2pdf");

  function fileName(words) {
    const layout = LAYOUTS.find((l) => l[0] === opts.layout)[1].toLowerCase().replace(/\W+/g, "-");
    const src = opts.source;
    return `vocabstudy-${layout}-${src}-${words.length}w.pdf`;
  }

  /**
   * html2canvas loses the spaces between Arabic words. Before drawing, put
   * each Arabic word in its own inline box with a fixed gap: the letters
   * inside a word still join correctly, and the gaps survive. The preview
   * is re-rendered afterwards, so this never shows on screen.
   */
  function boxArabicWords(root) {
    VS.$$('[lang="ar"]', root).forEach((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const frag = document.createDocumentFragment();
        node.nodeValue.trim().split(/\s+/).forEach((word) => {
          const box = document.createElement("span");
          box.className = "ar-word";
          box.textContent = word;
          frag.appendChild(box);
        });
        node.replaceWith(frag);
      });
    });
  }

  /**
   * Stamp the parts a raster PDF cannot draw itself: a running title on
   * pages 2+, a page number in the bottom margin, and the file's metadata.
   * These are real PDF text (not part of the image), so they stay sharp.
   */
  function stampPages(pdf, info) {
    const total = pdf.internal.getNumberOfPages();
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    const cards = info.layout === "cards";
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(115);
      if (i > 1 || cards) {
        pdf.text(info.title, 12, 7.2);
        pdf.text(info.subtitle, width - 12, 7.2, { align: "right" });
        pdf.setDrawColor(185);
        pdf.setLineWidth(0.2);
        pdf.line(12, 9.3, width - 12, 9.3);
      }
      pdf.setTextColor(130);
      if (cards) {
        pdf.text("Print double-sided (flip on long edge), then cut along the dashed lines.",
          width / 2, height - 5.5, { align: "center" });
      } else {
        // The maker's credit, small and grey; only "nagdista.com" is a link.
        const made = "Made with VocabStudy · vocabstudy.nagdista.com · by ";
        pdf.text(made, 12, height - 5.5);
        pdf.textWithLink("nagdista.com", 12 + pdf.getTextWidth(made), height - 5.5, { url: VS.credit.url });
      }
      pdf.text("Page " + i + " of " + total, width - 12, height - 5.5, { align: "right" });
    }
    pdf.setTextColor(0);
  }

  async function downloadPdf(button) {
    const doc = VS.$(".print-doc");
    if (!doc) return;
    const words = pickWords();
    const name = LAYOUTS.find((l) => l[0] === opts.layout)[1];
    const label = sourceLabel();
    const filename = fileName(words);

    // Ask where to save before doing the work, exactly like a backup. The
    // picker must open inside the click (user activation); opening it after
    // a slow render would be blocked. No picker → a normal download below.
    let handle = null;
    if (typeof window.showSaveFilePicker === "function") {
      try {
        handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: "PDF document", accept: { "application/pdf": [".pdf"] } }],
        });
      } catch (err) {
        if (err && err.name === "AbortError") return;   // the learner cancelled
        handle = null;                                  // restricted → download
      }
    }

    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "Preparing PDF…";
    let wrap = null;
    try {
      const html2pdf = await loadPdfLib();
      await document.fonts.ready;
      // Draw a full-size copy off to the left. The visible preview may be
      // scaled down to fit a phone; changing it would make the screen jump
      // and zoom while the file is being made.
      wrap = document.createElement("div");
      Object.assign(wrap.style, {
        position: "fixed", left: "-100000px", top: "0", width: "186mm",
        pointerEvents: "none", zIndex: "0",
      });
      const copy = doc.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      copy.style.transform = "none";                    // no phone downscaling
      copy.classList.add("pdf-render");                 // paper styles, A4 width, no shadow
      wrap.appendChild(copy);
      document.body.appendChild(wrap);
      boxArabicWords(copy);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      // Keep the canvas below the memory limit of phone browsers (a huge
      // canvas is the other reason a PDF can come out completely white).
      // Desktop browsers can afford a much larger canvas, so the text in
      // the downloaded file stays crisp when it is printed.
      const w = copy.offsetWidth || 703;
      const h = copy.offsetHeight || 1000;
      const cap = window.matchMedia("(pointer: coarse)").matches ? 14e6 : 42e6;
      const scale = Math.max(0.5, Math.min(3, Math.sqrt(cap / (w * h))));
      const worker = html2pdf().set({
        margin: [12, 12, 12, 12],
        filename,
        image: { type: "jpeg", quality: 0.96 },
        html2canvas: { scale, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: ["tr", "li", ".p-card", ".p-match", ".p-bank", ".p-head", ".p-name", ".p-answers", ".p-key"] },
      }).from(copy).toPdf();
      const pdf = await worker.get("pdf");
      stampPages(pdf, {
        title: name,
        subtitle: label + " · " + VS.plural(words.length, "word"),
        layout: opts.layout,
      });
      pdf.setProperties({
        title: name + " — " + label,
        subject: VS.plural(words.length, "word") + " for vocabulary practice",
        author: "VocabStudy",
        creator: "VocabStudy",
      });
      if (handle) {
        const writable = await handle.createWritable();
        try {
          await writable.write(pdf.output("blob"));
          await writable.close();
        } catch (err) {
          try { await writable.abort(); } catch (ignore) {}
          throw err;
        }
        VS.toast("PDF saved.");
      } else {
        pdf.save(filename);
        VS.toast("PDF saved to your downloads.");
      }
    } catch (e) {
      VS.toast("Couldn't make the PDF. Try Print → Save as PDF.");
    } finally {
      if (wrap) wrap.remove();
      VS.app.render();                                 // restore the untouched preview and button
    }
  }

  /** Show the A4 sheet at its real width, scaled down when the screen is narrower. */
  function fitPreview() {
    const wrap = VS.$(".print-preview");
    const doc = VS.$(".print-doc");
    if (!wrap || !doc) return;
    doc.style.transform = "";
    wrap.style.height = "";
    const scale = Math.min(1, wrap.clientWidth / doc.offsetWidth);
    if (scale < 0.995) {
      doc.style.transform = "scale(" + scale + ")";
      wrap.style.height = Math.ceil(doc.offsetHeight * scale) + "px";
    }
  }

  /** Checkboxes and selects change options directly — one listener for the whole app. */
  function onChange(e) {
    if (VS.app.current() !== "print") return;
    const t = e.target;
    if (t.dataset.printToggle) {
      const name = t.dataset.printToggle;
      if (opts[name] instanceof Set) { if (t.checked) opts[name].add(t.value); else opts[name].delete(t.value); }
      else opts[name] = t.checked;
    } else if (t.dataset.printSelect) {
      opts[t.dataset.printSelect] = t.value;
    } else return;
    VS.app.render();
  }

  /* ── The view ───────────────────────────────────────────────── */
  VS.views.print = {
    title: () => "Print",
    crumbs: (p) => VS.ui.crumbs(p, "Print"),

    render(p) {
      fromRoute(p);
      const words = pickWords();
      const name = LAYOUTS.find((l) => l[0] === opts.layout)[1];
      return html`
        <div class="print-page">
          ${controls(words)}
          <div class="print-preview">
            <article class="print-doc size-${opts.size} layout-${opts.layout}">
              <header class="p-head">
                <span class="p-brand">${VS.brandMark} VocabStudy</span>
                <span><b>${name}</b> · ${sourceLabel()} · ${VS.plural(words.length, "word")}</span>
              </header>
              ${opts.nameLine ? html`<div class="p-name"><span>Name</span><span>Date</span><span>Score</span></div>` : ""}
              ${words.length
                ? LAYOUT[opts.layout](words)
                : html`<p class="p-empty-note">No words match these options. Choose other words or loosen a filter.</p>`}
              <footer class="p-foot">Made with VocabStudy · vocabstudy.nagdista.com · by nagdista.com</footer>
            </article>
          </div>
        </div>`;
    },

    mount() {
      if (!listening) { document.addEventListener("change", onChange); listening = true; }
      if (!watching) {
        watching = true;
        window.addEventListener("resize", () => { if (VS.app.current() === "print") fitPreview(); });
      }
      requestAnimationFrame(fitPreview);
      if (document.fonts) document.fonts.ready.then(fitPreview);
    },

    actions: {
      "print-opt"(el) { opts[el.dataset.name] = el.dataset.value; VS.app.render(); },
      "print-now"() { window.print(); },
      "pdf-download"(el) { downloadPdf(el); },
    },
  };
})();
