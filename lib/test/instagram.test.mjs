import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { authorizeUrl, handleCallback, handleInstagram, makeState, open, readState, seal } from "../instagram.js";
import { testing } from "../quota.js";

const DEVICE = "0f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b";
const env = { INSTAGRAM_APP_ID: "123", INSTAGRAM_APP_SECRET: "sec", MADA_TOKEN_KEY: "k".repeat(32), MADA_PUBLIC_URL: "https://reelryan.vercel.app" };
function fakeHttp(method = "GET", url = "/api/instagram", headers = { "x-mada-device": DEVICE }) {
  const res = new EventEmitter();
  Object.assign(res, { statusCode: 0, headers: {}, chunks: [], setHeader(k, v) { this.headers[k] = v; }, end(c) { if (c) this.chunks.push(c); } });
  return { req: { method, url, headers, socket: { remoteAddress: `t-${Math.random()}` } }, res, body: () => JSON.parse(res.chunks.join("")) };
}
const ok = v => ({ ok: true, status: 200, json: async () => v });

test("the state is signed, tied to the device and short-lived; tokens are sealed", () => {
  const s = makeState(DEVICE, env, 1000);
  assert.equal(readState(s, env, 1000 + 60_000), DEVICE);
  assert.equal(readState(s, env, 1000 + 16 * 60_000), null);
  assert.equal(readState(s, { ...env, MADA_TOKEN_KEY: "autre" }, 2000), null);
  const box = seal({ token: "secret" }, env);
  assert.ok(!JSON.stringify(box).includes("secret"));
  assert.deepEqual(open(box, env), { token: "secret" });
  const u = new URL(authorizeUrl(DEVICE, env));
  assert.equal(u.searchParams.get("redirect_uri"), "https://reelryan.vercel.app/api/instagram/callback");
  assert.equal(u.searchParams.get("scope"), "instagram_business_basic,instagram_business_manage_insights");
});

test("not configured: a clear answer that points to the screenshot", async () => {
  const a = fakeHttp();
  await handleInstagram(a.req, a.res, null, { env: {}, store: testing.memoryStore() });
  assert.equal(a.res.statusCode, 503);
  assert.match(a.body().message, /capture/);
});

test("connect, come back, read the Reels with their views, disconnect", async () => {
  const s = testing.memoryStore(), now = Date.parse("2026-10-28T12:00:00Z");
  const c = fakeHttp("POST");
  await handleInstagram(c.req, c.res, { action: "connecter" }, { env, store: s, now });
  const state = new URL(c.body().url).searchParams.get("state");

  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes("oauth/access_token")) { assert.match(init.body, /code=abc&|code=abc$/); return ok({ access_token: "short", user_id: 42 }); }
    if (String(url).includes("ig_exchange_token")) return ok({ access_token: "long", expires_in: 5184000 });
    if (String(url).includes("/me?")) return ok({ username: "chezlou", account_type: "BUSINESS", followers_count: 1200 });
    if (String(url).includes("/me/media")) return ok({ data: [{ id: "m1", caption: "Le magret #resto", media_type: "VIDEO", media_product_type: "REELS", timestamp: "2026-10-27T18:00:00+0000", permalink: "https://www.instagram.com/reel/m1/" }, { id: "m2", caption: "Photo", media_type: "IMAGE", media_product_type: "FEED", timestamp: "2026-10-26T10:00:00+0000" }] });
    if (String(url).includes("/m1/insights")) return ok({ data: [{ name: "views", values: [{ value: 2400 }] }, { name: "likes", values: [{ value: 80 }] }] });
    if (String(url).includes("/m2/insights")) return ok({ data: [{ name: "reach", total_value: { value: 300 } }] });
    throw new Error(`unexpected ${url}`);
  };
  const cb = fakeHttp("GET", `/api/instagram/callback?code=abc%23_&state=${state}`, {});
  await handleCallback(cb.req, cb.res, { env, store: s, fetchImpl, now: now + 60_000 });
  assert.equal(cb.res.headers.location, "madastudio://instagram?ok=1");
  assert.ok(!JSON.stringify(await s.get(`mada:ig:${DEVICE}`)).includes("long"));

  const g = fakeHttp();
  await handleInstagram(g.req, g.res, null, { env, store: s, fetchImpl, now: now + 120_000 });
  const out = g.body();
  assert.equal(out.connecte, true);
  assert.equal(out.compte.nom, "chezlou");
  assert.equal(out.posts[0].vues, 2400);
  assert.equal(out.posts[0].type, "reel");
  assert.equal(out.posts[1].portee, 300);
  assert.ok(calls.some(u => u.includes("access_token=long")));

  // Cached for six hours: no new call.
  const n = calls.length, again = fakeHttp();
  await handleInstagram(again.req, again.res, null, { env, store: s, fetchImpl, now: now + 3600_000 });
  assert.equal(calls.length, n);

  const d = fakeHttp("DELETE");
  await handleInstagram(d.req, d.res, null, { env, store: s, now });
  const after = fakeHttp();
  await handleInstagram(after.req, after.res, null, { env, store: s, now });
  assert.equal(after.body().connecte, false);
});

test("a refused or forged return goes back to the app with the reason", async () => {
  const a = fakeHttp("GET", "/api/instagram/callback?error=access_denied", {});
  await handleCallback(a.req, a.res, { env, store: testing.memoryStore() });
  assert.equal(a.res.headers.location, "madastudio://instagram?erreur=refus");
  const b = fakeHttp("GET", "/api/instagram/callback?code=x&state=faux", {});
  await handleCallback(b.req, b.res, { env, store: testing.memoryStore() });
  assert.equal(b.res.headers.location, "madastudio://instagram?erreur=lien");
});

test("a screenshot of the statistics becomes one post, without inventing figures", async () => {
  testing.reset();
  const a = fakeHttp("POST");
  await handleInstagram(a.req, a.res, { action: "capture", image: { type: "image/png", data: "iVBOR" } }, {
    env: {}, callJson: async ({ content }) => { assert.equal(content[0].type, "image"); return { lisible: true, type: "reel", vues: 2400, portee: 1800, likes: 90, commentaires: null, partages: 3, enregistrements: 7, date: "2026-10-20" }; },
  });
  const out = a.body();
  assert.equal(out.lisible, true, JSON.stringify(out));
  assert.equal(out.post.vues, 2400);
  assert.equal(out.post.commentaires, null);
  assert.equal(out.post.source, "capture");
  assert.equal(out.post.at, "2026-10-20T12:00:00.000Z");
});
