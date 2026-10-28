// Voice-over: POST /api/voix (étape 5 de la refonte). Two actions, so the app has one address:
//   { action: "ecrire", consigne, duree, marque?, ton?, brief? } → Ma DA writes the text (one small model call)
//   { action: "lire", texte, voix, vitesse }                     → a French voice reads it (ElevenLabs)
// « lire » returns the sound (MP3, base64) and the time of each word, for subtitles on the phone. The
// keys stay here (ANTHROPIC_API_KEY, ELEVENLABS_API_KEY); nothing is stored. Each reading counts as
// one voice-over in the quota (core/plans.ts); writing the text counts as a retouch.
import { callJson, MODELS } from "../prototype/lib/ai.mjs";
import { MAX_TEXTE, SCRIPT_SCHEMA, SCRIPT_SYSTEM, VITESSES, isVoix, scriptPrompt, wordsFrom } from "../core/voice.ts";
import { checkAccess, errorCode, overLimit } from "./claude.js";
import { take } from "./quota.js";

const SCRIPT_MODEL = process.env.RR_VOIX_TEXTE_MODEL || MODELS.etiquetage;
// ElevenLabs premade voices that read French with the multilingual model; to replace by French voices
// picked in the ElevenLabs library: MADA_VOIX_JSON = {"camille":"<voice_id>", "hugo": …}.
const DEFAULT_VOICES = { camille: "21m00Tcm4TlvDq8ikWAM", hugo: "ErXwobaYiN019PkySvjV", ines: "EXAVITQu4vr4xnSDxMaL", leo: "pNInz6obpgDQGcFmaJgB" };
const TTS_MODEL = process.env.MADA_VOIX_MODEL || "eleven_multilingual_v2";

class BadRequest extends Error {}
const fail = msg => { throw new BadRequest(msg); };
const text = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function voices(env = process.env) {
  try { return { ...DEFAULT_VOICES, ...(env.MADA_VOIX_JSON ? JSON.parse(env.MADA_VOIX_JSON) : {}) }; } catch { return DEFAULT_VOICES; }
}

export function parseRequest(body) {
  if (!body || typeof body !== "object") fail("Requête vide.");
  if (body.action === "ecrire") {
    const consigne = text(body.consigne, 300);
    if (!consigne) fail("Dis-moi ce que la voix doit raconter.");
    const duree = typeof body.duree === "number" && body.duree > 0 ? Math.min(180, body.duree) : 20;
    return { action: "ecrire", consigne, duree, marque: text(body.marque, 80), ton: text(body.ton, 120), brief: text(body.brief, 300) };
  }
  if (body.action === "lire") {
    const t = text(body.texte, MAX_TEXTE);
    if (!t) fail("Le texte est vide.");
    if (!isVoix(body.voix)) fail("Voix inconnue.");
    const vitesse = VITESSES.includes(body.vitesse) ? body.vitesse : 1;
    return { action: "lire", texte: t, voix: body.voix, vitesse };
  }
  fail("Action inconnue.");
}

export async function writeScript(req, { deps = { callJson }, signal } = {}) {
  const ledger = [];
  const raw = await deps.callJson({ model: SCRIPT_MODEL, system: SCRIPT_SYSTEM, content: [{ type: "text", text: scriptPrompt(req.consigne, req) }], schema: SCRIPT_SCHEMA, effort: "low", maxTokens: 1500, step: "voix-texte", ledger, signal });
  return { texte: text(raw?.texte, MAX_TEXTE), cout_usd: Math.round(ledger.reduce((s, l) => s + l.cout_usd, 0) * 10000) / 10000 };
}

export async function read(req, { env = process.env, fetchImpl = fetch, signal } = {}) {
  const id = voices(env)[req.voix];
  const r = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(id)}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST", signal,
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ text: req.texte, model_id: TTS_MODEL, language_code: "fr", voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: req.vitesse } }),
  });
  if (!r.ok) { const e = new Error(`voix ${r.status}`); e.status = r.status; throw e; }
  const out = await r.json();
  if (typeof out.audio_base64 !== "string" || !out.audio_base64) throw new Error("voix vide");
  const mots = out.alignment ? wordsFrom(out.alignment) : [];
  return { audio: out.audio_base64, format: "mp3", mots, duree: mots.length ? mots[mots.length - 1].fin : null };
}

const json = (res, status, payload) => {
  res.statusCode = status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
};

export async function handleVoix(req, res, body, deps = {}) {
  if (!checkAccess(req)) return json(res, 401, { error: "unauthorized", message: "Code d'accès incorrect." });
  if (overLimit(req)) return json(res, 429, { error: "rate_limited", message: "Trop de demandes." });
  let parsed;
  try { parsed = parseRequest(body); } catch (e) {
    if (e instanceof BadRequest) return json(res, 400, { error: "bad_request", message: e.message });
    throw e;
  }
  const env = deps.env || process.env;
  if (parsed.action === "lire" && !env.ELEVENLABS_API_KEY) return json(res, 503, { error: "server_config", message: "La voix off n'est pas encore branchée sur le serveur." });
  if (parsed.action === "ecrire" && !deps.callJson && !env.ANTHROPIC_API_KEY) return json(res, 500, { error: "server_config", message: "ANTHROPIC_API_KEY manquante sur le serveur." });
  const q = await take(req, parsed.action === "lire" ? "voix" : "retouche", deps.quota || {});
  if (!q.ok) return json(res, q.status, q.body);
  try {
    return json(res, 200, parsed.action === "lire"
      ? await read(parsed, { env, fetchImpl: deps.fetchImpl || fetch })
      : await writeScript(parsed, { deps: deps.callJson ? { callJson: deps.callJson } : undefined }));
  } catch (e) {
    await q.refund();
    console.error("voix failed:", e.status, e.message);
    return json(res, 502, { error: errorCode(e), message: "La voix n'a pas pu être créée. Réessaie dans un instant." });
  }
}
