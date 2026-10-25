// MaDA Pro: entitlement check through RevenueCat (which handles App Store and
// Google Play billing) and the free daily AI quota. Without
// REVENUECAT_SECRET_KEY the gate is off and everyone has full access.
const ENTITLEMENT = process.env.REVENUECAT_ENTITLEMENT || "pro";
import { supaPublic } from "./supa.js";
import { socialConfig } from "./social.js";

// One visual or one edit is about 3 AI requests (create, review, fixes).
const FREE_PER_DAY = Number(process.env.FREE_PER_DAY) || 15;

const pro = new Map();
export async function isPro(user) {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key || !user) return false;
  const c = pro.get(user);
  if (c && Date.now() - c.at < 600e3) return c.pro;
  try {
    const r = await fetch("https://api.revenuecat.com/v1/subscribers/" + encodeURIComponent(user), { headers: { authorization: "Bearer " + key } });
    if (!r.ok) return c ? c.pro : false;
    const e = (((await r.json()).subscriber || {}).entitlements || {})[ENTITLEMENT];
    const ok = !!e && (!e.expires_date || Date.parse(e.expires_date) > Date.now());
    pro.set(user, { pro: ok, at: Date.now() });
    if (pro.size > 20000) pro.clear();
    return ok;
  } catch { return c ? c.pro : false; }
}

// Best-effort, per server instance. Counted per user id and, more loosely,
// per IP so a fresh id does not reset the quota.
const used = new Map();
function bump(key, max) {
  const n = used.get(key) || 0;
  if (n >= max) return false;
  used.set(key, n + 1);
  if (used.size > 50000) used.clear();
  return true;
}

export function userOf(req) { return String(req.headers["x-mada-user"] || "").replace(/[^\w-]/g, "").slice(0, 64); }

// Returns true when the request may run.
export async function allowAI(req) {
  if (!process.env.REVENUECAT_SECRET_KEY) return true;
  const user = userOf(req);
  if (await isPro(user)) return true;
  const day = new Date().toISOString().slice(0, 10);
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "anon").split(",")[0].trim();
  if ((used.get(day + "|ip|" + ip) || 0) >= FREE_PER_DAY * 4) return false;
  if (!bump(day + "|u|" + (user || ip), FREE_PER_DAY)) return false;
  bump(day + "|ip|" + ip, FREE_PER_DAY * 4);
  return true;
}

export async function handleStatus(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  const gated = !!process.env.REVENUECAT_SECRET_KEY;
  res.end(JSON.stringify({ gated, pro: gated ? await isPro(userOf(req)) : true, freePerDay: FREE_PER_DAY, music: !!process.env.JAMENDO_CLIENT_ID, supabase: supaPublic(), social: socialConfig() }));
}
