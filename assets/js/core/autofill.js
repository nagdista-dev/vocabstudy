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
     api.datamuse.com
         the words it goes with: heavy rain, a subtle difference
         (Arab learners say "strong rain": collocations are where they slip)

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
  // Two meanings at most: a learner reads the first and remembers one. Three
  // ("جميل - حسن - مليح") mostly adds a rare word.
  const MAX_ARABIC = 2;
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

  /* A phrasal verb is a verb and its particle: give up, take off, look after,
     put up with. "make a decision" is a verb too, but it's a phrase (a
     collocation): its second word isn't a particle. */
  const PARTICLES = new Set(("up off on out in into away back down over through around round about along across " +
    "by after for with apart aside ahead forward together under").split(" "));
  const phrasalShape = (word) => {
    const parts = String(word || "").toLowerCase().trim().split(/\s+/);
    return parts.length >= 2 && parts.length <= 3 && !PARTICLES.has(parts[0]) && parts.slice(1).every((x) => PARTICLES.has(x));
  };

  /** Part of speech → the app's word type. */
  function typeOf(pos, word) {
    const type = TYPE[String(pos || "").toLowerCase()];
    if (!type) return "";
    if (/\s/.test(word)) return type === "Verb" && phrasalShape(word) ? "Phrasal Verb" : "Phrase";
    return type;
  }

  /* ── One meaning, one Arabic ─────────────────────────────────────
     Google lists Arabic words per part of speech, not per meaning, and
     each Arabic word comes with the English words it translates back to
     ("خلع" ← take off, strip, slip off; "طار" ← fly, rise). A meaning gets
     the Arabic words whose back-translations share a word with its own
     definition and similar words — so "take off: the action of becoming
     airborne" is never shown as "اخلع". A meaning nothing matches gets its
     Arabic later, from its closest similar word (translateTerms). */
  const STOP = new Set(("the and for that with from this into onto have has had are was were been being your their " +
    "which what when where who whom whose such than then them they there these those very more most some any about " +
    "someone something somebody often usually especially particular quickly become becoming make made cause").split(" "));
  const stem = (w) => (w.length > 4 ? w.replace(/(?:ations?|ments?|ings?|ies|ied|ed|es|ly|s)$/, "") : w);
  function keysOf(m, word) {
    const own = new Set(String(word).toLowerCase().split(/\s+/).map(stem));
    const keys = new Set();
    [m.definition].concat(m.synonyms || []).join(" ").toLowerCase().split(/[^a-z]+/).forEach((x) => {
      if (x.length >= 3 && !STOP.has(x) && !own.has(stem(x))) keys.add(stem(x));
    });
    return keys;
  }
  /** The Arabic words (of this part of speech) that belong to this meaning, best first. */
  function arabicFor(m, word, entries) {
    const keys = keysOf(m, word);
    // Google lists its Arabic words most common first; a match keeps that order
    // ("beautiful": جميل before وسيم, which only matches "handsome").
    const hits = (entries || []).filter((e) => (e.reverse_translation || []).join(" ").toLowerCase()
      .split(/[^a-z]+/).filter(Boolean).map(stem).some((x) => keys.has(x)));
    // Common words first: Google scores how often each Arabic word is the
    // translation. A rare one ("مليح") is kept only when nothing common fits.
    const common = hits.filter((e) => (e.score || 0) >= 0.001);
    return arabicList((common.length ? common : hits).map((e) => e.word));
  }

  /* Arabic words compared by their core: "تلقى" = "تلقي" = "يتلقى", "التحدي" = "تحدى". */
  const core = (a) => {
    let w = String(a || "").replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
      .trim().replace(/^ال/, "");
    if (w.length > 3 && /[يا]$/.test(w)) w = w.slice(0, -1);           // تحدي → تحد
    if (w.length > 3 && /^[يتان]/.test(w)) w = w.slice(1);              // يتلقى → تلق
    return w;
  };
  const cores = (list) => String(list || "").split(" - ").map(core).filter(Boolean);
  const shares = (a, b) => { const B = cores(b); return cores(a).some((x) => B.some((y) => x === y || x.includes(y) || y.includes(x))); };

  /** Google's usual Arabic for a part of speech: its translation if it's one of them, then its top words. */
  function mainArabic(translation, entries) {
    const top = (entries || []).slice(0, 3).map((e) => e.word);
    if (!top.length) return "";
    return arabicList((translation && shares(translation, top.join(" - ")) ? [translation] : []).concat(top), 2);
  }

  /**
   * Does the learner need to pick the meaning? Only when the word clearly
   * has meanings that a learner would translate differently, or when the
   * Arabic of the first meaning couldn't be confirmed:
   *   • the first meaning's Arabic is only Google's usual guess, and the word
   *     has many meanings ("bank": the dictionary starts with a river bank)
   *   • a phrasal verb with meanings that share no Arabic ("take off": نزع / إقلاع)
   *   • parts of speech that share no Arabic ("fine": رفيع / غرامة) — not "challenge" (تحدي / تحدى)
   */
  function ambiguous(senses, entriesFor, word) {
    const s0 = senses[0];
    if (!s0 || !s0.arabic || senses.length < 2) return false;
    if (s0.unsure && senses.filter((m) => m.pos === s0.pos).length >= 3) return true;
    const top = senses.slice(1, 5).filter((m) => m.arabic && !shares(m.arabic, s0.arabic));
    if (phrasalShape(word) && top.length) return true;
    return top.some((m) => m.pos !== s0.pos && entriesFor && (entriesFor[m.pos] || []).length);
  }

  /** Several Arabic meanings, written the app's way: «في الواقع - فعلاً - حقاً». */
  function arabicList(list, max) {
    const out = [], seen = new Set();
    list.forEach((t) => {
      String(t || "").replace(/[.。]+$/, "").split(/[,،;؛]/).forEach((part) => {
        const p = part.trim().replace(/^(أن|ان)\s+/, "");
        // One form of a word is enough: "يحقق - حقق" is the same verb twice.
        const key = core(p);
        if (hasArabic(p) && !seen.has(key) && p.length <= 40) { seen.add(key); out.push(p); }
      });
    });
    return out.slice(0, max || MAX_ARABIC).join(" - ");
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
    const entriesFor = {};
    (data.dict || []).forEach((d) => { entriesFor[d.pos] = d.entry || (d.terms || []).map((t) => ({ word: t })); });
    const clean = (t) => String(t || "").replace(/[.。]+$/, "").trim();
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
      const m = {
        type: typeOf(group.pos, word),
        pos: group.pos,
        definition: gloss(e.gloss),
        example: sentence(e.example),
        synonyms: similar(synonymsFor[group.pos + "|" + (e.definition_id || "")] || []),
      };
      m.arabic = arabicFor(m, word, entriesFor[group.pos]);
      senses.push(m);
    }));
    // The first sense gets an example from Google's list when its own has none.
    if (senses.length && !senses[0].example && examples.length) senses[0].example = examples[0];
    // No definitions (most phrases): still keep the part of speech and the Arabic.
    const mainPos = ((data.dict || [])[0] || {}).pos || "";
    if (!senses.length && mainPos) {
      senses.push({ type: typeOf(mainPos, word), pos: mainPos, definition: "", example: examples[0] || "", synonyms: [],
                    arabic: arabicList([translation].concat((entriesFor[mainPos] || []).map((e) => e.word))) });
    }
    // Google's one-line translation joins the first meaning only when it is
    // one of that meaning's own Arabic words: "تلقي" for receive, never "اخلع"
    // for "the action of becoming airborne".
    const one = clean(translation);
    if (senses[0] && hasArabic(one) && senses[0].arabic && shares(one, senses[0].arabic)) {
      senses[0].arabic = arabicList([one].concat(senses[0].arabic.split(" - ")));
    }
    // A first meaning nothing matched ("receive: be given, presented with…")
    // takes Google's own most common Arabic for its part of speech.
    if (senses[0] && !senses[0].arabic) {
      senses[0].arabic = mainArabic(one, entriesFor[senses[0].pos]);
      if (senses[0].arabic) senses[0].unsure = true;        // likely, not confirmed: see ambiguous()
    }
    // "postponed" → base "postpone": a learner should learn the verb, not one of its forms.
    const d0 = (data.dict || [])[0];
    // Only regular forms (postponed, borrowing, studied): "born" is not "bear", "found" may not be "find".
    const b = d0 && d0.pos === "verb" && d0.base_form ? d0.base_form.toLowerCase() : "";
    const base = b && b !== word.toLowerCase() && !/\s/.test(word) &&
      word.toLowerCase().startsWith(b.replace(/[ey]$/, "")) && /(?:s|ed|ing)$/i.test(word) ? b : "";
    return { senses, translation: hasArabic(translation) ? arabicList([translation]) : "", base, mainPos, entriesFor,
             found: !!((data.dict || []).length || (data.definitions || []).length) };
  }

  /**
   * Arabic for meanings that have none yet, in one request: each meaning
   * sends its closest similar word ("liftoff" → "إقلاع"), or its definition
   * without "To" and brackets ("leave the ground and begin flight").
   */
  async function translateTerms(senses) {
    // A definition translated word by word reads badly ("النزاع على صحة أو صحة"):
    // only the first meaning, which must have Arabic, falls back to it.
    const todo = senses.slice(0, 6).filter((m, i) => !m.arabic && ((m.synonyms || []).length || (i === 0 && m.definition)));
    if (!todo.length) return;
    // "To leave the ground…" is sent with its "to": Arabic answers "لمغادرة الأرض…",
    // and the "ل" comes off → "مغادرة الأرض" (a meaning, not an order: "اترك الأرض").
    const term = (m) => {
      const one = (m.synonyms || []).find((x) => !/\s/.test(x)) || (m.synonyms || [])[0];
      return (one || m.definition.replace(/\([^)]*\)/g, "").trim().split(/[;:]/)[0]).replace(/[.\n]+/g, " ").trim();
    };
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dj=1&dt=t&q=" +
      encodeURIComponent(todo.map(term).join("\n"));
    const data = await getJSON(url);
    const lines = ((data && data.sentences) || []).map((x) => x.trans || "").join("").split("\n");
    todo.forEach((m, i) => {
      let ar = lines[i] || "";
      if (/^to\s/i.test(term(m))) ar = ar.trim().replace(/^ل(?=[ء-ي]{3})/, "");
      if (hasArabic(ar)) m.arabic = arabicList([ar]);
    });
  }

  /* ── dictionaryapi.dev: IPA, and a definition when Google has none ── */

  /** A real transcription: "/ˈæk.(t)ʃu.ə.li/", not a fragment like "/-ɪ/" or "/bi-/". */
  const goodIPA = (t) => /[a-zɑ-ʒˈˌəɪʊæɛɔʌθðŋʃʒ]{2}/i.test(String(t || "").replace(/[-./\s]/g, "")) && !/^\/?-|-\/?$/.test(t || "");
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
    // Real recordings (S5): the dictionary tags them -us / -uk. Played when online.
    const audio = {};
    data.flatMap((e) => e.phonetics || []).forEach((p) => {
      const m = /-(us|uk)\.mp3$/.exec(p.audio || "");
      if (m && !audio[m[1]] && /^https:\/\//.test(p.audio)) audio[m[1]] = p.audio;
    });
    if (audio.us || audio.uk) out.audio = audio;
    // The main part of speech has the most senses ("borrow" is a verb, though a
    // rare noun is listed first); its FIRST sense is the most common one.
    const byType = {};
    data.flatMap((e) => e.meanings || []).forEach((m) => {
      // Only each definition's own similar words: the list under a part of speech
      // covers all its meanings ("take off": remove, flourish…) and would mix them.
      (byType[m.partOfSpeech] = byType[m.partOfSpeech] || []).push(...(m.definitions || []));
    });
    const order = Object.keys(byType).sort((a, b) => byType[b].length - byType[a].length);
    const main = order[0];
    const d = main && byType[main][0];
    if (d) {
      out.definition = gloss(d.definition);
      if (d.example) out.example = sentence(d.example);
      out.type = typeOf(main, word);
      out.pos = main;
    }
    out.found = true;
    // Its meanings too, a few per part of speech: Google has none for many
    // phrasal verbs ("take off" as a verb), and these fill that gap.
    out.senses = order.flatMap((pos) => byType[pos].slice(0, 4).map((x) => ({
      type: typeOf(pos, word), pos, definition: gloss(x.definition), example: x.example ? sentence(x.example) : "",
      synonyms: [...new Set(x.synonyms || [])].filter((y) => !/\s.*\s/.test(y)).slice(0, MAX_SIMILAR),
    })));
    return out;
  }

  /** The Arabic meaning when Google can't be reached. */
  async function myMemory(word) {
    const data = await getJSON("https://api.mymemory.translated.net/get?langpair=en|ar&q=" + encodeURIComponent(word));
    const text = data && data.responseData && data.responseData.translatedText;
    return hasArabic(text) ? arabicList([text]) : "";
  }

  /* ── Datamuse: the words it goes with (collocations) ─────────── */

  // Words that go with almost anything teach nothing: "much rain", "such advice".
  const FILLER = new Set(("little much more most such whole entire many few several various certain other own same " +
    "next last first second main real great big small good new").split(" "));

  /** Nouns → the adjectives used with them ("heavy rain"); adjectives → their nouns ("subtle difference"). */
  async function collocations(word, type) {
    if (/\s/.test(word) || (type !== "Noun" && type !== "Adjective")) return [];
    const rel = type === "Noun" ? "rel_jjb" : "rel_jja";
    const data = await getJSON("https://api.datamuse.com/words?max=25&" + rel + "=" + encodeURIComponent(word.toLowerCase()));
    if (!Array.isArray(data)) return [];
    const seen = new Set();
    const out = [];
    data.forEach((d) => {
      const x = String(d.word || "").toLowerCase();
      const key = x.replace(/(s|x|z|ch|sh)es$/, "$1").replace(/s$/, "");   // "change"/"changes", "box"/"boxes" are one
      if (!/^[a-z-]+$/.test(x) || FILLER.has(x) || seen.has(key) || out.length >= 4) return;
      seen.add(key);
      out.push(type === "Noun" ? x + " " + word.toLowerCase() : word.toLowerCase() + " " + x);
    });
    return out;
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
    const gv = g.status === "fulfilled" ? g.value : { senses: [], translation: "", entriesFor: {} };
    const dv = d.status === "fulfilled" ? d.value : {};
    let senses = gv.senses.slice();
    // The part of speech Google translates first is the word's main one
    // ("take off" → verb: اخلع). When Google has no meanings for it, the
    // dictionary's go first — with Arabic chosen for each of them.
    const main = gv.mainPos;
    if (main && !senses.some((m) => m.pos === main) && dv.senses) {
      const extra = dv.senses.filter((m) => m.pos === main);
      extra.forEach((m) => { m.arabic = arabicFor(m, word, gv.entriesFor[main]); });
      if (extra[0] && !extra[0].arabic) {
        extra[0].arabic = mainArabic(gv.translation, gv.entriesFor[main]);
        if (extra[0].arabic) extra[0].unsure = true;
      }
      senses = extra.concat(senses);
    }
    if (!senses.length && dv.senses) senses = dv.senses.slice();
    // Google has the Arabic but no definition ("look after": اعتني): take the
    // dictionary meaning that Arabic belongs to ("to take care of"), not just
    // its first one ("to follow with the eyes").
    if (senses[0] && !senses[0].definition && senses[0].arabic && dv.senses) {
      const own = (gv.entriesFor[senses[0].pos] || []).filter((e) => shares(e.word, senses[0].arabic));
      const fit = dv.senses.find((m) => (m.pos === senses[0].pos || !senses[0].pos) && arabicFor(m, word, own));
      if (fit) senses[0] = Object.assign({}, fit, { arabic: senses[0].arabic, example: fit.example || senses[0].example });
      else senses[0].unsure = true;
    }
    try { await translateTerms(senses); } catch (e) { /* offline or blocked: those meanings stay without Arabic */ }
    const first = senses[0] || {};
    const fields = {};
    // The definition belongs to the Arabic shown: the dictionary's first one only when nothing else is known.
    fields.definition = first.definition || (first.arabic && !first.unsure ? "" : dv.definition) || "";
    // An example belongs to its definition: use the dictionary's only with its own definition.
    fields.example = first.definition ? first.example : (dv.example || first.example || "");
    fields.type = first.type || dv.type || "";
    // A meaning's own Arabic; Google's one-line translation only when there are no meanings at all.
    fields.arabic = first.arabic || (first.definition ? "" : gv.translation) || "";
    fields.synonyms = first.synonyms || [];
    fields.ipa = dv.ipa || "";
    fields.audio = dv.audio || "";
    if (!fields.arabic) { try { fields.arabic = await myMemory(word); } catch (e) { /* offline */ } }
    try { fields.goes = await collocations(word, fields.type); } catch (e) { /* offline: no collocations, that's all */ }
    const word2 = caseFrom(word, fields.example);
    if (word2) fields.word = word2;
    // Drop empty values: "found nothing" must not overwrite anything.
    Object.keys(fields).forEach((k) => { if (!fields[k] || (Array.isArray(fields[k]) && !fields[k].length)) delete fields[k]; });
    if (!senses.length && dv.definition) senses.push({ type: dv.type, definition: dv.definition, example: dv.example || "", synonyms: [], arabic: fields.arabic || "" });
    const offline = g.status === "rejected" && d.status === "rejected";
    // Neither dictionary knows it, and it isn't a common word: probably a typo
    // ("recieve"). The word gets a "Check the spelling" line with the fix.
    await VS.frequency.load();
    const unknown = (word.toLowerCase().match(/[a-z]+/g) || []).some((t) => !VS.spelling.known(t));
    if (!offline && !gv.found && !dv.found && unknown) {
      let fix = "";
      if (!VS.spelling.kept(word)) { try { fix = await VS.spelling.suggest(word); } catch (e) { /* no suggestion */ } }
      // "Keep it as typed" is remembered with the word, so it is never asked again.
      fields.check = VS.spelling.kept(word) ? { kind: "ok" } : { kind: "spelling", fix };
    }
    // Meanings a learner would translate differently: ask which one they met.
    else if (ambiguous(senses, gv.entriesFor, word)) fields.check = { kind: "meaning" };
    return { fields, senses, offline, base: gv.base || "" };
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
      let now = id;
      try {
        let found = await lookup(w.word);
        // An inflected verb ("postponed", "went") becomes its base form, unless
        // that word is already in the library. The sentence it came with stays.
        if (found.base && VS.store.status(id) === "new") {
          const moved = VS.store.renameUserWord(id, found.base);
          if (moved) { now = moved; found = await lookup(found.base); }
        }
        const { fields, offline } = found;
        // Offline: keep it marked, and try again next time the app is online.
        VS.store.fillUserWord(now, fields, offline && !Object.keys(fields).length ? "todo" : "");
      } catch (e) {
        VS.store.fillUserWord(now, {}, "todo");
      } finally {
        running--;
        listeners.forEach((fn) => fn(now, id));
        work();
      }
    }
  }

  VS.autofill = {
    lookup,
    enabled,
    /** Every meaning of a word, most common first (Edit → Other meanings). */
    async senses(word) { return (await lookup(word)).senses; },
    /** Arabic for one meaning that has none yet (picked in Other meanings): "" if it can't be found. */
    async arabicOf(sense) {
      const m = Object.assign({ synonyms: [] }, sense, { arabic: "" });
      try { await translateTerms([m]); } catch (e) { /* offline */ }
      return m.arabic;
    },
    /** Called with (id, oldId) each time a word has been filled; the id changes when a verb form became its base. */
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
    /**
     * At start-up: words saved before the spelling check existed. A word with
     * no definition that isn't a common word is looked at once; a likely typo
     * gets the "Check the spelling" line, the rest are marked as looked at.
     */
    async review() {
      if (!enabled() || !navigator.onLine) return;
      await VS.frequency.load();
      const todo = VS.allWords().filter((w) => !w.check && !w.definition && w.auto !== "todo" &&
        (w.word.toLowerCase().match(/[a-z]+/g) || []).some((t) => !VS.spelling.known(t))).slice(0, 10);
      for (const w of todo) {
        let fix = "";
        try { fix = await VS.spelling.suggest(w.word); } catch (e) { return; }
        VS.store.fillUserWord(w.id, { check: fix ? { kind: "spelling", fix } : { kind: "ok" } }, w.auto || "");
        listeners.forEach((fn) => fn(w.id, w.id));
      }
    },
  };

  window.addEventListener("online", () => VS.autofill.resume());
})();
