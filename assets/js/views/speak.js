/* views/speak.js — say the word out loud; the app listens.
   Many Arabic speakers know a word and still avoid saying it: P that
   turns into B, a silent letter pronounced, an extra vowel before "st".
   Here you hear the word, see its sound traps, then say it yourself.

   A miss is never held against your memory: speech recognition can be
   wrong, so only a word you said right counts (VS.store.grade "good").
   Up to three tries per word, then move on. */
(function () {
  "use strict";
  const { html, icon } = VS;
  const TRIES = 3;

  let s = null;   // { scope, words, index, tries, state, heard, right, missed: [] }

  const MESSAGES = {
    "not-allowed": "Allow the microphone for this page to use Speak.",
    "service-not-allowed": "Allow the microphone for this page to use Speak.",
    "no-speech": "I didn't hear anything. Tap the mic and say the word.",
    "audio-capture": "No microphone found.",
    network: "Speech recognition needs a connection in this browser.",
  };

  function finish() {
    const next = VS.finishStep(s.scope, "speak");
    if (!s.missed.length && s.right) setTimeout(VS.ui.celebrate, 150);
    return VS.ui.summary({
      title: s.missed.length ? "Speaking done" : "Every word said right",
      message: s.missed.length ? "Listen to these again, then try once more — slowly is fine." : "Your mouth knows these words now.",
      stats: [
        { value: s.right + " / " + s.words.length, label: "said right", tone: "good" },
        { value: s.missed.length, label: "to practise", tone: s.missed.length ? "bad" : "" },
      ],
      words: s.missed,
      actions: [
        next ? Object.assign({ primary: true }, next) : { href: s.scope.back, label: "Done", primary: true },
        { action: "restart", label: "Speak again" },
      ],
    });
  }

  VS.views.speak = {
    title: () => "Speak",
    crumbs: (p) => VS.ui.crumbs(p, "Speak"),

    start(p) {
      const scope = VS.scope(p);
      s = { scope, words: scope ? VS.sessionWords(scope.words, VS.roundSize()) : [], index: 0,
            tries: 0, state: "ready", heard: "", error: "", right: 0, missed: [], combo: 0 };
    },

    leave() { VS.listen.stop(); },

    render() {
      if (!VS.listen.supported) {
        return VS.ui.emptyActivity("#/", VS.listen.available
          ? "Speak practice is off. Turn it on in Settings → Study."
          : "This browser can't listen. Speak works in Chrome, Edge and Safari.");
      }
      if (!s.scope || !s.words.length) return VS.ui.emptyActivity("#/", "There are no words to say.");
      if (s.index >= s.words.length) return html`<div class="activity">${finish()}</div>`;
      const w = s.words[s.index];
      const said = s.state === "right";
      const missed = s.state === "wrong";
      return html`
        <div class="activity">
          ${VS.ui.activityHead({ back: s.scope.back, title: "Speak · " + s.scope.title, index: s.index, total: s.words.length, combo: s.combo })}
          <section class="speak card">
            <p class="speak-ar" lang="ar">${w.arabic}</p>
            <p class="speak-word"><span class="mark">${w.word}</span></p>
            <div class="row speak-sound">${VS.ui.speakButton(w.word)}<span class="ipa">${w.ipa}</span>
              <button class="btn btn-quiet" type="button" data-action="slow">${icon("clock", "icon-sm")} Slower</button></div>
            ${VS.ui.soundTraps(w)}
            <button class="mic ${s.state === "listening" ? "is-listening" : ""}" type="button" data-action="listen"
                    aria-label="${s.state === "listening" ? "Listening — say the word" : "Tap and say the word"}" ${said ? VS.raw("disabled") : ""}>
              ${icon("mic", "icon-lg")}
            </button>
            <p class="speak-status" role="status">${
              s.state === "listening" ? "Listening… say the word."
              : said ? html`${icon("check", "icon-sm")} Clear — I heard “${s.heard}”.`
              : missed ? (s.heard ? html`I heard “${s.heard}”. ${s.tries < TRIES ? "Listen once more and try again." : "Listen to it again later."}` : MESSAGES[s.error] || "Couldn't hear that. Try again.")
              : "Tap the mic and say it."}</p>
          </section>
          <p class="hint speak-note">Your browser does the listening (Chrome and Edge use their online speech service). Turn Speak off in Settings.</p>
          <div class="action-bar">
            ${said || s.tries >= TRIES
              ? html`<button class="btn btn-lg btn-primary" type="button" data-action="next" id="nextBtn">Next word <kbd>Enter</kbd></button>`
              : html`<button class="btn btn-lg" type="button" data-action="skip">Skip</button>
                     <button class="btn btn-lg btn-primary" type="button" data-action="listen">${icon("mic", "icon-sm")} Say it <kbd>Space</kbd></button>`}
          </div>
        </div>`;
    },

    mount() {
      const w = s && s.words[s.index];
      if (w && s.state === "ready" && s.tries === 0) VS.speech.auto(w.word);
    },

    actions: {
      slow() { VS.speech.say(VS.spellingOf(s.words[s.index]), null, 0.6); },
      async listen() {
        if (s.state === "listening") return;
        const w = s.words[s.index];
        s.state = "listening";
        VS.app.render();
        const r = await VS.listen.hear(w.word);
        if (VS.app.current() !== "speak" || s.words[s.index] !== w) return;    // left the screen meanwhile
        s.heard = r.heard;
        s.error = r.error;
        if (r.ok) {
          s.state = "right";
          s.right++; s.combo++;
          VS.store.grade(w.id, "good");
          VS.sfx.play("right");
        } else if (r.error && !r.heard) {
          s.state = "wrong";                       // no speech / no mic: not a try
        } else {
          s.state = "wrong";
          s.tries++; s.combo = 0;
          VS.sfx.play("wrong");
          if (s.tries >= TRIES && !s.missed.includes(w)) s.missed.push(w);
        }
        VS.app.render();
      },
      skip() {
        const w = s.words[s.index];
        if (!s.missed.includes(w)) s.missed.push(w);
        this.next();
      },
      next() { s.index++; s.tries = 0; s.state = "ready"; s.heard = ""; s.error = ""; VS.app.render(); },
      restart() { VS.views.speak.start(VS.app.params()); VS.app.render(); },
    },

    keys(e) {
      if (!s || s.index >= s.words.length) return;
      if (e.key === " ") { e.preventDefault(); if (s.state !== "right" && s.tries < TRIES) this.actions.listen(); }
      else if (e.key === "Enter" && (s.state === "right" || s.tries >= TRIES)) { e.preventDefault(); this.actions.next(); }
    },
  };
})();
