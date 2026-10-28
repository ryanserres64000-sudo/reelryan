// Free AI uses per sign-up, Pro caps, and the offers config (étude, ch. 8 §2 et §5 ; Ryan, 28 octobre :
// 3 montages offerts à chaque inscription, réglable sur le serveur).
//   GET  /api/offres  → the offers and quotas the app shows (MADA_OFFRES_JSON overrides them).
//   POST /api/quota   → what this device has left.
// The device sends `x-mada-device`, an anonymous id kept in the iOS keychain (it survives a reinstall,
// ch. 8 §5). Counters live in Upstash Redis when UPSTASH_REDIS_REST_URL / _TOKEN (or Vercel KV's
// KV_REST_API_URL / _TOKEN) are set, otherwise in memory (fine for server.js, lost on each Vercel cold start).
// Pro is the right the server checked from Apple's signed transactions (lib/apple.js, /api/achat);
// the app's own `x-mada-pro: 1` header counts only with MADA_PRO_HEADER=1 (development).
// Not done yet: App Attest needs the native app. MADA_QUOTA=strict refuses calls without a device id.
import { DEFAULT_CONFIG, check, consume, emptyUsage, monthOf, sanitizeConfig } from "../core/plans.ts";

export function config(env = process.env) {
  let raw = {};
  try { raw = env.MADA_OFFRES_JSON ? JSON.parse(env.MADA_OFFRES_JSON) : {}; } catch { raw = {}; }
  const c = sanitizeConfig({ ...DEFAULT_CONFIG, ...raw, gratuit: { ...DEFAULT_CONFIG.gratuit, ...(raw.gratuit || {}) }, pro: { ...DEFAULT_CONFIG.pro, ...(raw.pro || {}) } });
  // The one number Ryan may want to change fast (« 1 ou 3 selon le coût »).
  if (/^\d+$/.test(env.MADA_FREE_MONTAGES || "")) c.gratuit.montages = Math.min(10, Number(env.MADA_FREE_MONTAGES));
  return c;
}

// ---------- Storage ----------

function memoryStore() {
  const m = new Map();
  return { get: async k => m.get(k) ?? null, set: async (k, v) => { m.set(k, v); }, incr: async (k, ttl) => { const n = (m.get(k) ?? 0) + 1; m.set(k, n); return n; } };
}
function upstashStore(url, token, fetchImpl = fetch) {
  const call = async (...cmd) => {
    const r = await fetchImpl(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(cmd) });
    if (!r.ok) throw new Error(`quota store ${r.status}`);
    return (await r.json()).result;
  };
  return {
    get: async k => { const v = await call("GET", k); return v ? JSON.parse(v) : null; },
    set: async (k, v) => { await call("SET", k, JSON.stringify(v)); },
    incr: async (k, ttl) => { const n = await call("INCR", k); if (n === 1 && ttl) await call("EXPIRE", k, ttl); return n; },
  };
}
let shared = null;
export function store(env = process.env) {
  if (shared) return shared;
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL, token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  shared = url && token ? upstashStore(url, token) : memoryStore();
  return shared;
}
export const testing = { memoryStore, upstashStore, reset: () => { shared = null; } };

// ---------- Per request ----------

const DEVICE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// ch. 8 §5 : 3 free montages a day per IP address at most; as many visuals.
const FREE_PER_IP_PER_DAY = 6;
const ipOf = req => String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "anon").split(",")[0].trim();
export const deviceOf = req => (DEVICE.test(String(req.headers["x-mada-device"] || "")) ? String(req.headers["x-mada-device"]).toLowerCase() : null);
export async function isPro(req, { env = process.env, s = store(env), now = new Date() } = {}) {
  if (env.MADA_PRO_HEADER === "1") return req.headers["x-mada-pro"] === "1";
  const device = deviceOf(req);
  if (!device) return false;
  const r = await s.get(`mada:pro:${device}`);
  return !!r && r.expire > now.getTime();
}

// Takes one use of `kind` before an AI call. Returns { ok, status, body } to answer with when refused,
// and `refund()` to give the use back if the AI call fails (a failed call never costs the person).
export async function take(req, kind, { env = process.env, s = store(env), now = new Date() } = {}) {
  const device = deviceOf(req), cfg = config(env);
  if (!device) {
    if (env.MADA_QUOTA === "strict") return { ok: false, status: 403, body: { error: "device", message: "Appareil non reconnu." } };
    return { ok: true, refund: async () => {} };
  }
  const pro = await isPro(req, { env, s, now }), key = `mada:u:${device}`;
  const usage = (await s.get(key)) ?? emptyUsage(monthOf(now));
  const v = check(kind, pro, usage, cfg, now);
  if (!v.ok) return { ok: false, status: 402, body: { error: "quota", raison: v.raison, message: v.raison === "plafond_pro" ? "Plafond du mois atteint." : "Tes créations offertes sont utilisées." } };
  if (!pro && (kind === "montage" || kind === "visuel") && (await s.incr(`mada:ip:${ipOf(req)}:${now.toISOString().slice(0, 10)}`, 86400)) > FREE_PER_IP_PER_DAY) {
    return { ok: false, status: 429, body: { error: "rate_limited", message: "Trop de créations offertes depuis ce réseau aujourd'hui." } };
  }
  await s.set(key, consume(kind, pro, usage, now));
  return { ok: true, restant: v.restant - 1, refund: async () => { await s.set(key, usage); } };
}

const json = (res, status, payload) => {
  res.statusCode = status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
};
export function handleOffres(req, res) { return json(res, 200, config()); }
export async function handleQuota(req, res, { env = process.env, s = store(env), now = new Date() } = {}) {
  const device = deviceOf(req), cfg = config(env);
  if (!device) return json(res, 400, { error: "device", message: "Appareil non reconnu." });
  const usage = (await s.get(`mada:u:${device}`)) ?? emptyUsage(monthOf(now)), pro = await isPro(req, { env, s, now });
  return json(res, 200, { pro, montages: check("montage", pro, usage, cfg, now).restant, visuels: check("visuel", pro, usage, cfg, now).restant, retouches: check("retouche", pro, usage, cfg, now).restant, voix: check("voix", pro, usage, cfg, now).restant });
}

// DELETE /api/compte : « Supprimer mon compte » (règle Apple 5.1.1(v), RGPD ; étude, ch. 9). The server
// holds no image, sound or text after a call; what it has on a device is its usage counters. They are
// wiped except the number of free creations already used, kept without any name so that deleting does
// not hand out new free AI uses (anti-abuse, intérêt légitime, written in the privacy policy).
export async function handleCompte(req, res, { env = process.env, s = store(env), now = new Date() } = {}) {
  const device = deviceOf(req);
  if (!device) return json(res, 400, { error: "device", message: "Appareil non reconnu." });
  const key = `mada:u:${device}`, usage = await s.get(key);
  if (usage) await s.set(key, { ...emptyUsage(monthOf(now)), gratuit: usage.gratuit });
  // The checked Pro right goes too; the subscription itself lives at Apple, and the app sends it back
  // at the next launch if it is still running.
  if (await s.get(`mada:pro:${device}`)) await s.set(`mada:pro:${device}`, null);
  return json(res, 200, { supprime: ["compteurs Pro", "historique d'usage", "droit Pro vérifié"], garde: ["créations offertes déjà utilisées sur cet appareil"] });
}
