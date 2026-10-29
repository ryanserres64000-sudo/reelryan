// The sign-up interview, worded for each person: POST /api/entretien. The app sends the profile, the
// answers so far and the next question it chose (core/interview.ts); the small model reacts to the last
// answer and rewords the question. One short call per card, nothing stored; the app keeps its own
// wording when this fails or takes too long.
import { callJson, MODELS } from "../prototype/lib/ai.mjs";
import { PROFILS, QUESTIONS } from "../core/brand.ts";
import { ENTRETIEN_SCHEMA, ENTRETIEN_SYSTEM, entretienContent, sanitizeWording } from "../core/interview.ts";
import { checkAccess, errorCode } from "./claude.js";

const MODEL = process.env.RR_ENTRETIEN_MODEL || MODELS.etiquetage;

// About twenty cards per sign-up: its own limit per address, so the interview does not use up the
// creations' one (lib/claude.js, MAX_PER_HOUR).
const hits = new Map(), PER_HOUR = 80;
function overLimit(req, now = Date.now()) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "anon").split(",")[0].trim();
  const list = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  const over = list.length >= PER_HOUR;
  if (!over) list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return over;
}

class BadRequest extends Error {}
const fail = msg => { throw new BadRequest(msg); };
const text = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function parseRequest(body) {
  if (!body || typeof body !== "object") fail("Requête vide.");
  if (!PROFILS.includes(body.profil)) fail("Profil inconnu.");
  const q = QUESTIONS.find(x => x.id === body.prochaine?.id);
  if (!q) fail("Question inconnue.");
  const titre = text(body.prochaine.titre, 120), pourquoi = text(body.prochaine.pourquoi, 200);
  if (!titre) fail("Question vide.");
  const history = (Array.isArray(body.historique) ? body.historique : []).slice(-24)
    .map(h => ({ question: text(h?.question, 120), reponse: text(h?.reponse, 300) })).filter(h => h.question);
  const options = (Array.isArray(body.prochaine.options) ? body.prochaine.options : []).map(o => text(o, 60)).filter(Boolean).slice(0, 10);
  return { profil: text(body.libelle_profil, 60) || body.profil, history, next: { id: q.id, kind: q.kind, titre, pourquoi, options } };
}

export async function runEntretien(req, { deps = { callJson }, signal } = {}) {
  const ledger = [];
  const raw = await deps.callJson({ model: MODEL, system: ENTRETIEN_SYSTEM, content: [{ type: "text", text: entretienContent(req.profil, req.history, req.next) }], schema: ENTRETIEN_SCHEMA, effort: "low", maxTokens: 1200, step: "entretien", ledger, signal });
  return { ...sanitizeWording(raw, req.next.kind), cout_usd: Math.round(ledger.reduce((t, l) => t + l.cout_usd, 0) * 10000) / 10000 };
}

const json = (res, status, payload) => {
  res.statusCode = status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
};

export async function handleEntretien(req, res, body, deps) {
  if (!deps && !process.env.ANTHROPIC_API_KEY) return json(res, 500, { error: "server_config", message: "ANTHROPIC_API_KEY manquante sur le serveur." });
  if (!checkAccess(req)) return json(res, 401, { error: "unauthorized", message: "Code d'accès incorrect." });
  if (overLimit(req)) return json(res, 429, { error: "rate_limited", message: "Trop de demandes." });
  let parsed;
  try { parsed = parseRequest(body); } catch (e) {
    if (e instanceof BadRequest) return json(res, 400, { error: "bad_request", message: e.message });
    throw e;
  }
  try {
    return json(res, 200, await runEntretien(parsed, { deps }));
  } catch (e) {
    console.error("entretien failed:", e.status, e.message);
    return json(res, 502, { error: errorCode(e) });
  }
}
