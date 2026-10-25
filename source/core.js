"use strict";
/* ================= CORE ================= */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = (p = "") => p + Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : d; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
const fmtDate = ts => { try { return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); } catch (e) { return ""; } };
let toastT;
function toast(msg, ms = 2800) { const el = $("#toast"); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, ms); }
function copyText(text, el) { const ok = () => toast("Copié"); try { navigator.clipboard.writeText(text).then(ok, () => { if (el) { el.focus(); el.select && el.select(); } toast("Sélectionné : copie avec Ctrl+C ou un appui long"); }); } catch (e) { toast("Copie impossible ici"); } }

/* ---------- Local storage (IndexedDB) ---------- */
const L = {
  db: null,
  open() { return new Promise(res => { try { const r = indexedDB.open("ryanreel-studio", 1); r.onupgradeneeded = () => { ["docs", "assets", "kv"].forEach(s => r.result.createObjectStore(s)); }; r.onsuccess = () => { this.db = r.result; res(); }; r.onerror = () => res(); } catch (e) { res(); } }); },
  op(s, mode, fn) { return new Promise(res => { if (!this.db) return res(null); try { const tx = this.db.transaction(s, mode); const q = fn(tx.objectStore(s)); tx.oncomplete = () => res(q ? q.result : null); tx.onerror = () => res(null); } catch (e) { res(null); } }); },
  put(s, k, v) { return this.op(s, "readwrite", st => st.put(v, k)); },
  get(s, k) { return this.op(s, "readonly", st => st.get(k)); },
  del(s, k) { return this.op(s, "readwrite", st => st.delete(k)); },
  all(s) { return this.op(s, "readonly", st => st.getAll()); }
};

/* ---------- Store: cloud (artifact db, private per person) with local mirror ---------- */
const Store = {
  mode: "local", uid: null, db: null, user: null, readOnly: false, q: new Map(), timers: new Map(),
  async init() {
    // Site and app: MaDA account (Supabase) when signed in.
    if (window.__RR_STANDALONE) { if (typeof Auth !== "undefined" && Auth.user) { this.db = SupaDB; this.uid = Auth.user.id; this.mode = "cloud"; } return; }
    if (!(window.claude && claude.use)) return;
    try {
      const [db, user] = await Promise.all([claude.use("db"), claude.use("user")]);
      this.db = db; this.user = user;
      if (db && user) { const id = await user.id(); if (id) { this.uid = id; this.mode = "cloud"; } }
    } catch (e) { }
  },
  col() { return this.db.collection("data/users/" + this.uid); },
  key(kind, id) { return kind + "~" + id; },
  async all(kind) {
    const local = ((await L.all("docs")) || []).filter(d => d && d.kind === kind);
    if (this.mode !== "cloud") return local;
    try {
      const snap = await this.col().where("kind", "==", kind).get();
      const map = new Map(local.map(d => [d.id, d])), cloudIds = new Map();
      for (const s of snap.docs) {
        const d = s.data(); if (!d || !d.id) continue; cloudIds.set(d.id, d.updatedAt || 0);
        const l = map.get(d.id);
        if (!l || (d.updatedAt || 0) > (l.updatedAt || 0)) { const c = JSON.parse(JSON.stringify(d)); map.set(d.id, c); L.put("docs", this.key(kind, d.id), c); }
      }
      for (const l of local) if (!cloudIds.has(l.id) || cloudIds.get(l.id) < (l.updatedAt || 0)) this.push(kind, l);
      return [...map.values()];
    } catch (e) { return local; }
  },
  async put(kind, obj) { obj.kind = kind; obj.updatedAt = Date.now(); await L.put("docs", this.key(kind, obj.id), JSON.parse(JSON.stringify(obj))); this.push(kind, obj); return obj; },
  putSoon(kind, obj, ms = 1200) { const k = this.key(kind, obj.id); clearTimeout(this.timers.get(k)); this.timers.set(k, setTimeout(() => this.put(kind, obj), ms)); },
  push(kind, obj) {
    if (this.mode !== "cloud" || this.readOnly) return;
    const key = this.key(kind, obj.id), body = JSON.parse(JSON.stringify(obj));
    if (JSON.stringify(body).length > 240000) { delete body.thumb; if (JSON.stringify(body).length > 240000) return; }
    const prev = this.q.get(key) || Promise.resolve();
    const p = prev.then(() => this.col().doc(key).set(body)).catch(e => {
      if (e && e.code === "invalid_argument") { this.readOnly = true; App.renderMe(); }
      else if (e && e.code === "quota_exceeded") toast("Sauvegarde en ligne pleine : supprime d'anciennes créations.");
    });
    this.q.set(key, p);
  },
  async del(kind, id) { await L.del("docs", this.key(kind, id)); if (this.mode === "cloud" && !this.readOnly) { try { await this.col().doc(this.key(kind, id)).delete(); } catch (e) { } } },
  label() { return this.mode === "cloud" && !this.readOnly ? "Synchronisé avec ton compte" : "Enregistré sur cet appareil"; }
};

/* ---------- Assets (images, kept in this browser) ---------- */
const Assets = {
  cache: new Map(), list: [],
  async load(rec) {
    if (this.cache.has(rec.id)) return this.cache.get(rec.id);
    const url = URL.createObjectURL(rec.blob); const img = new Image(); img.src = url;
    try { await img.decode(); } catch (e) { await new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 5000); }); }
    const a = { ...rec, url, img }; this.cache.set(rec.id, a); return a;
  },
  async refresh(ws) {
    const all = ((await L.all("assets")) || []).filter(a => a && a.ws === ws).sort((a, b) => b.created - a.created);
    this.list = await Promise.all(all.map(r => this.load(r)));
    return this.list;
  },
  async ensure(ids) { for (const id of ids) if (id && !this.cache.has(id)) { const r = await L.get("assets", id); if (r) await this.load(r); } },
  get(id) { return this.cache.get(id); },
  async add(file, ws, tag = "photo") {
    let blob = file, w = 0, h = 0;
    try {
      const bmp = await createImageBitmap(file); w = bmp.width; h = bmp.height;
      const max = tag === "screenshot" ? 1600 : 2400;
      if (Math.max(w, h) > max) {
        const s = max / Math.max(w, h), c = document.createElement("canvas"); c.width = Math.round(w * s); c.height = Math.round(h * s);
        c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); w = c.width; h = c.height;
        blob = await new Promise(r => c.toBlob(r, file.type === "image/png" ? "image/png" : "image/jpeg", .9)) || file;
      }
    } catch (e) { }
    const rec = { id: uid("a"), ws, tag, name: (file.name || "image").replace(/\.[^.]+$/, ""), w, h, blob, created: Date.now() };
    await L.put("assets", rec.id, rec);
    const a = await this.load(rec); if (!a.w) { a.w = a.img.naturalWidth; a.h = a.img.naturalHeight; }
    if (!a.img.naturalWidth) { await L.del("assets", rec.id); this.cache.delete(rec.id); throw new Error("illisible"); }
    this.list.unshift(a); return a;
  },
  async del(id) { await L.del("assets", id); const a = this.cache.get(id); if (a) URL.revokeObjectURL(a.url); this.cache.delete(id); this.list = this.list.filter(a => a.id !== id); },
  async thumbBlob(id, max = 512) {
    const a = this.get(id); if (!a || !a.img.naturalWidth) return null;
    const iw = a.img.naturalWidth, ih = a.img.naturalHeight, s = Math.min(1, max / Math.max(iw, ih));
    const c = document.createElement("canvas"); c.width = Math.round(iw * s); c.height = Math.round(ih * s);
    c.getContext("2d").drawImage(a.img, 0, 0, c.width, c.height);
    return new Promise(r => c.toBlob(r, "image/jpeg", .82));
  },
  orientation(a) { const w = a.w || a.img.naturalWidth, h = a.h || a.img.naturalHeight; return w > h * 1.1 ? "paysage" : h > w * 1.1 ? "portrait" : "carrée"; }
};
async function pickFiles(accept = "image/*", multiple = true) {
  return new Promise(res => { const inp = $("#assetIn"); inp.accept = accept; inp.multiple = multiple; inp.value = ""; inp.onchange = () => res([...inp.files]); inp.click(); });
}
async function importImages(files, tag = "photo") {
  files = files.filter(f => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
  if (!files.length) return [];
  toast(`Import de ${files.length} image${files.length > 1 ? "s" : ""}…`, 30000);
  const out = []; let bad = 0;
  for (const f of files) { try { out.push(await Assets.add(f, WS.cur.id, tag)); } catch (e) { bad++; } }
  toast(bad ? `${out.length} importée${out.length > 1 ? "s" : ""}, ${bad} illisible${bad > 1 ? "s" : ""} (format non pris en charge par ce navigateur)` : `${out.length} image${out.length > 1 ? "s" : ""} ajoutée${out.length > 1 ? "s" : ""}`);
  return out;
}

/* ---------- Workspaces (brand spaces) ---------- */
const BRAND_TYPES = ["Créateur de contenu", "Influenceur", "Marque", "Établissement (hôtel, restaurant, bar)", "Événementiel / soirées", "Artiste / musique", "Association / BDE", "Client d'agence"];
function newBrand(o = {}) {
  return { id: uid("b"), name: o.name || "Nouvel espace", type: o.type || BRAND_TYPES[0], handle: o.handle || "", description: "", audience: "", tone: "", tagline: "", colors: ["#141218", "#F4EFE6", "#E8C27A"], fonts: { display: "", body: "" }, keywords: "", dos: "", donts: "", logo: null, ig: null, createdAt: Date.now() };
}
const WS = {
  list: [], cur: null,
  async load() {
    this.list = (await Store.all("brand")).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    if (!this.list.length) { const b = newBrand({ name: "Mon espace" }); await Store.put("brand", b); this.list = [b]; }
    this.cur = this.list.find(b => b.id === lsGet("rr-ws")) || this.list[0];
  },
  save() { return Store.put("brand", this.cur); },
  saveSoon() { Store.putSoon("brand", this.cur, 800); },
  async create(o) { const b = newBrand(o); await Store.put("brand", b); this.list.push(b); await this.switchTo(b.id); return b; },
  async switchTo(id) {
    const b = this.list.find(x => x.id === id); if (!b) return;
    this.cur = b; lsSet("rr-ws", id); await Assets.refresh(id); Designs.list = null; Ideas.doc = null;
    App.renderSide(); App.go(App.view === "create" && !$("#editor").hidden ? "gallery" : App.view, { force: true });
    if (App.view === "video") Video.open(id);
  },
  async remove(id) {
    if (this.list.length < 2) return toast("Garde au moins un espace.");
    const ds = (await Store.all("design")).filter(d => d.ws === id); for (const d of ds) await Store.del("design", d.id);
    const as = ((await L.all("assets")) || []).filter(a => a.ws === id); for (const a of as) await L.del("assets", a.id);
    await Store.del("ideas", id); await Store.del("brand", id);
    this.list = this.list.filter(b => b.id !== id); await this.switchTo(this.list[0].id);
  }
};
function brandInitial(b) { return (b.name || "?").trim().charAt(0).toUpperCase(); }
function brandColor(b) { return (b.colors && b.colors.find(c => c && c.toLowerCase() !== "#ffffff" && c.toLowerCase() !== "#f4efe6")) || "#5B47A8"; }
function brandContext(b = WS.cur) {
  if (!b) return "";
  const lines = [`Marque / espace : ${b.name}${b.handle ? ` (${b.handle})` : ""} — ${b.type}`];
  if (b.tagline) lines.push(`Signature : ${b.tagline}`);
  if (b.description) lines.push(`Description : ${b.description}`);
  if (b.audience) lines.push(`Public : ${b.audience}`);
  if (b.tone) lines.push(`Ton : ${b.tone}`);
  if (b.colors && b.colors.length) lines.push(`Couleurs de marque : ${b.colors.join(", ")}`);
  if (b.fonts && (b.fonts.display || b.fonts.body)) lines.push(`Polices de marque : titres ${b.fonts.display || "libre"}, texte ${b.fonts.body || "libre"}`);
  if (b.keywords) lines.push(`Univers / mots-clés : ${b.keywords}`);
  if (b.dos) lines.push(`À faire : ${b.dos}`);
  if (b.donts) lines.push(`À éviter : ${b.donts}`);
  if (b.ig && b.ig.summary) lines.push(`Analyse Instagram : ${b.ig.summary}${b.ig.style ? ` Style actuel : ${[b.ig.style.mood, b.ig.style.photography, b.ig.style.typography].filter(Boolean).join(" ; ")}` : ""}`);
  return "IDENTITÉ DE MARQUE\n" + lines.join("\n");
}
window.RR = { isView: v => App.view === v, brandContext: () => brandContext(), brand: () => WS.cur };

/* ---------- AI ---------- */
const AI = {
  sample: null, downloads: null, imgMax: 0, disabled: false, ready: false,
  async init() {
    try {
      if (window.claude && claude.use) {
        const [s, d] = await Promise.all([claude.use("sample"), claude.use("downloads")]);
        this.sample = s; this.downloads = d;
        if (s) { const lim = await s.limits().catch(() => null); this.imgMax = lim && lim.images ? lim.images.maxCount : 0; }
      }
    } catch (e) { }
    this.ready = true;
  },
  ok() { return !!this.sample && !this.disabled; },
  err(e) {
    const c = e && e.code;
    if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(c)) { this.disabled = true; return "L'IA n'est pas autorisée sur cette page. Recharge la page et accepte quand Claude te le demande."; }
    return ({ rate_limited: "Trop de demandes ou limite d'usage atteinte. Attends un peu, puis réessaie.", pro_required: "Limite gratuite du jour atteinte : passe à MaDA Pro pour continuer.", invalid_json: "La réponse de l'IA est arrivée incomplète. Réessaie.", refused: "L'IA ne peut pas traiter cette demande. Reformule-la.", session_expired: "Ta session Claude a expiré : reconnecte-toi.", prompt_too_large: "Trop d'éléments envoyés en une fois. Retire quelques images.", image_rejected: "Une image n'a pas pu être analysée. Essaie avec une autre.", empty_completion: "L'IA n'a rien produit. Précise ta demande.", cancelled: "Arrêté." })[c] || "L'IA n'a pas pu répondre. Réessaie dans un instant.";
  },
  unavailableMsg() { return window.__RR_STANDALONE ? "Le serveur IA ne répond pas. Vérifie la clé API dans les réglages de l'hébergement." : "L'IA ne fonctionne que lorsque l'application est ouverte dans Claude : depuis la conversation ou ta liste d'artefacts sur claude.ai, connecté à ton compte, et pas dans un onglet séparé. Accepte ensuite l'autorisation demandée par Claude."; },
  json(prompt, o = {}) {
    if (!this.ok()) return Promise.reject({ code: "not_granted" });
    return this.sample.json(prompt, { images: o.images && o.images.length ? o.images : undefined, signal: o.signal, modelTier: o.tier, cache: false, onText: o.onText });
  }
};

/* ---------- Modal ---------- */
const Modal = {
  onclose: null,
  open(html, wide) { this.fireClose(); const c = $("#modalCard"); c.className = "modal-card" + (wide ? " wide" : ""); c.innerHTML = html; $("#modal").hidden = false; return c; },
  close() { this.fireClose(); $("#modal").hidden = true; $("#modalCard").innerHTML = ""; },
  fireClose() { const f = this.onclose; this.onclose = null; if (f) { try { f(); } catch (e) { } } }
};
$("#modal").addEventListener("click", e => { if (e.target.id === "modal" || e.target.closest("[data-close]")) Modal.close(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#modal").hidden) Modal.close(); });

// Share sheet (app: Instagram, TikTok, « Enregistrer la vidéo »…), else Web Share, else a plain download.
// The caption is copied first: Instagram and TikTok ignore text passed with a file.
async function shareFile(name, blob, caption) {
  if (caption) { try { await navigator.clipboard.writeText(caption); } catch (e) { } }
  const done = () => { if (caption) toast("Légende copiée : colle-la dans Instagram ou TikTok", 4500); return true; };
  if (window.MadaNative) {
    try { await MadaNative.share({ filename: name, data: blob, text: caption }); return done(); }
    catch (e) { if (e && e.code === "cancelled") return false; }
  }
  try {
    const f = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return done(); }
  } catch (e) { if (e && e.name === "AbortError") return false; }
  return saveFile(name, blob);
}
async function saveFile(name, data) {
  if (!AI.downloads) { toast("L'enregistrement de fichiers n'est pas disponible dans cette vue."); return false; }
  try { await AI.downloads.save({ filename: name, data }); toast("Fichier enregistré"); return true; }
  catch (e) { toast(e && e.code === "declined" ? "Enregistrement annulé." : e && e.code === "too_large" ? "Fichier trop lourd pour cette vue." : "Impossible d'enregistrer ici."); return false; }
}
