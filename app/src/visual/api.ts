import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { fetch } from "expo/fetch";
import { compactDna } from "../../../core/brand";
import { KINDS, keepLockedLayers, naturalDesign, offlineDesign, sanitizeDesign, type BrandLook, type Design, type VisualBrief } from "../../../core/design";
import type { Brand } from "../brand/types";
import { SERVER, aiUrl, serverHeaders } from "../flow/server";

export type Photo = { id: string; uri: string };
// `relire`: a new design from the AI, which the editor re-reads once on its render (reviewVisual).
export type VisualResult = { design: Design; concept: string; relecture: string[]; byAi: boolean; relire?: boolean };

export const lookOf = (b: Brand | null): BrandLook & { nom?: string } => ({
  couleurs: b?.dna?.couleurs?.length ? b.dna.couleurs : b?.kit.couleurs ?? [],
  polices: b?.dna?.polices ?? (b?.kit.polices.titres ? b.kit.polices : null),
  nom: b?.dna?.nom || (typeof b?.answers.nom === "string" ? b.answers.nom : undefined),
});
// The images the design can use: the person's photos as img1…, the logo as "logo".
export const assetsOf = (photos: Photo[], b: Brand | null): Record<string, string> =>
  Object.fromEntries([...photos.map(p => [p.id, p.uri]), ...(b?.logoUri ? [["logo", b.logoUri]] : [])]);

// Small copies only (étude, ch. 5 §2 : réduites sur l'appareil) : 512 px JPEG photos, a 256 px PNG logo.
async function small(uri: string, logo: boolean) {
  const r = await (await ImageManipulator.manipulate(uri).resize({ width: logo ? 256 : 512 }).renderAsync()).saveAsync({ format: logo ? SaveFormat.PNG : SaveFormat.JPEG, compress: 0.7, base64: true });
  return r.base64 ?? "";
}
async function call(body: object, signal?: AbortSignal) {
  const res = await fetch(`${SERVER.url}/api/visuel`, {
    method: "POST", signal,
    headers: serverHeaders.get(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function images(photos: Photo[], b: Brand | null) {
  const out = [];
  for (const p of photos.slice(0, 3)) out.push({ id: p.id, data: await small(p.uri, false) });
  if (b?.logoUri) out.push({ id: "logo", data: await small(b.logoUri, true) });
  return out.filter(i => i.data);
}

// POST /api/visuel (lib/visuel.js). Without a server, or when it fails, a hand-made layout at the
// brand's colours, so the person always gets a visual to work on.
export async function createVisual(brief: VisualBrief, brand: Brand | null, photos: Photo[], signal?: AbortSignal, ai = true): Promise<VisualResult> {
  const look = lookOf(brand), assets = Object.keys(assetsOf(photos, brand));
  const offline = (): VisualResult => {
    const r = naturalDesign(offlineDesign(brief, look, { photo: photos.length > 0, logo: !!brand?.logoUri }), look);
    return { design: r.design, concept: "", relecture: r.fixes, byAi: false };
  };
  if (!aiUrl() || !ai) return offline();
  try {
    const out = await call({ brief, adn: brand?.dna ? compactDna(brand.dna) : "", couleurs: look.couleurs, polices: look.polices, images: await images(photos, brand) }, signal);
    const { w, h } = KINDS[brief.kind];
    return { design: sanitizeDesign(out.design, w, h, assets), concept: out.concept ?? "", relecture: out.relecture ?? [], byAi: true, relire: true };
  } catch (e) {
    if (signal?.aborted) throw e;
    return offline();
  }
}

// The art director's second look (lib/visuel.js, mode « relire »): the design as rendered on this
// iPhone, as a small JPEG, with its JSON. Null when there is nothing to change or no server.
export async function reviewVisual(d: Design, rendu: string, brief: VisualBrief, brand: Brand | null, photos: Photo[], signal?: AbortSignal): Promise<{ design: Design; relecture: string[] } | null> {
  if (!aiUrl() || !rendu) return null;
  const look = lookOf(brand);
  const out = await call({ mode: "relire", rendu, design: d, brief, adn: brand?.dna ? compactDna(brand.dna) : "", couleurs: look.couleurs, polices: look.polices, images: await images(photos, brand) }, signal);
  const relecture: string[] = (out.relecture ?? []).filter((x: unknown) => typeof x === "string" && x.trim());
  if (!relecture.length) return null;
  return { design: keepLockedLayers(d, sanitizeDesign(out.design, d.w, d.h, Object.keys(assetsOf(photos, brand)))), relecture };
}

// A retouch in one sentence; what the person moved by hand comes back as it was. Null offline.
export async function retouchVisual(d: Design, demande: string, brief: VisualBrief, brand: Brand | null, photos: Photo[], signal?: AbortSignal): Promise<{ design: Design; summary: string; relecture: string[] } | null> {
  if (!aiUrl()) return null;
  const look = lookOf(brand);
  const out = await call({ mode: "retoucher", demande, design: d, brief, adn: brand?.dna ? compactDna(brand.dna) : "", couleurs: look.couleurs, polices: look.polices, images: await images(photos, brand) }, signal);
  const next = sanitizeDesign(out.design, d.w, d.h, Object.keys(assetsOf(photos, brand)));
  return { design: keepLockedLayers(d, next), summary: out.concept ?? "", relecture: out.relecture ?? [] };
}
