/* MaDA — standalone runtime.
   Provides the small window.claude API the app expects when it runs inside Claude:
   - "sample": AI calls, sent to this app's own server (/api/generate)
   - "downloads": saving files via a normal browser download
   - "db" / "user": not available, so the app keeps everything in this browser.
   Also exposes window.MadaServer (music gallery, Pro status) and, inside the
   iOS / Android app, window.MadaNative (share sheet, saving files).
   The mobile build sets window.MADA_API_BASE to the server's address. */
(function () {
  const ACCESS_KEY = "rr-access-code";
  const MAX_IMAGES = 12;
  const API = String(window.MADA_API_BASE || "").replace(/\/+$/, "");

  function getAccess() { try { return localStorage.getItem(ACCESS_KEY) || ""; } catch (e) { return ""; } }
  function setAccess(v) { try { v ? localStorage.setItem(ACCESS_KEY, v) : localStorage.removeItem(ACCESS_KEY); } catch (e) { } }

  // Anonymous id of this install, used by the server for the Pro status and the free quota.
  const USER = (function () {
    try {
      let id = localStorage.getItem("mada-uid");
      if (!id) { id = "u" + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, ""); localStorage.setItem("mada-uid", id); }
      return id;
    } catch (e) { return ""; }
  })();

  function baseHeaders() {
    const h = {}; const code = getAccess();
    if (code) h["x-rr-access"] = code;
    if (USER) h["x-mada-user"] = USER;
    return h;
  }

  function blobToBase64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1] || "");
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }

  async function toImage(b) {
    if (!b) return null;
    let type = b.type || "image/jpeg";
    if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) {
      // Re-encode anything unusual as JPEG so the API accepts it.
      try {
        const bmp = await createImageBitmap(b), c = document.createElement("canvas");
        c.width = bmp.width; c.height = bmp.height; c.getContext("2d").drawImage(bmp, 0, 0);
        b = await new Promise(r => c.toBlob(r, "image/jpeg", .88)); type = "image/jpeg";
      } catch (e) { return null; }
    }
    return { type, data: await blobToBase64(b) };
  }

  function parseJson(text) {
    const t = String(text || "").replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    try { return JSON.parse(t); } catch (e) { }
    const a = t.indexOf("{"), z = t.lastIndexOf("}");
    if (a >= 0 && z > a) { try { return JSON.parse(t.slice(a, z + 1)); } catch (e) { } }
    return undefined;
  }

  async function call(prompt, o, retried) {
    const images = (await Promise.all((o.images || []).slice(0, MAX_IMAGES).map(toImage))).filter(Boolean);
    const headers = { "content-type": "application/json", ...baseHeaders() };
    let res;
    try {
      res = await fetch(API + "/api/generate", { method: "POST", headers, body: JSON.stringify({ prompt, images }), signal: o.signal });
    } catch (e) {
      throw { code: e && e.name === "AbortError" ? "cancelled" : "network" };
    }
    if (res.status === 401 && !retried) {
      const v = window.prompt("Code d'accès de MaDA :", "");
      if (v === null) throw { code: "cancelled" };
      setAccess(v.trim());
      return call(prompt, o, true);
    }
    if (res.status === 402) {
      window.dispatchEvent(new CustomEvent("mada:pro-required"));
      throw { code: "pro_required" };
    }
    if (!res.ok) {
      let err = {}; try { err = await res.json(); } catch (e) { }
      if (res.status === 401) setAccess("");
      throw { code: err.error || (res.status === 413 ? "prompt_too_large" : res.status === 429 ? "rate_limited" : "server_error"), message: err.message };
    }
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = "", text = "", end = null;
    try {
      for (; ;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line) continue;
          let m; try { m = JSON.parse(line); } catch (e) { continue; }
          if (typeof m.t === "string") { text += m.t; if (o.onText) { try { o.onText({ text }); } catch (e) { } } }
          else if (m.error || m.done) end = m;
        }
      }
    } catch (e) {
      throw { code: o.signal && o.signal.aborted ? "cancelled" : "network" };
    }
    if (end && end.error) throw { code: end.error };
    if (!end) throw { code: "invalid_json" };
    if (!text.trim()) throw { code: "empty_completion" };
    const out = parseJson(text);
    if (out === undefined) throw { code: "invalid_json" };
    return out;
  }

  const sample = {
    limits: async () => ({ images: { maxCount: MAX_IMAGES } }),
    json: (prompt, o = {}) => call(prompt, o, false)
  };

  /* ---------- Native app (Capacitor) ---------- */
  const Cap = window.Capacitor;
  const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const plugin = name => isNative && Cap.registerPlugin ? Cap.registerPlugin(name) : null;

  async function nativeShare({ filename, data, text, title }) {
    const Filesystem = plugin("Filesystem"), Share = plugin("Share");
    const blob = data instanceof Blob ? data : new Blob([data]);
    const safe = String(filename || "fichier").replace(/[^\w.\- ]/g, "_");
    const { uri } = await Filesystem.writeFile({ path: safe, data: await blobToBase64(blob), directory: "CACHE" });
    try { await Share.share({ title: title || safe, text: text || undefined, files: [uri], dialogTitle: "Partager" }); }
    catch (e) { if (/cancel/i.test(String(e && (e.message || e.errorMessage || e)))) throw { code: "cancelled" }; throw e; }
  }

  if (isNative) {
    window.MadaNative = {
      platform: Cap.getPlatform(),
      share: nativeShare,
      plugin
    };
  }

  /* ---------- Server helpers (music gallery, Pro) ---------- */
  window.MadaServer = {
    base: API,
    user: USER,
    headers: baseHeaders,
    access: getAccess,
    async json(path) {
      const r = await fetch(API + path, { headers: baseHeaders() });
      let body = {}; try { body = await r.json(); } catch (e) { }
      if (!r.ok) throw { code: body.error || "server_error", status: r.status, message: body.message };
      return body;
    },
    async blob(path) {
      const r = await fetch(API + path, { headers: baseHeaders() });
      if (!r.ok) throw { code: r.status === 401 ? "unauthorized" : "server_error", status: r.status };
      return r.blob();
    },
    // Address an <audio> element can stream directly (it cannot send headers).
    url(path) { const k = getAccess(); return API + path + (k ? (path.includes("?") ? "&" : "?") + "k=" + encodeURIComponent(k) : ""); }
  };

  const downloads = {
    async save({ filename, data, mimeType }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || (typeof data === "string" ? "text/plain;charset=utf-8" : "application/octet-stream") });
      // In the app a web download does nothing: hand the file to the share sheet ("Enregistrer la vidéo", Fichiers…).
      if (isNative) return nativeShare({ filename, data: blob });
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = filename || "fichier"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  };

  window.claude = {
    async use(name) {
      if (name === "sample") return sample;
      if (name === "downloads") return downloads;
      return null;
    }
  };
})();
