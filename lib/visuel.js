// Visuals for the iPhone app: POST /api/visuel (affiche, post, story, flyer, menu). The phone sends
// the brief, the short brand DNA, its colours and fonts, and up to 4 small images (its photos at
// 512 px, the logo). One call to the large model returns the layer JSON with its own review; then the
// « naturel » check by code (core/design.ts naturalDesign) fixes what slipped through, and both lists
// go back to the person (« J'ai corrigé 2 choses avant de te montrer »). Étude, ch. 5 §7 ; ch. 6 §5 ;
// ch. 4 (relecture visible). The web prototype also re-read its render with a second call: the phone
// cannot send a server-side render, and the code check covers the same faults (contrast, margins,
// safe zones, sizes) at no cost (ch. 8 §4, coût par création).
// `mode: "retoucher"` applies one request to an existing design; locked layers come back on the phone.
import { callJson, MODELS } from "../prototype/lib/ai.mjs";
import { AI_DESIGN_SCHEMA, DESIGN_SYSTEM, INFOS, KINDS, designContent, fromAi, naturalDesign, sanitizeDesign, toAi } from "../core/design.ts";
import { STYLES_MAISON, isHex } from "../core/brand.ts";
import { checkAccess, errorCode, overLimit } from "./claude.js";

const MODEL = process.env.RR_VISUEL_MODEL || MODELS.sonnet;
const MAX_IMAGE_CHARS = 200_000;

class BadRequest extends Error {}
const fail = msg => { throw new BadRequest(msg); };
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function parseRequest(body) {
  if (!body || typeof body !== "object") fail("Requête vide.");
  const b = body.brief && typeof body.brief === "object" ? body.brief : {};
  if (!(b.kind in KINDS)) fail("Type de visuel inconnu.");
  const infos = {};
  for (const k of INFOS) if (text(b.infos?.[k], 200)) infos[k] = text(b.infos[k], 200);
  const images = [];
  for (const im of Array.isArray(body.images) ? body.images.slice(0, 4) : []) {
    if (!im || !/^(img[1-9]|logo)$/.test(im.id) || typeof im.data !== "string" || !im.data || im.data.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(im.data)) fail("Image invalide.");
    images.push({ id: im.id, desc: text(im.desc, 120) || (im.id === "logo" ? "logo de la marque, à placer petit" : "photo de la personne"), data: im.data });
  }
  const mode = body.mode === "retoucher" ? "retoucher" : "creer";
  const demande = text(body.demande, 500);
  if (mode === "retoucher") {
    if (!demande) fail("La demande est vide.");
    if (!body.design || typeof body.design !== "object" || !Array.isArray(body.design.layers)) fail("Visuel absent.");
    if (JSON.stringify(body.design).length > 60_000) fail("Visuel trop lourd.");
  }
  const polices = body.polices && typeof body.polices === "object" ? body.polices : null;
  return {
    mode, demande, design: body.design, images,
    brief: { kind: b.kind, idee: text(b.idee, 1000), infos, style: STYLES_MAISON.includes(b.style) ? b.style : null },
    adn: text(body.adn, 2000),
    look: {
      couleurs: (Array.isArray(body.couleurs) ? body.couleurs : []).filter(isHex).slice(0, 4),
      polices: polices && text(polices.titres, 40) ? { titres: text(polices.titres, 40), texte: text(polices.texte, 40) } : null,
    },
  };
}

const media = d => (d.startsWith("iVBOR") ? "image/png" : "image/jpeg");

export async function runVisuel(req, { deps = { callJson }, signal } = {}) {
  const ledger = [];
  const { w: W, h: H } = KINDS[req.brief.kind];
  const ids = req.images.map(i => i.id);
  const content = [{ type: "text", text: designContent(req.brief, req.adn, req.images) }];
  for (const im of req.images) content.push({ type: "text", text: `${im.id} :` }, { type: "image", source: { type: "base64", media_type: media(im.data), data: im.data } });
  if (req.look.couleurs.length) content.push({ type: "text", text: `Couleurs de la marque : ${req.look.couleurs.join(", ")}.${req.look.polices ? ` Polices : ${req.look.polices.titres} (titres), ${req.look.polices.texte} (texte).` : ""}` });
  if (req.mode === "retoucher") {
    const current = sanitizeDesign(req.design, W, H, ids);
    content.push({ type: "text", text: `VISUEL ACTUEL (JSON) :\n${JSON.stringify(toAi(current))}\n\nDEMANDE : ${req.demande}\nApplique précisément la demande et garde à l'identique tout ce qu'elle ne touche pas. Garde l'« id » de chaque calque existant ; recopie exactement les calques marqués « verrouille » (la personne les a placés à la main). Dans « concept », écris en une phrase ce que tu as changé.` });
  } else content.push({ type: "text", text: `Crée le visuel. Réponds avec design.w = ${W} et design.h = ${H}.` });
  const raw = await deps.callJson({ model: MODEL, system: DESIGN_SYSTEM, content, schema: AI_DESIGN_SCHEMA, effort: req.mode === "retoucher" ? "low" : "medium", maxTokens: 16000, fallback: true, step: req.mode === "retoucher" ? "retouche-visuel" : "visuel", ledger, signal });
  const design = sanitizeDesign(fromAi(raw?.design), W, H, ids);
  const natural = naturalDesign(design, req.look);
  const ai = (Array.isArray(raw?.relecture) ? raw.relecture : []).map(x => text(x, 200)).filter(Boolean).slice(0, 3);
  return {
    design: natural.design, concept: text(raw?.concept, 300),
    relecture: [...natural.fixes, ...ai].slice(0, 6),
    cout_usd: Math.round(ledger.reduce((s, l) => s + l.cout_usd, 0) * 10000) / 10000,
  };
}

const json = (res, status, payload) => {
  res.statusCode = status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
};

export async function handleVisuel(req, res, body, deps) {
  if (!deps && !process.env.ANTHROPIC_API_KEY) return json(res, 500, { error: "server_config", message: "ANTHROPIC_API_KEY manquante sur le serveur." });
  if (!checkAccess(req)) return json(res, 401, { error: "unauthorized", message: "Code d'accès incorrect." });
  if (overLimit(req)) return json(res, 429, { error: "rate_limited", message: "Trop de demandes." });
  let parsed;
  try { parsed = parseRequest(body); } catch (e) {
    if (e instanceof BadRequest) return json(res, 400, { error: "bad_request", message: e.message });
    throw e;
  }
  try {
    return json(res, 200, await runVisuel(parsed, { deps }));
  } catch (e) {
    console.error("visuel failed:", e.status, e.message);
    return json(res, 502, { error: /refusé/.test(e.message || "") ? "refused" : /calque/.test(e.message || "") ? "invalid_json" : errorCode(e) });
  }
}
