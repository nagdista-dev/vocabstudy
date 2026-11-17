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

  /* ── Google Translate, shared and careful ──────────────────────
     Auto-fill, the spelling check, Arabic → English and From text all use
     Google's free web endpoint. It is not an official API: it can answer
     429 ("too many requests") or stop answering. Every call goes through
     here so the app reacts once, in one way:
       • a refusal (429, 403, 5xx) or a dead connection while online pauses
         Google for 10 minutes, then 30 — no hammering a closed door
       • while paused, calls fail at once: callers fall back (the spelling
         check to its word list, auto-fill to dictionaryapi.dev + MyMemory,
         and the word is filled again later — VS.autofill.resume)
       • VS.google.status() → "ok" | "paused" | "offline", for Settings
     ------------------------------------------------------------------ */
  const GOOGLE_URL = "https://translate.googleapis.com/translate_a/single?client=gtx&dj=1";
  const PAUSES = [10, 30];                 // minutes, then 30 for every refusal after
  let pausedUntil = 0, refusals = 0;
  const statusListeners = [];
  const tellStatus = () => statusListeners.forEach((fn) => { try { fn(VS.google.status()); } catch (e) { /* a view went away */ } });

  VS.google = {
    status: () => (!navigator.onLine ? "offline" : Date.now() < pausedUntil ? "paused" : "ok"),
    /** When Google will be tried again (ms since epoch), or 0. */
    pausedUntil: () => (Date.now() < pausedUntil ? pausedUntil : 0),
    onStatus(fn) { statusListeners.push(fn); },
    /**
     * One request: { sl, tl, dt: [...], q } → the JSON. Throws when paused,
     * offline, slow (timeout ms) or refused.
     */
    async json({ sl, tl, dt, q }, timeout) {
      if (!navigator.onLine) throw new Error("offline");
      if (Date.now() < pausedUntil) throw new Error("paused");
      const url = GOOGLE_URL + "&sl=" + sl + "&tl=" + tl + dt.map((d) => "&dt=" + d).join("") + "&q=" + encodeURIComponent(q);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout || 8000);
      let res;
      try {
        res = await fetch(url, { signal: ctrl.signal });
      } catch (e) {
        clearTimeout(timer);
        // Aborted on our own timer: slow, not refused. A failed fetch while online: treated as refused.
        if (e.name !== "AbortError" && navigator.onLine) refuse();
        throw e;
      }
      clearTimeout(timer);
      if (res.status === 429 || res.status === 403 || res.status >= 500) { refuse(); throw new Error("HTTP " + res.status); }
      if (!res.ok) throw new Error("HTTP " + res.status);
      if (refusals) { refusals = 0; tellStatus(); }
      return res.json();
    },
  };
  function refuse() {
    const wait = PAUSES[Math.min(refusals, PAUSES.length - 1)] * 60000;
    pausedUntil = Date.now() + wait;
    refusals++;
    tellStatus();
    // When the pause ends: say so, and finish the words that waited.
    clearTimeout(refuse.timer);
    refuse.timer = setTimeout(() => { tellStatus(); if (VS.autofill) VS.autofill.resume(); }, wait + 1000);
  }
  window.addEventListener("online", tellStatus);
  window.addEventListener("offline", tellStatus);

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

  /* ── Meanings checked by hand, and the meaning the learner met ────
     assets/data/overrides.js holds the common words free dictionaries get
     wrong. Its meanings are trusted: they come first and need no "Is this
     the meaning?" question. When the learner met the word in a sentence
     ("The plane will take off at six"), that sentence picks the meaning:
     the one whose keys, definition or example share its words. */
  /** The checked entry a word belongs to: itself, its British spelling, or its base ("gave up" → "give up"). */
  const aliasOf = (word) => (window.VS_OVERRIDE_ALIASES || {})[VS.wordKey(word)] || "";
  function overrideSenses(word) {
    const all = window.VS_OVERRIDES || {};
    const o = all[VS.wordKey(word)] || all[aliasOf(word)];
    if (!o) return null;
    return (o.senses || [o]).map((m) => ({ type: m.type, pos: String(m.type || "").toLowerCase(), definition: m.definition,
      example: m.example, arabic: m.arabic, synonyms: m.synonyms || [], keys: m.keys || "", trusted: true }));
  }
  /* Words of a sentence, the same way on both sides: lower case, curly ' straightened, a plural
     "s"/"es" taken off (planes = plane, shoes = shoe), and the word itself left out in all its
     forms ("took", "gave", "broke" are the headword, never a clue). */
  const PRONOUNS = new Set("i me my mine you your yours he him his she her hers it its we us our ours they them their theirs this that these those there here".split(" "));
  const MORE_STOP = new Set("can could will would shall should may might must not get got gets new one two time day year last next very really just also".split(" "));
  const norm = (x) => {
    x = x.replace(/'s$/, "");
    if (x.length <= 3) return x;
    x = x.replace(/ies$/, "y").replace(/(?:ses|xes|ches|shes)$/, (m) => m.slice(0, -2));
    return /[^s]s$/.test(x) ? x.slice(0, -1) : x;                    // no lookbehind: older iPhones can't parse it
  };
  function ownForms(word) {
    return new Set(String(word).toLowerCase().split(/\s+/).flatMap((t) => [t].concat(VS.IRREGULAR[t] || [])
      .concat(VS.wordForms ? VS.wordForms(t) : [])).map(norm));
  }
  function contextWords(text, word) {
    const own = ownForms(word);
    return new Set(String(text || "").toLowerCase().replace(/[’‘]/g, "'").split(/[^a-z']+/)
      .filter((x) => x.length >= 2 && !STOP.has(x) && !PRONOUNS.has(x) && !MORE_STOP.has(x)).map(norm).filter((x) => !own.has(x)));
  }
  /**
   * The meaning a sentence points to → its index, or -1 ("ask the learner").
   * Checked meanings vote only with their explicit `keys`; a tie is no answer.
   * Dictionary meanings vote with their definition and similar words (never
   * their example — its words are where wrong picks came from) and need two
   * clues and a clear lead before the app decides alone.
   */
  function senseFor(senses, context, word) {
    const ctx = contextWords(context, word);
    if (!ctx.size) return -1;
    const checked = senses.length && senses.every((m) => m.trusted);
    const scores = senses.slice(0, 8).map((m) => {
      const keys = checked
        ? new Set(String(m.keys || "").toLowerCase().split(/\s+/).filter(Boolean).map(norm))
        : new Set([...keysOf(m, word)].filter((k) => !PRONOUNS.has(k) && !MORE_STOP.has(k)).map(norm));
      return [...ctx].filter((x) => keys.has(x)).length;
    });
    const best = Math.max(0, ...scores);
    const at = scores.indexOf(best);
    const second = Math.max(0, ...scores.filter((_, i) => i !== at));
    if (!best || best === second) return -1;                         // no clue, or a tie: ask
    if (!checked && (best < 2 || best - second < 2)) return -1;        // the dictionary must be clearly right
    return at;
  }

  /** Similar words a learner can use: common (top 6,000), one or two words, three at most. */
  function commonSimilar(list) {
    return (list || []).filter((x) => {
      const parts = String(x).toLowerCase().split(/\s+/);
      return parts.length <= 2 && parts.every((t) => VS.frequency.rank(t) < 6000);
    }).slice(0, 3);
  }

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
    const data = await VS.google.json({ sl: "en", tl: "ar", dt: ["t", "bd", "md", "ex", "ss"], q: word });
    if (!data) return { senses: [], translation: "" };
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
    // "relieved", "interested", "tired" are adjectives a learner meets as such: never turned into a verb.
    const b = d0 && d0.pos === "verb" && d0.base_form && !entriesFor.adjective && !overrideSenses(word) ? d0.base_form.toLowerCase() : "";
    const base = b && b !== word.toLowerCase() && !/\s/.test(word) &&
      word.toLowerCase().startsWith(b.replace(/[ey]$/, "")) && /(?:s|ed|ing)$/i.test(word) ? b : "";
    return { senses, translation: hasArabic(translation) ? arabicList([translation]) : "", base, mainPos, entriesFor, examples,
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
    const data = await VS.google.json({ sl: "en", tl: "ar", dt: ["t"], q: todo.map(term).join("\n") });
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
      // "change"/"changes", "box"/"boxes", "woman"/"women" are one collocate.
      const key = ({ women: "woman", men: "man", children: "child", people: "person", feet: "foot", teeth: "tooth" })[x] ||
        x.replace(/(s|x|z|ch|sh)es$/, "$1").replace(/s$/, "");
      // Three at most, and only collocates a learner meets (top 6,000): "heavy rain", not "resilient modulus".
      if (!/^[a-z-]+$/.test(x) || FILLER.has(x) || seen.has(key) || out.length >= 3 || VS.frequency.rank(x) >= 6000) return;
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
  async function lookup(word, context) {
    await VS.frequency.load();
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
    // Checked meanings first; then the meaning the learner's own sentence points to.
    const checked = overrideSenses(word);
    let fromContext = false, unsettled = false;
    if (checked) {
      const i = senseFor(checked, context, word);
      if (i > 0) checked.unshift(checked.splice(i, 1)[0]);
      fromContext = i >= 0;
      unsettled = checked.length > 1 && i < 0;           // several everyday meanings, nothing to choose by
      senses = checked.concat(senses);
    } else if (context) {
      const i = senseFor(senses, context, word);
      if (i > 0) senses.unshift(senses.splice(i, 1)[0]);
      fromContext = i >= 0;
    }
    const first = senses[0] || {};
    const fields = {};
    // The definition belongs to the Arabic shown: the dictionary's first one only when nothing else is known.
    fields.definition = first.definition || (first.arabic && !first.unsure ? "" : dv.definition) || "";
    // An example belongs to its definition: use the dictionary's only with its own definition.
    fields.example = first.definition ? first.example : (dv.example || first.example || "");
    // A short example reads better for an A2–B1 learner: when the meaning's own is long
    // (over 14 words), Google's shortest everyday example for the same word goes in.
    const words = (t) => String(t || "").split(/\s+/).filter(Boolean).length;
    if (!first.trusted && fields.example && words(fields.example) > 14 && senses[0] === gv.senses[0]) {
      const short = (gv.examples || []).filter((e) => words(e) <= 14 && VS.findIn({ word }, e)).sort((a, b) => words(a) - words(b))[0];
      if (short) fields.example = short;
    }
    fields.type = first.type || dv.type || "";
    // A meaning's own Arabic; Google's one-line translation only when there are no meanings at all.
    fields.arabic = first.arabic || (first.definition ? "" : gv.translation) || "";
    // Checked meanings carry no similar words: borrow them from the dictionary's meaning of the
    // same part of speech (the one whose Arabic agrees, if any), common words only.
    const twin = first.trusted && (gv.senses.find((m) => m.pos === first.pos && m.arabic && shares(m.arabic, first.arabic)) ||
      gv.senses.find((m) => m.pos === first.pos));
    fields.synonyms = first.trusted ? ((first.synonyms || []).length ? first.synonyms : commonSimilar(twin && twin.synonyms))
      : commonSimilar(first.synonyms);
    fields.ipa = dv.ipa || "";
    fields.audio = dv.audio || "";
    if (!fields.arabic) { try { fields.arabic = await myMemory(word); } catch (e) { /* offline */ } }
    try { fields.goes = await collocations(word, fields.type); } catch (e) { /* offline: no collocations, that's all */ }
    const word2 = caseFrom(word, fields.example);
    if (word2) fields.word = word2;
    if (first.trusted) fields.trusted = true;
    if (fromContext) fields.fromContext = true;
    // Drop empty values: "found nothing" must not overwrite anything.
    Object.keys(fields).forEach((k) => { if (!fields[k] || (Array.isArray(fields[k]) && !fields[k].length)) delete fields[k]; });
    if (!senses.length && dv.definition) senses.push({ type: dv.type, definition: dv.definition, example: dv.example || "", synonyms: [], arabic: fields.arabic || "" });
    const offline = g.status === "rejected" && d.status === "rejected";
    // Google didn't answer but the dictionary did: the word gets what there is
    // now, and is filled again properly when Google is back (work → partial).
    const googleDown = g.status === "rejected" && !offline;
    // Neither dictionary knows it, and it isn't a common word: probably a typo
    // ("recieve"). The word gets a "Check the spelling" line with the fix.
    await VS.frequency.load();
    const unknown = (word.toLowerCase().match(/[a-z]+/g) || []).some((t) => !VS.spelling.known(t));
    // Only when both dictionaries answered: a silent Google is not "no dictionary knows it".
    if (!offline && !googleDown && !gv.found && !dv.found && unknown) {
      let fix = "";
      if (!VS.spelling.kept(word)) { try { fix = await VS.spelling.suggest(word); } catch (e) { /* no suggestion */ } }
      // "Keep it as typed" is remembered with the word, so it is never asked again.
      fields.check = VS.spelling.kept(word) ? { kind: "ok" } : { kind: "spelling", fix };
    }
    // Meanings a learner would translate differently: ask which one they met —
    // unless a checked meaning or the learner's own sentence already settled it.
    else if (checked ? unsettled : !fromContext && ambiguous(senses, gv.entriesFor, word)) fields.check = { kind: "meaning" };
    // "gave up" is learned as "give up" (its base); "realise" keeps the learner's British spelling.
    const alias = aliasOf(word);
    const phraseBase = alias && /\s/.test(word) && /\s/.test(alias) ? alias : "";
    return { fields, senses, offline, googleDown, base: gv.base || phraseBase || "" };
  }

  const enabled = () => VS.store.settings().autofill !== false;
  let toldBusy = false;                    // "the meaning service is busy": once a visit
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
        // Filled while Google was down, and not studied yet: start again from
        // scratch, so the Arabic and the definition come from one meaning.
        if (w.partial && VS.store.status(id) === "new") VS.store.clearAutoFields(id);
        let found = await lookup(w.word, w.context);
        // An inflected verb ("postponed", "went") becomes its base form, unless
        // that word is already in the library. The sentence it came with stays.
        if (found.base && VS.store.status(id) === "new") {
          const moved = VS.store.renameUserWord(id, found.base);
          if (moved) { now = moved; found = await lookup(found.base, w.context); }
        }
        const { fields, offline, googleDown } = found;
        // Offline: keep it marked, and try again next time the app is online.
        // Google down: keep what the other dictionaries gave, marked to finish later.
        VS.store.fillUserWord(now, fields, (offline && !Object.keys(fields).length) || googleDown ? "todo" : "",
          { partial: googleDown });
        if (googleDown && !toldBusy) {
          toldBusy = true;
          VS.toast("Saved. The meaning service is busy — the details will be finished in a few minutes.");
        }
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
    async senses(word, context) { return (await lookup(word, context)).senses; },
    /** The checked meanings of a word (assets/data/overrides.js), or null. */
    checked: (word) => overrideSenses(word),
    /** Which meaning a sentence points to (index, or -1): exposed for tests and the review harness. */
    senseFor: (senses, context, word) => senseFor(senses, context, word),
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
    /**
     * At start-up: words auto-filled before their meaning was checked by hand
     * ("persuade" = اقتنع, "commute" = خفف العقوبة) move to the checked meaning —
     * the one their "Where you met it" sentence points to, else the first.
     * Words whose Arabic the learner typed, or confirmed, are left alone.
     */
    migrateChecked() {
      if (!window.VS_OVERRIDES) return 0;
      let n = 0;
      VS.allWords().forEach((w) => {
        if (w.confirmed || w.trusted) return;
        const checked = overrideSenses(w.word);
        if (!checked) return;
        const i = senseFor(checked, w.context, w.word);
        const m = checked[i >= 0 ? i : 0];
        if (core(m.arabic) && cores(w.arabic).includes(core(m.arabic.split(" - ")[0]))) {
          if (VS.store.upgradeToChecked(w.id, Object.assign({}, m, { arabic: w.arabic }), i >= 0)) n++;   // same meaning: just mark it
          return;
        }
        if (VS.store.upgradeToChecked(w.id, m, i >= 0)) n++;
      });
      return n;
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
