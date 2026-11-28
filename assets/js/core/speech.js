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
  let activeSpeech = null; // the utterance waiting to start or speaking
  let lastNotice = { text: "", at: 0 };

  /** A quiet, specific explanation — in the card when one is open, else a toast. */
  function notice(text, action, kind) {
    const now = Date.now();
    if (text === lastNotice.text && now - lastNotice.at < 5000) return;
    lastNotice = { text, at: now };
    // The card note can carry one action. The global toast's button is the
    // shared Undo slot, so outside the card the message stays button-free.
    if (VS.cardNote && VS.cardNote(text, action, kind)) return;
    if (VS.toast) VS.toast(text);
  }

  /** Why the browser's voice did not answer, in words a learner can act on. */
  function reasonFor(code) {
    switch (code) {
      case "not-allowed":
        return "Your browser blocked the sound. Allow it for this site, then tap the speaker again.";
      case "audio-busy":
        return "Another app is using the speaker. Close it and tap again.";
      case "audio-hardware":
        return "The speaker isn't available. Check your sound output and tap again.";
      case "network":
        return "The voice needs the internet right now. Check your connection and tap again.";
      case "language-unavailable":
      case "voice-unavailable":
        return "No English voice is installed. Add one in your system settings, then tap again.";
      case "synthesis-unavailable":
      case "synthesis-failed":
        return "The voice engine stopped. Tap again — if it stays quiet, restart the browser.";
      case "text-too-long":
      case "invalid-argument":
        return "That text can't be spoken. Try a shorter one.";
      default:
        return "The voice didn't start. Check your volume, then tap again.";
    }
  }

  /** A delay note has done its job once the voice actually starts. */
  function hideDelayNote() {
    const note = document.querySelector("#wordCard[open] .word-card-toast");
    if (note && note.dataset.kind === "delay") note.hidden = true;
  }

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

  function speak(text, button, rate, quiet) {
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(text);
    if (!voice || voiceFor !== VS.store.settings().voice) voice = pickVoice();
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : "en-US";
    u.rate = rate || VS.store.settings().rate;
    if (button) button.classList.add("is-speaking");
    let started = false;
    let delayTimer = 0;
    const entry = { u, done: null };
    const done = () => {
      clearTimeout(delayTimer);
      if (button) button.classList.remove("is-speaking");
      if (activeSpeech === entry) activeSpeech = null;
    };
    entry.done = done;
    u.onstart = () => { started = true; clearTimeout(delayTimer); hideDelayNote(); };
    u.onend = done;
    u.onerror = (e) => {
      done();
      const code = e && e.error;
      // A new word, a closed card or the learner tapping again: not a failure.
      if (code === "canceled" || code === "interrupted") return;
      if (!quiet) notice(reasonFor(code));
    };
    // Some browsers queue a voice and then never start it. Say so, gently,
    // instead of leaving the learner tapping a silent button.
    delayTimer = setTimeout(() => {
      if (!started && !quiet) notice("The voice is still waking up. Give it a second, then tap again.", null, "delay");
    }, 1500);
    activeSpeech = entry;
    try {
      synth.speak(u);
    } catch (err) {
      done();
      if (!quiet) notice("The voice engine refused. Tap again — if it stays quiet, restart the browser.");
    }
  }

  function play(url, text, button, rate, quiet) {
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
      speak(text, button, rate, quiet);
    };
    if (button) button.classList.add("is-speaking");
    audio.addEventListener("ended", () => { if (player === audio) player = null; done(); });
    audio.addEventListener("error", fallback);
    audio.play().catch(fallback);
  }

  const settingsAction = () => (VS.actions && VS.actions["open-settings"]
    ? { label: "Settings", run: () => VS.actions["open-settings"]() }
    : null);

  VS.speech = {
    supported: !!synth,

    /** Say text. `button` (optional) shows a speaking state while it plays.
        `quiet` is for automatic speech: it never explains a silence. */
    say(text, button, rate, quiet) {
      if (!text) return;
      if (!VS.store.settings().sound) {
        if (!quiet) notice("Sound is off, so the word stays quiet. Turn it on in Settings to hear words.", settingsAction(), "sound-off");
        return;
      }
      this.stop();
      const url = recordingFor(text);
      if (url) { play(url, text, button, rate, quiet); return; }
      if (!synth) {
        if (!quiet) notice("This browser has no voice. Open the app in Chrome, Edge or Safari to hear words.");
        return;
      }
      speak(text, button, rate, quiet);
    },

    stop() {
      if (activeSpeech) { activeSpeech.done(); activeSpeech = null; }
      if (synth) synth.cancel();
      if (player) { player.pause(); player = null; }
    },

    /** Say a new word on its own — only if "Say new words automatically" is on. */
    auto(text) { if (VS.store.settings().autoplay) this.say(text, null, null, true); },
  };
})();
