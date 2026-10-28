// AI edit for the iPhone app: POST /api/montage. The phone sends its brief, the list of rushes and
// 15 to 30 small keyframes already sorted on the device (étude, ch. 5 §2); the server tags them
// (small model), writes 2 or 3 variants (large model), reviews them, and streams back newline-
// delimited JSON: {"etape":"…"} per step, then {"resultat":{…}} or {"error":"code","message":"…"}.
// No video ever reaches the server and nothing is stored (étude, ch. 3 n°7, ch. 9).
import { callJson, decisionContent, DIRECTOR_SYSTEM, TAG_SCHEMA, TAG_SYSTEM, MODELS } from "../prototype/lib/ai.mjs";
import { sanitizeTimeline, variantsSchema, PLATEFORMES, VARIANTES } from "../core/timeline.ts";
import { checkAccess, errorCode, overLimit } from "./claude.js";

const MODEL = process.env.RR_MONTAGE_MODEL || MODELS.sonnet;
const MAX_RUSHES = 25;
const MAX_IMAGES = 30;
const MAX_IMAGE_CHARS = 140_000; // base64 of a ~100 KB JPEG; 30 of them stay under the 4,5 Mo Vercel body limit
const MAX_BRIEF = 2000;

const REVIEW_SYSTEM = `${DIRECTOR_SYSTEM}

Cette fois, tu relis des variantes déjà écrites, avant que la personne les voie. Sois critique comme une directrice artistique d'agence : accroche molle, plan répété, rythme qui retombe, textes trop longs ou qui se chevauchent, texte imposé absent ou modifié, durée hors cible, rendu qui fait « modèle tout fait », variantes trop semblables entre elles.
Corrige chaque variante et renvoie-les toutes, complètes, dans le même ordre. Dans « relecture.corrections », écris ce que tu as corrigé, en phrases courtes adressées à la personne (« J'ai raccourci l'accroche »), 3 au maximum, ou rien si la variante était déjà excellente. N'invente pas de correction.
Dans « plans_a_tourner », note au plus 3 plans qui auraient rendu le montage meilleur. Garde tous les textes imposés, mot pour mot.`;

class BadRequest extends Error {}
const fail = msg => { throw new BadRequest(msg); };
const isNum = v => typeof v === "number" && Number.isFinite(v);

// Checks the request and turns it into what the prompt builders expect.
export function parseRequest(body) {
  if (!body || typeof body !== "object") fail("Requête vide.");
  const brief = typeof body.brief === "string" ? body.brief.trim() : "";
  if (!brief) fail("Le brief est vide.");
  if (brief.length > MAX_BRIEF) fail("Brief trop long.");
  const rushes = Array.isArray(body.rushes) ? body.rushes : [];
  if (!rushes.length || rushes.length > MAX_RUSHES) fail(`Il faut entre 1 et ${MAX_RUSHES} rushes.`);
  const clips = {};
  for (const r of rushes) {
    if (!r || typeof r.id !== "string" || !/^[\w-]{1,40}$/.test(r.id) || !isNum(r.duree) || r.duree <= 0) fail("Rush invalide.");
    clips[r.id] = {
      id: r.id, duration: r.duree, still: !!r.photo, width: isNum(r.largeur) ? r.largeur : 1080, height: isNum(r.hauteur) ? r.hauteur : 1920,
      hasAudio: !!r.son, voix: Array.isArray(r.voix) ? r.voix.filter(v => Array.isArray(v) && isNum(v[0]) && isNum(v[1])).slice(0, 20) : [],
    };
  }
  const images = Array.isArray(body.images) ? body.images : [];
  if (!images.length || images.length > MAX_IMAGES) fail(`Il faut entre 1 et ${MAX_IMAGES} images clés.`);
  const frames = images.map((f, i) => {
    if (!f || !clips[f.rush] || !isNum(f.temps) || typeof f.data !== "string" || !f.data || f.data.length > MAX_IMAGE_CHARS) fail("Image invalide.");
    return { id: typeof f.id === "string" && f.id ? f.id.slice(0, 20) : `f${i + 1}`, clip: f.rush, time: Math.round(f.temps * 10) / 10, data: f.data };
  });
  const duree = isNum(body.duree) ? Math.min(90, Math.max(5, body.duree)) : 30;
  const nb = body.variantes === 2 ? 2 : 3;
  const plateformes = (Array.isArray(body.plateformes) ? body.plateformes : []).filter(p => p in PLATEFORMES);
  const style = body.style && typeof body.style === "object" ? body.style : {};
  if (JSON.stringify(style).length > 8000) fail("Style trop long.");
  return { brief, clips, frames, duree, nb, plateformes, style, musique: body.musique, charte: body.charte };
}

const sum = ledger => Math.round(ledger.reduce((t, l) => t + l.cout_usd, 0) * 10000) / 10000;

// Keeps the variants that survive validation; the phone receives only checked timelines.
function checkVariants(raw, req, beat, previous = []) {
  const out = [];
  for (const [i, v] of (Array.isArray(raw?.variantes) ? raw.variantes : []).slice(0, req.nb).entries()) {
    try {
      const r = sanitizeTimeline({ ...v, musique: req.musique, charte: req.charte, exports: req.plateformes.map(plateforme => ({ plateforme })) },
        req.clips, { brief: req.brief, beat: Array.isArray(req.musique?.temps_forts) && req.musique.temps_forts.length ? undefined : beat, maxDuration: Math.ceil(req.duree * 1.2) });
      out.push({ ...r, timeline: { ...r.timeline, variante: r.timeline.variante || VARIANTES[i] } });
    } catch (e) {
      if (previous[i]) out.push(previous[i]);
    }
  }
  return out;
}

// `deps.callJson` is swapped in the tests, so the whole route runs without an API key.
export async function runMontage(req, { send = () => {}, deps = { callJson }, signal } = {}) {
  const ledger = [], started = Date.now();
  const call = opts => deps.callJson({ ...opts, ledger, signal });
  const image = f => f.data;

  send({ etape: "etiquetage" });
  const tags = {};
  for (let i = 0; i < req.frames.length; i += 10) {
    const group = req.frames.slice(i, i + 10), content = [];
    for (const f of group) {
      content.push({ type: "text", text: `Image ${f.id} (rush ${f.clip}, à ${f.time} s) :` });
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.data } });
    }
    content.push({ type: "text", text: `Étiquette ces ${group.length} images.` });
    const out = await call({ model: MODELS.etiquetage, system: TAG_SYSTEM, content, schema: TAG_SCHEMA, effort: "low", maxTokens: 16000, step: "etiquetage" });
    for (const t of out.images || []) tags[t.id] = t;
  }

  const bpm = Number(req.musique?.bpm);
  const beat = bpm >= 60 && bpm <= 200 ? 60 / bpm : 0;
  const partis = VARIANTES.slice(0, req.nb).join(", ");
  send({ etape: "decision" });
  const content = await decisionContent({
    brief: req.brief, style: req.style, clips: req.clips, frames: req.frames, tags, duration: req.duree, beat,
    ask: `Monte ${req.nb} variantes du Reel, une par parti pris, dans cet ordre : ${partis}. Elles doivent vraiment différer (accroche, ordre, rythme), pas seulement par les textes. Laisse « relecture » vide : tu reliras ensuite.`,
  }, image);
  const draft = await call({ model: MODEL, system: DIRECTOR_SYSTEM, content, schema: variantsSchema(), effort: "medium", fallback: true, step: "decision" });
  let variantes = checkVariants(draft, req, beat);
  if (!variantes.length) throw Object.assign(new Error("Aucune variante utilisable."), { code: "invalid_json" });

  send({ etape: "relecture" });
  try {
    const reviewed = await call({
      model: MODEL, system: REVIEW_SYSTEM, schema: variantsSchema(), effort: "medium", fallback: true, step: "relecture",
      content: [{ type: "text", text: `Brief : ${req.brief}\nDurée visée : ${req.duree} s (à 10 % près).\nStyle : ${JSON.stringify({ ...req.style, corrections: undefined })}\nCorrections passées : ${(req.style.corrections || []).slice(-15).join(" ; ") || "aucune"}\n\nVariantes à relire (avec les remarques de la vérification automatique) :\n${JSON.stringify(variantes.map(v => ({ ...v.timeline, avertissements: v.warnings })), null, 2)}\n\nRelis et corrige.` }],
    });
    const checked = checkVariants(reviewed, req, beat, variantes);
    if (checked.length) variantes = checked;
  } catch (e) {
    if (signal?.aborted) throw e;
    // The review improves the edit but must not lose it: keep the first draft.
    console.error("montage review failed:", e.status, e.message);
  }

  return { variantes, cout_usd: sum(ledger), temps_s: Math.round((Date.now() - started) / 100) / 10, etapes: ledger };
}

const json = (res, status, error, message) => {
  res.statusCode = status; res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ error, message }));
};

export async function handleMontage(req, res, body, deps) {
  if (!deps && !process.env.ANTHROPIC_API_KEY) return json(res, 500, "server_config", "ANTHROPIC_API_KEY manquante sur le serveur.");
  if (!checkAccess(req)) return json(res, 401, "unauthorized", "Code d'accès incorrect.");
  if (overLimit(req)) return json(res, 429, "rate_limited", "Trop de demandes.");
  let parsed;
  try { parsed = parseRequest(body); } catch (e) {
    if (e instanceof BadRequest) return json(res, 400, "bad_request", e.message);
    throw e;
  }

  res.statusCode = 200;
  res.setHeader("content-type", "application/x-ndjson; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-accel-buffering", "no");
  const send = o => { if (!res.writableEnded) res.write(JSON.stringify(o) + "\n"); };
  const abort = new AbortController();
  res.on("close", () => { if (!res.writableEnded) abort.abort(); });
  try {
    send({ resultat: await runMontage(parsed, { send, deps, signal: abort.signal }) });
  } catch (e) {
    if (!abort.signal.aborted) {
      console.error("montage failed:", e.status, e.message);
      send({ error: e.code === "invalid_json" ? "invalid_json" : /refusé/.test(e.message || "") ? "refused" : /coupée/.test(e.message || "") ? "invalid_json" : errorCode(e) });
    }
  }
  res.end();
}
