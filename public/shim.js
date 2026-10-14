/* RyanREEL Studio — standalone runtime.
   Provides the small window.claude API the app expects when it runs inside Claude:
   - "sample": AI calls, sent to this app's own server (/api/generate)
   - "downloads": saving files via a normal browser download
   - "db" / "user": not available, so the app keeps everything in this browser. */
(function () {
  const ACCESS_KEY = "rr-access-code";
  const MAX_IMAGES = 6;

  function getAccess() { try { return localStorage.getItem(ACCESS_KEY) || ""; } catch (e) { return ""; } }
  function setAccess(v) { try { v ? localStorage.setItem(ACCESS_KEY, v) : localStorage.removeItem(ACCESS_KEY); } catch (e) { } }

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
    const headers = { "content-type": "application/json" };
    const code = getAccess(); if (code) headers["x-rr-access"] = code;
    let res;
    try {
      res = await fetch("/api/generate", { method: "POST", headers, body: JSON.stringify({ prompt, images }), signal: o.signal });
    } catch (e) {
      throw { code: e && e.name === "AbortError" ? "cancelled" : "network" };
    }
    if (res.status === 401 && !retried) {
      const v = window.prompt("Code d'accès de RyanREEL Studio :", "");
      if (v === null) throw { code: "cancelled" };
      setAccess(v.trim());
      return call(prompt, o, true);
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

  const downloads = {
    async save({ filename, data, mimeType }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || (typeof data === "string" ? "text/plain;charset=utf-8" : "application/octet-stream") });
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
