import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { handleReseau, handleReseauCallback, seconds } from "../reseaux.js";
import { testing } from "../quota.js";

const DEVICE = "0f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b";
const env = { TIKTOK_CLIENT_KEY: "tk", TIKTOK_CLIENT_SECRET: "ts", GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gs", MADA_TOKEN_KEY: "k".repeat(32) };
function http(method = "GET", url = "/", headers = { "x-mada-device": DEVICE }) {
  const res = new EventEmitter();
  Object.assign(res, { statusCode: 0, headers: {}, chunks: [], setHeader(k, v) { this.headers[k] = v; }, end(c) { if (c) this.chunks.push(c); } });
  return { req: { method, url, headers, socket: { remoteAddress: `t-${Math.random()}` } }, res, body: () => JSON.parse(res.chunks.join("")) };
}
const ok = v => ({ ok: true, status: 200, json: async () => v });

async function connect(p, s, fetchImpl, now) {
  const c = http("POST");
  await handleReseau(c.req, c.res, { action: "connecter" }, p, { env, store: s, now });
  const state = new URL(c.body().url).searchParams.get("state");
  const cb = http("GET", `/api/reseau/${p}/callback?code=abc&state=${state}`, {});
  await handleReseauCallback(cb.req, cb.res, p, { env, store: s, fetchImpl, now });
  return cb.res.headers.location;
}

test("YouTube durations; not configured says so", async () => {
  assert.equal(seconds("PT1M5S"), 65); assert.equal(seconds("PT45S"), 45); assert.equal(seconds("P0D"), 0);
  const a = http();
  await handleReseau(a.req, a.res, null, "tiktok", { env: {}, store: testing.memoryStore() });
  assert.equal(a.res.statusCode, 503);
});

test("TikTok: connect, read the videos with their views and duration, refresh, revoke", async () => {
  const s = testing.memoryStore(), now = Date.parse("2026-10-28T12:00:00Z"), calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body });
    if (url.includes("oauth/token")) return ok({ access_token: init.body.includes("refresh_token") ? "tok2" : "tok1", refresh_token: "ref", expires_in: 86400 });
    if (url.includes("user/info")) { assert.equal(init.headers.authorization.startsWith("Bearer tok"), true); return ok({ data: { user: { username: "chezlou", follower_count: 300 } }, error: { code: "ok" } }); }
    if (url.includes("video/list")) return ok({ data: { videos: [{ id: "v1", create_time: 1761300000, video_description: "Magret #resto", duration: 12, view_count: 5100, like_count: 200, share_url: "https://www.tiktok.com/@chezlou/video/v1" }] }, error: { code: "ok" } });
    if (url.includes("revoke")) return ok({});
    throw new Error(url);
  };
  assert.equal(await connect("tiktok", s, fetchImpl, now), "madastudio://reseau?p=tiktok&ok=1");
  const g = http();
  await handleReseau(g.req, g.res, null, "tiktok", { env, store: s, fetchImpl, now: now + 1000 });
  const out = g.body();
  assert.equal(out.compte.nom, "chezlou");
  assert.deepEqual([out.posts[0].vues, out.posts[0].duree, out.posts[0].source], [5100, 12, "tiktok"]);
  // A day later the access token is refreshed with the refresh token.
  const r = http("GET", "/?frais=1");
  await handleReseau(r.req, r.res, null, "tiktok", { env, store: s, fetchImpl, now: now + 86400_000 });
  assert.ok(calls.some(c => c.url.includes("oauth/token") && String(c.body).includes("grant_type=refresh_token")));
  const d = http("DELETE");
  await handleReseau(d.req, d.res, null, "tiktok", { env, store: s, fetchImpl, now });
  assert.ok(calls.some(c => c.url.includes("revoke")));
  assert.equal(await s.get(`mada:tiktok:${DEVICE}`), null);
});

test("YouTube: Shorts are compared with Reels, long videos are not", async () => {
  const s = testing.memoryStore(), now = Date.parse("2026-10-28T12:00:00Z");
  const fetchImpl = async url => {
    if (url.includes("oauth2.googleapis.com/token")) return ok({ access_token: "g1", refresh_token: "gr", expires_in: 3600 });
    if (url.includes("/channels")) return ok({ items: [{ snippet: { title: "Chez Lou", customUrl: "@chezlou" }, statistics: { subscriberCount: "90" }, contentDetails: { relatedPlaylists: { uploads: "UU1" } } }] });
    if (url.includes("/playlistItems")) return ok({ items: [{ contentDetails: { videoId: "a" } }, { contentDetails: { videoId: "b" } }] });
    if (url.includes("/videos")) return ok({ items: [
      { id: "a", snippet: { title: "Short", publishedAt: "2026-10-20T10:00:00Z" }, statistics: { viewCount: "800" }, contentDetails: { duration: "PT28S" } },
      { id: "b", snippet: { title: "Long", publishedAt: "2026-10-10T10:00:00Z" }, statistics: { viewCount: "50" }, contentDetails: { duration: "PT12M3S" } }] });
    throw new Error(url);
  };
  await connect("youtube", s, fetchImpl, now);
  const g = http();
  await handleReseau(g.req, g.res, null, "youtube", { env, store: s, fetchImpl, now });
  const out = g.body();
  assert.equal(out.compte.nom, "@chezlou");
  assert.equal(out.compte.abonnes, 90);
  assert.deepEqual(out.posts.map(p => [p.id, p.type, p.vues]), [["a", "reel", 800], ["b", "post", 50]]);
});

test("a state made for one platform is refused by another", async () => {
  const s = testing.memoryStore();
  const c = http("POST");
  await handleReseau(c.req, c.res, { action: "connecter" }, "tiktok", { env, store: s });
  const state = new URL(c.body().url).searchParams.get("state");
  const cb = http("GET", `/api/reseau/youtube/callback?code=x&state=${state}`, {});
  await handleReseauCallback(cb.req, cb.res, "youtube", { env, store: s, fetchImpl: async () => { throw new Error("no"); } });
  assert.equal(cb.res.headers.location, "madastudio://reseau?p=youtube&erreur=lien");
});
