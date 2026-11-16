/* core/sound-traps.js — the pronunciation mistakes Arabic speakers make,
   spotted from the word itself.
   ------------------------------------------------------------------
   A good teacher doesn't just read the IPA aloud; they say "watch the P".
   Arabic has no /p/ and no /v/, is written as it sounds (so silent letters
   get pronounced), and never starts a word with two consonants (so
   "street" turns into "istreet"). Every rule below is one of those habits.

   VS.soundTraps(word) → up to two { title, text } tips, most useful first.
   The IPA confirms each rule when it is there: "know" /nəʊ/ has no /k/, so
   the K really is silent. Without IPA only the rules that are always true
   apply (kn-, wr-, -mb). Learners' own words get tips with no extra typing.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  /* Words whose spelling hides syllables or sounds — the classics a teacher
     corrects again and again. The text says how it really sounds. */
  const KNOWN = {
    comfortable: "Three syllables, not four: COMF-ta-ble. The “or” almost disappears.",
    vegetable: "Three syllables: VEJ-ta-ble. The middle “e” is silent.",
    interesting: "Three syllables: IN-tres-ting. Say “trest”, not “ter-est”.",
    chocolate: "Two syllables: CHOK-lit.",
    different: "Two or three syllables, never four: DIF-rent.",
    family: "Often just two syllables: FAM-ly.",
    every: "Two syllables: EV-ry.",
    wednesday: "Two syllables: WENZ-day. The first “d” is silent.",
    business: "Two syllables: BIZ-nis. The “i” after s is silent.",
    february: "FEB-roo-ary: the first “r” is often dropped — that's fine.",
    clothes: "One syllable, like “close”: the “th” almost disappears.",
    island: "The S is silent: EYE-land.",
    receipt: "The P is silent: ri-SEET.",
    salmon: "The L is silent: SAM-un.",
    debt: "The B is silent: rhymes with “wet”.",
    doubt: "The B is silent: rhymes with “out”.",
    honest: "The H is silent: starts like “on”.",
    hour: "The H is silent: sounds like “our”.",
    honour: "The H is silent: starts like “on”.",
    heir: "The H is silent: sounds like “air”.",
    whole: "The W is silent: sounds like “hole”.",
    answer: "The W is silent: AN-ser.",
    sword: "The W is silent: sounds like “sord”.",
    yacht: "Sounds like “yot”: the “ch” is silent.",
    colonel: "Sounds like “kernel”.",
    women: "WIM-in: the “o” sounds like “i”.",
    said: "Sounds like “sed”, not “sayd”.",
    says: "Sounds like “sez”.",
    psychology: "The P is silent: sy-KOL-o-gy.",
  };

  const has = (ipa, sound) => ipa.indexOf(sound) !== -1;

  /* Each rule: test(word, ipa) → a tip or nothing. Ordered by how much a
     learner gains: silent letters and -ed change the word's shape most. */
  const RULES = [
    // Silent letters — Arabic is read as written, so these get pronounced.
    (w, ipa) => /^kn/.test(w) && { title: "Silent K", text: "Kn- sounds like n: start with the n." },
    (w, ipa) => /^wr/.test(w) && { title: "Silent W", text: "Wr- sounds like r: start with the r." },
    (w, ipa) => /mb(s|ed|ing)?$/.test(w) && (!ipa || !/mb/.test(ipa)) && { title: "Silent B", text: "-mb ends on the m. Don't say the b." },
    (w, ipa) => /(stle|sten)(s|ed|ing)?$/.test(w) && (!ipa || !has(ipa, "t")) && { title: "Silent T", text: "The t after s is silent (listen, castle)." },
    (w, ipa) => ipa && /gh/.test(w) && !has(ipa, "ɡ") && !has(ipa, "g") && !has(ipa, "f") && { title: "Silent GH", text: "The gh makes no sound of its own." },
    (w, ipa) => ipa && /^h/.test(w) && !/^\/?ˈ?ˌ?h/.test(ipa) && { title: "Silent H", text: "The h is silent: start with the vowel." },
    (w, ipa) => ipa && /mn$/.test(w) && !has(ipa, "n/") && { title: "Silent N", text: "-mn ends on the m (autumn)." },

    // -ed: Arabic speakers add a syllable to every -ed ending.
    // Only a real ending: a consonant sound right before the final /t/ or /d/
    // ("worked" /wɜːkt/), so "red" and "hundred" stay quiet.
    (w, ipa) => {
      if (!ipa || w.length < 5 || !/[^e]ed$/.test(w) || /[td]ed$/.test(w)) return null;
      const m = ipa.match(/([^əɪeiːaʊɔɒʌæuɛ])([dt])\/$/);
      return m && { title: "-ed sounds like /" + m[2] + "/", text: "No extra syllable: the -ed is just a short " + m[2] + "." };
    },

    // TH: often turned into s / t (think) or z / d (this).
    (w, ipa) => ipa && /th/.test(w) && has(ipa, "θ") && { title: "TH as in think", text: "Tongue between your teeth, blow air. Not s, not t." },
    (w, ipa) => ipa && /th/.test(w) && has(ipa, "ð") && { title: "TH as in this", text: "Tongue between your teeth, voice on. Not z, not d." },

    // The two sounds Arabic doesn't have.
    (w, ipa) => /p/.test(w.replace(/ph/g, "")) && (!ipa || has(ipa, "p")) && { title: "P, not B", text: "Close both lips and let a puff of air out — a paper in front of your mouth should move." },
    (w, ipa) => /v/.test(w) && { title: "V, not F", text: "Top teeth on your bottom lip, voice on: you should feel a buzz." },

    // Two consonants at the start: no vowel before them.
    (w, ipa) => /^s(p|t|k|c[^eiy]|m|n|l|w|qu)/.test(w) && { title: "No vowel before S", text: "Start straight on the s: “street”, not “istreet”." },
  ];

  /**
   * Word stress, read from the IPA: how many syllables, and which one is
   * stressed (ˈ marks the start of the stressed syllable).
   *   "/pɹoʊˈkɹæstəneɪt/" → { count: 4, stressed: 1 }   pro-CRAS-ti-nate
   * Arabic words keep their stress steady; English moves it, and a word with
   * the right sounds on the wrong syllable is often not understood. Teachers
   * draw it as circles: o O o o. Returns null for one syllable, phrases, or
   * an IPA without a stress mark.
   */
  const VOWELS = "iɪeɛæaɑɒɔoʊuʌəɜɐɚɝyɨʉøœɵɤ";
  VS.stress = function (ipa) {
    const s = String(ipa || "").replace(/[\/\[\]()]/g, "").trim().normalize("NFD");
    if (!s || /\s/.test(s)) return null;
    let count = 0, stressed = -1, inVowel = false;
    for (const ch of s) {
      if (ch === "ˈ") { stressed = count; inVowel = false; continue; }
      if (ch === "ˌ" || ch === ".") { inVowel = false; continue; }
      if (ch === "̩") { count++; inVowel = false; continue; }      // syllabic consonant: the "l" in bottle /ˈbɒtl̩/
      if (VOWELS.includes(ch)) { if (!inVowel) { count++; inVowel = true; } continue; }   // a diphthong is one syllable
      if (ch === "ː" || /[̀-ͯ]/.test(ch)) continue;            // length and diacritics keep the vowel going
      inVowel = false;
    }
    if (count < 2 || stressed < 0) return null;
    return { count, stressed: Math.min(stressed, count - 1) };
  };

  VS.soundTraps = function (word) {
    if (!word || !word.word) return [];
    const w = String(word.word).toLowerCase().trim();
    // Phrases ("rely on"): the first word carries the trap a learner trips on.
    const head = w.split(/\s+/)[0].replace(/[^a-z]/g, "");
    const ipa = String(word.ipa || "").split(/\s+/)[0];
    const tips = [];
    if (KNOWN[head]) tips.push({ title: "Say it right", text: KNOWN[head] });
    for (const rule of RULES) {
      if (tips.length >= 2) break;
      const tip = rule(head, ipa && ipa.charAt(ipa.length - 1) !== "/" ? ipa + "/" : ipa);
      if (tip && !tips.some((t) => t.title === tip.title)) tips.push(tip);
    }
    return tips.slice(0, 2);
  };
})();
