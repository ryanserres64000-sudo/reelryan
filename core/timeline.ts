// Timeline JSON v1: what the AI returns, what the server checks and what the iPhone renders
// (étude, ch. 5 « Format JSON de la timeline MaDa (v1) »). It extends the prototype format
// (prototype/lib/timeline.mjs) without breaking it: a prototype timeline is a valid v1 timeline.
// Plain TypeScript with erasable syntax only, so Node runs it as is and Metro bundles it.
import { DUO_IDS, type DuoId } from "./typo.ts";
import { sanitizeLook, sanitizePlace, type TextLook, type TextPlace } from "./textlook.ts";
import { RECETTES, onCuts, recipeLook, wordIn, type RecetteId } from "./recipes.ts";

export const TRANSITIONS = ["coupe", "fondu", "glisse", "zoom"] as const;
export const TEXT_POSITIONS = ["haut", "centre", "bas"] as const;
export const TEXT_STYLES = ["accroche", "titre", "info", "signature"] as const;
export const CROPS = ["centre", "gauche", "droite"] as const;
export const ETALONNAGES = ["naturel", "chaud", "froid", "contraste", "desature", "noir-et-blanc"] as const;
export const MOUVEMENTS = ["aucun", "zoom-avant", "zoom-arriere", "glisse-gauche", "glisse-droite"] as const;
export const VARIANTES = ["accroche-forte", "posee", "rythmee"] as const;
export const SOUS_TITRES_STYLES = ["marque", "sobre", "mot-a-mot"] as const;
export const MUSIQUE_MODES = ["fichier", "catalogue", "tendance", "aucune"] as const;
export const MUSIQUE_SOURCES = ["lien", "fichier", "catalogue"] as const;
// Sound effects on key moments (Ryan, référence coachtijoux du 28 octobre), few and spaced.
export const EFFETS = ["whoosh", "pop", "clic", "ding", "impact"] as const;
export const MAX_EFFETS = 4;
export const EFFET_ECART = 3;
export const LOGO_POSITIONS = ["debut", "fin", "partout", "aucun"] as const;
// OFL fonts only, so they can be burnt into videos (étude, ch. 6 §3).
export const POLICES = ["Bricolage Grotesque", "DM Sans", "Fraunces", "Inter", "Playfair Display", "Bebas Neue", "Anton", "Archivo Black", "Cormorant Garamond", "Caveat", "Montserrat", "Poppins", "Pinyon Script", "Bodoni Moda", "Abril Fatface", "Dela Gothic One"] as const;

// Maximum durations and UI-safe margins (px on 1080 × 1920). The study flags them [À VÉRIFIER]:
// check them again against each platform before submitting to the App Store.
export const PLATEFORMES = {
  reels: { duree_max: 180, marge_haut: 220, marge_bas: 420, marge_droite: 120 },
  tiktok: { duree_max: 600, marge_haut: 160, marge_bas: 480, marge_droite: 150 },
  shorts: { duree_max: 180, marge_haut: 200, marge_bas: 380, marge_droite: 120 },
} as const;
export type Plateforme = keyof typeof PLATEFORMES;

// Tracks over the main shots (étude de la refonte, « Un vrai logiciel de montage »): voices and sounds,
// videos and photos laid over the frame, with keyframes. All optional, so every earlier timeline stays
// valid and the AI can keep ignoring them.
export const AUDIO_TYPES = ["voix-off", "enregistrement", "son"] as const;
export const FUSIONS = ["normal", "ecran", "produit", "incrustation"] as const;
export const DETOURAGES = ["aucun", "personne", "fond-vert"] as const;
export const COURBES = ["regulier", "doux", "rebond"] as const;
// Three layers over the main shots at once at most, to stay smooth on an iPhone.
export const MAX_CALQUES_SIMULTANES = 3;
export const MAX_AUDIOS = 12;
export const MAX_CALQUES = 12;

export const TRANSITION_SECONDS = 0.3;
const MIN_SHOT = 0.5;
const MIN_TEXT = 0.4;

type OneOf<T extends readonly string[]> = T[number];
export type Plan = {
  source: string; debut: number; fin: number; cadrage: OneOf<typeof CROPS>; transition: OneOf<typeof TRANSITIONS>;
  garder_son: boolean; vitesse: number; etalonnage: OneOf<typeof ETALONNAGES>; mouvement: OneOf<typeof MOUVEMENTS>; raison: string;
  // Volume of the shot's own sound (1 when absent).
  volume?: number;
  // Reframed by hand (étape 4 du parcours) : the point of the rush kept at the centre (0 to 1 of its
  // width and height) and a zoom (1 to 3). Replaces `cadrage` when present.
  cadre?: Cadre;
  // Fine colour, on top of `etalonnage`: each from -1 to 1, 0 untouched.
  reglages?: Reglages;
};
export type Cadre = { x: number; y: number; z: number };
export const REGLAGES = ["lumiere", "contraste", "saturation", "chaleur"] as const;
export type Reglages = Record<OneOf<typeof REGLAGES>, number>;
export const CADRE_ZOOM = [1, 3] as const;
export function sanitizeCadre(raw: unknown): Cadre | undefined {
  const c = obj(raw);
  if (typeof c.x !== "number" || typeof c.y !== "number") return undefined;
  const z = clamp(num(c.z, 1), ...CADRE_ZOOM), x = clamp(num(c.x, 0.5), 0, 1), y = clamp(num(c.y, 0.5), 0, 1);
  // Centred and not zoomed: nothing to keep.
  return z === 1 && Math.abs(x - 0.5) < 0.005 && Math.abs(y - 0.5) < 0.005 ? undefined : { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, z: round(z) };
}
export function sanitizeReglages(raw: unknown): Reglages | undefined {
  const r = obj(raw), out = Object.fromEntries(REGLAGES.map(k => [k, round(clamp(num(r[k]), -1, 1))])) as Reglages;
  return REGLAGES.some(k => out[k] !== 0) ? out : undefined;
}
export type AudioClip = {
  id: string; type: OneOf<typeof AUDIO_TYPES>; source: string; nom: string; t: number; debut: number; fin: number;
  volume: number; fondu_entree: number; fondu_sortie: number;
  // Voice-over: the text read, the voice, and whether a synthetic voice made it (AI Act art. 50).
  texte: string; voix: string | null; ia: boolean;
};
// A keyframe: `t` from the start of the layer, position and size as fractions of the 1080 × 1920 frame.
export type Cle = { t: number; x: number; y: number; echelle: number; rotation: number; opacite: number; courbe: OneOf<typeof COURBES> };
export type Calque = {
  id: string; source: string; photo: boolean; t: number; debut: number; fin: number;
  x: number; y: number; w: number; h: number; rotation: number; opacite: number;
  fusion: OneOf<typeof FUSIONS>; arrondi: number; detourage: OneOf<typeof DETOURAGES>; volume: number; cles: Cle[];
};
// `lie`: the voice-over a subtitle line belongs to (it moves and goes with it).
// `place` and `look`: set by hand on the video (core/textlook.ts); without them, the slot `position` rules.
export type Texte = { texte: string; debut: number; fin: number; position: OneOf<typeof TEXT_POSITIONS>; style: OneOf<typeof TEXT_STYLES>; impose: boolean; accent: string; lie?: string; place?: TextPlace; look?: TextLook };
export type Effet = { t: number; type: OneOf<typeof EFFETS> };
export type Musique = {
  mode: OneOf<typeof MUSIQUE_MODES>;
  source: { type: OneOf<typeof MUSIQUE_SOURCES>; empreinte: string; droits_confirmes_le: string } | null;
  passage: { debut: number; fin: number } | null;
  bpm: number | null; temps_forts: number[]; volume: number; ducking_voix: boolean; fondu_sortie: number;
};
export type Charte = {
  couleurs: { principale: string | null; texte: string | null };
  polices: { titre: OneOf<typeof POLICES>; texte: OneOf<typeof POLICES> };
  logo: { asset: string; position: OneOf<typeof LOGO_POSITIONS>; taille: number } | null;
  duo: DuoId | null;
};
export type TimelineV1 = {
  version: 1; titre: string; intention: string; variante: OneOf<typeof VARIANTES> | null;
  format: { w: 1080; h: 1920; fps: 30 }; duree: number; plans: Plan[]; textes: Texte[];
  sous_titres: { actifs: boolean; style: OneOf<typeof SOUS_TITRES_STYLES>; position: "bas" | "centre" };
  musique: Musique; effets: Effet[]; charte: Charte; style_utilise: string[];
  // The edit recipe the AI picked (core/recipes.ts); absent: edited the usual way.
  recette?: RecetteId;
  exports: { plateforme: Plateforme; duree_max: number }[];
  relecture: { corrections: string[]; plans_a_tourner: string[] };
  legende: { texte: string; hashtags: string[] };
  audios?: AudioClip[]; calques?: Calque[];
};
export type Clips = Record<string, { duration: number }>;
export type SanitizeOptions = { beat?: number; maxDuration?: number; brief?: string };

const round = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const str = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);
const pick = <T extends readonly string[]>(v: unknown, list: T, d: T[number]): T[number] => (list as readonly string[]).includes(v as string) ? (v as T[number]) : d;
const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {});
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : null);
const isoDate = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : "");

// Texts the person wrote between quotes in the brief: they must appear word for word.
export function imposedTexts(brief = ""): string[] {
  return [...String(brief).matchAll(/«\s*([^»]+?)\s*»|“([^”]+)”|"([^"]+)"/g)].map(m => (m[1] || m[2] || m[3]).trim()).filter(Boolean);
}
const norm = (s: string) => s.normalize("NFC").replace(/[\p{Extended_Pictographic}️‍]/gu, "").replace(/\s+/g, " ").trim().toLowerCase();

// Final duration of the edit once transitions overlap consecutive shots.
// Where each shot after the first starts in the edit (a transition starts early).
export function cutsOf(plans: Pick<Plan, "debut" | "fin" | "transition" | "vitesse">[]): number[] {
  let at = 0;
  return plans.map((p, i) => { const start = Math.max(0, at - (i && p.transition !== "coupe" ? TRANSITION_SECONDS : 0)); at = start + (p.fin - p.debut) / (p.vitesse || 1); return Math.round(start * 100) / 100; }).slice(1);
}

export function timelineDuration(plans: Pick<Plan, "debut" | "fin" | "transition" | "vitesse">[]): number {
  return plans.reduce((t, p, i) => t + (p.fin - p.debut) / (p.vitesse || 1) - (i && p.transition !== "coupe" ? TRANSITION_SECONDS : 0), 0);
}

// Nearest beat to `t` that leaves the shot at least `min` long; null if none fits.
function nearestBeat(grid: number[], t: number, min: number): number | null {
  let best: number | null = null;
  for (const g of grid) if (g >= min - 1e-6 && (best === null || Math.abs(g - t) < Math.abs(best - t))) best = g;
  return best;
}

function sanitizePlans(raw: unknown, clips: Clips, beat: number, maxDuration: number, warnings: string[], grid: number[] = []): Plan[] {
  const plans: Plan[] = [];
  let total = 0;
  for (const r of arr(raw)) {
    const p = obj(r), clip = clips[p.source];
    if (!clip) { warnings.push(`Plan ignoré : rush inconnu « ${str(p.source, 40)} ».`); continue; }
    const vitesse = clamp(num(p.vitesse, 1), 0.5, 2);
    let debut = clamp(num(p.debut), 0, Math.max(0, clip.duration - MIN_SHOT));
    let fin = Math.min(clip.duration, num(p.fin));
    const transition = plans.length ? pick(p.transition, TRANSITIONS, "coupe") : "coupe";
    const overlap = plans.length && transition !== "coupe" ? TRANSITION_SECONDS : 0;
    if (grid.length) {
      // The music's own beats (étude, ch. 4 top 5 n°4): each cut lands on the beat nearest to where the AI put it.
      // Edit time: this shot starts at `total - overlap` and ends at the cut.
      const start = total - overlap, wanted = start + (fin - debut) / vitesse;
      let b = nearestBeat(grid, wanted, start + MIN_SHOT / vitesse);
      while (b !== null && (b - start) * vitesse > clip.duration + 1e-6) b = nearestBeat(grid.filter(g => g < b!), wanted, start + MIN_SHOT / vitesse);
      if (b !== null) {
        const length = (b - start) * vitesse;
        if (debut + length > clip.duration) debut = clip.duration - length;
        // Rounded here so the next cut aims from where this one really ends: no drift along the edit.
        debut = round(debut); fin = round(debut + length);
      }
    } else if (beat > 0) {
      // Whole beats (in edit time, so after the speed change), plus the overlap a transition eats.
      let beats = Math.max(1, Math.round((fin - debut) / vitesse / beat));
      while (beats > 1 && (beats * beat + overlap) * vitesse > clip.duration) beats--;
      const length = Math.min(clip.duration, (beats * beat + overlap) * vitesse);
      if (debut + length > clip.duration) debut = clip.duration - length;
      fin = debut + length;
    }
    if (fin - debut < MIN_SHOT) { warnings.push(`Plan ignoré : trop court (${p.source} ${round(debut)}-${round(fin)}).`); continue; }
    const shot = (fin - debut) / vitesse - overlap;
    if (total + shot > maxDuration) { warnings.push("Montage coupé : durée maximale atteinte."); break; }
    total += shot;
    plans.push({
      source: p.source, debut: round(debut), fin: round(fin), cadrage: pick(p.cadrage, CROPS, "centre"), transition,
      garder_son: !!p.garder_son, vitesse: round(vitesse), etalonnage: pick(p.etalonnage, ETALONNAGES, "naturel"),
      mouvement: pick(p.mouvement, MOUVEMENTS, "aucun"), raison: str(p.raison, 200),
      ...(p.volume !== undefined && num(p.volume, 1) !== 1 ? { volume: round(clamp(num(p.volume, 1), 0, 2)) } : {}),
      ...(sanitizeCadre(p.cadre) ? { cadre: sanitizeCadre(p.cadre) } : {}),
      ...(sanitizeReglages(p.reglages) ? { reglages: sanitizeReglages(p.reglages) } : {}),
    });
  }
  return plans;
}

// A text the AI writes in a recipe gets the recipe's look (core/recipes.ts); a text with its own look
// (moved or styled by hand, saved by the app) keeps it.
function sanitizeTextes(raw: unknown, duration: number, brief: string | undefined, warnings: string[], recette?: RecetteId, charte?: Charte): Texte[] {
  const imposed = imposedTexts(brief).map(norm);
  const textes = arr(raw).map(r => {
    const t = obj(r), texte = str(t.texte, 140), style = pick(t.style, TEXT_STYLES, "titre");
    const base: Texte = {
      texte, debut: round(clamp(num(t.debut), 0, duration)), fin: round(clamp(num(t.fin), 0, duration)),
      position: pick(t.position, TEXT_POSITIONS, "centre"), style,
      impose: imposed.includes(norm(texte)) || (!brief && !!t.impose),
      // The duo's accent word goes with titles only (core/typo.ts).
      accent: style === "accroche" || style === "titre" ? str(t.accent, 30) : "",
      ...(t.lie ? { lie: str(t.lie, 40) } : {}),
    };
    const own = sanitizeLook(t.look, style), mot = wordIn(texte, t.mot);
    const styled = !own && recette && charte ? recipeLook(recette, style, charte, mot) : null;
    const place = sanitizePlace(t.place) ?? styled?.place;
    const look = own ?? styled?.look ?? (mot ? { ...sanitizeLook({}, style)!, mot } : undefined);
    return { ...base, ...(place ? { place } : {}), ...(look ? { look } : {}) };
  }).filter(t => t.texte && t.fin - t.debut >= MIN_TEXT);
  for (const [i, t] of imposedTexts(brief).entries()) if (!textes.some(x => norm(x.texte) === imposed[i])) warnings.push(`Texte demandé absent du montage : « ${t} »`);
  return textes;
}

function sanitizeMusique(raw: unknown, warnings: string[]): Musique {
  const m = obj(raw);
  let mode = pick(m.mode, MUSIQUE_MODES, "aucune");
  const s = obj(m.source);
  let source: Musique["source"] = null;
  if (mode === "fichier" || mode === "catalogue") {
    source = { type: pick(s.type, MUSIQUE_SOURCES, mode === "catalogue" ? "catalogue" : "fichier"), empreinte: str(s.empreinte, 100), droits_confirmes_le: isoDate(s.droits_confirmes_le) };
    // An imported sound needs the dated rights checkbox (étude, ch. 5 §3 ; ch. 9 « Droits musicaux »).
    if (source.type !== "catalogue" && !source.droits_confirmes_le) { warnings.push("Musique retirée : les droits du son ne sont pas confirmés."); mode = "aucune"; source = null; }
  }
  const p = obj(m.passage);
  const passage = mode === "fichier" || mode === "catalogue" ? (num(p.fin) > num(p.debut) ? { debut: round(Math.max(0, num(p.debut))), fin: round(num(p.fin)) } : null) : null;
  const bpmRaw = num(m.bpm, 0);
  const bpm = bpmRaw >= 60 && bpmRaw <= 200 ? round(bpmRaw) : null;
  if (bpmRaw && !bpm) warnings.push(`Tempo ignoré : ${bpmRaw} hors de 60 à 200.`);
  const temps_forts = arr(m.temps_forts).map(x => num(x, -1)).filter(x => x >= 0).sort((a, b) => a - b).slice(0, 2000).map(round);
  return { mode, source, passage, bpm: mode === "aucune" ? null : bpm, temps_forts: mode === "aucune" ? [] : temps_forts,
    volume: round(clamp(num(m.volume, 0.8), 0, 1)), ducking_voix: m.ducking_voix !== false, fondu_sortie: round(clamp(num(m.fondu_sortie, 1), 0, 3)) };
}

function sanitizeCharte(raw: unknown): Charte {
  const c = obj(raw), co = obj(c.couleurs), po = obj(c.polices), lo = obj(c.logo);
  return {
    couleurs: { principale: hex(co.principale), texte: hex(co.texte) },
    polices: { titre: pick(po.titre, POLICES, "Bricolage Grotesque"), texte: pick(po.texte, POLICES, "DM Sans") },
    logo: lo.asset ? { asset: str(lo.asset, 60), position: pick(lo.position, LOGO_POSITIONS, "fin"), taille: round(clamp(num(lo.taille, 0.22), 0.1, 0.4)) } : null,
    duo: DUO_IDS.includes(c.duo) ? c.duo : null,
  };
}

let seq = 0;
const id = (v: unknown, p: string) => (typeof v === "string" && /^[\w-]{1,40}$/.test(v) ? v : `${p}${(++seq).toString(36)}${Date.now().toString(36).slice(-4)}`);

// Extra sounds on their own tracks (voice-over, recording, imported sound), inside the edit.
export function sanitizeAudios(raw: unknown, duration: number): AudioClip[] {
  return arr(raw).map(r => {
    const a = obj(r), debut = Math.max(0, num(a.debut)), fin = num(a.fin);
    return {
      id: id(a.id, "a"), type: pick(a.type, AUDIO_TYPES, "son"), source: str(a.source, 300), nom: str(a.nom, 80),
      t: round(clamp(num(a.t), 0, Math.max(0, duration - 0.2))), debut: round(debut), fin: round(fin),
      volume: round(clamp(num(a.volume, 1), 0, 2)), fondu_entree: round(clamp(num(a.fondu_entree), 0, 3)), fondu_sortie: round(clamp(num(a.fondu_sortie), 0, 3)),
      texte: str(a.texte, 1000), voix: a.voix ? str(a.voix, 60) : null, ia: !!a.ia,
    };
  }).filter(a => a.source && a.fin - a.debut >= 0.2).slice(0, MAX_AUDIOS);
}

const frac = (v: unknown, d: number, lo = -1, hi = 2) => round(clamp(num(v, d), lo, hi) * 1000) / 1000;
function sanitizeCle(raw: unknown): Cle {
  const k = obj(raw);
  return { t: round(Math.max(0, num(k.t))), x: frac(k.x, 0.5), y: frac(k.y, 0.5), echelle: round(clamp(num(k.echelle, 1), 0.1, 5)), rotation: round(clamp(num(k.rotation), -360, 360)), opacite: round(clamp(num(k.opacite, 1), 0, 1)), courbe: pick(k.courbe, COURBES, "doux") };
}

// Videos and photos over the frame, from the rushes, inside the edit; keyframes sorted inside the layer.
export function sanitizeCalques(raw: unknown, clips: Clips, duration: number, warnings: string[] = []): Calque[] {
  const out: Calque[] = [];
  for (const r of arr(raw)) {
    const c = obj(r), clip = clips[c.source];
    if (!clip) { warnings.push(`Calque ignoré : rush inconnu « ${str(c.source, 40)} ».`); continue; }
    const debut = clamp(num(c.debut), 0, Math.max(0, clip.duration - MIN_SHOT)), fin = clamp(num(c.fin, clip.duration), debut + MIN_SHOT, clip.duration);
    const t = round(clamp(num(c.t), 0, Math.max(0, duration - MIN_SHOT))), len = Math.min(fin - debut, duration - t);
    out.push({
      id: id(c.id, "c"), source: c.source, photo: !!c.photo, t, debut: round(debut), fin: round(debut + len),
      x: frac(c.x, 0.7), y: frac(c.y, 0.2), w: frac(c.w, 0.35, 0.05, 1.5), h: frac(c.h, 0.35, 0.05, 1.5), rotation: round(clamp(num(c.rotation), -360, 360)),
      opacite: round(clamp(num(c.opacite, 1), 0, 1)), fusion: pick(c.fusion, FUSIONS, "normal"), arrondi: round(clamp(num(c.arrondi, 0.08), 0, 0.5)),
      detourage: pick(c.detourage, DETOURAGES, "aucun"), volume: round(clamp(num(c.volume, 0), 0, 2)),
      cles: arr(c.cles).map(sanitizeCle).filter(k => k.t <= len).sort((a, b) => a.t - b.t).slice(0, 20),
    });
  }
  // No more than MAX_CALQUES_SIMULTANES at any moment: the later ones give way.
  const kept: Calque[] = [];
  for (const c of out.slice(0, MAX_CALQUES)) {
    const end = c.t + c.fin - c.debut;
    if (kept.filter(k => k.t < end && c.t < k.t + k.fin - k.debut).length >= MAX_CALQUES_SIMULTANES) { warnings.push("Calque retiré : trois calques au plus en même temps."); continue; }
    kept.push(c);
  }
  return kept;
}

// At most MAX_EFFETS sound effects, EFFET_ECART seconds apart, inside the edit.
function sanitizeEffets(raw: unknown, duration: number, warnings: string[]): Effet[] {
  const all = arr(raw).map(e => obj(e)).filter(e => (EFFETS as readonly string[]).includes(e.type))
    .map(e => ({ t: round(clamp(num(e.t, -1), 0, Math.max(0, duration - 0.2))), type: e.type as Effet["type"] }))
    .filter(e => num(e.t, -1) >= 0).sort((a, b) => a.t - b.t);
  const out: Effet[] = [];
  for (const e of all) if (out.length < MAX_EFFETS && (!out.length || e.t - out[out.length - 1].t >= EFFET_ECART)) out.push(e);
  if (out.length < all.length) warnings.push(`Effets sonores réduits à ${out.length} : peu, et espacés.`);
  return out;
}

function sanitizeExports(raw: unknown, duration: number, warnings: string[]): TimelineV1["exports"] {
  const asked = arr(raw).map(e => obj(e).plateforme).filter((p): p is Plateforme => p in PLATEFORMES);
  const list = [...new Set(asked.length ? asked : (Object.keys(PLATEFORMES) as Plateforme[]))];
  for (const p of list) if (duration > PLATEFORMES[p].duree_max) warnings.push(`Trop long pour ${p} : ${round(duration)} s pour ${PLATEFORMES[p].duree_max} s au plus.`);
  return list.map(p => ({ plateforme: p, duree_max: PLATEFORMES[p].duree_max }));
}

// Validates and repairs an AI timeline against the real rushes. `clips` maps id -> { duration }.
// The beat comes from `beat` (seconds) or else from musique.bpm, and snaps shot lengths to the tempo.
export function sanitizeTimeline(raw: unknown, clips: Clips, opts: SanitizeOptions = {}): { timeline: TimelineV1; duration: number; warnings: string[] } {
  const warnings: string[] = [];
  const r = obj(raw);
  if (!Array.isArray(r.plans)) throw new Error("Timeline invalide : pas de plans.");
  const musique = sanitizeMusique(r.musique, warnings);
  const beat = opts.beat ?? (musique.bpm ? 60 / musique.bpm : 0);
  // Beats of the chosen passage, in edit time (the passage starts with the edit).
  const from = musique.passage?.debut ?? 0, to = musique.passage?.fin ?? Infinity;
  const grid = opts.beat === undefined ? musique.temps_forts.filter(t => t >= from && t <= to).map(t => round(t - from)) : [];
  const plans = sanitizePlans(r.plans, clips, beat, opts.maxDuration ?? 60, warnings, grid);
  if (!plans.length) throw new Error("Timeline invalide : aucun plan utilisable.");
  const duration = round(timelineDuration(plans));
  const st = obj(r.sous_titres), rel = obj(r.relecture), leg = obj(r.legende);
  const recette = (RECETTES as readonly unknown[]).includes(r.recette) ? (r.recette as RecetteId) : undefined;
  const charte = sanitizeCharte(r.charte);
  const textes = sanitizeTextes(r.textes, duration, opts.brief, warnings, recette, charte);
  const timeline: TimelineV1 = {
    version: 1, titre: str(r.titre, 80) || "Montage", intention: str(r.intention, 300),
    variante: r.variante ? pick(r.variante, VARIANTES, "accroche-forte") : null,
    format: { w: 1080, h: 1920, fps: 30 }, duree: duration, plans,
    // Teaser: the words land on the cuts, which sit on the beat.
    textes: recette === "teaser" ? onCuts(textes, cutsOf(plans)) : textes,
    sous_titres: { actifs: !!st.actifs, style: pick(st.style, SOUS_TITRES_STYLES, "marque"), position: st.position === "centre" ? "centre" : "bas" },
    musique, effets: sanitizeEffets(r.effets, duration, warnings), charte,
    style_utilise: arr(r.style_utilise).map(x => str(x, 120)).filter(Boolean).slice(0, 10),
    exports: sanitizeExports(r.exports, duration, warnings),
    relecture: { corrections: arr(rel.corrections).map(x => str(x, 200)).filter(Boolean).slice(0, 6), plans_a_tourner: arr(rel.plans_a_tourner).map(x => str(x, 200)).filter(Boolean).slice(0, 3) },
    legende: { texte: str(leg.texte, 2200), hashtags: [...new Set(arr(leg.hashtags).map(h => "#" + str(h, 60).replace(/^#+/, "").replace(/\s+/g, "")).filter(h => h.length > 1))].slice(0, 30) },
  };
  if (recette) timeline.recette = recette;
  if (Array.isArray(r.audios) && r.audios.length) timeline.audios = sanitizeAudios(r.audios, duration);
  if (Array.isArray(r.calques) && r.calques.length) timeline.calques = sanitizeCalques(r.calques, clips, duration, warnings);
  return { timeline, duration, warnings };
}

// What the AI fills in (structured outputs, no numeric bounds: sanitizeTimeline enforces them).
// Music, brand kit and export targets are known by the phone, so the server merges them in.
const field = (type: string, description: string, extra: Record<string, unknown> = {}) => ({ type, description, ...extra });
const list = (items: object, description = "") => ({ type: "array", ...(description ? { description } : {}), items });
const object = (properties: Record<string, object>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

export const AI_TIMELINE_SCHEMA = object({
  titre: field("string", "Nom court du montage"),
  intention: field("string", "Pourquoi ce montage, en une ou deux phrases adressées à la personne (tutoiement) : l'idée et pourquoi elle colle au brief"),
  variante: field("string", "Le parti pris de cette version", { enum: VARIANTES }),
  recette: field("string", "La recette de montage suivie (consigne « RECETTES DE MONTAGE »), ou « aucune »", { enum: [...RECETTES, "aucune"] }),
  plans: list(object({
    source: field("string", "Identifiant du rush, par exemple clip02"),
    debut: field("number", "Début dans le rush, en secondes"),
    fin: field("number", "Fin dans le rush, en secondes"),
    cadrage: field("string", "Partie de l'image gardée en 9:16", { enum: CROPS }),
    transition: field("string", "Transition depuis le plan précédent (ignorée pour le premier)", { enum: TRANSITIONS }),
    garder_son: field("boolean", "Garder le son d'origine (voix, ambiance)"),
    vitesse: field("number", "1 = normal, 0.5 = ralenti, 2 = accéléré"),
    etalonnage: field("string", "Couleur du plan", { enum: ETALONNAGES }),
    mouvement: field("string", "Mouvement de caméra ajouté (surtout pour les photos)", { enum: MOUVEMENTS }),
    raison: field("string", "Pourquoi ce plan, en quelques mots"),
  }), "Les plans dans l'ordre de lecture"),
  textes: list(object({
    texte: field("string", "Texte affiché : mot pour mot s'il est imposé par le brief, sinon 6 mots maximum"),
    debut: field("number", "Début dans le montage final, en secondes"),
    fin: field("number", "Fin dans le montage final, en secondes"),
    position: field("string", "Place à l'écran", { enum: TEXT_POSITIONS }),
    style: field("string", "Rôle du texte", { enum: TEXT_STYLES }),
    accent: field("string", "Mot d'accent du titre en duo, 1 ou 2 mots, seulement si la consigne « TITRE EN DUO » le permet ; sinon vide"),
    mot: field("string", "Mot du texte mis en couleur, écrit comme dans le texte (consigne « MOT EN COULEUR ») ; sinon vide"),
  })),
  effets: list(object({
    t: field("number", "Moment dans le montage final, en secondes"),
    type: field("string", "Bruitage", { enum: EFFETS }),
  }), `Bruitages sur des moments clés (révélation, avant/après, chute) : ${MAX_EFFETS} au plus, ${EFFET_ECART} s d'écart au moins, souvent aucun. Jamais sur chaque coupe`),
  sous_titres: object({ actifs: field("boolean", "Sous-titres de la voix, seulement si quelqu'un parle"), style: field("string", "Style des sous-titres", { enum: SOUS_TITRES_STYLES }) }),
  style_utilise: list({ type: "string" }, "Les éléments du style de la personne que tu as appliqués, en mots simples"),
  relecture: object({
    corrections: list({ type: "string" }, "Ce que tu as corrigé en relisant, phrases courtes au passé composé (« J'ai raccourci l'accroche »). Vide si rien"),
    plans_a_tourner: list({ type: "string" }, "Au plus 3 plans qui manquaient, à tourner la prochaine fois"),
  }),
  legende: object({ texte: field("string", "Légende de la publication : accroche concrète en première ligne, un détail vrai tiré des plans, l'appel à l'action ; dans la voix de la marque ; jamais la phrase de la personne recopiée ou paraphrasée"), hashtags: list({ type: "string" }, "5 hashtags au plus, du plus utile au moins utile (ville, métier, produit), sans le #") }),
});

export const variantsSchema = () => object({ variantes: list(AI_TIMELINE_SCHEMA, "Une timeline par variante demandée, chacune avec un parti pris différent") });
