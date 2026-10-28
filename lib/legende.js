// The post's caption: POST /api/legende. Written by the AI from what the edit shows (its shots, the texts
// on screen, the intention) and the brand's voice, never a copy of the brief (Ryan's first test,
// 28 octobre 2026: « la légende doit être générée par l'IA, proposer un texte cohérent »). One short
// call to the large model, no images: the shot descriptions already come from them.
import { callJson, MODELS } from "../prototype/lib/ai.mjs";
import { checkAccess, errorCode, overLimit } from "./claude.js";

const MODEL = process.env.RR_LEGENDE_MODEL || MODELS.sonnet;

export const LEGENDE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["texte", "hashtags"],
  properties: {
    texte: { type: "string", description: "La légende complète, lignes séparées par \\n" },
    hashtags: { type: "array", items: { type: "string" }, description: "3 à 5 hashtags précis, sans le #" },
  },
};

export const LEGENDE_SYSTEM = `Tu écris la légende d'un Reel (Instagram, TikTok, YouTube Shorts) pour une marque, en français.
La personne a décrit son idée en une phrase pour le montage. Cette phrase est une consigne de travail, pas la légende : ne la recopie pas et ne la paraphrase pas.
Écris à partir de ce que la vidéo montre vraiment (les plans et les textes à l'écran) et de la voix de la marque.

Forme :
- Première ligne : une accroche de 80 caractères au plus, concrète, qui donne envie de lire la suite.
- Puis 1 à 3 lignes courtes : un détail vrai tiré des plans, le contexte (lieu, date, ambiance) s'il est connu.
- Dernière ligne : l'appel à l'action demandé, sinon une invitation simple et naturelle.
- Parle comme la marque (« je » ou « nous » selon son carnet), tutoie ou vouvoie comme elle.
- 0 ou 1 emoji, seulement si le ton de la marque s'y prête.

Interdit : « plongez », « découvrez », « incroyable », « inoubliable », « magique », « n'hésitez pas », « un moment hors du temps », les superlatifs vides, les points d'exclamation en série, inventer un prix, une date, une adresse ou un nom qui n'est pas donné.
Hashtags : 3 à 5, précis (lieu, métier, événement, nom de la marque), jamais #love #instagood #reels #fyp.`;

class BadRequest extends Error {}
const fail = msg => { throw new BadRequest(msg); };
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v, n, max) => (Array.isArray(v) ? v.map(x => text(x, max)).filter(Boolean).slice(0, n) : []);

export function parseRequest(body) {
  if (!body || typeof body !== "object") fail("Requête vide.");
  const t = body.timeline && typeof body.timeline === "object" ? body.timeline : null;
  if (!t || !Array.isArray(t.plans) || !t.plans.length) fail("Montage vide.");
  return {
    brief: text(body.brief, 1000),
    style: body.style && typeof body.style === "object" ? JSON.stringify(body.style).slice(0, 3000) : "",
    precedente: text(body.precedente, 2200),
    video: {
      titre: text(t.titre, 120), intention: text(t.intention, 400),
      plans: t.plans.slice(0, 40).map(p => text(p?.raison, 160)).filter(Boolean),
      textes: (Array.isArray(t.textes) ? t.textes : []).slice(0, 20).map(x => [text(x?.texte, 120), text(x?.accent, 40)].filter(Boolean).join(" ")).filter(Boolean),
      duree: typeof t.duree === "number" ? Math.round(t.duree) : null,
    },
    plateformes: list(body.plateformes, 3, 10),
  };
}

const clean = h => h.replace(/^#+/, "").replace(/\s+/g, "");
const BANNED_TAGS = new Set(["love", "instagood", "reels", "reel", "fyp", "foryou", "viral", "explore"]);

export async function runLegende(req, { deps = { callJson }, signal } = {}) {
  const ledger = [];
  const v = req.video;
  const lines = [
    `L'idée de la personne (consigne, pas la légende) : ${req.brief || "—"}`,
    `Ce que montre la vidéo${v.duree ? ` (${v.duree} s)` : ""} : ${v.titre}${v.intention ? `. ${v.intention}` : ""}`,
    v.plans.length ? `Les plans, dans l'ordre :\n${v.plans.map((p, i) => `${i + 1}. ${p}`).join("\n")}` : "",
    v.textes.length ? `Textes à l'écran : ${v.textes.map(x => `« ${x} »`).join(", ")}` : "",
    req.style ? `La marque (carnet et règles de style) : ${req.style}` : "",
    req.precedente ? `Proposition précédente, que la personne veut remplacer : écris autre chose, avec une autre accroche.\n${req.precedente}` : "",
  ].filter(Boolean);
  const raw = await deps.callJson({ model: MODEL, system: LEGENDE_SYSTEM, content: [{ type: "text", text: lines.join("\n\n") }], schema: LEGENDE_SCHEMA, effort: "low", maxTokens: 2000, step: "legende", ledger, signal });
  const texte = text(raw?.texte, 2200);
  if (!texte) throw new Error("legende vide");
  const hashtags = [...new Set(list(raw?.hashtags, 10, 60).map(clean).filter(h => h.length > 1 && !BANNED_TAGS.has(h.toLowerCase())))].slice(0, 5).map(h => `#${h}`);
  return { legende: { texte, hashtags }, cout_usd: Math.round(ledger.reduce((s, l) => s + l.cout_usd, 0) * 10000) / 10000 };
}

const json = (res, status, payload) => {
  res.statusCode = status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
};

export async function handleLegende(req, res, body, deps) {
  if (!deps && !process.env.ANTHROPIC_API_KEY) return json(res, 500, { error: "server_config", message: "ANTHROPIC_API_KEY manquante sur le serveur." });
  if (!checkAccess(req)) return json(res, 401, { error: "unauthorized", message: "Code d'accès incorrect." });
  if (overLimit(req)) return json(res, 429, { error: "rate_limited", message: "Trop de demandes." });
  let parsed;
  try { parsed = parseRequest(body); } catch (e) {
    if (e instanceof BadRequest) return json(res, 400, { error: "bad_request", message: e.message });
    throw e;
  }
  try { return json(res, 200, await runLegende(parsed, { deps })); } catch (e) {
    console.error("legende failed:", e.status, e.message);
    return json(res, 502, { error: errorCode(e) });
  }
}
