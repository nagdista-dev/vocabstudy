/* core/listen.js — the app listens to you say a word (Speak).
   ------------------------------------------------------------------
   Uses the browser's own speech recognition (Web Speech API). It needs no
   key and no account, but it is the browser's service, not the app's:
   Chrome and Edge send the audio to their speech servers; Safari can
   recognise on the device. The Speak screen says so, and Settings →
   Speak practice switches it off. Firefox has no recognition, so Speak
   simply doesn't appear there.

     VS.listen.supported          → can this browser listen (and is it on)?
     VS.listen.hear(word) → Promise<{ ok, heard, error }>
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let active = null;

  /** Does what you said match the word? Any of the browser's guesses counts,
      and a guess that contains the word ("a borrow") counts too. */
  function matches(guesses, word) {
    const want = VS.normalise(word).replace(/[^a-z' ]/g, "");
    return guesses.some((g) => {
      const got = VS.normalise(g).replace(/[^a-z' ]/g, "");
      return got === want || (" " + got + " ").includes(" " + want + " ");
    });
  }

  VS.listen = {
    get supported() { return !!SR && VS.store.settings().speak !== false; },
    available: !!SR,

    hear(word) {
      return new Promise((resolve) => {
        if (!SR) { resolve({ ok: false, heard: "", error: "unsupported" }); return; }
        VS.listen.stop();
        const r = new SR();
        r.lang = VS.store.settings().voice === "uk" ? "en-GB" : "en-US";
        r.interimResults = false;
        r.maxAlternatives = 5;
        let done = false;
        const finish = (out) => { if (!done) { done = true; active = null; resolve(out); } };
        r.onresult = (e) => {
          const guesses = [...e.results[0]].map((a) => a.transcript.trim());
          finish({ ok: matches(guesses, word), heard: guesses[0] || "", error: "" });
        };
        r.onerror = (e) => finish({ ok: false, heard: "", error: e.error || "error" });
        r.onend = () => finish({ ok: false, heard: "", error: "no-speech" });
        active = r;
        VS.speech.stop();          // don't let the app's own voice answer for you
        try { r.start(); } catch (e) { finish({ ok: false, heard: "", error: "busy" }); }
      });
    },

    stop() { if (active) { try { active.abort(); } catch (e) { /* already stopped */ } active = null; } },
  };
})();
