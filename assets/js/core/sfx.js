/* core/sfx.js — small interface sounds, synthesised on the fly.
   ------------------------------------------------------------------
   No audio files: every sound is a few notes made with the Web Audio
   API, so it works offline and adds nothing to load. They are short
   and quiet on purpose — after hours of study, loud or long sounds tire.

     VS.sfx.play("right")   correct answer      two rising notes
     VS.sfx.play("wrong")   wrong answer        one soft low note
     VS.sfx.play("flip")    card flip           a light tick
     VS.sfx.play("pop")     matched pair        a short pop
     VS.sfx.play("combo", n) streak of n        pitch climbs with the streak
     VS.sfx.play("done")    round finished      a short chime
     VS.sfx.play("perfect") perfect round       a little fanfare
     VS.sfx.play("bell")    break reminder      a soft bell

   Settings → Sound effects switches them off; pronunciation is separate.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  let ctx = null;
  const VOLUME = 0.07;

  // Browsers only allow audio after the learner has interacted with the page.
  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /** One soft note: frequency (Hz), start offset and length (s), wave shape. */
  function note(ac, freq, at, length, type, level) {
    const t = ac.currentTime + at;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(VOLUME * (level || 1), t + 0.01);    // quick, click-free attack
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);            // natural fade
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  // Notes of a C-major scale: everything sounds consonant together.
  const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5;

  const SOUNDS = {
    right: (ac) => { note(ac, E5, 0, 0.12); note(ac, A5, 0.07, 0.2); },
    wrong: (ac) => { note(ac, 220, 0, 0.22, "triangle", 1.2); },
    flip: (ac) => { note(ac, 1400, 0, 0.04, "triangle", 0.5); },
    pop: (ac) => { note(ac, G5, 0, 0.08, "sine", 1.1); note(ac, C6, 0.04, 0.1, "sine", 0.7); },
    combo: (ac, n) => {
      const scale = [C5, D5, E5, G5, A5, C6];
      note(ac, scale[Math.min(scale.length - 1, Math.max(0, n - 2))] * 2, 0, 0.12, "sine", 0.6);
    },
    done: (ac) => { [C5, E5, G5].forEach((f, i) => note(ac, f, i * 0.08, 0.3)); },
    perfect: (ac) => { [C5, E5, G5, C6].forEach((f, i) => note(ac, f, i * 0.09, 0.35)); note(ac, E5 * 2, 0.4, 0.5, "sine", 0.6); },
    bell: (ac) => { note(ac, A5, 0, 1.2, "sine", 0.8); note(ac, A5 * 2.76, 0, 0.6, "sine", 0.15); },
  };

  VS.sfx = {
    play(name, arg) {
      if (!VS.store.settings().effects) return;
      const ac = audio();
      if (ac && SOUNDS[name]) SOUNDS[name](ac, arg);
    },
  };
})();
