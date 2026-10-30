import { test } from "node:test";
import assert from "node:assert/strict";
import { config, handleOffres, take, testing } from "../quota.js";
import { sign } from "../auth.js";
import { handleMontage } from "../montage.js";

const DEV = "3f2b8c1e-5d4a-4b7c-9e2f-1a2b3c4d5e6f";
const req = (h = {}) => ({ headers: { "x-mada-device": DEV, "x-forwarded-for": "1.2.3.4", ...h }, socket: {} });

test("each sign-up gets the free montages set on the server (1 by default), refunded when the AI fails", async () => {
  assert.equal(config({}).gratuit.montages, 1);
  const s = testing.memoryStore(), env = { MADA_FREE_MONTAGES: "3" };
  for (let i = 0; i < 3; i++) assert.ok((await take(req(), "montage", { env, s })).ok);
  const no = await take(req(), "montage", { env, s });
  assert.deepEqual([no.ok, no.status, no.body.raison], [false, 402, "gratuit_epuise"]);
  const s2 = testing.memoryStore();
  const q = await take(req(), "montage", { env, s: s2 });
  await q.refund();
  for (let i = 0; i < 3; i++) assert.ok((await take(req(), "montage", { env, s: s2 })).ok, "le montage raté est rendu");
  assert.equal(config({ MADA_FREE_MONTAGES: "1" }).gratuit.montages, 1);
  const s3 = testing.memoryStore();
  assert.ok((await take(req(), "montage", { env: { MADA_FREE_MONTAGES: "1" }, s: s3 })).ok);
  assert.equal((await take(req(), "montage", { env: { MADA_FREE_MONTAGES: "1" }, s: s3 })).ok, false);
});

test("no device id: allowed by default, refused in strict mode; one network cannot farm free uses", async () => {
  const s = testing.memoryStore();
  assert.ok((await take({ headers: {}, socket: {} }, "montage", { env: {}, s })).ok);
  assert.equal((await take({ headers: {}, socket: {} }, "montage", { env: { MADA_QUOTA: "strict" }, s })).status, 403);
  let refused = 0;
  for (let i = 0; i < 10; i++) {
    const d = `3f2b8c1e-5d4a-4b7c-9e2f-1a2b3c4d5e${String(i).padStart(2, "0")}`;
    const r = await take(req({ "x-mada-device": d }), "montage", { env: {}, s });
    if (!r.ok && r.status === 429) refused++;
  }
  assert.equal(refused, 4, "6 créations offertes par jour et par réseau");
});

test("the Upstash store speaks the REST protocol", async () => {
  const calls = [];
  const fake = async (url, o) => { calls.push(JSON.parse(o.body)); return { ok: true, json: async () => ({ result: calls.length === 1 ? 1 : "OK" }) }; };
  const s = testing.upstashStore("https://x.upstash.io", "tok", fake);
  assert.equal(await s.incr("k", 60), 1);
  assert.deepEqual(calls, [["INCR", "k"], ["EXPIRE", "k", 60]]);
});

test("the montage route refuses more than 90 s of rushes on the free plan, before any AI call", async () => {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, write() {}, on() {}, end(b) { this.body = b && JSON.parse(b); } };
  const body = { brief: "Menu", rushes: [{ id: "a", duree: 60 }, { id: "b", duree: 60 }], images: [{ rush: "a", temps: 1, data: "x" }] };
  let called = false;
  await handleMontage(req(), res, body, { callJson: async () => { called = true; return {}; } });
  assert.equal(res.statusCode, 402);
  assert.equal(called, false);
});

test("deleting the account wipes the usage but not the free uses already taken", async () => {
  const { handleCompte } = await import("../quota.js");
  const s = testing.memoryStore(), env = { MADA_PRO_HEADER: "1", MADA_FREE_MONTAGES: "3" };
  for (let i = 0; i < 3; i++) await take(req(), "montage", { env, s });
  await take(req({ "x-mada-pro": "1" }), "montage", { env, s });
  let out;
  const res = { setHeader() {}, end: b => { out = JSON.parse(b); } };
  await handleCompte(req(), res, { env, s });
  assert.equal(res.statusCode, 200);
  assert.ok(out.garde.length && out.supprime.length);
  const u = await s.get(`mada:u:${DEV}`);
  assert.equal(u.gratuit.montages, 3);
  assert.equal(u.pro.montages, 0);
  assert.equal((await take(req(), "montage", { env, s })).ok, false, "supprimer ne rend pas les essais");
});

test("switches on the server: AI off, a daily ceiling for the whole app, an account required", async () => {
  const s = testing.memoryStore();
  const off = await take(req(), "montage", { env: { MADA_IA: "off" }, s });
  assert.deepEqual([off.ok, off.status, off.body.error], [false, 503, "ia_coupee"]);
  const s2 = testing.memoryStore(), env = { MADA_PLAFOND_JOUR: "2", MADA_FREE_MONTAGES: "3" };
  assert.ok((await take(req(), "montage", { env, s: s2 })).ok);
  assert.ok((await take(req(), "montage", { env, s: s2 })).ok);
  const full = await take(req(), "montage", { env, s: s2 });
  assert.deepEqual([full.status, full.body.error], [503, "plafond_jour"]);
  const s3 = testing.memoryStore(), acc = { MADA_COMPTE_REQUIS: "1", MADA_AUTH_SECRET: "x".repeat(32) };
  assert.equal((await take(req(), "montage", { env: acc, s: s3 })).status, 401);
  assert.ok((await take(req({ authorization: `Bearer ${sign("u1", acc)}` }), "montage", { env: acc, s: s3 })).ok);
});

test("GET /api/offres?etat=1 says whether the counters last, without any secret", () => {
  let out;
  const res = { setHeader() {}, end: b => { out = JSON.parse(b); } };
  handleOffres({ url: "/api/offres?etat=1" }, res, { UPSTASH_REDIS_REST_URL: "https://x", UPSTASH_REDIS_REST_TOKEN: "secret-token" });
  assert.equal(out.compteurs, "upstash");
  assert.ok(!JSON.stringify(out).includes("secret-token"));
  handleOffres({ url: "/api/offres?etat=1" }, res, {});
  assert.deepEqual([out.compteurs, out.ia, out.plafond_jour], ["memoire", "ouverte", 300]);
});
