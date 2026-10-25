// Encrypts social network tokens at rest (AES-256-GCM) and signs OAuth
// state, both with SOCIAL_TOKEN_KEY.
import crypto from "node:crypto";

const key = () => crypto.createHash("sha256").update(String(process.env.SOCIAL_TOKEN_KEY || "")).digest();
export const sealReady = () => String(process.env.SOCIAL_TOKEN_KEY || "").length >= 16;

export function seal(text) {
  if (text == null) return null;
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b => b.toString("base64url")).join(".");
}

export function unseal(box) {
  if (!box) return null;
  const [iv, tag, enc] = String(box).split(".").map(s => Buffer.from(s, "base64url"));
  const d = crypto.createDecipheriv("aes-256-gcm", key(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

export function signState(obj) {
  const body = Buffer.from(JSON.stringify(obj)).toString("base64url");
  const mac = crypto.createHmac("sha256", key()).update(body).digest("base64url");
  return body + "." + mac;
}

export function readState(s) {
  const [body, mac] = String(s || "").split(".");
  if (!body || !mac) return null;
  const want = crypto.createHmac("sha256", key()).update(body).digest("base64url");
  if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
  try { const o = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); return o.exp > Date.now() ? o : null; } catch { return null; }
}
