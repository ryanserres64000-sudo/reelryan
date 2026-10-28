// AI retouche of an edit: POST /api/retouche. Only what plain rules on the phone could not understand
// comes here (core/corrections.ts): the request, the current timeline, the rush lengths and what the
// person locked by hand. One call to the large model returns the corrected timeline; the phone then
// puts the locked shots and texts back (core/edit.ts keepLocked). Étude, ch. 5 §6 ; ch. 4 top 5 n°2.
import { callJson, DIRECTOR_SYSTEM, MODELS } from "../prototype/lib/ai.mjs";
import { AI_TIMELINE_SCHEMA, sanitizeTimeline } from "../core/timeline.ts";
import { checkAccess, errorCode, overLimit } from "./claude.js";

const MODEL = process.env.RR_RETOUCHE_MODEL || MODELS.sonnet;
const RETOUCHE_SYSTEM = `${DIRECTOR_SYSTEM}

Cette fois, tu retouches un montage existant à la demande de la personne. Change seulement ce qu'elle demande, garde tout le reste à l'identique. Les plans et textes marqués « verrouillé » ont été réglés à la main : recopie-les exactement, à leur place.
Si la demande est impossible avec ses rushes (un plan qu'elle n'a pas filmé), ne l'invente pas : laisse le montage tel quel et explique-le dans « relecture.corrections » en une phrase (« Je n'ai pas de plan de ta vitrine : ajoute-en un »).
Dans « relecture.corrections », écris ce que tu as changé, en phrases courtes adressées à la personne.`;

class BadRequest extends Error {}
const fail = msg => { throw new BadRequest(msg); };
const isNum = v => typeof v === "number" && Number.isFinite(v);

export function parseRequest(body) {
  if (!body || typeof body !== "object") fail("Requête vide.");
  const demande = typeof body.demande === "string" ? body.demande.trim().slice(0, 500) : "";
  if (!demande) fail("La demande est vide.");
  const clips = {};
  for (const r of Array.isArray(body.rushes) ? body.rushes.slice(0, 25) : []) {
    if (r && typeof r.id === "string" && /^[\w-]{1,40}$/.test(r.id) && isNum(r.duree) && r.duree > 0) clips[r.id] = { duration: r.duree };
  }
  if (!Object.keys(clips).length) fail("Il manque les rushes.");
  if (!body.timeline || typeof body.timeline !== "object" || !Array.isArray(body.timeline.plans)) fail("Timeline absente.");
  if (JSON.stringify(body.timeline).length > 60_000) fail("Timeline trop longue.");
  const ints = v => (Array.isArray(v) ? v.filter(Number.isInteger).slice(0, 50) : []);
  const verrous = { plans: ints(body.verrous?.plans), textes: ints(body.verrous?.textes) };
  const style = body.style && typeof body.style === "object" && JSON.stringify(body.style).length <= 8000 ? body.style : {};
  return { demande, clips, timeline: body.timeline, verrous, style, brief: typeof body.brief === "string" ? body.brief.slice(0, 2000) : "" };
}

export async function runRetouche(req, { deps = { callJson }, signal } = {}) {
  const ledger = [];
  const t = req.timeline;
  const marked = {
    ...t,
    plans: t.plans.map((p, i) => ({ ...p, ...(req.verrous.plans.includes(i) ? { verrouille: true } : {}) })),
    textes: (t.textes || []).map((x, i) => ({ ...x, ...(req.verrous.textes.includes(i) ? { verrouille: true } : {}) })),
  };
  const content = [{ type: "text", text: `Rushes (durée en secondes) : ${Object.entries(req.clips).map(([id, c]) => `${id} ${c.duration}`).join(", ")}
Style de la personne : ${JSON.stringify({ ...req.style, corrections: undefined })}
Règles apprises : ${(req.style.corrections || []).join(" ; ") || "aucune"}

Montage actuel :
${JSON.stringify({ titre: marked.titre, intention: marked.intention, variante: marked.variante, plans: marked.plans, textes: marked.textes, sous_titres: marked.sous_titres, legende: marked.legende }, null, 1)}

Demande : ${req.demande}` }];
  const raw = await deps.callJson({ model: MODEL, system: RETOUCHE_SYSTEM, content, schema: AI_TIMELINE_SCHEMA, effort: "low", maxTokens: 16000, fallback: true, step: "retouche", ledger, signal });
  const out = sanitizeTimeline({ ...raw, musique: t.musique, charte: t.charte, exports: t.exports }, req.clips, { brief: req.brief, maxDuration: 180 });
  return { ...out, cout_usd: Math.round(ledger.reduce((s, l) => s + l.cout_usd, 0) * 10000) / 10000 };
}

const json = (res, status, payload) => {
  res.statusCode = status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
};

export async function handleRetouche(req, res, body, deps) {
  if (!deps && !process.env.ANTHROPIC_API_KEY) return json(res, 500, { error: "server_config", message: "ANTHROPIC_API_KEY manquante sur le serveur." });
  if (!checkAccess(req)) return json(res, 401, { error: "unauthorized", message: "Code d'accès incorrect." });
  if (overLimit(req)) return json(res, 429, { error: "rate_limited", message: "Trop de demandes." });
  let parsed;
  try { parsed = parseRequest(body); } catch (e) {
    if (e instanceof BadRequest) return json(res, 400, { error: "bad_request", message: e.message });
    throw e;
  }
  try {
    return json(res, 200, await runRetouche(parsed, { deps }));
  } catch (e) {
    console.error("retouche failed:", e.status, e.message);
    return json(res, 502, { error: /refusé/.test(e.message || "") ? "refused" : /plan/.test(e.message || "") ? "invalid_json" : errorCode(e) });
  }
}
