/* core/autofill.js — you type the word, the app fills in the rest.
   ------------------------------------------------------------------
   A new word needs its Arabic meaning, a definition, an example, its
   type, similar words and its IPA. (Its CEFR level is yours to set: no
   free source knows it reliably, and a wrong level shown as fact would
   mislead.) Typing all of that is what makes people stop adding words,
   so the app does it, from free services that need no account:

     Google Translate (the free web endpoint)
         the Arabic meaning, the most common sense's definition and
         example, the part of speech and similar words
     dictionaryapi.dev
         the IPA (American or British, Settings → Accent), and a
         definition when Google has none
     mymemory.translated.net
         the Arabic meaning when Google can't be reached

   THE MOST COMMON MEANING FIRST. Dictionaries list a word's senses from
   the most common down. The app takes the first sense of the main part
   of speech, and that sense's own example — never "the first sense that
   happens to have an example", which picked "eventually: (of a sequence)
   for some tail…" over "in the end". A word with several meanings can be
   switched to another one in Edit → Other meanings (VS.autofill.senses).

   Privacy: only the English word is sent — never your notes, progress
   or other words. Settings → Auto-fill turns it off; then nothing leaves
   this device at all.

   Your typing always wins: auto-fill only fills fields that are empty.
   Words added offline are marked { auto: "todo" } and filled the next
   time the app is online (see VS.autofill.resume, called at start-up).
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  const TYPE = { noun: "Noun", verb: "Verb", adjective: "Adjective", adverb: "Adverb", preposition: "Preposition",
                 conjunction: "Conjunction", pronoun: "Pronoun", interjection: "Interjection", determiner: "Determiner",
                 exclamation: "Interjection", article: "Determiner", abbreviation: "Noun" };
  const hasArabic = (s) => /[؀-ۿ]/.test(s || "");
  const MAX_ARABIC = 3;
  const MAX_SIMILAR = 4;

  async function getJSON(url) {
    const res = await fetch(url);
    if (res.status === 404) return { missing: true };
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  /* ── Small text helpers ──────────────────────────────────────── */

  /** "<b>eventually</b>, after midnight, I arrived" → "Eventually, after midnight, I arrived." */
  function sentence(text) {
    const t = String(text || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    const s = t.charAt(0).toUpperCase() + t.slice(1);
    return /[.!?…"”')]$/.test(s) ? s : s + ".";
  }

  /** "take and use (something) … returning it." → same, first letter capitalised. */
  const gloss = (text) => {
    const t = String(text || "").replace(/^\((?:modal|informal|formal)\)\s*/i, "").trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
  };

  /** Part of speech → the app's word type. "give up" as a verb is a phrasal verb. */
  function typeOf(pos, word) {
    const type = TYPE[String(pos || "").toLowerCase()];
    if (!type) return "";
    if (/\s/.test(word)) return type === "Verb" ? "Phrasal Verb" : "Phrase";
    return type;
  }

  /** Several Arabic meanings, written the app's way: «في الواقع - فعلاً - حقاً». */
  function arabicList(list) {
    const out = [];
    list.forEach((t) => {
      String(t || "").replace(/[.。]+$/, "").split(/[,،;؛]/).forEach((part) => {
        const p = part.trim().replace(/^(أن|ان)\s+/, "");
        if (hasArabic(p) && !out.includes(p) && p.length <= 40) out.push(p);
      });
    });
    return out.slice(0, MAX_ARABIC).join(" - ");
  }

  /* ── Google: meanings, examples, Arabic, similar words ───────── */

  /**
   * Every sense Google knows, most common first:
   *   [{ type, definition, example, synonyms: [], arabic }]
   * plus `translation`, its one-line Arabic translation of the word.
   */
  async function google(word) {
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dj=1" +
      "&dt=t&dt=bd&dt=md&dt=ex&dt=ss&q=" + encodeURIComponent(word);
    const data = await getJSON(url);
    if (!data || data.missing) return { senses: [], translation: "" };
    const translation = (data.sentences || []).map((s) => s.trans || "").join("").trim();
    const arabicFor = {};
    (data.dict || []).forEach((d) => { arabicFor[d.pos] = d.terms || (d.entry || []).map((e) => e.word); });
    // Similar words for each sense. Groups marked informal, archaic or rare
    // ("borrow" → "nab", "filch") are left out: a learner copies what they see.
    const synonymsFor = {};
    (data.synsets || []).forEach((set) => (set.entry || []).forEach((e) => {
      if (e.label_info && e.label_info.register && e.label_info.register.length) return;
      const key = set.pos + "|" + (e.definition_id || "");
      synonymsFor[key] = (synonymsFor[key] || []).concat(e.synonym || []);
    }));
    // One or two words first: "delay" before "put off doing something".
    const similar = (list) => [...new Set(list)]
      .filter((x) => x.toLowerCase() !== word.toLowerCase() && x.split(/\s+/).length <= 3)
      .map((x, i) => [x, i]).sort((a, b) => a[0].split(/\s+/).length - b[0].split(/\s+/).length || a[1] - b[1])
      .map(([x]) => x).slice(0, MAX_SIMILAR);
    const examples = ((data.examples && data.examples.example) || []).map((e) => sentence(e.text));
    const senses = [];
    (data.definitions || []).forEach((group) => (group.entry || []).forEach((e) => {
      senses.push({
        type: typeOf(group.pos, word),
        pos: group.pos,
        definition: gloss(e.gloss),
        example: sentence(e.example),
        synonyms: similar(synonymsFor[group.pos + "|" + (e.definition_id || "")] || []),
        arabic: arabicList([translation].concat(arabicFor[group.pos] || [])),
      });
    }));
    // The first sense gets an example from Google's list when its own has none.
    if (senses.length && !senses[0].example && examples.length) senses[0].example = examples[0];
    // No definitions (most phrases): still keep the part of speech and the Arabic.
    if (!senses.length && (data.dict || []).length) {
      const pos = data.dict[0].pos;
      senses.push({ type: typeOf(pos, word), pos, definition: "", example: examples[0] || "", synonyms: [],
                    arabic: arabicList([translation].concat(arabicFor[pos] || [])) });
    }
    return { senses, translation: hasArabic(translation) ? arabicList([translation]) : "" };
  }

  /* ── dictionaryapi.dev: IPA, and a definition when Google has none ── */

  /** A real transcription: "/ˈæk.(t)ʃu.ə.li/", not a fragment like "/-ɪ/". */
  const goodIPA = (t) => /[a-zɑ-ʒˈˌəɪʊæɛɔʌθðŋʃʒ]{2}/i.test(String(t || "").replace(/[-./\s]/g, "")) && !/^\/?-/.test(t || "");
  const slashed = (t) => "/" + String(t).trim().replace(/^[\/\[]|[\/\]]$/g, "") + "/";

  async function dictionary(word) {
    let data = await getJSON("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(word.toLowerCase()));
    // Proper nouns ("Wednesday") are listed with their capital.
    if ((data.missing || !Array.isArray(data)) && word !== word.toLowerCase()) {
      data = await getJSON("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(word));
    }
    if (data.missing || !Array.isArray(data)) return {};
    const out = {};
    // IPA in the learner's accent: the dictionary tags its recordings -us / -uk.
    const accent = VS.store.settings().voice === "uk" ? /-uk\.mp3$/ : /-us\.mp3$/;
    const phonetics = data.flatMap((e) => e.phonetics || []).filter((p) => goodIPA(p.text));
    const ipa = (phonetics.find((p) => accent.test(p.audio || "")) || phonetics[0] || {}).text ||
      data.map((e) => e.phonetic).find(goodIPA);
    if (ipa) out.ipa = slashed(ipa);
    // The main part of speech has the most senses ("borrow" is a verb, though a
    // rare noun is listed first); its FIRST sense is the most common one.
    const byType = {};
    data.flatMap((e) => e.meanings || []).forEach((m) => {
      (byType[m.partOfSpeech] = byType[m.partOfSpeech] || []).push(...(m.definitions || []));
    });
    const main = Object.keys(byType).sort((a, b) => byType[b].length - byType[a].length)[0];
    const d = main && byType[main][0];
    if (d) {
      out.definition = gloss(d.definition);
      if (d.example) out.example = sentence(d.example);
      out.type = typeOf(main, word);
      out.pos = main;
    }
    return out;
  }

  /** The Arabic meaning when Google can't be reached. */
  async function myMemory(word) {
    const data = await getJSON("https://api.mymemory.translated.net/get?langpair=en|ar&q=" + encodeURIComponent(word));
    const text = data && data.responseData && data.responseData.translatedText;
    return hasArabic(text) ? arabicList([text]) : "";
  }

  /** "wednesday" → "Wednesday" when the example writes it with a capital mid-sentence. */
  function caseFrom(word, example) {
    const cap = word.charAt(0).toUpperCase() + word.slice(1);
    if (cap === word || !example) return "";
    return new RegExp("[^.!?\\s]\\s+" + VS.escapeRegExp(cap) + "\\b").test(example) ? cap : "";
  }

  /**
   * Everything the app can find for one word → { fields, senses, offline }.
   * `fields` holds only what was found; the caller decides what to keep.
   * `senses` lists every meaning, for Edit → Other meanings.
   */
  async function lookup(word) {
    const [g, d] = await Promise.allSettled([google(word), dictionary(word)]);
    const gv = g.status === "fulfilled" ? g.value : { senses: [], translation: "" };
    const dv = d.status === "fulfilled" ? d.value : {};
    const senses = gv.senses.slice();
    const first = senses[0] || {};
    const fields = {};
    fields.definition = first.definition || dv.definition || "";
    // An example belongs to its definition: use the dictionary's only with its own definition.
    fields.example = first.definition ? first.example : (dv.example || first.example || "");
    fields.type = first.type || dv.type || "";
    fields.arabic = first.arabic || gv.translation || "";
    fields.synonyms = first.synonyms || [];
    fields.ipa = dv.ipa || "";
    if (!fields.arabic) { try { fields.arabic = await myMemory(word); } catch (e) { /* offline */ } }
    const word2 = caseFrom(word, fields.example);
    if (word2) fields.word = word2;
    // Drop empty values: "found nothing" must not overwrite anything.
    Object.keys(fields).forEach((k) => { if (!fields[k] || (Array.isArray(fields[k]) && !fields[k].length)) delete fields[k]; });
    if (!senses.length && dv.definition) senses.push({ type: dv.type, definition: dv.definition, example: dv.example || "", synonyms: [], arabic: fields.arabic || "" });
    const offline = g.status === "rejected" && d.status === "rejected";
    return { fields, senses, offline };
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
    /** Every meaning of a word, most common first (Edit → Other meanings). */
    async senses(word) { return (await lookup(word)).senses; },
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
