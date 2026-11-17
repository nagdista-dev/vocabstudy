/* views/transfer.js — Move to another device, through the camera.
   ------------------------------------------------------------------
   The phone and the laptop each keep their own library (the app has no
   server, on purpose). To bring them together, one device shows its data
   as a moving QR code and the other reads it with its camera — no
   internet, no account, nothing passes through anyone else's computer.

   SEND     the full backup (VS.store.exportJSON) is compressed, cut into
            parts, and each part becomes one QR frame. The frames loop
            until the other device has them all.
   RECEIVE  the camera reads frames in any order (a missed one comes round
            again), shows which parts it has, then merges the data into
            this device the same way a backup file is merged: for every
            word the stronger memory wins, notes are kept from both.

   Frame text:  VS1:<session>:<z|u>:<part>:<parts>:<base64 data>
                z = deflate-compressed, u = plain UTF-8
   Libraries (assets/vendor, tools/vendor.py): qrcode.js draws the codes
   (MIT), jsQR.js reads them (Apache-2.0); where the browser can read QR
   codes itself (BarcodeDetector) it does.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { html, icon } = VS;

  // Characters per frame: small libraries get easy-to-scan codes; big ones denser codes, so it stays quick.
  const partSize = (length) => (length > 60000 ? 900 : 600);
  const SPEEDS = { normal: 320, slow: 650 };

  let s = null;      // { mode: "" | "send" | "receive", … }

  /* ── bytes ⇄ text ─────────────────────────────────────────────── */
  const toBase64 = (bytes) => {
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const fromBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  async function pack(text) {
    const raw = new TextEncoder().encode(text);
    if (!("CompressionStream" in window)) return { flag: "u", b64: toBase64(raw) };
    const zipped = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    return { flag: "z", b64: toBase64(zipped) };
  }

  async function unpack(flag, b64) {
    const bytes = fromBase64(b64);
    if (flag === "u") return new TextDecoder().decode(bytes);
    if (!("DecompressionStream" in window)) throw new Error("old-browser");
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  }

  /* ── Send ─────────────────────────────────────────────────────── */
  async function startSend() {
    const text = VS.store.exportJSON();
    const { flag, b64 } = await pack(text);
    const id = Math.random().toString(36).slice(2, 6);
    const part = partSize(b64.length);
    const n = Math.ceil(b64.length / part);
    const frames = Array.from({ length: n }, (_, i) => `VS1:${id}:${flag}:${i}:${n}:${b64.slice(i * part, (i + 1) * part)}`);
    try { await VS.loadScript("assets/vendor/qrcode.js", "qrcode"); } catch (e) { s.error = "The QR maker didn't load. Reload the app and try again."; VS.app.render(); return; }
    s = { mode: "send", frames, index: 0, speed: "normal", paused: false, kb: Math.round(text.length / 1024), words: VS.allWords().length };
    VS.app.render();
  }

  /** Draw one frame on the canvas: ink on white, with the quiet zone readers need. */
  function draw(canvas, text) {
    const qr = window.qrcode(0, "L");
    qr.addData(text, "Byte");
    qr.make();
    const n = qr.getModuleCount(), quiet = 4, total = n + quiet * 2;
    const css = Math.min(340, canvas.parentElement.clientWidth);
    const scale = Math.max(2, Math.floor((css * (window.devicePixelRatio || 1)) / total));
    canvas.width = canvas.height = total * scale;
    canvas.style.width = canvas.style.height = css + "px";
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#141b2d";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
    }
  }

  let timer = null, wake = null;
  function loop() {
    clearInterval(timer);
    const canvas = VS.$("#qrCanvas");
    if (!canvas || !s || s.mode !== "send") return;
    const show = () => {
      draw(canvas, s.frames[s.index]);
      const count = VS.$("#qrPart");
      if (count) count.textContent = `Part ${s.index + 1} of ${s.frames.length}`;
    };
    show();
    if (s.frames.length > 1 && !s.paused) timer = setInterval(() => { s.index = (s.index + 1) % s.frames.length; show(); }, SPEEDS[s.speed]);
  }

  /* ── Receive ──────────────────────────────────────────────────── */
  let stream = null, raf = 0, detector = null, lastScan = 0;

  async function startReceive() {
    s = { mode: "receive", id: "", flag: "", parts: [], got: 0, total: 0, status: "Starting the camera…", ready: null };
    VS.app.render();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      s.status = ""; s.error = "This browser can't use the camera. Use a backup file instead.";
      VS.app.render(); return;
    }
    try {
      if ("BarcodeDetector" in window && (await window.BarcodeDetector.getSupportedFormats()).includes("qr_code")) {
        detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      } else {
        await VS.loadScript("assets/vendor/jsQR.js", "jsQR");
      }
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (e) {
      s.status = "";
      s.error = e && e.name === "NotAllowedError"
        ? "The camera is blocked. Allow it for this site in your browser, then try again — or use a backup file instead."
        : "The camera didn't start. Try again, or use a backup file instead.";
      VS.app.render(); return;
    }
    s.status = "Point the camera at the QR code on the other device.";
    VS.app.render();
  }

  function stopCamera() {
    cancelAnimationFrame(raf);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  async function scan(video, canvas) {
    raf = requestAnimationFrame(() => scan(video, canvas));
    const now = performance.now();
    if (now - lastScan < 110 || video.readyState < 2) return;
    lastScan = now;
    let text = "";
    if (detector) {
      try { const codes = await detector.detect(video); text = codes[0] ? codes[0].rawValue : ""; } catch (e) { /* next frame */ }
    } else {
      const w = Math.min(720, video.videoWidth), h = Math.round(video.videoHeight * (w / video.videoWidth));
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, w, h);
      const code = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
      text = code ? code.data : "";
    }
    if (text) take(text);
  }

  function take(text) {
    const m = /^VS1:(\w+):([zu]):(\d+):(\d+):([A-Za-z0-9+/=]*)$/.exec(text);
    if (!m || !s || s.mode !== "receive" || s.ready) return;
    const [, id, flag, i, n] = m;
    if (id !== s.id) Object.assign(s, { id, flag, parts: new Array(Number(n)), got: 0, total: Number(n) });
    if (s.parts[i] !== undefined) return;
    s.parts[i] = m[5];
    s.got++;
    navigator.vibrate?.(8);
    updateProgress();
    if (s.got === s.total) finishReceive();
  }

  function updateProgress() {
    const bar = VS.$("#qrGot");
    if (bar) bar.innerHTML = String(gotMarkup());
  }

  const partClass = (i) => (s.parts[i] != null ? "is-got" : "");
  function gotMarkup() {
    if (!s.total) return html`<p class="hint">Waiting for the first part…</p>`;
    return html`
      <p class="qr-count"><b>${s.got}</b> of ${s.total} parts</p>
      <ol class="qr-parts" aria-hidden="true">${Array.from({ length: s.total }, (_, i) => html`<li class="${partClass(i)}"></li>`)}</ol>`;
  }

  async function finishReceive() {
    stopCamera();
    VS.sfx.play("done");
    try {
      const text = await unpack(s.flag, s.parts.join(""));
      const data = JSON.parse(text);
      if (!data || data.app !== "vocabstudy") throw new Error("not-ours");
      s.ready = { text, words: (data.library || []).length, notes: Object.keys(data.notes || {}).length };
    } catch (e) {
      s.error = e.message === "old-browser"
        ? "This browser is too old to unpack the data. Update it, or use a backup file instead."
        : "The data didn't come through whole. Try again.";
    }
    VS.app.render();
  }

  /* ── Screen ───────────────────────────────────────────────────── */
  function chooseMarkup() {
    return html`
      <div class="transfer-choose">
        <button class="card transfer-pick" type="button" data-action="qr-send">
          ${icon("qr", "icon-lg")}
          <b>Send from this device</b>
          <span class="hint">Shows a moving QR code with your ${VS.plural(VS.allWords().length, "word")} and all your progress.</span>
        </button>
        <button class="card transfer-pick" type="button" data-action="qr-receive">
          ${icon("camera", "icon-lg")}
          <b>Receive on this device</b>
          <span class="hint">Uses the camera to read the code on the other device, then merges it here.</span>
        </button>
      </div>
      <ol class="transfer-steps">
        <li>Open VocabStudy on both devices.</li>
        <li>On the one with the words: <b>Send</b>. On the other: <b>Receive</b>.</li>
        <li>Hold the camera over the code until every part is in — seconds for a few hundred words, a minute or two for thousands.</li>
      </ol>
      <p class="hint">Do it both ways and the two devices know the same words. Nothing passes through the internet.</p>`;
  }

  function sendMarkup() {
    return html`
      <div class="transfer-send">
        <div class="qr-frame"><canvas id="qrCanvas" role="img" aria-label="Moving QR code with your data"></canvas></div>
        <p class="qr-count" id="qrPart" aria-live="off">Part 1 of ${s.frames.length}</p>
        <p class="hint">${VS.plural(s.words, "word")} and your progress · ${s.kb} KB in ${VS.plural(s.frames.length, "part")}.
          Keep this screen open until the other device says it has them all.</p>
        <div class="row transfer-controls">
          <button class="btn" type="button" data-action="qr-speed">${s.speed === "normal" ? "Slower" : "Faster"}</button>
          <button class="btn btn-quiet" type="button" data-action="qr-stop">Stop</button>
        </div>
      </div>`;
  }

  function receiveMarkup() {
    if (s.ready) {
      return html`
        <div class="transfer-ready">
          <p class="transfer-done">${icon("check", "icon-lg")}<span><b>Everything came through.</b>
            <span class="hint">${VS.plural(s.ready.words, "word")}${s.ready.notes ? ", " + VS.plural(s.ready.notes, "note") : ""} and their progress.</span></span></p>
          <button class="btn btn-primary btn-lg btn-block" type="button" data-action="qr-merge">Merge into this device</button>
          <p class="hint">Keeps the words on both devices. For every word, the stronger memory wins.</p>
          <button class="danger-link" type="button" data-action="qr-replace">Replace this device's data instead</button>
        </div>`;
    }
    return html`
      <div class="transfer-receive">
        <div class="qr-camera">${stream ? html`<video id="qrVideo" playsinline muted autoplay></video><span class="qr-aim" aria-hidden="true"></span>` : ""}</div>
        <canvas id="qrScan" hidden></canvas>
        ${s.status ? html`<p class="hint">${s.status}</p>` : ""}
        <div id="qrGot" aria-live="polite">${gotMarkup()}</div>
        <button class="btn btn-quiet" type="button" data-action="qr-stop">Cancel</button>
      </div>`;
  }

  VS.views.transfer = {
    title: () => "Move to another device",
    crumbs: () => [{ label: "Backup & export", href: "#/data" }, { label: "Move to another device" }],

    start() { s = { mode: "" }; },

    render() {
      return html`
        <div class="page transfer-page view-enter">
          <header class="page-head"><div>
            <h1>Move to another device</h1>
            <p class="hint">Phone to laptop, laptop to phone — through the camera, with no internet and no account.</p>
          </div></header>
          <section class="card transfer-card">
            ${s.error ? html`<div class="transfer-error" role="alert"><p>${s.error}</p>
              <div class="row"><button class="btn" type="button" data-action="qr-stop">Try again</button>
              <a class="btn btn-quiet" href="#/data">Use a backup file</a></div></div>`
              : s.mode === "send" ? sendMarkup() : s.mode === "receive" ? receiveMarkup() : chooseMarkup()}
          </section>
        </div>`;
    },

    mount() {
      if (s.mode === "send") {
        loop();
        if (navigator.wakeLock && !wake) navigator.wakeLock.request("screen").then((w) => { wake = w; }).catch(() => {});
      }
      const video = VS.$("#qrVideo");
      if (video && stream) {
        video.srcObject = stream;
        video.play().catch(() => {});
        cancelAnimationFrame(raf);
        scan(video, VS.$("#qrScan"));
      }
    },

    leave() {
      clearInterval(timer);
      stopCamera();
      if (wake) { wake.release().catch(() => {}); wake = null; }
    },

    actions: {
      "qr-send"() { startSend(); },
      "qr-receive"() { startReceive(); },
      "qr-speed"() { s.speed = s.speed === "normal" ? "slow" : "normal"; VS.app.render(); },
      "qr-stop"() { VS.views.transfer.leave(); s = { mode: "" }; VS.app.render(); },
      "qr-merge"() {
        if (!VS.store.mergeJSON(s.ready.text)) { VS.toast("That data couldn't be merged."); return; }
        VS.toast("Merged. Your words are on this device now.");
        setTimeout(() => location.reload(), 700);
      },
      "qr-replace": async () => {
        const payload = s.ready.text;
        const yes = await VS.confirm({
          title: "Use the other device's data?",
          body: "Words and progress here that the other device doesn't have will be lost. This can't be undone.",
          confirmLabel: "Replace",
        });
        if (!yes) return;
        if (!VS.store.importJSON(payload)) { VS.toast("That data couldn't be used."); return; }
        VS.toast("Replaced. This device now matches the other one.");
        setTimeout(() => location.reload(), 700);
      },
    },
  };
})();
