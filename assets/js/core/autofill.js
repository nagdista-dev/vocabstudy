/* core/autofill.js — you type the word, the app fills in the rest.
   ------------------------------------------------------------------
   A new word needs its IPA, definition, example, type, level and Arabic
   meaning. Typing all of that is what makes people stop adding words, so
   the app does it:

     dictionaryapi.dev        IPA, definition, example, part of speech
     mymemory.translated.net  the Arabic meaning
     estimateLevel()          a CEFR guess from the word itself (no network)

   Privacy: both services are free and need no account. Only the English
   word is sent — never your notes, progress or other words. Settings →
   Auto-fill turns it off; then nothing leaves this device at all.

   Your typing always wins: auto-fill only fills fields that are empty.
   Words added offline are marked { auto: "todo" } and filled the next
   time the app is online (see VS.autofill.resume, called at start-up).
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  const TYPE = { noun: "Noun", verb: "Verb", adjective: "Adjective", adverb: "Adverb", preposition: "Preposition",
                 conjunction: "Conjunction", pronoun: "Pronoun", interjection: "Interjection", determiner: "Determiner" };
  const hasArabic = (s) => /[؀-ۿ]/.test(s || "");

  /** A rough CEFR level when the learner gives none: short everyday words are
      usually lower, long and multi-word ones higher. Editable like any field. */
  function estimateLevel(word) {
    const w = String(word || "").trim();
    if (/\s/.test(w)) return "B2";                 // phrasal verbs and idioms
    if (w.length <= 4) return "A2";
    if (w.length <= 7) return "B1";
    if (w.length <= 10) return "B2";
    return "C1";
  }

  async function getJSON(url) {
    const res = await fetch(url);
    if (res.status === 404) return { missing: true };
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  /** IPA, definition, example and type from the free dictionary. */
  async function dictionary(word) {
    const data = await getJSON("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(word.toLowerCase()));
    if (data.missing || !Array.isArray(data)) return {};
    const entries = data;
    const ipa = entries.map((e) => e.phonetic).find(Boolean) ||
      entries.flatMap((e) => e.phonetics || []).map((p) => p.text).find(Boolean) || "";
    const meanings = entries.flatMap((e) => e.meanings || []);
    // Prefer a sense that comes with an example: the app needs one for "fill the gap".
    let best = null;
    for (const m of meanings) {
      for (const d of m.definitions || []) {
        if (!best) best = { m, d };
        if (d.example && new RegExp(VS.escapeRegExp(word.split(" ")[0].slice(0, 4)), "i").test(d.example)) { best = { m, d }; break; }
      }
      if (best && best.d.example) break;
    }
    const out = {};
    if (ipa) out.ipa = ipa.startsWith("/") ? ipa : "/" + ipa.replace(/^\[|\]$/g, "") + "/";
    if (best) {
      out.definition = best.d.definition;
      if (best.d.example) out.example = best.d.example.charAt(0).toUpperCase() + best.d.example.slice(1);
      const type = TYPE[best.m.partOfSpeech];
      if (type) out.type = /\s/.test(word) && type === "Verb" ? "Phrasal Verb" : type;
    }
    return out;
  }

  /** The Arabic meaning, from a free translation memory. */
  async function arabic(word) {
    const data = await getJSON("https://api.mymemory.translated.net/get?langpair=en|ar&q=" + encodeURIComponent(word));
    const text = data && data.responseData && data.responseData.translatedText;
    return hasArabic(text) ? { arabic: String(text).replace(/[.。]+$/, "").trim() } : {};
  }

  /**
   * Everything the app can find for one word → { fields, offline }.
   * `fields` holds only what was found; the caller decides what to keep.
   */
  async function lookup(word) {
    const fields = {};
    let offline = false;
    const tries = await Promise.allSettled([dictionary(word), arabic(word)]);
    tries.forEach((t) => {
      if (t.status === "fulfilled") Object.assign(fields, t.value);
      else offline = true;
    });
    return { fields, offline };
  }

  const enabled = () => VS.store.settings().autofill !== false;
  const queue = [];
  let running = 0;
  const listeners = [];

  async function work() {
    while (queue.length && running < 3) {
      const id = queue.shift();
      const w = VS.byId[id];
      if (!w || !w.custom) continue;
      running++;
      try {
        const { fields, offline } = await lookup(w.word);
        fields.level = estimateLevel(w.word);        // used only if you left the level empty
        // Offline: keep it marked, and try again next time the app is online.
        VS.store.fillUserWord(id, fields, offline && !Object.keys(fields).length ? "todo" : "");
      } catch (e) {
        VS.store.fillUserWord(id, {}, "todo");
      } finally {
        running--;
        listeners.forEach((fn) => fn(id));
        work();
      }
    }
  }

  VS.autofill = {
    lookup,
    estimateLevel,
    enabled,
    /** Called with a word id each time a word has been filled. */
    onFill(fn) { listeners.push(fn); },
    /** Is this word still waiting to be filled? */
    pending: (id) => queue.includes(id) || (VS.byId[id] && VS.byId[id].auto === "todo" && enabled()),
    /** Fill these words in the background (only their empty fields). */
    fill(ids) {
      if (!enabled() || !navigator.onLine) return;
      ids.forEach((id) => { if (!queue.includes(id)) queue.push(id); });
      work();
    },
    /** At start-up and when the connection comes back: words added offline. */
    resume() {
      if (!enabled()) return;
      VS.autofill.fill(VS.allWords().filter((w) => w.auto === "todo").map((w) => w.id));
    },
  };

  window.addEventListener("online", () => VS.autofill.resume());
})();
