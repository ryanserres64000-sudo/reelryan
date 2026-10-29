import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { checkAppleToken, handleAuth, handleAuthCallback, methods, sign, verify } from "../auth.js";
import { makeState } from "../instagram.js";
import { testing } from "../quota.js";

const DEVICE = "6f1c2a4e-0b7d-4c3e-9a1f-2b3c4d5e6f70";
const env = { MADA_AUTH_SECRET: "s3cret", MADA_TOKEN_KEY: "k", MADA_APPLE_BUNDLE_ID: "com.madastudio.app", GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsec", MADA_AUTH_DEV: "1" };
function http(method, { headers = {}, url = "/api/auth" } = {}) {
  const res = new EventEmitter();
  Object.assign(res, { statusCode: 0, headers: {}, body: "", setHeader(k, v) { this.headers[k] = v; }, end(c) { if (c) this.body += c; } });
  return { req: { method, url, headers: { "x-mada-device": DEVICE, ...headers }, socket: { remoteAddress: "t" } }, res, out: () => (res.body ? JSON.parse(res.body) : null) };
}

test("sessions are signed, last a year and cannot be forged", () => {
  const s = sign("email:abc", env, 0);
  assert.equal(verify(s, env, 1000), "email:abc");
  assert.equal(verify(s, env, 400 * 24 * 3600 * 1000), null);
  assert.equal(verify(s.replace(/.$/, c => (c === "A" ? "B" : "A")), env, 1000), null);
  assert.equal(verify(s, { MADA_AUTH_SECRET: "other" }, 1000), null);
});

test("the server says which ways in it can offer", () => {
  assert.deepEqual(methods({}), { apple: false, google: false, email: false });
  assert.deepEqual(methods(env), { apple: true, google: true, email: true });
  assert.equal(methods({ ...env, MADA_AUTH_DEV: "", RESEND_API_KEY: "r", MADA_EMAIL_FROM: "a@b.fr" }).email, false, "un code e-mail a besoin d'un stockage durable");
});

test("e-mail: a code, five tries, then a session tied to the account and the iPhone", async () => {
  const store = testing.memoryStore();
  let h = http("POST");
  await handleAuth(h.req, h.res, { action: "email", email: " Ryan@Exemple.FR " }, { env, store, now: 0 });
  const { code } = h.out();
  assert.match(code, /^\d{6}$/);
  h = http("POST");
  await handleAuth(h.req, h.res, { action: "code", email: "ryan@exemple.fr", code: code === "000000" ? "111111" : "000000" }, { env, store, now: 1 });
  assert.equal(h.res.statusCode, 400);
  h = http("POST");
  await handleAuth(h.req, h.res, { action: "code", email: "ryan@exemple.fr", code }, { env, store, now: 2 });
  const { session, compte } = h.out();
  assert.equal(compte.email, "ryan@exemple.fr");
  assert.equal(await store.get(`mada:appareil:${DEVICE}`), compte.id);
  h = http("POST");
  await handleAuth(h.req, h.res, { action: "code", email: "ryan@exemple.fr", code }, { env, store, now: 3 });
  assert.equal(h.res.statusCode, 400, "un code ne sert qu'une fois");
  h = http("GET", { url: "/api/auth?moi=1", headers: { authorization: `Bearer ${session}` } });
  await handleAuth(h.req, h.res, null, { env, store, now: 4 });
  assert.equal(h.out().compte.id, compte.id);
  h = http("DELETE", { headers: { authorization: `Bearer ${session}` } });
  await handleAuth(h.req, h.res, null, { env, store, now: 5 });
  assert.equal(await store.get(`mada:user:${compte.id}`), null);
  assert.equal(await store.get(`mada:appareil:${DEVICE}`), null);
  h = http("POST");
  await handleAuth(h.req, h.res, { action: "email", email: "pas-une-adresse" }, { env, store });
  assert.equal(h.res.statusCode, 400);
});

test("Apple: only a token signed by Apple, for this app, still valid", async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const b = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const token = (claims, key = privateKey) => {
    const data = `${b({ alg: "RS256", kid: "k1" })}.${b(claims)}`;
    return `${data}.${crypto.sign("RSA-SHA256", Buffer.from(data), key).toString("base64url")}`;
  };
  const keyOf = async kid => (kid === "k1" ? publicKey : null);
  const good = { iss: "https://appleid.apple.com", aud: "com.madastudio.app", exp: 100, sub: "001.abc", email: "x@privaterelay.appleid.com" };
  assert.deepEqual(await checkAppleToken(token(good), env, fetch, 1000, keyOf), { sub: "001.abc", email: "x@privaterelay.appleid.com" });
  assert.equal(await checkAppleToken(token({ ...good, aud: "autre.app" }), env, fetch, 1000, keyOf), null);
  assert.equal(await checkAppleToken(token(good), env, fetch, 200_000, keyOf), null);
  const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  assert.equal(await checkAppleToken(token(good, other), env, fetch, 1000, keyOf), null);
  const store = testing.memoryStore(), h = http("POST");
  await handleAuth(h.req, h.res, { action: "apple", jeton: token(good), nom: "Ryan" }, { env, store, now: 1000, appleKey: keyOf });
  assert.equal(h.out().compte.nom, "Ryan");
  assert.equal(h.out().compte.id, "apple:001.abc");
});

test("Google: the page, then the callback opens the session and goes back to the app", async () => {
  const store = testing.memoryStore();
  let h = http("POST");
  await handleAuth(h.req, h.res, { action: "google" }, { env, store, now: 0 });
  const url = new URL(h.out().url);
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  const b = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const fetchImpl = async () => ({ ok: true, json: async () => ({ id_token: `${b({ alg: "RS256" })}.${b({ iss: "https://accounts.google.com", aud: "gid", exp: 100, sub: "g1", email: "r@gmail.com", email_verified: true, given_name: "Ryan" })}.sig` }) });
  h = http("GET", { url: `/api/auth/callback?code=c&state=${makeState(`login~${DEVICE}`, env, 0)}` });
  await handleAuthCallback(h.req, h.res, { env, store, now: 1000, fetchImpl });
  const back = new URL(h.res.headers.location.replace("madastudio://", "https://app/"));
  assert.equal(verify(back.searchParams.get("session"), env, 2000), "google:g1");
  assert.equal(await store.get(`mada:appareil:${DEVICE}`), "google:g1");
  h = http("GET", { url: "/api/auth/callback?error=access_denied" });
  await handleAuthCallback(h.req, h.res, { env, store });
  assert.match(h.res.headers.location, /erreur=refus/);
});
