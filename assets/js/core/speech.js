/* core/speech.js — pronunciation with the browser's built-in voices.
   The Web Speech API needs no key and no network. Voices load
   asynchronously, so we pick one lazily the first time we speak. */
(function () {
  "use strict";

  const synth = window.speechSynthesis;
  let voice = null;

  let voiceFor = "";

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

  VS.speech = {
    supported: !!synth,

    /** Speak text. `button` (optional) shows a speaking state while it plays. */
    say(text, button, rate) {
      if (!synth || !VS.store.settings().sound || !text) return;
      synth.cancel();
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
    },

    stop() { if (synth) synth.cancel(); },

    /** Say a new word on its own — only if "Say new words automatically" is on. */
    auto(text) { if (VS.store.settings().autoplay) this.say(text); },
  };
})();
