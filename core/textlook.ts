// Texts placed and styled by hand, directly on the video (Ryan's first test, 28 octobre 2026: « je veux
// modifier un texte directement sur la vidéo, pas seulement en haut, au centre ou en bas »). A text
// without `place` keeps its slot (haut, centre, bas) as before; once moved, it carries its own centre,
// width, size and angle, in fractions of the 1080 × 1920 frame. The preview (app/src/video/Frame.tsx),
// the export plan (core/export.ts) and the native render (Overlay.swift) all read the same numbers.

export const TEXT_ROLES = ["titre", "texte", "accent"] as const;
// « contour » = a thin frame around the text, in its colour.
export const TEXT_FONDS = ["ombre", "aucun", "plein", "arrondi", "contour"] as const;
export const TEXT_ALIGNS = ["centre", "gauche", "droite"] as const;
export const TEXT_ANIMS = ["fondu", "aucune", "glisse", "zoom", "mots"] as const;

// The 16 fonts (core/timeline.ts POLICES) sorted in families, as Edits and CapCut show them (Ryan,
// 30 octobre). A text may take one instead of its brand role.
export const FONT_FAMILIES = {
  simple: ["DM Sans", "Inter", "Poppins", "Montserrat"],
  grasse: ["Anton", "Archivo Black", "Bebas Neue", "Dela Gothic One", "Bricolage Grotesque"],
  elegante: ["Playfair Display", "Cormorant Garamond", "Bodoni Moda", "Fraunces"],
  retro: ["Abril Fatface"],
  manuscrite: ["Caveat", "Pinyon Script"],
} as const;
export type FontFamily = keyof typeof FONT_FAMILIES;
export const TEXT_FONTS = Object.values(FONT_FAMILIES).flat();
export type TextFont = (typeof TEXT_FONTS)[number];
// Letter spacing, in em: none, the spaced capitals of a chic title (« L E  R O Y A L »), wide.
export const SPACINGS = [0, 0.15, 0.3] as const;

type OneOf<T extends readonly string[]> = T[number];
// x, y: the text's centre, 0 to 1 of the frame; w: its width, 0.2 to 1; s: its size against the style's
// base size, 0.5 to 2.5; r: its angle in degrees, -45 to 45.
export type TextPlace = { x: number; y: number; w: number; s: number; r: number };
// `police`: a font of its own instead of the role's; `majuscules`: written in capitals; `espace`: letter
// spacing in em; `mot`: the word(s) drawn in `motCouleur` (else the brand colour; « les plus belles
// VUES », Ryan's Reels).
export type TextLook = {
  role: OneOf<typeof TEXT_ROLES>; couleur: string | null; fond: OneOf<typeof TEXT_FONDS>;
  align: OneOf<typeof TEXT_ALIGNS>; anim: OneOf<typeof TEXT_ANIMS>;
  police?: TextFont; majuscules?: boolean; espace?: number; mot?: string; motCouleur?: string;
};

// The base size of each style, in px on a 1080 px wide frame (the same as Overlay.swift).
export const BASE_SIZE = { accroche: 92, titre: 76, info: 50, signature: 58 } as const;
// The smallest text a phone reads comfortably on a Reel (« Le regard du monteur » : 48 px).
export const MIN_SIZE = 48;
export const PLACE_LIMITS = { w: [0.2, 1], s: [0.5, 2.5], r: [-45, 45] } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const pick = <T extends readonly string[]>(v: unknown, list: T, d: T[number]): T[number] => ((list as readonly string[]).includes(v as string) ? (v as T[number]) : d);
const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

export function sanitizePlace(raw: unknown): TextPlace | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const p = raw as Record<string, unknown>;
  if (typeof p.x !== "number" || typeof p.y !== "number") return undefined;
  return {
    x: r3(clamp(num(p.x, 0.5), 0, 1)), y: r3(clamp(num(p.y, 0.5), 0, 1)),
    w: r3(clamp(num(p.w, 0.8), ...PLACE_LIMITS.w)), s: r3(clamp(num(p.s, 1), ...PLACE_LIMITS.s)),
    r: Math.round(clamp(num(p.r, 0), ...PLACE_LIMITS.r) * 10) / 10,
  };
}

export const defaultLook = (style: string): TextLook => ({ role: style === "accroche" || style === "titre" ? "titre" : "texte", couleur: null, fond: style === "signature" ? "arrondi" : "ombre", align: "centre", anim: "fondu" });

export function sanitizeLook(raw: unknown, style: string): TextLook | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const l = raw as Record<string, unknown>, d = defaultLook(style);
  const mot = typeof l.mot === "string" ? l.mot.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  const espace = typeof l.espace === "number" && Number.isFinite(l.espace) ? Math.round(clamp(l.espace, 0, 0.5) * 100) / 100 : 0;
  return {
    role: pick(l.role, TEXT_ROLES, d.role), couleur: isHex(l.couleur) ? l.couleur.toUpperCase() : null,
    fond: pick(l.fond, TEXT_FONDS, d.fond), align: pick(l.align, TEXT_ALIGNS, d.align), anim: pick(l.anim, TEXT_ANIMS, d.anim),
    ...((TEXT_FONTS as readonly string[]).includes(l.police as string) ? { police: l.police as TextFont } : {}),
    ...(l.majuscules === true ? { majuscules: true } : {}),
    ...(espace ? { espace } : {}),
    ...(mot ? { mot } : {}),
    ...(mot && isHex(l.motCouleur) ? { motCouleur: l.motCouleur.toUpperCase() } : {}),
  };
}

// Where the accent word sits in the text as written (capitals or not): [start, end) or null.
export function wordRange(text: string, look: Pick<TextLook, "mot" | "majuscules">): [number, number] | null {
  if (!look.mot) return null;
  const shown = look.majuscules ? text.toLocaleUpperCase("fr-FR") : text;
  const i = shown.toLocaleLowerCase("fr-FR").indexOf(look.mot.toLocaleLowerCase("fr-FR"));
  return i < 0 ? null : [i, i + look.mot.length];
}

// The font size in px on the 1080 frame.
export const sizeOf = (style: keyof typeof BASE_SIZE, place?: TextPlace) => Math.round(BASE_SIZE[style] * (place?.s ?? 1));

// What a reader sees of an animation at `t` seconds into a text shown `len` seconds: opacity, a lift in
// px (on 1080), a scale, and how many words are out (« mots »). Short and soft: 0,25 s in, 0,2 s out.
export const ANIM_IN = 0.25, ANIM_OUT = 0.2;
export function animAt(anim: TextLook["anim"], t: number, len: number, words: number): { opacite: number; dy: number; echelle: number; mots: number } {
  const ease = (u: number) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const pin = ease(t / ANIM_IN), pout = clamp((len - t) / ANIM_OUT, 0, 1);
  if (anim === "aucune") return { opacite: t >= 0 && t < len ? 1 : 0, dy: 0, echelle: 1, mots: words };
  const opacite = Math.min(pin, pout);
  if (anim === "glisse") return { opacite, dy: (1 - pin) * 40, echelle: 1, mots: words };
  if (anim === "zoom") return { opacite, dy: 0, echelle: 0.9 + 0.1 * pin, mots: words };
  if (anim === "mots") return { opacite: pout, dy: 0, echelle: 1, mots: Math.min(words, Math.floor(t / 0.18) + 1) };
  return { opacite, dy: 0, echelle: 1, mots: words };
}

// The drawing constants shared by the preview and Overlay.swift, in px on the 1080 frame.
export const RENDER = { ink: "#FFFFFF", plate: "#121212", shadow: "rgba(0,0,0,0.35)", shadowBlur: 8, shadowY: 2, padX: 32, padY: 16, radius: 18, border: 3, lineHeight: 1.2, word: "#FFD23F" } as const;
// The plain colours offered next to the brand's: white, black, and the two accent colours of a word.
export const SWATCHES = { blanc: "#FFFFFF", noir: "#111111", jaune: "#FFD23F", orange: "#FF7A1A" } as const;
