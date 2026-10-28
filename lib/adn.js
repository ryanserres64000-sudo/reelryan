// Brand DNA at sign-up: POST /api/adn. The phone sends the profile, the questionnaire answers, the
// colours it read from the logo and, if there is one, the logo itself at 256 px. One call to the large
// model writes the carnet ADN, checked by core/brand.ts, then reused by every edit without a new call
// (étude, ch. 5 §8 ; Ryan, 28 octobre). Nothing is stored on the server.
import { callJson, MODELS } from "../prototype/lib/ai.mjs";
import { DNA_SCHEMA, DNA_SYSTEM, PROFILS, QUESTIONS, dnaContent, isHex, sanitizeDna } from "../core/brand.ts";
import { checkAccess, errorCode, overLimit } from "./claude.js";

const MODEL = process.env.RR_ADN_MODEL || MODELS.sonnet;
const MAX_LOGO_CHARS = 120_000;

class BadRequest extends Error {}
const fail = msg => { throw new BadRequest(msg); };
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function parseRequest(body) {
  if (!body || typeof body !== "object") fail("Requête vide.");
  if (!PROFILS.includes(body.profil)) fail("Profil inconnu.");
  const answers = {};
  const given = body.reponses && typeof body.reponses === "object" ? body.reponses : {};
  for (const q of QUESTIONS) {
    const v = given[q.id];
    if (Array.isArray(v)) { const l = v.map(x => text(x, 60)).filter(Boolean).slice(0, 8); if (l.length) answers[q.id] = l; }
    else if (text(v, q.max || 120)) answers[q.id] = text(v, q.max || 120);
  }
  const kit = body.kit && typeof body.kit === "object" ? body.kit : {};
  const polices = kit.polices && typeof kit.polices === "object" ? kit.polices : {};
  const logo = typeof body.logo === "string" && body.logo ? body.logo : null;
  if (logo && (logo.length > MAX_LOGO_CHARS || !/^[A-Za-z0-9+/=]+$/.test(logo))) fail("Logo invalide.");
  return {
    profil: body.profil, answers, logo,
    labels: { profil: text(body.libelle_profil, 60) || body.profil },
    kit: { couleurs: (Array.isArray(kit.couleurs) ? kit.couleurs : []).filter(isHex).slice(0, 4), polices: { titres: text(polices.titres, 40), texte: text(polices.texte, 40) }, logo: !!logo },
  };
}

// `deps.callJson` is swapped in the tests.
export async function runAdn(req, { deps = { callJson }, signal } = {}) {
  const ledger = [];
  const content = [];
  if (req.logo) content.push({ type: "text", text: "Son logo :" }, { type: "image", source: { type: "base64", media_type: req.logo.startsWith("iVBOR") ? "image/png" : "image/jpeg", data: req.logo } });
  content.push({ type: "text", text: dnaContent(req.profil, req.answers, req.kit, req.labels) });
  const raw = await deps.callJson({ model: MODEL, system: DNA_SYSTEM, content, schema: DNA_SCHEMA, effort: "low", maxTokens: 8000, fallback: true, step: "adn", ledger, signal });
  return { adn: sanitizeDna(raw, req.profil, req.answers, req.kit), cout_usd: Math.round(ledger.reduce((t, l) => t + l.cout_usd, 0) * 10000) / 10000 };
}

const json = (res, status, payload) => {
  res.statusCode = status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
};

export async function handleAdn(req, res, body, deps) {
  if (!deps && !process.env.ANTHROPIC_API_KEY) return json(res, 500, { error: "server_config", message: "ANTHROPIC_API_KEY manquante sur le serveur." });
  if (!checkAccess(req)) return json(res, 401, { error: "unauthorized", message: "Code d'accès incorrect." });
  if (overLimit(req)) return json(res, 429, { error: "rate_limited", message: "Trop de demandes." });
  let parsed;
  try { parsed = parseRequest(body); } catch (e) {
    if (e instanceof BadRequest) return json(res, 400, { error: "bad_request", message: e.message });
    throw e;
  }
  try {
    return json(res, 200, await runAdn(parsed, { deps }));
  } catch (e) {
    console.error("adn failed:", e.status, e.message);
    return json(res, 502, { error: /refusé/.test(e.message || "") ? "refused" : errorCode(e) });
  }
}
