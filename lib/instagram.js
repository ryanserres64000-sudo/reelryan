// Instagram (étape 8 de la refonte ; étude, ch. 5 « Connecter les réseaux »). Read-only: the person's
// professional account, their Reels and each one's views, to tell them what works. Everything works
// without it; connecting only adds.
//   POST   /api/instagram { action: "connecter" }          → { url } of Instagram's « Autoriser » page
//   GET    /api/instagram/callback?code&state              → token exchanged and kept, back to the app
//   GET    /api/instagram                                  → { connecte, compte, posts } (6 h cache, ?frais=1)
//   DELETE /api/instagram                                  → token forgotten (disconnect in one tap)
//   POST   /api/instagram { action: "capture", image }     → the figures read from a screenshot of the
//                                                            statistics, when no account is connected
// Instagram API with Instagram Login (Meta, checked 28 octobre 2026): scopes instagram_business_basic
// and instagram_business_manage_insights; a 60-day token, refreshed here. The token is encrypted
// (AES-256-GCM, MADA_TOKEN_KEY) and stored by device id with the quotas (Upstash / Vercel KV).
// Settings: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, MADA_TOKEN_KEY, MADA_PUBLIC_URL, MADA_IG_VERSION.
import crypto from "node:crypto";
import { callJson, MODELS } from "../prototype/lib/ai.mjs";
import { CAPTURE_SCHEMA, CAPTURE_SYSTEM, sanitizePosts } from "../core/insights.ts";
import { checkAccess, errorCode, overLimit } from "./claude.js";
import { deviceOf, store } from "./quota.js";

const SCOPES = "instagram_business_basic,instagram_business_manage_insights";
const STATE_TTL = 15 * 60 * 1000, CACHE_TTL = 6 * 3600 * 1000, REFRESH_BEFORE = 7 * 24 * 3600 * 1000;
const APP_RETURN = "madastudio://instagram";
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CAPTURES_PER_DAY = 20;

const base = env => (env.MADA_PUBLIC_URL || "https://reelryan.vercel.app").replace(/\/$/, "");
export const redirectUri = env => `${base(env)}/api/instagram/callback`;
const graph = env => `https://graph.instagram.com/${env.MADA_IG_VERSION || "v24.0"}`;
export const configured = env => !!(env.INSTAGRAM_APP_ID && env.INSTAGRAM_APP_SECRET && env.MADA_TOKEN_KEY);

// ---------- State and token encryption ----------

const key = env => crypto.createHash("sha256").update(String(env.MADA_TOKEN_KEY)).digest();
const b64u = b => Buffer.from(b).toString("base64url");
export function makeState(device, env, now = Date.now()) {
  const body = `${device}.${now}`, sig = crypto.createHmac("sha256", key(env)).update(body).digest("base64url");
  return b64u(`${body}.${sig}`);
}
export function readState(state, env, now = Date.now()) {
  let raw = "";
  try { raw = Buffer.from(String(state), "base64url").toString(); } catch { return null; }
  const [device, ts, sig] = raw.split(".");
  if (!device || !ts || !sig) return null;
  const want = crypto.createHmac("sha256", key(env)).update(`${device}.${ts}`).digest("base64url");
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  return now - Number(ts) < STATE_TTL ? device : null;
}
export function seal(value, env) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", key(env), iv);
  const data = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return { iv: b64u(iv), tag: b64u(c.getAuthTag()), data: b64u(data) };
}
export function open(box, env) {
  try {
    const d = crypto.createDecipheriv("aes-256-gcm", key(env), Buffer.from(box.iv, "base64url"));
    d.setAuthTag(Buffer.from(box.tag, "base64url"));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(box.data, "base64url")), d.final()]).toString("utf8"));
  } catch { return null; }
}
const tokenKey = device => `mada:ig:${device}`, cacheKey = device => `mada:ig:posts:${device}`;

// ---------- Instagram calls ----------

async function get(url, fetchImpl) {
  const r = await fetchImpl(url);
  const out = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(`instagram ${r.status} ${out?.error?.message || ""}`.trim()); e.status = r.status; e.code = out?.error?.code; throw e; }
  return out;
}

export function authorizeUrl(device, env, now = Date.now()) {
  const q = new URLSearchParams({ client_id: env.INSTAGRAM_APP_ID, redirect_uri: redirectUri(env), response_type: "code", scope: SCOPES, state: makeState(device, env, now) });
  return `https://www.instagram.com/oauth/authorize?${q}`;
}

// The code from « Autoriser » → a short token → a 60-day token.
export async function exchange(code, env, fetchImpl = fetch, now = Date.now()) {
  const form = new URLSearchParams({ client_id: env.INSTAGRAM_APP_ID, client_secret: env.INSTAGRAM_APP_SECRET, grant_type: "authorization_code", redirect_uri: redirectUri(env), code: String(code).replace(/#_$/, "") });
  const r = await fetchImpl("https://api.instagram.com/oauth/access_token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form.toString() });
  const short = await r.json().catch(() => ({}));
  if (!r.ok || !short.access_token) { const e = new Error(`instagram code ${r.status}`); e.status = r.status; throw e; }
  const long = await get(`https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: env.INSTAGRAM_APP_SECRET, access_token: short.access_token })}`, fetchImpl);
  return { token: long.access_token, user: String(short.user_id ?? ""), expire: now + (Number(long.expires_in) || 5184000) * 1000 };
}

async function fresh(saved, env, fetchImpl, now) {
  if (saved.expire - now > REFRESH_BEFORE) return saved;
  const r = await get(`https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: saved.token })}`, fetchImpl);
  return { ...saved, token: r.access_token, expire: now + (Number(r.expires_in) || 5184000) * 1000 };
}

const metric = (ins, name) => {
  const m = (ins?.data ?? []).find(x => x.name === name);
  const v = m?.total_value?.value ?? m?.values?.[0]?.value;
  return typeof v === "number" ? v : null;
};

// The account and its last 30 posts; the Reels with their figures (one insights call each, 6 at a time).
export async function readAccount(token, env, fetchImpl = fetch) {
  const g = graph(env), auth = `access_token=${encodeURIComponent(token)}`;
  const compte = await get(`${g}/me?fields=user_id,username,account_type,profile_picture_url,followers_count,media_count&${auth}`, fetchImpl);
  const media = await get(`${g}/me/media?fields=id,caption,media_type,media_product_type,timestamp,permalink&limit=30&${auth}`, fetchImpl);
  const list = media.data ?? [], out = [];
  for (let i = 0; i < list.length; i += 6) {
    out.push(...await Promise.all(list.slice(i, i + 6).map(async m => {
      const reel = m.media_product_type === "REELS" || m.media_type === "VIDEO";
      let ins = null;
      try { ins = await get(`${g}/${m.id}/insights?metric=${reel ? "views,reach,likes,comments,shares,saved" : "reach,likes,comments,shares,saved"}&${auth}`, fetchImpl); } catch { ins = null; }
      return { id: m.id, at: m.timestamp, type: reel ? "reel" : m.media_product_type === "STORY" ? "story" : "post", legende: m.caption ?? "", lien: m.permalink ?? null,
        vues: metric(ins, "views"), portee: metric(ins, "reach"), likes: metric(ins, "likes"), commentaires: metric(ins, "comments"), partages: metric(ins, "shares"), enregistrements: metric(ins, "saved"), source: "instagram" };
    })));
  }
  return {
    compte: { nom: String(compte.username ?? ""), type: String(compte.account_type ?? ""), abonnes: typeof compte.followers_count === "number" ? compte.followers_count : null, photo: compte.profile_picture_url ?? null },
    posts: sanitizePosts(out),
  };
}

// ---------- Handlers ----------

const json = (res, status, payload) => {
  res.statusCode = status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
};
const back = (res, query) => { res.statusCode = 302; res.setHeader("location", `${APP_RETURN}?${new URLSearchParams(query)}`); res.end(); };

export async function handleInstagram(req, res, body, deps = {}) {
  const env = deps.env || process.env, s = deps.store || store(env), fetchImpl = deps.fetchImpl || fetch, now = deps.now ?? Date.now();
  if (!checkAccess(req)) return json(res, 401, { error: "unauthorized", message: "Code d'accès incorrect." });
  if (overLimit(req)) return json(res, 429, { error: "rate_limited", message: "Trop de demandes." });
  const device = deviceOf(req);

  if (req.method === "POST" && body?.action === "capture") return capture(req, res, body, deps);
  if (!configured(env)) return json(res, 503, { error: "server_config", message: "La connexion Instagram n'est pas encore ouverte. En attendant, envoie une capture de tes statistiques." });
  if (!device) return json(res, 400, { error: "device", message: "Appareil non reconnu." });

  if (req.method === "POST" && body?.action === "connecter") return json(res, 200, { url: authorizeUrl(device, env, now) });
  if (req.method === "DELETE") { await s.set(tokenKey(device), null); await s.set(cacheKey(device), null); return json(res, 200, { connecte: false }); }
  if (req.method !== "GET") return json(res, 405, { error: "method" });

  const box = await s.get(tokenKey(device)), saved = box ? open(box, env) : null;
  if (!saved) return json(res, 200, { connecte: false });
  const url = new URL(req.url || "/", "http://x");
  const cached = await s.get(cacheKey(device));
  if (cached && url.searchParams.get("frais") !== "1" && now - cached.at < CACHE_TTL) return json(res, 200, { connecte: true, ...cached.value });
  try {
    const t = await fresh(saved, env, fetchImpl, now);
    if (t !== saved) await s.set(tokenKey(device), seal(t, env));
    const value = await readAccount(t.token, env, fetchImpl);
    await s.set(cacheKey(device), { at: now, value });
    return json(res, 200, { connecte: true, ...value });
  } catch (e) {
    // A token Instagram no longer accepts (password changed, access removed): ask to reconnect.
    if (e.status === 400 || e.status === 401 || e.code === 190) { await s.set(tokenKey(device), null); return json(res, 200, { connecte: false, expire: true }); }
    console.error("instagram failed:", e.status, e.message);
    return json(res, 502, { error: "instagram", message: "Instagram ne répond pas. Réessaie dans un moment." });
  }
}

// GET /api/instagram/callback: no access code here (Instagram calls it, not the app); the signed state
// says which device asked, a quarter of an hour at most before.
export async function handleCallback(req, res, deps = {}) {
  const env = deps.env || process.env, s = deps.store || store(env), fetchImpl = deps.fetchImpl || fetch, now = deps.now ?? Date.now();
  const q = new URL(req.url || "/", "http://x").searchParams;
  if (!configured(env)) return back(res, { erreur: "config" });
  if (q.get("error")) return back(res, { erreur: "refus" });
  const device = readState(q.get("state"), env, now);
  if (!device || !q.get("code")) return back(res, { erreur: "lien" });
  try {
    await s.set(tokenKey(device), seal(await exchange(q.get("code"), env, fetchImpl, now), env));
    await s.set(cacheKey(device), null);
    return back(res, { ok: "1" });
  } catch (e) {
    console.error("instagram callback failed:", e.status, e.message);
    return back(res, { erreur: "echange" });
  }
}

// A screenshot of a post's statistics, read by the small model: only the figures it can see.
async function capture(req, res, body, deps) {
  const env = deps.env || process.env, img = body?.image;
  if (!img || !IMAGE_TYPES.has(img.type) || typeof img.data !== "string" || img.data.length > 5_000_000) return json(res, 400, { error: "bad_request", message: "Image illisible." });
  if (!deps.callJson && !env.ANTHROPIC_API_KEY) return json(res, 500, { error: "server_config", message: "ANTHROPIC_API_KEY manquante sur le serveur." });
  // Not counted in the creations (a small model, a few tenths of a cent), but 20 a day per device.
  const s = deps.store || store(env), who = deviceOf(req) || "anon", day = new Date(deps.now ?? Date.now()).toISOString().slice(0, 10);
  if ((await s.incr(`mada:capture:${who}:${day}`, 86400)) > CAPTURES_PER_DAY) return json(res, 429, { error: "rate_limited", message: "Assez de captures pour aujourd'hui. Reviens demain." });
  try {
    const ledger = [];
    const raw = await (deps.callJson || callJson)({ model: process.env.RR_CAPTURE_MODEL || MODELS.etiquetage, system: CAPTURE_SYSTEM, content: [{ type: "image", source: { type: "base64", media_type: img.type, data: img.data } }, { type: "text", text: "Recopie les statistiques de cette capture." }], schema: CAPTURE_SCHEMA, effort: "low", maxTokens: 1000, step: "capture-stats", ledger });
    if (!raw?.lisible) return json(res, 200, { lisible: false });
    const at = typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? `${raw.date}T12:00:00.000Z` : new Date(deps.now ?? Date.now()).toISOString();
    const [post] = sanitizePosts([{ ...raw, id: `capture-${crypto.randomUUID()}`, at, legende: "", source: "capture" }]);
    return json(res, 200, { lisible: true, post });
  } catch (e) {
    console.error("capture failed:", e.message);
    return json(res, 502, { error: errorCode(e), message: "Je n'ai pas pu lire la capture. Réessaie avec une image nette." });
  }
}
