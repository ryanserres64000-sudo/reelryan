// Pro checked by the server, not taken on the app's word (étude, ch. 8 §5 ; CLAUDE.md, lot 8 « le
// serveur croit l'app sur x-mada-pro »). StoreKit 2 hands the app a JWS signed by Apple for each
// transaction; the server checks it here, with node:crypto only:
//   POST /api/achat                  { jws: [ ... ] } after a purchase, a restore or at launch.
//   POST /api/apple/notifications    App Store Server Notifications V2: renewals, refunds, expiries.
// A JWS is trusted when its x5c chain ends on Apple Root CA - G3 (pinned by SHA-256 fingerprint),
// each certificate is issued by the next one, the leaf and intermediate carry Apple's marker OIDs,
// and the ES256 signature verifies with the leaf key. Then the transaction must be for this app
// (MADA_APPLE_BUNDLE_ID), for an offer of core/plans.ts, not revoked, not expired, and bought with
// this device's id as appAccountToken (app/modules/mada-store).
import { X509Certificate, verify } from "node:crypto";
import { config, deviceOf, store } from "./quota.js";
export { isPro } from "./quota.js";

// Apple Root CA - G3, https://www.apple.com/certificateauthority/ (same value as the
// app-store-server-api library).
export const APPLE_ROOT_G3 = "63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79";
// DER of the marker OIDs: 1.2.840.113635.100.6.11.1 (leaf), 1.2.840.113635.100.6.2.1 (intermediate).
const LEAF_OID = Buffer.from("060a2a864886f76364060b01", "hex");
const INTER_OID = Buffer.from("060a2a864886f76364060201", "hex");

const b64url = s => Buffer.from(s, "base64url");
const pem = c => `-----BEGIN CERTIFICATE-----\n${c}\n-----END CERTIFICATE-----`;

// Returns the payload of an Apple-signed JWS, or throws.
export function verifyJws(token, { root = APPLE_ROOT_G3, now = new Date() } = {}) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("JWS mal formé");
  const header = JSON.parse(b64url(parts[0]).toString("utf8"));
  if (header.alg !== "ES256" || !Array.isArray(header.x5c) || header.x5c.length < 3) throw new Error("JWS : en-tête inattendu");
  const certs = header.x5c.map(c => new X509Certificate(pem(c)));
  for (const c of certs) if (!(new Date(c.validFrom) <= now && now <= new Date(c.validTo))) throw new Error("JWS : certificat hors validité");
  for (let i = 0; i < certs.length - 1; i++) {
    if (!certs[i].checkIssued(certs[i + 1]) || !certs[i].verify(certs[i + 1].publicKey)) throw new Error("JWS : chaîne rompue");
  }
  if (certs[certs.length - 1].fingerprint256 !== root) throw new Error("JWS : racine inconnue");
  if (!certs[0].raw.includes(LEAF_OID) || !certs[1].raw.includes(INTER_OID)) throw new Error("JWS : certificat non Apple");
  const ok = verify("sha256", Buffer.from(`${parts[0]}.${parts[1]}`), { key: certs[0].publicKey, dsaEncoding: "ieee-p1363" }, b64url(parts[2]));
  if (!ok) throw new Error("JWS : signature invalide");
  return JSON.parse(b64url(parts[1]).toString("utf8"));
}

// What a decoded transaction gives: an active Pro right, or why not.
export function rightOf(tx, { bundleId, products, now = new Date() }) {
  if (!tx || tx.bundleId !== bundleId) return { ok: false, raison: "app" };
  if (!products.includes(tx.productId)) return { ok: false, raison: "produit" };
  if (tx.revocationDate) return { ok: false, raison: "rembourse" };
  if (!tx.expiresDate || tx.expiresDate <= now.getTime()) return { ok: false, raison: "expire" };
  return { ok: true, expire: tx.expiresDate, produit: tx.productId, original: String(tx.originalTransactionId), env: tx.environment, compte: String(tx.appAccountToken || "").toLowerCase() };
}

const settings = env => ({ bundleId: env.MADA_APPLE_BUNDLE_ID, products: config(env).offres.map(o => o.produit), root: env.MADA_APPLE_ROOT_FINGERPRINT || APPLE_ROOT_G3 });

const json = (res, status, payload) => {
  res.statusCode = status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
};

export async function handleAchat(req, res, body, { env = process.env, s = store(env), now = new Date() } = {}) {
  const device = deviceOf(req), cfg = settings(env);
  if (!device) return json(res, 400, { error: "device", message: "Appareil non reconnu." });
  if (!cfg.bundleId) return json(res, 500, { error: "server_config", message: "MADA_APPLE_BUNDLE_ID manquant sur le serveur." });
  const list = (Array.isArray(body?.jws) ? body.jws : []).filter(j => typeof j === "string" && j.length < 20_000).slice(0, 10);
  let best = null, raison = list.length ? "invalide" : "aucun_achat";
  for (const j of list) {
    let tx;
    try { tx = verifyJws(j, { root: cfg.root, now }); } catch { continue; }
    const r = rightOf(tx, { ...cfg, now });
    if (!r.ok) { raison = r.raison; continue; }
    // Bought by another device: its appAccountToken is someone else's id.
    if (r.compte !== device) { raison = "autre_appareil"; continue; }
    if (!best || r.expire > best.expire) best = r;
  }
  if (!best) return json(res, 200, { pro: false, raison });
  await s.set(`mada:pro:${device}`, best);
  await s.set(`mada:orig:${best.original}`, device);
  return json(res, 200, { pro: true, expire: new Date(best.expire).toISOString(), produit: best.produit });
}

// Apple calls this URL (App Store Connect → App Information → App Store Server Notifications, V2).
export async function handleNotification(req, res, body, { env = process.env, s = store(env), now = new Date() } = {}) {
  const cfg = settings(env);
  let n, tx;
  try {
    n = verifyJws(body?.signedPayload, { root: cfg.root, now });
    tx = n.data?.signedTransactionInfo ? verifyJws(n.data.signedTransactionInfo, { root: cfg.root, now }) : null;
  } catch {
    return json(res, 400, { error: "signature" });
  }
  if (!tx || n.data?.bundleId !== cfg.bundleId) return json(res, 200, { ignore: true });
  const device = String(tx.appAccountToken || "").toLowerCase() || (await s.get(`mada:orig:${tx.originalTransactionId}`));
  if (!device) return json(res, 200, { ignore: true });
  const r = rightOf(tx, { ...cfg, now });
  // Renewal: a later expiry. Refund, revocation or expiry: the right ends now.
  await s.set(`mada:pro:${device}`, r.ok ? r : { expire: 0, raison: r.raison, original: String(tx.originalTransactionId) });
  return json(res, 200, { pro: r.ok, type: n.notificationType });
}
