/* core/share.js — words in a link (docs/SHARE.md).
   ------------------------------------------------------------------
   A shared list travels inside the link itself, after the "#", so it never
   reaches any server (browsers do not send the fragment):

       <app>#/shared?d=z.<base64url( deflate-raw( JSON ) )>
       <app>#/shared?d=u.<base64url( JSON )>          (no CompressionStream)

   JSON, rows of values instead of objects so a list stays small:
       { v: 1, t: title, f: from, m: note, k: "adep…", w: [[word, sense, a, d, …], …] }
   `k` names the fields after word and sense, one letter each:
       a arabic · d definition · e example · p type · l level · i ipa · c context

     VS.share.FIELDS                    the letters and the word keys they stand for
     VS.share.encode(list)  → Promise<payload>    list: { title, from, note, keys, words }
     VS.share.decode(payload) → Promise<list>     throws "broken" | "old-browser" | "version"
     VS.share.link(payload) → the full address to send
     VS.share.LIMITS                    how many words, when a link is "long", when a QR fits

   Nothing private is ever read here: the caller passes the fields to send.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  const FIELDS = [
    ["a", "arabic"], ["d", "definition"], ["e", "example"],
    ["p", "type"], ["l", "level"], ["i", "ipa"], ["c", "context"],
  ];
  const KEY_OF = Object.fromEntries(FIELDS);
  const LIMITS = { words: 200, longLink: 6000, qr: 1800, title: 60, from: 40, note: 280 };

  /* bytes ⇄ base64url (no "+", "/" or "=": safe in a link, in a chat, in a QR) */
  const toB64url = (bytes) => {
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const fromB64url = (s) => {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(b64 + "===".slice((b64.length + 3) % 4)), (c) => c.charCodeAt(0));
  };
  const zip = async (bytes) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
  const unzip = async (bytes) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());

  const clip = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);

  async function encode(list) {
    const keys = String(list.keys || "").split("").filter((k) => KEY_OF[k]).join("");
    const rows = (list.words || []).slice(0, LIMITS.words).map((w) => {
      const row = [clip(w.word, 80), clip(w.sense, 60)];
      keys.split("").forEach((k) => row.push(clip(w[KEY_OF[k]], 400)));
      while (row.length > 1 && row[row.length - 1] === "") row.pop();      // trailing blanks cost bytes
      return row;
    });
    const json = JSON.stringify({ v: 1, t: clip(list.title, LIMITS.title), f: clip(list.from, LIMITS.from), m: clip(list.note, LIMITS.note), k: keys, w: rows });
    const raw = new TextEncoder().encode(json);
    if ("CompressionStream" in window) return "z." + toB64url(await zip(raw));
    return "u." + toB64url(raw);
  }

  async function decode(payload) {
    const m = /^([zu])\.([A-Za-z0-9_-]+)$/.exec(String(payload || "").trim());
    if (!m) throw new Error("broken");
    let bytes;
    try { bytes = fromB64url(m[2]); } catch (e) { throw new Error("broken"); }
    if (m[1] === "z") {
      if (!("DecompressionStream" in window)) throw new Error("old-browser");
      try { bytes = await unzip(bytes); } catch (e) { throw new Error("broken"); }     // a cut link fails here
    }
    let data;
    try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { throw new Error("broken"); }
    if (!data || data.v !== 1 || !Array.isArray(data.w)) throw new Error(data && data.v > 1 ? "version" : "broken");
    const keys = String(data.k || "").split("").filter((k) => KEY_OF[k]);
    const words = data.w.slice(0, LIMITS.words).map((row) => {
      if (!Array.isArray(row) || !row[0]) return null;
      const w = { word: clip(row[0], 80) };
      if (row[1]) w.sense = clip(row[1], 60);
      keys.forEach((k, i) => { const v = clip(row[i + 2], 400); if (v) w[KEY_OF[k]] = v; });
      if (w.arabic && !/[؀-ۿ]/.test(w.arabic)) delete w.arabic;    // only real Arabic is kept as Arabic
      return w;
    }).filter((w) => w && /[A-Za-z]/.test(w.word));
    if (!words.length) throw new Error("broken");
    return { title: clip(data.t, LIMITS.title), from: clip(data.f, LIMITS.from), note: clip(data.m, LIMITS.note), keys: keys.join(""), words };
  }

  /** The address to send: the app's own folder (never index.html), the list after "#". */
  const link = (payload) => location.origin + (VS.cleanPath ? VS.cleanPath() : location.pathname) + "#/shared?d=" + payload;

  VS.share = { FIELDS, LIMITS, encode, decode, link };
})();
