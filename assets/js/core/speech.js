/* core/speech.js — pronunciation: a real recording when there is one, the
   browser's voice otherwise.
   ------------------------------------------------------------------
   Browser voices need no key and no network, but on many phones they are
   robotic — and a learner copies what they hear. So for a word in the
   library that auto-fill found a recording for (a person saying it, from
   the dictionary — American or British, Settings → Accent), the app plays
   that recording while online. Offline, or if it fails to load, the
   browser's voice speaks instead, so a button never stays silent.
   Sentences (examples) always use the browser's voice.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  const synth = window.speechSynthesis;
  let voice = null;
  let voiceFor = "";
  let player = null;       // the recording playing now

  /** The best voice for the chosen accent (Settings → Accent): natural voices first. */
  function pickVoice() {
    if (!synth) return null;
    const want = VS.store.settings().voice === "uk" ? /en[-_]GB/i : /en[-_]US/i;
    const voices = synth.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
    voiceFor = VS.store.settings().voice;
    return (
      voices.find((v) => /natural|neural|google|premium|enhanced/i.test(v.name) && want.test(v.lang)) ||
      voices.find((v) => want.test(v.lang)) ||
      voices.find((v) => /en[-_](US|GB)/i.test(v.lang)) ||
      voices[0] || null
    );
  }
  if (synth) synth.addEventListener?.("voiceschanged", () => { voice = pickVoice(); });

  /** The recording for this text, if it is a library word that has one (and we're online). */
  function recordingFor(text) {
    const st = VS.store.settings();
    if (st.recorded === false || !navigator.onLine || !VS.byId) return "";
    const w = VS.findWord(text);
    const a = w && w.audio;
    if (!a) return "";
    return (st.voice === "uk" ? a.uk || a.us : a.us || a.uk) || "";
  }

  function speak(text, button, rate) {
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(text);
    if (!voice || voiceFor !== VS.store.settings().voice) voice = pickVoice();
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : "en-US";
    u.rate = rate || VS.store.settings().rate;
    if (button) {
      button.classList.add("is-speaking");
      u.onend = u.onerror = () => button.classList.remove("is-speaking");
    }
    synth.speak(u);
  }

  function play(url, text, button, rate) {
    const audio = new Audio(url);
    player = audio;
    // Speaking speed applies to recordings too (Normal = 0.9 = as recorded).
    audio.playbackRate = Math.max(0.6, Math.min(1.4, (rate || VS.store.settings().rate) / 0.9));
    audio.preservesPitch = true;
    let fell = false;
    const done = () => { if (button) button.classList.remove("is-speaking"); };
    const fallback = () => {
      if (fell || player !== audio) return;
      fell = true; player = null; done();
      speak(text, button, rate);
    };
    if (button) button.classList.add("is-speaking");
    audio.addEventListener("ended", () => { if (player === audio) player = null; done(); });
    audio.addEventListener("error", fallback);
    audio.play().catch(fallback);
  }

  VS.speech = {
    supported: !!synth,

    /** Say text. `button` (optional) shows a speaking state while it plays. */
    say(text, button, rate) {
      if (!VS.store.settings().sound || !text) return;
      this.stop();
      const url = recordingFor(text);
      if (url) play(url, text, button, rate);
      else speak(text, button, rate);
    },

    stop() {
      if (synth) synth.cancel();
      if (player) { player.pause(); player = null; }
    },

    /** Say a new word on its own — only if "Say new words automatically" is on. */
    auto(text) { if (VS.store.settings().autoplay) this.say(text); },
  };
})();
