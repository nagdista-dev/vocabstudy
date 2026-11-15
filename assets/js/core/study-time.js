/* core/study-time.js — counts real study time and suggests breaks.
   ------------------------------------------------------------------
   Long study days (hours, not minutes) need rest built in. Memory
   consolidates during breaks, and eyes need to refocus at a distance.

   • Time counts only while the tab is visible AND you touched the
     keyboard/mouse in the last 90 seconds — idle time is not study.
   • After N minutes of active study (Settings → Break reminder,
     default 50) a card offers a 5-minute break with a countdown.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html } = VS;
  const TICK = 15;                 // seconds between checks
  const IDLE_AFTER = 90 * 1000;    // no input for 90 s → not studying
  const BREAK_SECONDS = 5 * 60;

  let lastInput = Date.now();
  let sinceBreak = 0;
  let breakTimer = null;

  ["pointerdown", "keydown", "wheel", "touchstart"].forEach((type) =>
    window.addEventListener(type, () => { lastInput = Date.now(); }, { passive: true, capture: true })
  );

  function card(markup) {
    let el = VS.$("#breakCard");
    if (!el) {
      el = document.createElement("aside");
      el.id = "breakCard";
      el.className = "break-card";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.innerHTML = String(markup);
    el.hidden = false;
    return el;
  }
  const hide = () => { const el = VS.$("#breakCard"); if (el) el.hidden = true; };

  function offerBreak(minutes) {
    VS.sfx.play("bell");
    card(html`
      <b>You've studied for ${minutes} minutes.</b>
      <p>A short break helps the words settle. Look at something far away and stand up for a moment.</p>
      <div class="row">
        <button class="btn btn-primary" type="button" data-break="start">Take a 5-minute break</button>
        <button class="btn btn-quiet" type="button" data-break="later">In 10 minutes</button>
      </div>`);
  }

  function startBreak() {
    let left = BREAK_SECONDS;
    const draw = () => card(html`
      <b>Break · ${VS.formatTime(left * 1000)}</b>
      <p>Look 6 metres away for 20 seconds. Roll your shoulders. Drink some water.</p>
      <div class="row"><button class="btn" type="button" data-break="end">Back to study</button></div>`);
    draw();
    clearInterval(breakTimer);
    breakTimer = setInterval(() => {
      left--;
      if (left <= 0) { clearInterval(breakTimer); hide(); VS.toast("Break over — welcome back."); return; }
      draw();
    }, 1000);
    sinceBreak = 0;
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-break]");
    if (!b) return;
    const what = b.dataset.break;
    if (what === "start") startBreak();
    if (what === "later") { sinceBreak -= 10 * 60; hide(); }
    if (what === "end") { clearInterval(breakTimer); sinceBreak = 0; hide(); }
  });

  setInterval(() => {
    if (document.hidden || Date.now() - lastInput > IDLE_AFTER) return;
    VS.store.addStudyTime(TICK);
    sinceBreak += TICK;
    const every = VS.store.settings().breakEvery;
    if (every && sinceBreak >= every * 60 && (VS.$("#breakCard") || { hidden: true }).hidden) {
      offerBreak(Math.round(sinceBreak / 60));
    }
  }, TICK * 1000);

  /** "1 h 20 min" style, for the home screen. */
  VS.formatDuration = function (seconds) {
    const m = Math.floor((seconds || 0) / 60);
    return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min";
  };
})();
