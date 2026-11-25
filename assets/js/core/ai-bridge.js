/* core/ai-bridge.js — an AI app on this computer (Claude, opencode…) adds and edits words.
   ------------------------------------------------------------------------
   The words live here, in this browser. An AI app can't reach them, so a
   small messenger runs on the same computer (mcp/server.js) and passes its
   requests to this tab over 127.0.0.1. THIS tab does the work, with the same
   functions the learner's own taps use, and shows every change with Undo.

   • Off until the learner turns it on (Settings → App & data → AI assistant).
   • Nothing goes to a server: the messenger listens on this computer only.
   • Read, add, edit, add a sentence. No delete, no changes to the recall
     schedule — the learner's memory stays theirs.

     VS.aiBridge.sync()        connect or disconnect to match the setting
     VS.aiBridge.status()      "off" | "waiting" | "connected"
   ------------------------------------------------------------------------ */
(function () {
  "use strict";
  const PORT = 47821;
  const BASE = "http://127.0.0.1:" + PORT;
  const MAX_ADD = 50;
  const EDITABLE = ["sense", "arabic", "definition", "example", "type", "level", "ipa",
                    "synonyms", "antonyms", "goes", "memory", "tags", "context", "source"];
  const LISTS = ["synonyms", "antonyms", "goes", "tags"];

  let source = null;
  let state = "off";
  const listeners = [];
  const setState = (s) => { if (s !== state) { state = s; listeners.forEach((fn) => fn(s)); } };

  /** "claude-ai" → "Claude": the name the learner sees in the message. */
  function who(client) {
    const c = String(client || "");
    if (/claude/i.test(c)) return "Claude";
    if (/opencode/i.test(c)) return "opencode";
    if (/cursor/i.test(c)) return "Cursor";
    if (/codex|openai|chatgpt/i.test(c)) return "Codex";
    return "Your AI assistant";
  }

  const text = (v, max) => String(v == null ? "" : v).trim().slice(0, max || 400);
  const list = (v) => (Array.isArray(v) ? v : VS.parseTags(String(v || ""))).map((x) => text(x, 40)).filter(Boolean).slice(0, 12);
  const isArabic = (s) => /[؀-ۿ]/.test(s);

  function find(args) {
    const word = text(args.word, 80);
    if (!word) throw new Error("Give the word.");
    const sense = text(args.sense, 60).toLowerCase();
    const ar = text(args.arabic, 120);
    // Every meaning of the word, whatever its sense label. The Arabic is what
    // separates them; a sense only helps pick one when the Arabic is omitted.
    const matches = VS.words.filter((x) => VS.wordKey(x.word) === VS.wordKey(word));
    if (!matches.length) throw new Error("“" + word + "” isn't in the library. Use add_words to add it.");
    if (ar) {
      const w = matches.find((x) => VS.arKey(x.arabic) === VS.arKey(ar));
      if (!w) throw new Error("“" + word + "” has no meaning “" + ar + "” here. Give the exact arabic, or add it with add_words.");
      return w;
    }
    const bySense = sense ? matches.filter((x) => String(x.sense || "").toLowerCase() === sense) : [];
    // Two meanings cannot be told apart without the Arabic: never guess, or
    // an update would land on the wrong meaning.
    if (bySense.length === 1) return bySense[0];
    if (matches.length > 1) {
      throw new Error("“" + word + "” has " + matches.length + " meanings here — give arabic to choose one.");
    }
    return matches[0];
  }

  function brief(w) {
    const e = VS.store.word(w.id);
    return {
      word: w.word, sense: w.sense || undefined, type: w.type || undefined, level: w.level || undefined,
      arabic: w.arabic || undefined, status: VS.store.status(w.id),
      due: e.box ? e.due : undefined, tags: w.tags && w.tags.length ? w.tags : undefined,
    };
  }

  /** Show the change where the learner is, and let them take it back. */
  function announce(message, undo) {
    const view = VS.app.current();
    if (["library", "stats", "week", "import"].includes(view)) VS.app.render();
    VS.toast(message, undo ? { label: "Undo", run: () => { undo(); VS.app.render(); } } : undefined);
  }

  const TOOLS = {
    get_overview() {
      const t = VS.store.totals();
      const s = VS.store.statsFor(VS.allWords());
      const next = VS.store.nextReview();
      const st = VS.store.settings();
      return {
        words: t.words, new: s.new, learning: s.learning, mastered: t.mastered,
        due_for_recall_today: t.due, new_words_left_today: VS.newLeftToday(),
        answers_today: t.today.answered || 0, daily_goal: st.dailyGoal || null, streak_days: t.streak,
        next_recall: next ? { date: next.date, words: next.count } : null,
        recall_days: "A word comes back after 1, 3, 7, 14, 30 and 60 days; mastered = remembered after a week or more.",
      };
    },

    list_words(args) {
      const f = VS.filters.parse("");
      if (args.query) f.q = text(args.query, 80);
      if (args.status && args.status in VS.filters.STATUS) f.status = args.status;
      if (args.tag) f.tag = text(args.tag, 40);
      const all = VS.filters.apply(VS.allWords(), f);
      const offset = Math.max(0, Number(args.offset) || 0);
      const limit = Math.min(200, Math.max(1, Number(args.limit) || 50));
      return { total: all.length, offset, words: all.slice(offset, offset + limit).map(brief) };
    },

    get_word(args) {
      const w = find(args);
      const e = VS.store.word(w.id);
      return Object.assign(brief(w), {
        definition: w.definition || undefined, example: w.example || undefined, ipa: w.ipa || undefined,
        synonyms: w.synonyms && w.synonyms.length ? w.synonyms : undefined,
        antonyms: w.antonyms && w.antonyms.length ? w.antonyms : undefined,
        goes_with: w.goes && w.goes.length ? w.goes : undefined,
        memory_hook: w.memory || undefined,
        mistake_to_avoid: w.mistake || undefined,
        where_they_met_it: w.context ? { sentence: w.context, source: w.source || undefined } : undefined,
        their_sentences: w.mine && w.mine.length ? w.mine.map((m) => ({ text: m, may_have_a_mistake: VS.sentenceUnsure(w, m) || undefined })) : undefined,
        their_note: VS.store.note(w.id) || undefined,
        needs_a_check: w.check ? w.check.kind : undefined,
        recall: e.box ? { step: e.box + " of 6", next: e.due, right: e.right, wrong: e.wrong } : "not studied yet",
        common_mistakes: VS.usageTraps(w).map((t) => ({ kind: t.label, wrong: t.wrong || undefined, right: t.right || undefined, why: t.why || undefined })),
      });
    },

    add_words(args, client) {
      const items = Array.isArray(args.words) ? args.words.slice(0, MAX_ADD) : [];
      if (!items.length) throw new Error("Give at least one word.");
      const skipped = [];
      const fresh = [];
      items.forEach((it) => {
        const word = text(it && it.word, 80);
        if (!word) return;
        if (isArabic(word)) { skipped.push({ word, reason: "That's Arabic: give the English word." }); return; }
        const sense = text(it.sense, 60);
        const ar = text(it.arabic, 120);
        // One English word, one Arabic meaning. A different meaning is a second
        // word, and the sense label only names it.
        if (VS.findSameWord(word, sense, ar) || fresh.some((x) => VS.wordKey(x.word) === VS.wordKey(word) && VS.arKey(x.arabic) === VS.arKey(ar))) {
          skipped.push({ word, reason: ar ? "already in the library with this meaning" : "already in the library" }); return;
        }
        const sameHead = VS.words.filter((x) => VS.wordKey(x.word) === VS.wordKey(word))
          .concat(fresh.filter((x) => VS.wordKey(x.word) === VS.wordKey(word)));
        if (sameHead.length && !VS.arKey(ar)) {
          skipped.push({ word, reason: "the word is already here with another meaning — give its arabic to keep this one" }); return;
        }
        const w = { word, tags: list(it.tags) };
        EDITABLE.forEach((k) => {
          if (LISTS.includes(k) || !it[k]) return;
          w[k] = text(it[k], k === "context" || k === "memory" ? 300 : 400);
        });
        if (it.synonyms) w.synonyms = list(it.synonyms).slice(0, 6);
        if (it.antonyms) w.antonyms = list(it.antonyms).slice(0, 4);
        if (it.goes) w.goes = list(it.goes).slice(0, 6);
        const mistake = VS.cleanMistake(it.mistake || {
          wrong: it.wrong || it.mistakeWrong, right: it.right || it.mistakeRight, why: it.why || it.mistakeWhy,
        });
        if (mistake) w.mistake = mistake;
        if (w.arabic && !isArabic(w.arabic)) delete w.arabic;          // a translation that isn't Arabic is noise
        // The app's own dictionaries fill whatever the assistant left out.
        const missing = !w.arabic || !w.definition || !w.example || !w.ipa || !w.type;
        fresh.push(VS.autofill.enabled() && missing ? Object.assign(w, { auto: "todo" }) : w);
      });
      const result = VS.store.saveUserWords(fresh);
      const ids = result.added.map((w) => w.id);
      (result.skipped || []).forEach((w) => skipped.push({ word: w.word, reason: "already in the library with this meaning" }));
      (result.needsArabic || []).forEach((w) => skipped.push({ word: w.word, reason: "give its arabic to keep another meaning of the same word" }));
      if (ids.length) {
        VS.autofill.fill(ids);
        const names = result.added.slice(0, 3).map((w) => w.word).join(", ") + (ids.length > 3 ? "…" : "");
        announce(who(client) + " added " + VS.plural(ids.length, "word") + ": " + names, () => VS.store.deleteUserWords(ids));
      }
      return {
        added: result.added.map((w) => w.word), skipped,
        note: ids.length ? "Missing details are being filled in by the app's dictionaries. The learner can undo this." : undefined,
      };
    },

    update_word(args, client) {
      const w = find(args);
      const c = args.changes || {};
      const changes = {};
      EDITABLE.forEach((k) => {
        if (!(k in c)) return;
        changes[k] = LISTS.includes(k)
          ? list(c[k]).slice(0, k === "tags" ? 12 : 6)
          : text(c[k], k === "context" || k === "memory" ? 300 : 400);
      });
      if ("mistake" in c) {
        const mistake = VS.cleanMistake(c.mistake);
        changes.mistake = mistake;                    // null clears it
      }
      if ("arabic" in changes && !isArabic(changes.arabic)) throw new Error("The Arabic meaning has to be in Arabic.");
      if ("example" in changes && changes.example.split(/\s+/).length > 20) throw new Error("Keep the example short: 20 words or fewer.");
      const note = "note" in c ? text(c.note, 600) : null;
      if (!Object.keys(changes).length && note === null) throw new Error("Nothing to change.");
      const snap = VS.store.snapshot([w.id]);
      const oldNote = VS.store.note(w.id);
      if (Object.keys(changes).length) {
        const r = VS.store.editUserWord(w.id, changes);
        if (r.error) throw new Error("Couldn't change “" + w.word + "” (" + r.error + ").");
        if (r.id !== w.id) { delete VS.byId[w.id]; w.id = r.id; }
        w.variant = r.variant || "";
        Object.assign(w, changes);                  // the word in memory too, so every screen shows it now
        delete w.check;
        VS.byId[w.id] = w;
      }
      if (note !== null) VS.store.setNote(w.id, note);
      const what = Object.keys(changes).concat(note !== null ? ["note"] : []).join(", ");
      announce(who(client) + " changed “" + w.word + "”: " + what, () => {
        VS.store.restore(snap);
        VS.store.setNote(w.id, oldNote);
      });
      return { word: w.word, changed: Object.keys(changes).concat(note !== null ? ["note"] : []) };
    },

    add_sentence(args, client) {
      const w = find(args);
      const sentence = text(args.sentence, 300);
      const r = VS.checkSentence(w, sentence);
      if (!r.ok) {
        return {
          saved: false,
          problems: r.problems.map((p) => (p.trap ? { kind: p.trap.label, you_wrote: p.found || undefined, fixed: p.fixed || undefined, why: p.text }
            : { why: typeof p.text === "string" ? p.text : String(p.text) })),
          hint: "Help the learner fix it, then try again with the corrected sentence.",
        };
      }
      const snap = VS.store.snapshot([w.id]);
      VS.store.addSentence(w.id, r.clean);
      announce(who(client) + " saved your sentence with “" + w.word + "”", () => VS.store.restore(snap));
      return { saved: true, sentence: r.clean, note: "It comes back in Recall as a gap." };
    },
  };

  async function answer(id, ok, payload) {
    try {
      await fetch(BASE + "/reply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ok ? { id, ok: true, result: payload } : { id, ok: false, error: payload }),
      });
    } catch (e) { /* the messenger went away; it times the call out itself */ }
  }

  function connect() {
    if (source || typeof EventSource === "undefined") return;
    setState("waiting");
    source = new EventSource(BASE + "/events");
    source.addEventListener("hello", () => setState("connected"));
    source.addEventListener("call", (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      const run = TOOLS[msg.tool];
      if (!run) { answer(msg.id, false, "Unknown tool: " + msg.tool); return; }
      try { answer(msg.id, true, run(msg.args || {}, msg.client)); }
      catch (e) { answer(msg.id, false, e.message || String(e)); }
    });
    // No messenger running yet: the browser keeps retrying every few seconds on its own.
    source.onerror = () => setState("waiting");
  }

  function disconnect() {
    if (source) { source.close(); source = null; }
    setState("off");
  }

  VS.aiBridge = {
    sync() { if (VS.store.settings().aiBridge === true) connect(); else disconnect(); },
    status: () => state,
    onStatus(fn) { listeners.push(fn); },
  };
})();
