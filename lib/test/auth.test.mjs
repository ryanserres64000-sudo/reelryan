import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { appleClientSecret, checkAppleToken, handleAuth, handleAuthCallback, methods, sign, verify } from "../auth.js";
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

test("Apple: the refresh token is kept sealed at sign-in and revoked when the account is deleted", async () => {
  const rsa = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }), ec = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const b = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const data = `${b({ alg: "RS256", kid: "k1" })}.${b({ iss: "https://appleid.apple.com", aud: "com.madastudio.app", exp: 100, sub: "001.rev" })}`;
  const jeton = `${data}.${crypto.sign("RSA-SHA256", Buffer.from(data), rsa.privateKey).toString("base64url")}`;
  const keyOf = async kid => (kid === "k1" ? rsa.publicKey : null);
  const pem = ec.privateKey.export({ type: "pkcs8", format: "pem" }).replace(/\n/g, "\\n");
  const full = { ...env, MADA_TOKEN_KEY: "x".repeat(32), MADA_APPLE_KEY_ID: "KEY1", MADA_APPLE_TEAM_ID: "X9RNXY8RFF", MADA_APPLE_SIGNIN_KEY: pem };
  // The client secret is an ES256 token Apple can check with the public half of the key.
  const [h64, p64, sig] = appleClientSecret(full, 1000).split(".");
  assert.ok(crypto.verify("SHA256", Buffer.from(`${h64}.${p64}`), { key: ec.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(sig, "base64url")));
  assert.equal(JSON.parse(Buffer.from(p64, "base64url")).sub, "com.madastudio.app");
  const calls = [];
  const f = async (url, o) => {
    const form = new URLSearchParams(o.body); calls.push([url, Object.fromEntries(form)]);
    return url.endsWith("/auth/token") ? { ok: true, json: async () => ({ refresh_token: "rt-1" }) } : { ok: true, json: async () => ({}) };
  };
  const store = testing.memoryStore();
  let h = http("POST");
  await handleAuth(h.req, h.res, { action: "apple", jeton, code: "c-1" }, { env: full, store, now: 1000, appleKey: keyOf, fetchImpl: f });
  const session = h.out().session;
  assert.ok(!JSON.stringify(await store.get("mada:user:apple:001.rev")).includes("rt-1"), "le jeton d'Apple est scellé");
  h = http("DELETE", { headers: { authorization: `Bearer ${session}` } });
  await handleAuth(h.req, h.res, null, { env: full, store, now: 2000, fetchImpl: f });
  assert.equal(h.out().apple_revoque, true);
  assert.deepEqual(calls.map(c => c[0]), ["https://appleid.apple.com/auth/token", "https://appleid.apple.com/auth/revoke"]);
  assert.equal(calls[1][1].token, "rt-1");
});

test("the App Store review account signs in with its fixed code, without any e-mail", async () => {
  const demoEnv = { ...env, MADA_AUTH_DEV: "0", RESEND_API_KEY: "r", MADA_EMAIL_FROM: "a@b.fr", UPSTASH_REDIS_REST_URL: "u", UPSTASH_REDIS_REST_TOKEN: "t", MADA_DEMO_EMAIL: "Revue@MadaStudio.fr", MADA_DEMO_CODE: "246810" };
  const store = testing.memoryStore(), f = async () => { throw new Error("aucun e-mail"); };
  let h = http("POST");
  await handleAuth(h.req, h.res, { action: "email", email: "revue@madastudio.fr" }, { env: demoEnv, store, fetchImpl: f });
  assert.deepEqual(h.out(), { envoye: true });
  h = http("POST");
  await handleAuth(h.req, h.res, { action: "code", email: "revue@madastudio.fr", code: "246810" }, { env: demoEnv, store });
  assert.ok(h.out().session);
});
