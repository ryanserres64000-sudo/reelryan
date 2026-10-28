// TikTok and YouTube (étape 9 de la refonte ; étude, ch. 5): the same read-only connection as
// Instagram (lib/instagram.js), so « Tes chiffres » works for the three platforms the export targets.
//   POST   /api/reseau/<p> { action: "connecter" } → { url } of the platform's « Autoriser » page
//   GET    /api/reseau/<p>/callback?code&state     → tokens exchanged and kept (encrypted), back to the app
//   GET    /api/reseau/<p>                         → { connecte, compte, posts } (6 h cache, ?frais=1)
//   DELETE /api/reseau/<p>                         → access revoked at the platform and forgotten here
// TikTok: Login Kit + Display API (user.info.basic, user.info.stats, video.list), access token 24 h,
// refresh token 1 year. YouTube: Google OAuth (youtube.readonly), access token 1 h, refresh token.
// Both checked in their documentation on 28 octobre 2026. Settings: TIKTOK_CLIENT_KEY,
// TIKTOK_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, plus MADA_TOKEN_KEY and MADA_PUBLIC_URL.
import { makeState, open, readState, seal } from "./instagram.js";
import { sanitizePosts } from "../core/insights.ts";
import { checkAccess, overLimit } from "./claude.js";
import { deviceOf, store } from "./quota.js";

const CACHE_TTL = 6 * 3600 * 1000, EARLY = 5 * 60 * 1000;
const base = env => (env.MADA_PUBLIC_URL || "https://reelryan.vercel.app").replace(/\/$/, "");
export const redirectUri = (p, env) => `${base(env)}/api/reseau/${p}/callback`;

async function call(fetchImpl, url, init = {}) {
  const r = await fetchImpl(url, init);
  const out = await r.json().catch(() => ({}));
  const apiError = out?.error && typeof out.error === "object" && out.error.code && out.error.code !== "ok";
  if (!r.ok || apiError) { const e = new Error(`${new URL(url).host} ${r.status} ${out?.error?.message || out?.error_description || out?.error?.code || ""}`.trim()); e.status = r.status; throw e; }
  return out;
}
const form = o => ({ method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(o).toString() });
const bearer = token => ({ headers: { authorization: `Bearer ${token}` } });
const tokens = (out, now, old = {}) => ({
  token: out.access_token, refresh: out.refresh_token || old.refresh, expire: now + (Number(out.expires_in) || 3600) * 1000,
});

// ISO 8601 duration of a YouTube video (PT1M5S) in seconds.
export const seconds = iso => { const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(iso)); return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : null; };

export const PROVIDERS = {
  tiktok: {
    configured: env => !!(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET && env.MADA_TOKEN_KEY),
    authorizeUrl: (state, env) => `https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, scope: "user.info.basic,user.info.stats,video.list", response_type: "code", redirect_uri: redirectUri("tiktok", env), state })}`,
    exchange: async (code, env, f, now) => tokens(await call(f, "https://open.tiktokapis.com/v2/oauth/token/", form({ client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: redirectUri("tiktok", env) })), now),
    refresh: async (t, env, f, now) => tokens(await call(f, "https://open.tiktokapis.com/v2/oauth/token/", form({ client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: t.refresh })), now, t),
    revoke: (t, env, f) => f("https://open.tiktokapis.com/v2/oauth/revoke/", form({ client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, token: t.token })),
    read: async (token, f) => {
      const u = (await call(f, "https://open.tiktokapis.com/v2/user/info/?fields=display_name,username,follower_count,avatar_url", bearer(token))).data?.user ?? {};
      const v = await call(f, "https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,duration,create_time,share_url,view_count,like_count,comment_count,share_count",
        { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ max_count: 20 }) });
      return {
        compte: { nom: String(u.username || u.display_name || ""), type: "TIKTOK", abonnes: typeof u.follower_count === "number" ? u.follower_count : null, photo: u.avatar_url ?? null },
        posts: sanitizePosts((v.data?.videos ?? []).map(x => ({ id: x.id, at: new Date(Number(x.create_time) * 1000).toISOString(), type: "reel", legende: x.video_description || x.title || "", lien: x.share_url ?? null,
          vues: x.view_count ?? null, portee: null, likes: x.like_count ?? null, commentaires: x.comment_count ?? null, partages: x.share_count ?? null, enregistrements: null, duree: x.duration ?? null, source: "tiktok" }))),
      };
    },
  },
  youtube: {
    configured: env => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.MADA_TOKEN_KEY),
    authorizeUrl: (state, env) => `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri("youtube", env), response_type: "code", scope: "https://www.googleapis.com/auth/youtube.readonly", access_type: "offline", prompt: "consent", include_granted_scopes: "true", state })}`,
    exchange: async (code, env, f, now) => tokens(await call(f, "https://oauth2.googleapis.com/token", form({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri("youtube", env), grant_type: "authorization_code" })), now),
    refresh: async (t, env, f, now) => tokens(await call(f, "https://oauth2.googleapis.com/token", form({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: t.refresh, grant_type: "refresh_token" })), now, t),
    revoke: (t, env, f) => f(`https://oauth2.googleapis.com/revoke?${new URLSearchParams({ token: t.refresh || t.token })}`, { method: "POST" }),
    read: async (token, f) => {
      const g = "https://www.googleapis.com/youtube/v3";
      const ch = (await call(f, `${g}/channels?part=snippet,statistics,contentDetails&mine=true`, bearer(token))).items?.[0];
      if (!ch) return { compte: { nom: "", type: "YOUTUBE", abonnes: null, photo: null }, posts: [] };
      const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
      const items = uploads ? (await call(f, `${g}/playlistItems?part=contentDetails&maxResults=30&playlistId=${encodeURIComponent(uploads)}`, bearer(token))).items ?? [] : [];
      const ids = items.map(i => i.contentDetails?.videoId).filter(Boolean);
      const videos = ids.length ? (await call(f, `${g}/videos?part=snippet,statistics,contentDetails&id=${ids.join(",")}`, bearer(token))).items ?? [] : [];
      const stat = v => (v === undefined ? null : Number(v));
      return {
        compte: { nom: String(ch.snippet?.customUrl || ch.snippet?.title || ""), type: "YOUTUBE", abonnes: ch.statistics?.hiddenSubscriberCount ? null : stat(ch.statistics?.subscriberCount), photo: ch.snippet?.thumbnails?.default?.url ?? null },
        // Shorts last 3 minutes at most: they are compared with Reels; longer videos are posts.
        posts: sanitizePosts(videos.map(v => { const d = seconds(v.contentDetails?.duration); return { id: v.id, at: v.snippet?.publishedAt, type: d !== null && d <= 180 ? "reel" : "post", legende: `${v.snippet?.title ?? ""} ${v.snippet?.description ?? ""}`.trim(), lien: `https://www.youtube.com/shorts/${v.id}`,
          vues: stat(v.statistics?.viewCount), portee: null, likes: stat(v.statistics?.likeCount), commentaires: stat(v.statistics?.commentCount), partages: null, enregistrements: null, duree: d, source: "youtube" }; })),
      };
    },
  },
};

const json = (res, status, payload) => {
  res.statusCode = status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
};
const back = (res, p, query) => { res.statusCode = 302; res.setHeader("location", `madastudio://reseau?${new URLSearchParams({ p, ...query })}`); res.end(); };
const tokenKey = (p, d) => `mada:${p}:${d}`, cacheKey = (p, d) => `mada:${p}:posts:${d}`;
const NAMES = { tiktok: "TikTok", youtube: "YouTube" };

export async function handleReseau(req, res, body, p, deps = {}) {
  const env = deps.env || process.env, s = deps.store || store(env), f = deps.fetchImpl || fetch, now = deps.now ?? Date.now();
  const P = PROVIDERS[p];
  if (!P) return json(res, 404, { error: "unknown" });
  if (!checkAccess(req)) return json(res, 401, { error: "unauthorized", message: "Code d'accès incorrect." });
  if (overLimit(req)) return json(res, 429, { error: "rate_limited", message: "Trop de demandes." });
  if (!P.configured(env)) return json(res, 503, { error: "server_config", message: `La connexion ${NAMES[p]} n'est pas encore ouverte.` });
  const device = deviceOf(req);
  if (!device) return json(res, 400, { error: "device", message: "Appareil non reconnu." });

  if (req.method === "POST" && body?.action === "connecter") return json(res, 200, { url: P.authorizeUrl(makeState(`${p}~${device}`, env, now), env) });
  const box = await s.get(tokenKey(p, device)), saved = box ? open(box, env) : null;
  if (req.method === "DELETE") {
    if (saved) await P.revoke(saved, env, f).catch(() => {});
    await s.set(tokenKey(p, device), null); await s.set(cacheKey(p, device), null);
    return json(res, 200, { connecte: false });
  }
  if (req.method !== "GET") return json(res, 405, { error: "method" });
  if (!saved) return json(res, 200, { connecte: false });
  const cached = await s.get(cacheKey(p, device));
  if (cached && new URL(req.url || "/", "http://x").searchParams.get("frais") !== "1" && now - cached.at < CACHE_TTL) return json(res, 200, { connecte: true, ...cached.value });
  try {
    let t = saved;
    if (t.expire - now < EARLY) { t = await P.refresh(t, env, f, now); await s.set(tokenKey(p, device), seal(t, env)); }
    const value = await P.read(t.token, f);
    await s.set(cacheKey(p, device), { at: now, value });
    return json(res, 200, { connecte: true, ...value });
  } catch (e) {
    if (e.status === 400 || e.status === 401) { await s.set(tokenKey(p, device), null); return json(res, 200, { connecte: false, expire: true }); }
    console.error(`${p} failed:`, e.status, e.message);
    return json(res, 502, { error: p, message: `${NAMES[p]} ne répond pas. Réessaie dans un moment.` });
  }
}

export async function handleReseauCallback(req, res, p, deps = {}) {
  const env = deps.env || process.env, s = deps.store || store(env), f = deps.fetchImpl || fetch, now = deps.now ?? Date.now();
  const P = PROVIDERS[p];
  if (!P) { res.statusCode = 404; return res.end(); }
  const q = new URL(req.url || "/", "http://x").searchParams;
  if (!P.configured(env)) return back(res, p, { erreur: "config" });
  if (q.get("error")) return back(res, p, { erreur: "refus" });
  const who = readState(q.get("state"), env, now) || "";
  const [from, device] = who.split("~");
  if (from !== p || !device || !q.get("code")) return back(res, p, { erreur: "lien" });
  try {
    await s.set(tokenKey(p, device), seal(await P.exchange(q.get("code"), env, f, now), env));
    await s.set(cacheKey(p, device), null);
    return back(res, p, { ok: "1" });
  } catch (e) {
    console.error(`${p} callback failed:`, e.status, e.message);
    return back(res, p, { erreur: "echange" });
  }
}

// For the account deletion (lib/quota.js): every platform's keys for this device.
export const reseauKeys = device => Object.keys(PROVIDERS).flatMap(p => [tokenKey(p, device), cacheKey(p, device)]);
