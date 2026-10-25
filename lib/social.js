// Instagram and TikTok: official OAuth connection, direct publishing and
// statistics. Tokens are stored encrypted in Supabase (table mada_social,
// readable by the server only). Media to publish is uploaded by the app to
// the private Supabase bucket "publish" and removed once published.
//
// Instagram: "Instagram API with Instagram login" (professional accounts).
// TikTok: Login Kit + Content Posting API (direct post, FILE_UPLOAD).
import { authUser, rest, supaAdminReady, storageSignedUrl, storageDownload, storageRemove } from "./supa.js";
import { seal, unseal, signState, readState, sealReady } from "./seal.js";

const IG_VERSION = process.env.IG_API_VERSION || "v23.0";
const IG = "https://graph.instagram.com/" + IG_VERSION;
const TT = "https://open.tiktokapis.com/v2";
const APP_SCHEME = process.env.APP_SCHEME || "com.madastudio.app";
const BUCKET = "publish";
const sleep = ms => new Promise(r => setTimeout(r, ms));

const appUrl = () => String(process.env.APP_URL || "").replace(/\/+$/, "");
const redirectUri = () => appUrl() + "/api/social/callback";

class SocialError extends Error { constructor(code, message) { super(message || code); this.code = code; } }

async function getJson(res, what) {
  const t = await res.text(); let j = {};
  try { j = t ? JSON.parse(t) : {}; } catch { }
  // Instagram errors: {error:{code:190,message}}; TikTok always sends {error:{code:"ok"}} on success,
  // and {error:"invalid_grant",error_description} from its token endpoint.
  const e = j.error, bad = !res.ok || typeof e === "string" || (e && typeof e === "object" && e.code !== undefined && e.code !== "ok");
  if (bad) {
    const msg = (e && e.message) || j.error_description || (typeof e === "string" ? e : "") || t.slice(0, 200);
    throw new SocialError("provider_error", `${what}: ${msg}`);
  }
  return j;
}
const form = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));

/* ---------- Instagram ---------- */
const instagram = {
  ready: () => !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET),
  authorizeUrl(state) {
    return "https://www.instagram.com/oauth/authorize?" + form({
      client_id: process.env.INSTAGRAM_APP_ID, redirect_uri: redirectUri(), response_type: "code", state,
      scope: "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights"
    });
  },
  async exchange(code) {
    const r = await getJson(await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form({ client_id: process.env.INSTAGRAM_APP_ID, client_secret: process.env.INSTAGRAM_APP_SECRET, grant_type: "authorization_code", redirect_uri: redirectUri(), code }) }), "Instagram token");
    const short = (r.data && r.data[0]) || r;
    const long = await getJson(await fetch("https://graph.instagram.com/access_token?" + form({ grant_type: "ig_exchange_token", client_secret: process.env.INSTAGRAM_APP_SECRET, access_token: short.access_token })), "Instagram long token");
    const me = await this.profile(long.access_token);
    return { account_id: String(me.user_id || short.user_id), username: me.username, avatar: me.profile_picture_url || null, token: long.access_token, refresh: null, expires_at: new Date(Date.now() + (long.expires_in || 5184000) * 1000).toISOString(), refresh_expires_at: null };
  },
  // Long-lived tokens last 60 days and can be refreshed once they are 24 h old.
  async refresh(row) {
    const r = await getJson(await fetch("https://graph.instagram.com/refresh_access_token?" + form({ grant_type: "ig_refresh_token", access_token: row.token })), "Instagram refresh");
    return { token: r.access_token, expires_at: new Date(Date.now() + (r.expires_in || 5184000) * 1000).toISOString() };
  },
  async profile(token) {
    return getJson(await fetch(`${IG}/me?` + form({ fields: "user_id,username,name,profile_picture_url,followers_count,follows_count,media_count", access_token: token })), "Instagram profil");
  },
  // kind: video | image ; format: reel | post | story
  async publish(row, { url, kind, format, caption }) {
    const p = { access_token: row.token };
    if (format === "story") { p.media_type = "STORIES"; p[kind === "video" ? "video_url" : "image_url"] = url; }
    else if (kind === "video") { p.media_type = "REELS"; p.video_url = url; p.share_to_feed = "true"; p.caption = caption || ""; }
    else { p.image_url = url; p.caption = caption || ""; }
    const c = await getJson(await fetch(`${IG}/${row.account_id}/media`, { method: "POST", body: form(p) }), "Instagram création");
    // Videos are processed by Instagram before they can be published.
    for (let i = 0; i < 50; i++) {
      const s = await getJson(await fetch(`${IG}/${c.id}?` + form({ fields: "status_code,status", access_token: row.token })), "Instagram statut");
      if (s.status_code === "FINISHED" || (!s.status_code && kind === "image")) break;
      if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new SocialError("media_rejected", "Instagram a refusé le fichier : " + (s.status || s.status_code));
      if (i === 49) throw new SocialError("timeout", "Instagram traite encore la vidéo.");
      await sleep(4000);
    }
    const done = await getJson(await fetch(`${IG}/${row.account_id}/media_publish`, { method: "POST", body: form({ creation_id: c.id, access_token: row.token }) }), "Instagram publication");
    let link = null;
    try { link = (await getJson(await fetch(`${IG}/${done.id}?` + form({ fields: "permalink", access_token: row.token })), "permalink")).permalink; } catch { }
    return { id: done.id, url: link };
  },
  async stats(row) {
    const profile = await this.profile(row.token);
    const list = await getJson(await fetch(`${IG}/me/media?` + form({ fields: "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count", limit: 18, access_token: row.token })), "Instagram publications");
    const posts = await Promise.all((list.data || []).map(async m => {
      const o = { id: m.id, caption: (m.caption || "").slice(0, 300), type: m.media_product_type === "REELS" ? "Reel" : m.media_type === "CAROUSEL_ALBUM" ? "Carrousel" : m.media_type === "VIDEO" ? "Vidéo" : "Photo", url: m.permalink, thumb: m.thumbnail_url || (m.media_type === "IMAGE" ? m.media_url : null), date: m.timestamp, likes: m.like_count ?? null, comments: m.comments_count ?? null };
      try {
        const ins = await getJson(await fetch(`${IG}/${m.id}/insights?` + form({ metric: "reach,saved,shares,views,total_interactions", access_token: row.token })), "insights");
        for (const d of ins.data || []) o[{ reach: "reach", saved: "saves", shares: "shares", views: "views", total_interactions: "interactions" }[d.name]] = d.values && d.values[0] ? d.values[0].value : d.total_value && d.total_value.value;
      } catch { }
      return o;
    }));
    return { profile: { username: profile.username, name: profile.name, avatar: profile.profile_picture_url, followers: profile.followers_count, following: profile.follows_count, posts: profile.media_count }, posts };
  }
};

/* ---------- TikTok ---------- */
const tiktok = {
  ready: () => !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET),
  authorizeUrl(state) {
    return "https://www.tiktok.com/v2/auth/authorize/?" + form({ client_key: process.env.TIKTOK_CLIENT_KEY, response_type: "code", redirect_uri: redirectUri(), state, scope: "user.info.basic,user.info.profile,user.info.stats,video.publish,video.upload,video.list" });
  },
  async token(params) {
    const r = await getJson(await fetch(TT + "/oauth/token/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form({ client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET, ...params }) }), "TikTok token");
    return { token: r.access_token, refresh: r.refresh_token, account_id: r.open_id, expires_at: new Date(Date.now() + (r.expires_in || 86400) * 1000).toISOString(), refresh_expires_at: new Date(Date.now() + (r.refresh_expires_in || 31536000) * 1000).toISOString() };
  },
  async exchange(code) {
    const t = await this.token({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
    const me = await this.profile(t.token);
    return { ...t, username: me.display_name || me.username || "", avatar: me.avatar_url || null };
  },
  refresh(row) { return this.token({ grant_type: "refresh_token", refresh_token: row.refresh }); },
  async api(row, path, body, what) {
    const r = await getJson(await fetch(TT + path, { method: body ? "POST" : "GET", headers: { authorization: "Bearer " + row.token, "content-type": "application/json; charset=UTF-8" }, body: body ? JSON.stringify(body) : undefined }), what);
    return r.data || {};
  },
  async profile(token) {
    const d = await this.api({ token }, "/user/info/?fields=open_id,display_name,username,avatar_url,follower_count,following_count,likes_count,video_count", null, "TikTok profil");
    return d.user || {};
  },
  creatorInfo(row) { return this.api(row, "/post/publish/creator_info/query/", {}, "TikTok créateur"); },
  async publish(row, { path, kind, caption, tiktok: o = {} }) {
    if (kind !== "video") throw new SocialError("unsupported", "TikTok accepte ici uniquement les vidéos.");
    if (!o.privacy_level) throw new SocialError("bad_request", "Choisis qui peut voir la vidéo.");
    const file = await storageDownload(BUCKET, path), size = file.length;
    // One chunk up to 64 MB; above that, 10 MB chunks with the remainder in the last one.
    const chunk = size <= 64e6 ? size : 10e6, count = size <= 64e6 ? 1 : Math.floor(size / chunk);
    const init = await this.api(row, "/post/publish/video/init/", {
      post_info: { title: String(caption || "").slice(0, 2200), privacy_level: o.privacy_level, disable_comment: !!o.disable_comment, disable_duet: !!o.disable_duet, disable_stitch: !!o.disable_stitch, brand_content_toggle: !!o.brand_content, brand_organic_toggle: !!o.brand_organic },
      source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunk, total_chunk_count: count }
    }, "TikTok envoi");
    for (let i = 0; i < count; i++) {
      const a = i * chunk, b = i === count - 1 ? size : a + chunk;
      const r = await fetch(init.upload_url, { method: "PUT", headers: { "content-type": "video/mp4", "content-length": String(b - a), "content-range": `bytes ${a}-${b - 1}/${size}` }, body: file.subarray(a, b) });
      if (!r.ok) throw new SocialError("provider_error", "TikTok a refusé l'envoi de la vidéo (" + r.status + ").");
    }
    for (let i = 0; i < 45; i++) {
      await sleep(4000);
      const s = await this.api(row, "/post/publish/status/fetch/", { publish_id: init.publish_id }, "TikTok statut");
      if (s.status === "PUBLISH_COMPLETE") { const id = (s.publicaly_available_post_id || [])[0]; return { id: id ? String(id) : init.publish_id, url: null }; }
      if (s.status === "FAILED") throw new SocialError("media_rejected", "TikTok a refusé la vidéo : " + (s.fail_reason || "raison inconnue"));
    }
    return { id: init.publish_id, url: null, pending: true };
  },
  async stats(row) {
    const me = await this.profile(row.token);
    const list = await this.api(row, "/video/list/?fields=id,title,video_description,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time,duration", { max_count: 20 }, "TikTok vidéos");
    return {
      profile: { username: me.username || me.display_name, name: me.display_name, avatar: me.avatar_url, followers: me.follower_count, following: me.following_count, likes: me.likes_count, posts: me.video_count },
      posts: (list.videos || []).map(v => ({ id: v.id, caption: (v.video_description || v.title || "").slice(0, 300), type: "Vidéo", url: v.share_url, thumb: v.cover_image_url, date: v.create_time ? new Date(v.create_time * 1000).toISOString() : null, views: v.view_count, likes: v.like_count, comments: v.comment_count, shares: v.share_count, duration: v.duration }))
    };
  }
};

const PROVIDERS = { instagram, tiktok };

/* ---------- Token storage ---------- */
async function loadRow(userId, provider) {
  const rows = await rest(`mada_social?user_id=eq.${userId}&provider=eq.${provider}&select=*`);
  const r = rows && rows[0]; if (!r) return null;
  return { ...r, token: unseal(r.token), refresh: unseal(r.refresh) };
}
async function saveRow(userId, provider, d) {
  await rest("mada_social?on_conflict=user_id,provider", { method: "POST", prefer: "resolution=merge-duplicates", body: { user_id: userId, provider, account_id: d.account_id, username: d.username, avatar: d.avatar, token: seal(d.token), refresh: seal(d.refresh), expires_at: d.expires_at, refresh_expires_at: d.refresh_expires_at, updated_at: new Date().toISOString() } });
}
async function freshRow(userId, provider) {
  const row = await loadRow(userId, provider);
  if (!row) throw new SocialError("not_connected", "Compte non connecté.");
  const left = row.expires_at ? Date.parse(row.expires_at) - Date.now() : Infinity;
  const limit = provider === "instagram" ? 7 * 86400e3 : 10 * 60e3;
  if (left < limit) {
    if (left <= 0 && provider === "instagram") throw new SocialError("reconnect", "La connexion à Instagram a expiré : reconnecte ton compte.");
    try { const n = await PROVIDERS[provider].refresh(row); Object.assign(row, n); await saveRow(userId, provider, row); }
    catch (e) { if (left <= 0) throw new SocialError("reconnect", "La connexion a expiré : reconnecte ton compte."); }
  }
  return row;
}

/* ---------- HTTP ---------- */
function json(res, status, o) { res.statusCode = status; res.setHeader("content-type", "application/json; charset=utf-8"); res.setHeader("cache-control", "no-store"); res.end(JSON.stringify(o)); }
const page = (title, text, back) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0F0D12;color:#F0EBF5;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}a{display:inline-block;margin-top:16px;background:#E8C27A;color:#1C1509;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700}</style></head><body><div><h1>${title}</h1><p>${text}</p><a href="${back}">Retourner dans MaDA</a></div><script>setTimeout(function(){location.href=${JSON.stringify(back)}},800)</script></body></html>`;

export function socialConfig() {
  return { instagram: instagram.ready(), tiktok: tiktok.ready(), enabled: !!(appUrl() && supaAdminReady() && sealReady() && (instagram.ready() || tiktok.ready())) };
}

export async function handleSocial(req, res, action, readBody) {
  const cfg = socialConfig();
  if (!cfg.enabled) return json(res, 503, { error: "social_not_configured" });

  if (action === "callback") {
    const url = new URL(req.url, "http://x"), st = readState(url.searchParams.get("state"));
    const back = st && st.app ? `${APP_SCHEME}://social?provider=${st && st.p}` : appUrl() + "/?social=" + (st ? st.p : "");
    res.setHeader("content-type", "text/html; charset=utf-8");
    if (!st || !PROVIDERS[st.p]) return res.end(page("Lien expiré", "Recommence la connexion depuis MaDA.", back));
    const code = url.searchParams.get("code");
    if (!code) return res.end(page("Connexion annulée", "Ton compte n'a pas été connecté.", back + "&ok=0"));
    try {
      await saveRow(st.u, st.p, await PROVIDERS[st.p].exchange(code));
      return res.end(page("Compte connecté ✦", "Tu peux revenir dans MaDA.", back + "&ok=1"));
    } catch (e) {
      console.error("social callback:", e.message);
      return res.end(page("Connexion impossible", "Vérifie que ton compte est bien un compte professionnel ou créateur, puis réessaie.", back + "&ok=0"));
    }
  }

  const user = await authUser(req);
  if (!user) return json(res, 401, { error: "login_required" });
  try {
    if (action === "accounts") {
      const rows = await rest(`mada_social?user_id=eq.${user.id}&select=provider,username,avatar,expires_at,refresh_expires_at`);
      return json(res, 200, { available: { instagram: cfg.instagram, tiktok: cfg.tiktok }, accounts: rows || [] });
    }
    const body = req.method === "POST" ? (await readBody(req)) || {} : {};
    const provider = body.provider || new URL(req.url, "http://x").searchParams.get("provider");
    const P = PROVIDERS[provider];
    if (!P || !P.ready()) return json(res, 400, { error: "bad_request" });

    if (action === "start") {
      const state = signState({ u: user.id, p: provider, app: !!body.app, n: Math.random().toString(36).slice(2), exp: Date.now() + 15 * 60e3 });
      return json(res, 200, { url: P.authorizeUrl(state) });
    }
    if (action === "disconnect") {
      await rest(`mada_social?user_id=eq.${user.id}&provider=eq.${provider}`, { method: "DELETE" });
      return json(res, 200, { ok: true });
    }
    const row = await freshRow(user.id, provider);
    if (action === "stats") return json(res, 200, await P.stats(row));
    if (action === "creator") return json(res, 200, provider === "tiktok" ? await P.creatorInfo(row) : {});
    if (action === "publish") {
      const path = String(body.path || "");
      if (!path.startsWith(user.id + "/") || path.includes("..")) return json(res, 400, { error: "bad_request" });
      try {
        const url = provider === "instagram" ? await storageSignedUrl(BUCKET, path, 3600) : null;
        const out = await P.publish(row, { url, path, kind: body.kind === "image" ? "image" : "video", format: body.format, caption: String(body.caption || "").slice(0, 2200), tiktok: body.tiktok });
        return json(res, 200, { ok: true, ...out });
      } finally { if (body.last !== false) storageRemove(BUCKET, [path]); }
    }
    return json(res, 404, { error: "not_found" });
  } catch (e) {
    console.error("social", action, e.message);
    return json(res, e.code === "not_connected" ? 404 : e.code === "bad_request" || e.code === "unsupported" ? 400 : 502, { error: e.code || "server_error", message: e.code && e.code !== "provider_error" ? e.message : undefined, detail: e.message });
  }
}
