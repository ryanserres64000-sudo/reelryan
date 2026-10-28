// Timeline JSON v1: what the AI returns, what the server checks and what the iPhone renders
// (étude, ch. 5 « Format JSON de la timeline MaDa (v1) »). It extends the prototype format
// (prototype/lib/timeline.mjs) without breaking it: a prototype timeline is a valid v1 timeline.
// Plain TypeScript with erasable syntax only, so Node runs it as is and Metro bundles it.

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
export const LOGO_POSITIONS = ["debut", "fin", "partout", "aucun"] as const;
// OFL fonts only, so they can be burnt into videos (étude, ch. 6 §3).
export const POLICES = ["Bricolage Grotesque", "DM Sans", "Fraunces", "Inter", "Playfair Display", "Bebas Neue", "Anton", "Archivo Black", "Cormorant Garamond", "Caveat", "Montserrat", "Poppins"] as const;

// Maximum durations and UI-safe margins (px on 1080 × 1920). The study flags them [À VÉRIFIER]:
// check them again against each platform before submitting to the App Store.
export const PLATEFORMES = {
  reels: { duree_max: 180, marge_haut: 220, marge_bas: 420, marge_droite: 120 },
  tiktok: { duree_max: 600, marge_haut: 160, marge_bas: 480, marge_droite: 150 },
  shorts: { duree_max: 180, marge_haut: 200, marge_bas: 380, marge_droite: 120 },
} as const;
export type Plateforme = keyof typeof PLATEFORMES;

export const TRANSITION_SECONDS = 0.3;
const MIN_SHOT = 0.5;
const MIN_TEXT = 0.4;

type OneOf<T extends readonly string[]> = T[number];
export type Plan = {
  source: string; debut: number; fin: number; cadrage: OneOf<typeof CROPS>; transition: OneOf<typeof TRANSITIONS>;
  garder_son: boolean; vitesse: number; etalonnage: OneOf<typeof ETALONNAGES>; mouvement: OneOf<typeof MOUVEMENTS>; raison: string;
};
export type Texte = { texte: string; debut: number; fin: number; position: OneOf<typeof TEXT_POSITIONS>; style: OneOf<typeof TEXT_STYLES>; impose: boolean };
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
};
export type TimelineV1 = {
  version: 1; titre: string; intention: string; variante: OneOf<typeof VARIANTES> | null;
  format: { w: 1080; h: 1920; fps: 30 }; duree: number; plans: Plan[]; textes: Texte[];
  sous_titres: { actifs: boolean; style: OneOf<typeof SOUS_TITRES_STYLES>; position: "bas" | "centre" };
  musique: Musique; charte: Charte; style_utilise: string[];
  exports: { plateforme: Plateforme; duree_max: number }[];
  relecture: { corrections: string[]; plans_a_tourner: string[] };
  legende: { texte: string; hashtags: string[] };
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
    });
  }
  return plans;
}

function sanitizeTextes(raw: unknown, duration: number, brief: string | undefined, warnings: string[]): Texte[] {
  const imposed = imposedTexts(brief).map(norm);
  const textes = arr(raw).map(r => {
    const t = obj(r), texte = str(t.texte, 140);
    return {
      texte, debut: round(clamp(num(t.debut), 0, duration)), fin: round(clamp(num(t.fin), 0, duration)),
      position: pick(t.position, TEXT_POSITIONS, "centre"), style: pick(t.style, TEXT_STYLES, "titre"),
      impose: imposed.includes(norm(texte)) || (!brief && !!t.impose),
    };
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
  };
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
  const timeline: TimelineV1 = {
    version: 1, titre: str(r.titre, 80) || "Montage", intention: str(r.intention, 300),
    variante: r.variante ? pick(r.variante, VARIANTES, "accroche-forte") : null,
    format: { w: 1080, h: 1920, fps: 30 }, duree: duration, plans,
    textes: sanitizeTextes(r.textes, duration, opts.brief, warnings),
    sous_titres: { actifs: !!st.actifs, style: pick(st.style, SOUS_TITRES_STYLES, "marque"), position: st.position === "centre" ? "centre" : "bas" },
    musique, charte: sanitizeCharte(r.charte),
    style_utilise: arr(r.style_utilise).map(x => str(x, 120)).filter(Boolean).slice(0, 10),
    exports: sanitizeExports(r.exports, duration, warnings),
    relecture: { corrections: arr(rel.corrections).map(x => str(x, 200)).filter(Boolean).slice(0, 6), plans_a_tourner: arr(rel.plans_a_tourner).map(x => str(x, 200)).filter(Boolean).slice(0, 3) },
    legende: { texte: str(leg.texte, 2200), hashtags: [...new Set(arr(leg.hashtags).map(h => "#" + str(h, 60).replace(/^#+/, "").replace(/\s+/g, "")).filter(h => h.length > 1))].slice(0, 30) },
  };
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
  })),
  sous_titres: object({ actifs: field("boolean", "Sous-titres de la voix, seulement si quelqu'un parle"), style: field("string", "Style des sous-titres", { enum: SOUS_TITRES_STYLES }) }),
  style_utilise: list({ type: "string" }, "Les éléments du style de la personne que tu as appliqués, en mots simples"),
  relecture: object({
    corrections: list({ type: "string" }, "Ce que tu as corrigé en relisant, phrases courtes au passé composé (« J'ai raccourci l'accroche »). Vide si rien"),
    plans_a_tourner: list({ type: "string" }, "Au plus 3 plans qui manquaient, à tourner la prochaine fois"),
  }),
  legende: object({ texte: field("string", "Légende de la publication, dans le ton de la personne"), hashtags: list({ type: "string" }, "5 à 10 hashtags utiles, sans le #") }),
});

export const variantsSchema = () => object({ variantes: list(AI_TIMELINE_SCHEMA, "Une timeline par variante demandée, chacune avec un parti pris différent") });
