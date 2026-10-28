import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { X509Certificate, createPrivateKey, sign } from "node:crypto";
import { verifyJws, rightOf, handleAchat, handleNotification, APPLE_ROOT_G3 } from "../apple.js";
import { isPro, take, testing } from "../quota.js";

const fx = f => readFileSync(new URL(`./fixtures/apple/${f}`, import.meta.url), "utf8");
const der = p => p.replace(/-----[^-]+-----|\s/g, "");
const x5c = ["leaf.pem", "inter.pem", "root.pem"].map(f => der(fx(f)));
const ROOT = new X509Certificate(fx("root.pem")).fingerprint256;
const key = createPrivateKey(fx("leaf.key"));
const jws = (payload, chain = x5c) => {
  const h = Buffer.from(JSON.stringify({ alg: "ES256", x5c: chain })).toString("base64url");
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${h}.${p}.${sign("sha256", Buffer.from(`${h}.${p}`), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
};
const DEV = "3f2b8c1e-5a4d-4e6f-9a1b-2c3d4e5f6a7b";
const now = new Date("2026-11-01T12:00:00Z");
const tx = (extra = {}) => ({ bundleId: "fr.mada.app", productId: "mada.pro.mois", expiresDate: now.getTime() + 86400000, originalTransactionId: "2000001", appAccountToken: DEV.toUpperCase(), environment: "Sandbox", ...extra });
const env = { MADA_APPLE_BUNDLE_ID: "fr.mada.app", MADA_APPLE_ROOT_FINGERPRINT: ROOT };
const req = () => ({ headers: { "x-mada-device": DEV }, socket: {} });
const call = async (handler, body, s) => { let out; const res = { setHeader() {}, end: b => { out = JSON.parse(b); } }; await handler(req(), res, body, { env, s, now }); return { status: res.statusCode, out }; };

test("un JWS signé par la chaîne attendue est lu ; toute retouche est refusée", () => {
  assert.equal(verifyJws(jws(tx()), { root: ROOT, now }).productId, "mada.pro.mois");
  assert.throws(() => verifyJws(jws(tx()), { now }), /racine inconnue/); // pas la vraie racine Apple
  const [h, p, s] = jws(tx()).split(".");
  const forged = Buffer.from(JSON.stringify(tx({ expiresDate: 9e15 }))).toString("base64url");
  assert.throws(() => verifyJws(`${h}.${forged}.${s}`, { root: ROOT, now }), /signature/);
  assert.throws(() => verifyJws(jws(tx(), [x5c[0], x5c[0], x5c[2]]), { root: ROOT, now }), /chaîne|Apple/);
  assert.throws(() => verifyJws("abc", { root: ROOT, now }), /mal formé/);
  assert.match(APPLE_ROOT_G3, /^63:34:3A/);
});

test("droit Pro : bonne app, offre connue, ni remboursé ni expiré", () => {
  const o = { bundleId: "fr.mada.app", products: ["mada.pro.mois"], now };
  assert.equal(rightOf(tx(), o).ok, true);
  assert.equal(rightOf(tx({ bundleId: "autre" }), o).raison, "app");
  assert.equal(rightOf(tx({ productId: "x" }), o).raison, "produit");
  assert.equal(rightOf(tx({ revocationDate: 1 }), o).raison, "rembourse");
  assert.equal(rightOf(tx({ expiresDate: now.getTime() - 1 }), o).raison, "expire");
});

test("/api/achat : Pro vérifié pour cet appareil seulement, l'en-tête de l'app ne suffit plus", async () => {
  const s = testing.memoryStore();
  const { DEFAULT_CONFIG } = await import("../../core/plans.ts");
  const produit = DEFAULT_CONFIG.offres[0].produit;
  assert.equal(await isPro({ headers: { "x-mada-device": DEV, "x-mada-pro": "1" } }, { env, s, now }), false);
  let r = await call(handleAchat, { jws: [jws(tx({ productId: produit, appAccountToken: "00000000-0000-4000-8000-000000000000" }))] }, s);
  assert.deepEqual(r.out, { pro: false, raison: "autre_appareil" });
  r = await call(handleAchat, { jws: [jws(tx({ productId: produit }))] }, s);
  assert.equal(r.out.pro, true);
  assert.equal(await isPro(req(), { env, s, now }), true);
  // Pro: no free-plan limit on the quota.
  for (let i = 0; i < 5; i++) assert.equal((await take(req(), "montage", { env, s, now })).ok, true);
  assert.equal((await call(handleAchat, { jws: [] }, s)).out.raison, "aucun_achat");
  const missing = await (async () => { let out; const res = { setHeader() {}, end: b => { out = JSON.parse(b); } }; await handleAchat(req(), res, {}, { env: {}, s, now }); return res.statusCode; })();
  assert.equal(missing, 500);
});

test("notification Apple : un remboursement coupe Pro tout de suite", async () => {
  const s = testing.memoryStore();
  const { DEFAULT_CONFIG } = await import("../../core/plans.ts");
  const produit = DEFAULT_CONFIG.offres[0].produit;
  await call(handleAchat, { jws: [jws(tx({ productId: produit }))] }, s);
  const refund = jws({ notificationType: "REFUND", data: { bundleId: "fr.mada.app", signedTransactionInfo: jws(tx({ productId: produit, revocationDate: now.getTime(), appAccountToken: undefined })) } });
  const r = await call(handleNotification, { signedPayload: refund }, s);
  assert.deepEqual(r.out, { pro: false, type: "REFUND" });
  assert.equal(await isPro(req(), { env, s, now }), false);
  assert.equal((await call(handleNotification, { signedPayload: "faux" }, s)).status, 400);
});
