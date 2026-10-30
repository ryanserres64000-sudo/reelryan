// The poster read by AI: POST /api/affiche (plan « éditeur pro et montages », étape 5). The phone sends
// the poster, reduced to about 1024 px; the small model copies what is written on it (core/poster.ts).
// One Haiku call, about 0,002 $, not counted as an edit; nothing is stored on the server.
import { callJson, MODELS } from "../prototype/lib/ai.mjs";
import { AFFICHE_SCHEMA, AFFICHE_SYSTEM, sanitizeAffiche } from "../core/poster.ts";
import { checkAccess, errorCode, overLimit } from "./claude.js";

const MODEL = process.env.RR_AFFICHE_MODEL || MODELS.etiquetage;
const MAX_IMAGE_CHARS = 1_400_000;

class BadRequest extends Error {}
const fail = msg => { throw new BadRequest(msg); };

export function parseRequest(body) {
  if (!body || typeof body !== "object") fail("Requête vide.");
  const image = typeof body.image === "string" ? body.image : "";
  if (!image || image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image)) fail("Affiche invalide.");
  const annee = Number.isInteger(body.annee) && body.annee >= 2024 && body.annee <= 2100 ? body.annee : new Date().getFullYear();
  return { image, annee };
}

// `deps.callJson` is swapped in the tests.
export async function runAffiche(req, { deps = { callJson }, signal } = {}) {
  const ledger = [];
  const content = [
    { type: "image", source: { type: "base64", media_type: req.image.startsWith("iVBOR") ? "image/png" : "image/jpeg", data: req.image } },
    { type: "text", text: `Lis cette affiche. Si l'année n'est pas écrite, c'est ${req.annee} (ou ${req.annee + 1} si la date est déjà passée).` },
  ];
  const raw = await deps.callJson({ model: MODEL, system: AFFICHE_SYSTEM, content, schema: AFFICHE_SCHEMA, effort: "low", maxTokens: 4000, step: "affiche", ledger, signal });
  return { affiche: sanitizeAffiche(raw), cout_usd: Math.round(ledger.reduce((t, l) => t + l.cout_usd, 0) * 10000) / 10000 };
}

const json = (res, status, payload) => {
  res.statusCode = status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
};

export async function handleAffiche(req, res, body, deps) {
  if (!deps && !process.env.ANTHROPIC_API_KEY) return json(res, 500, { error: "server_config", message: "ANTHROPIC_API_KEY manquante sur le serveur." });
  if (!checkAccess(req)) return json(res, 401, { error: "unauthorized", message: "Code d'accès incorrect." });
  if (overLimit(req)) return json(res, 429, { error: "rate_limited", message: "Trop de demandes." });
  let parsed;
  try { parsed = parseRequest(body); } catch (e) {
    if (e instanceof BadRequest) return json(res, 400, { error: "bad_request", message: e.message });
    throw e;
  }
  try {
    return json(res, 200, await runAffiche(parsed, { deps }));
  } catch (e) {
    console.error("affiche failed:", e.status, e.message);
    return json(res, 502, { error: /refusé/.test(e.message || "") ? "refused" : errorCode(e) });
  }
}
