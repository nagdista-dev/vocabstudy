/* core/autofill.js — you type the word, the app fills in the rest.
   ------------------------------------------------------------------
   A new word needs its IPA, definition, example, type and Arabic meaning.
   (Its CEFR level is yours to set: no free source knows it reliably, and a
   wrong level shown as fact would mislead.) Typing all of that is what makes people stop adding words, so
   the app does it:

     dictionaryapi.dev        IPA, definition, example, part of speech
     mymemory.translated.net  the Arabic meaning

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
    // The main part of speech is the one with the most senses ("borrow" is
    // a verb, though the dictionary lists a rare noun first). Within it,
    // prefer a sense with an example: the app needs one for "fill the gap".
    const byType = {};
    entries.flatMap((e) => e.meanings || []).forEach((m) => {
      (byType[m.partOfSpeech] = byType[m.partOfSpeech] || []).push(...(m.definitions || []));
    });
    const main = Object.keys(byType).sort((a, b) => byType[b].length - byType[a].length)[0];
    const defs = main ? byType[main] : [];
    const d = defs.find((x) => x.example) || defs[0];
    const best = d ? { m: { partOfSpeech: main }, d } : null;
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

  /**
   * The Arabic meaning, from a free translation memory. A verb is asked as
   * "to borrow" — alone, "borrow" often comes back as a noun. Long lists of
   * synonyms are cut to three, written the app's way: «يستلف - ياخد سلف».
   */
  async function arabic(word, type) {
    const q = (type === "Verb" || type === "Phrasal Verb") && !/^to\s/i.test(word) ? "to " + word : word;
    const data = await getJSON("https://api.mymemory.translated.net/get?langpair=en|ar&q=" + encodeURIComponent(q));
    const text = data && data.responseData && data.responseData.translatedText;
    if (!hasArabic(text)) return {};
    const parts = [...new Set(String(text).replace(/[.。]+$/, "").split(/[,،;؛]/)
      .map((t) => t.trim().replace(/^(أن|ان)\s+/, "")).filter(hasArabic))].slice(0, 3);
    return parts.length ? { arabic: parts.join(" - ") } : {};
  }

  /**
   * Everything the app can find for one word → { fields, offline }.
   * `fields` holds only what was found; the caller decides what to keep.
   */
  async function lookup(word) {
    const fields = {};
    let offline = false;
    // The dictionary first: knowing the part of speech makes the translation better.
    try { Object.assign(fields, await dictionary(word)); } catch (e) { offline = true; }
    try { Object.assign(fields, await arabic(word, fields.type)); } catch (e) { offline = true; }
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
      if (!w) continue;
      running++;
      try {
        const { fields, offline } = await lookup(w.word);
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
