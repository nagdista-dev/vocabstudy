/* core/speech.js — pronunciation with the browser's built-in voices.
   The Web Speech API needs no key and no network. Voices load
   asynchronously, so we pick one lazily the first time we speak. */
(function () {
  "use strict";

  const synth = window.speechSynthesis;
  let voice = null;

  function pickVoice() {
    if (!synth) return null;
    const voices = synth.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
    // Prefer natural-sounding US/UK voices when the system has them.
    return (
      voices.find((v) => /natural|neural|google/i.test(v.name) && /en[-_](US|GB)/i.test(v.lang)) ||
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
      voice = voice || pickVoice();
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
  };
})();
