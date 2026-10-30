// Accounts (Ryan, 28 and 29 octobre : « une inscription au début, avec Google, Apple ou une adresse
// mail »). One Ma DA account per person, whatever the way in; the account keeps who the person is
// and is linked to the iPhone's anonymous id (lib/quota.js), so quotas and Pro follow it.
//   GET  /api/auth                                 → { methodes: { apple, google, email } }, what this server can do
//   POST /api/auth { action: "apple", jeton, nom? } → { session, compte }   (identity token from the iPhone)
//   POST /api/auth { action: "google" }            → { url } of Google's page; back through the callback
//   GET  /api/auth/callback?code&state             → madastudio://compte?session=… (or ?erreur=…)
//   POST /api/auth { action: "email", email }      → { envoye } a 6-digit code by e-mail, 10 minutes, 5 tries
//   POST /api/auth { action: "code", email, code } → { session, compte }
//   GET  /api/auth?moi=1 (Authorization: Bearer)   → { compte }
// Sessions are signed with MADA_AUTH_SECRET (or MADA_TOKEN_KEY) and last a year. Settings:
// MADA_APPLE_BUNDLE_ID (Apple), GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + MADA_TOKEN_KEY (Google, the
// same web client as YouTube, with …/api/auth/callback as an authorised redirect), RESEND_API_KEY +
// MADA_EMAIL_FROM (e-mail, from a domain verified at Resend). Codes need a lasting store (Upstash or
// Vercel KV). MADA_AUTH_DEV=1 returns the e-mail code in the answer, for tests only.
import crypto from "node:crypto";
import { makeState, open as unseal, readState, seal } from "./instagram.js";
import { checkAccess } from "./claude.js";
import { deviceOf, store } from "./quota.js";

const YEAR = 365 * 24 * 3600 * 1000, CODE_TTL = 10 * 60 * 1000, CODE_TRIES = 5, SENDS_PER_HOUR = 5;
const APP_RETURN = "madastudio://compte";
const base = env => (env.MADA_PUBLIC_URL || "https://reelryan.vercel.app").replace(/\/$/, "");
export const redirectUri = env => `${base(env)}/api/auth/callback`;
const persistent = env => !!((env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) || (env.KV_REST_API_URL && env.KV_REST_API_TOKEN));
const secret = env => env.MADA_AUTH_SECRET || env.MADA_TOKEN_KEY || "";

export const methods = env => ({
  apple: !!(env.MADA_APPLE_BUNDLE_ID && secret(env)),
  google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.MADA_TOKEN_KEY && secret(env)),
  email: !!(secret(env) && ((env.RESEND_API_KEY && env.MADA_EMAIL_FROM && persistent(env)) || env.MADA_AUTH_DEV === "1")),
});

// ---------- Sessions ----------

const sha = s => crypto.createHash("sha256").update(s).digest("hex");
export function sign(uid, env, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ u: uid, t: now })).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", secret(env)).update(body).digest("base64url")}`;
}
export function verify(session, env, now = Date.now()) {
  const [body, sig] = String(session || "").split(".");
  if (!body || !sig || !secret(env)) return null;
  const want = crypto.createHmac("sha256", secret(env)).update(body).digest("base64url");
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try {
    const { u, t } = JSON.parse(Buffer.from(body, "base64url").toString());
    return typeof u === "string" && now - t < YEAR ? u : null;
  } catch { return null; }
}
export const sessionOf = (req, env = process.env, now = Date.now()) => verify(String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""), env, now);

const userKey = uid => `mada:user:${uid}`;
const publicOf = u => ({ id: u.id, methode: u.methode, email: u.email ?? null, nom: u.nom ?? null, cree: u.cree });
// The person's record, created at the first sign-in, with the iPhones it came from.
async function signIn(s, env, { uid, methode, email, nom }, device, now) {
  const old = (await s.get(userKey(uid))) || {};
  const u = {
    id: uid, methode, cree: old.cree || new Date(now).toISOString(),
    email: email || old.email || null, nom: nom || old.nom || null,
    appareils: [...new Set([...(old.appareils || []), ...(device ? [device] : [])])].slice(-5),
  };
  await s.set(userKey(uid), u);
  if (device) await s.set(`mada:appareil:${device}`, uid);
  return { session: sign(uid, env, now), compte: publicOf(u) };
}

// ---------- Apple: the identity token signed by Apple (RS256, keys at appleid.apple.com) ----------

let appleKeys = { at: 0, keys: [] };
async function appleKey(kid, f, now) {
  if (now - appleKeys.at > 3600 * 1000 || !appleKeys.keys.some(k => k.kid === kid)) {
    const r = await f("https://appleid.apple.com/auth/keys");
    if (!r.ok) throw new Error(`apple keys ${r.status}`);
    appleKeys = { at: now, keys: (await r.json()).keys || [] };
  }
  const jwk = appleKeys.keys.find(k => k.kid === kid);
  return jwk ? crypto.createPublicKey({ key: jwk, format: "jwk" }) : null;
}
const part = p => JSON.parse(Buffer.from(p, "base64url").toString());
export async function checkAppleToken(token, env, f = fetch, now = Date.now(), keyOf = appleKey) {
  const [h, p, sig] = String(token || "").split(".");
  if (!h || !p || !sig) return null;
  let head, claims;
  try { head = part(h); claims = part(p); } catch { return null; }
  if (head.alg !== "RS256") return null;
  const key = await keyOf(head.kid, f, now);
  if (!key || !crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), key, Buffer.from(sig, "base64url"))) return null;
  if (claims.iss !== "https://appleid.apple.com" || claims.aud !== env.MADA_APPLE_BUNDLE_ID || !(claims.exp * 1000 > now) || !claims.sub) return null;
  return { sub: String(claims.sub), email: typeof claims.email === "string" ? claims.email : null };
}
// Revoking « Se connecter avec Apple » when the account is deleted (Apple, since June 2022). It takes a
// Sign in with Apple key from the developer account: MADA_APPLE_KEY_ID, MADA_APPLE_TEAM_ID and
// MADA_APPLE_SIGNIN_KEY (the .p8 text), plus MADA_TOKEN_KEY to keep Apple's refresh token sealed.
// Without them the sign-in still works and the deletion says the revocation was not made.
export const appleRevocable = env => !!(env.MADA_APPLE_KEY_ID && env.MADA_APPLE_TEAM_ID && env.MADA_APPLE_SIGNIN_KEY && env.MADA_APPLE_BUNDLE_ID && env.MADA_TOKEN_KEY);
export function appleClientSecret(env, now = Date.now()) {
  const enc = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const t = Math.floor(now / 1000), head = enc({ alg: "ES256", kid: env.MADA_APPLE_KEY_ID });
  const body = enc({ iss: env.MADA_APPLE_TEAM_ID, iat: t, exp: t + 300, aud: "https://appleid.apple.com", sub: env.MADA_APPLE_BUNDLE_ID });
  const key = String(env.MADA_APPLE_SIGNIN_KEY).replace(/\\n/g, "\n");
  const sig = crypto.sign("SHA256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${sig.toString("base64url")}`;
}
const appleForm = (env, now, extra) => new URLSearchParams({ client_id: env.MADA_APPLE_BUNDLE_ID, client_secret: appleClientSecret(env, now), ...extra }).toString();
// The authorization code the iPhone got at sign-in, traded once for a refresh token (kept sealed).
async function appleRefresh(code, env, f, now) {
  const r = await f("https://appleid.apple.com/auth/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: appleForm(env, now, { code, grant_type: "authorization_code" }) });
  const out = await r.json().catch(() => ({}));
  if (!r.ok || !out.refresh_token) throw new Error(`apple token ${r.status} ${out.error || ""}`.trim());
  return out.refresh_token;
}
async function appleRevoke(token, env, f, now) {
  const r = await f("https://appleid.apple.com/auth/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: appleForm(env, now, { token, token_type_hint: "refresh_token" }) });
  if (!r.ok) throw new Error(`apple revoke ${r.status}`);
}
export const testing = { resetApple: () => { appleKeys = { at: 0, keys: [] }; } };

// ---------- Google: the web flow, so the app needs no Google library ----------

const googleUrl = (state, env) => `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(env), response_type: "code", scope: "openid email profile", prompt: "select_account", state })}`;
// The ID token comes straight from Google's token endpoint over TLS: its claims are checked, its
// signature need not be (OpenID Connect Core, 3.1.3.7).
async function googleIdentity(code, env, f, now) {
  const r = await f("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri(env), grant_type: "authorization_code" }).toString() });
  const out = await r.json().catch(() => ({}));
  if (!r.ok || !out.id_token) throw new Error(`google token ${r.status} ${out.error || ""}`.trim());
  const c = part(String(out.id_token).split(".")[1] || "");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(c.iss) || c.aud !== env.GOOGLE_CLIENT_ID || !(c.exp * 1000 > now) || !c.sub) throw new Error("google id_token");
  return { sub: String(c.sub), email: c.email_verified ? String(c.email) : null, nom: typeof c.given_name === "string" ? c.given_name : null };
}

// ---------- E-mail: a 6-digit code ----------

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
const cleanEmail = v => (typeof v === "string" ? v.trim().toLowerCase() : "");
const codeKey = email => `mada:code:${sha(email)}`;
async function sendCode(email, code, env, f) {
  const text = `Ton code Ma DA : ${code}\n\nIl marche 10 minutes. Si tu n'as rien demandé, ignore ce message.`;
  const html = `<p style="font:16px -apple-system,Helvetica,sans-serif;color:#121212">Ton code Ma DA :</p><p style="font:600 32px -apple-system,Helvetica,sans-serif;letter-spacing:6px;color:#121212">${code}</p><p style="font:14px -apple-system,Helvetica,sans-serif;color:#555">Il marche 10 minutes. Si tu n'as rien demandé, ignore ce message.</p>`;
  const r = await f("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.MADA_EMAIL_FROM, to: [email], subject: `${code} est ton code Ma DA`, text, html }) });
  if (!r.ok) throw new Error(`resend ${r.status}`);
}

// ---------- Routes ----------

const json = (res, status, payload) => {
  res.statusCode = status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
};
const back = (res, q) => { res.statusCode = 302; res.setHeader("location", `${APP_RETURN}?${new URLSearchParams(q)}`); res.setHeader("cache-control", "no-store"); res.end(); };

export async function handleAuth(req, res, body, deps = {}) {
  const env = deps.env || process.env, s = deps.store || store(env), f = deps.fetchImpl || fetch, now = deps.now ?? Date.now();
  if (!checkAccess(req)) return json(res, 401, { error: "unauthorized" });
  const device = deviceOf(req), m = methods(env);
  if (req.method === "GET") {
    const q = new URL(req.url || "/", "http://x").searchParams;
    if (!q.get("moi")) return json(res, 200, { methodes: m });
    const uid = sessionOf(req, env, now), u = uid ? await s.get(userKey(uid)) : null;
    return u ? json(res, 200, { compte: publicOf(u) }) : json(res, 401, { error: "session" });
  }
  if (req.method === "DELETE") {
    // « Supprimer mon compte » (Réglages): the record, its e-mail and its link to this iPhone.
    const uid = sessionOf(req, env, now);
    if (!uid) return json(res, 401, { error: "session" });
    const u = await s.get(userKey(uid));
    // « Se connecter avec Apple » is revoked at Apple too; said in the answer when it could not be.
    let revoque = null;
    if (u?.apple && appleRevocable(env)) {
      try { const t = unseal(u.apple, env); if (!t) throw new Error("sealed token unreadable"); await appleRevoke(t, env, f, now); revoque = true; } catch (e) { console.error("apple revoke failed:", e.message); revoque = false; }
    } else if (u?.methode === "apple") revoque = false;
    for (const d of u?.appareils || []) if ((await s.get(`mada:appareil:${d}`)) === uid) await s.set(`mada:appareil:${d}`, null);
    await s.set(userKey(uid), null);
    return json(res, 200, { supprime: ["compte", "adresse e-mail", "lien avec tes iPhone"], apple_revoque: revoque });
  }
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  const action = body?.action;
  try {
    if (action === "apple") {
      if (!m.apple) return json(res, 503, { error: "config" });
      const id = await checkAppleToken(body.jeton, env, f, now, deps.appleKey);
      if (!id) return json(res, 401, { error: "jeton", message: "Apple n'a pas confirmé ton identité. Réessaie." });
      // Apple gives the name only at the very first sign-in: the app sends it then.
      const nom = typeof body.nom === "string" ? body.nom.trim().slice(0, 60) || null : null;
      const out = await signIn(s, env, { uid: `apple:${id.sub}`, methode: "apple", email: id.email, nom }, device, now);
      // Apple's refresh token, to revoke at deletion. A failure here never blocks the sign-in.
      if (appleRevocable(env) && typeof body.code === "string" && body.code) {
        try {
          const u = await s.get(userKey(`apple:${id.sub}`));
          await s.set(userKey(`apple:${id.sub}`), { ...u, apple: seal(await appleRefresh(body.code, env, f, now), env) });
        } catch (e) { console.error("apple refresh token failed:", e.message); }
      }
      return json(res, 200, out);
    }
    if (action === "google") {
      if (!m.google) return json(res, 503, { error: "config" });
      return json(res, 200, { url: googleUrl(makeState(`login~${device || "aucun"}`, env, now), env) });
    }
    if (action === "email") {
      if (!m.email) return json(res, 503, { error: "config" });
      const email = cleanEmail(body.email);
      if (!EMAIL.test(email)) return json(res, 400, { error: "email", message: "Cette adresse ne semble pas complète." });
      if ((await s.incr(`mada:code:envois:${sha(email)}`, 3600)) > SENDS_PER_HOUR) return json(res, 429, { error: "rate_limited", message: "Trop de codes demandés. Réessaie dans une heure." });
      // The App Store review account: MADA_DEMO_EMAIL signs in with the fixed MADA_DEMO_CODE (6 digits),
      // written in App Store Connect's review notes; no e-mail is sent to it.
      const demo = !!env.MADA_DEMO_EMAIL && /^\d{6}$/.test(env.MADA_DEMO_CODE || "") && email === cleanEmail(env.MADA_DEMO_EMAIL);
      const code = demo ? env.MADA_DEMO_CODE : String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
      await s.set(codeKey(email), { h: sha(`${email}:${code}`), exp: now + CODE_TTL, essais: 0 });
      if (env.MADA_AUTH_DEV === "1") return json(res, 200, { envoye: true, code });
      if (demo) return json(res, 200, { envoye: true });
      await sendCode(email, code, env, f);
      return json(res, 200, { envoye: true });
    }
    if (action === "code") {
      if (!m.email) return json(res, 503, { error: "config" });
      const email = cleanEmail(body.email), code = String(body.code || "").replace(/\D/g, "");
      const c = await s.get(codeKey(email));
      if (!c || c.exp < now || c.essais >= CODE_TRIES) return json(res, 400, { error: "expire", message: "Ce code a expiré. Demande-en un nouveau." });
      const want = Buffer.from(c.h), got = Buffer.from(sha(`${email}:${code}`));
      if (!crypto.timingSafeEqual(want, got)) {
        await s.set(codeKey(email), { ...c, essais: c.essais + 1 });
        return json(res, 400, { error: "code", message: c.essais + 1 >= CODE_TRIES ? "Trop d'essais. Demande un nouveau code." : "Ce n'est pas le bon code." });
      }
      await s.set(codeKey(email), null);
      return json(res, 200, await signIn(s, env, { uid: `email:${sha(email)}`, methode: "email", email, nom: null }, device, now));
    }
    return json(res, 400, { error: "action" });
  } catch (e) {
    console.error("auth failed:", action, e.message);
    return json(res, 502, { error: "service", message: "La connexion n'a pas abouti. Réessaie dans un instant." });
  }
}

export async function handleAuthCallback(req, res, deps = {}) {
  const env = deps.env || process.env, s = deps.store || store(env), f = deps.fetchImpl || fetch, now = deps.now ?? Date.now();
  const q = new URL(req.url || "/", "http://x").searchParams;
  if (!methods(env).google) return back(res, { erreur: "config" });
  if (q.get("error")) return back(res, { erreur: "refus" });
  const who = readState(q.get("state"), env, now) || "";
  const [from, device] = who.split("~");
  if (from !== "login" || !q.get("code")) return back(res, { erreur: "lien" });
  try {
    const id = await googleIdentity(q.get("code"), env, f, now);
    const out = await signIn(s, env, { uid: `google:${id.sub}`, methode: "google", email: id.email, nom: id.nom }, device === "aucun" ? null : device, now);
    return back(res, { session: out.session });
  } catch (e) {
    console.error("google sign-in failed:", e.message);
    return back(res, { erreur: "echange" });
  }
}
