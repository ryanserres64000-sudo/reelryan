// Visuals (posters, posts, stories, flyers, menus) for the iPhone app: the layer JSON of the web
// prototype (source/aidesign.js, source/render.js), ported to TypeScript. The format stays the pivot
// between the AI and the renderer (CLAUDE.md) : {w, h, background, fx, layers[]}, so a design made on
// the web opens in the app. Étude, ch. 5 §7 (visuels), ch. 6 §5 (styles maison, clichés).
// Plain TypeScript with erasable syntax only, so Node runs it as is and Metro bundles it.
import { CLICHES, STYLES_MAISON, contrast, textOn, type Dna, type StyleMaison } from "./brand.ts";
import { hasEmoji, isNeon, stripEmoji } from "./natural.ts";
import { POLICES } from "./timeline.ts";

export const KINDS = {
  story: { w: 1080, h: 1920, desc: "story Instagram verticale" },
  post: { w: 1080, h: 1350, desc: "publication Instagram 4:5" },
  affiche: { w: 1240, h: 1754, desc: "affiche A4 à imprimer ou à poster" },
  flyer: { w: 1240, h: 1754, desc: "flyer A4 promotionnel, à imprimer et à partager" },
  menu: { w: 1240, h: 1754, desc: "menu ou carte, lisible et élégant" },
} as const;
export type Kind = keyof typeof KINDS;
export const INFOS = ["titre", "date", "lieu", "prix", "contact", "autre"] as const;
export type Infos = Partial<Record<(typeof INFOS)[number], string>>;

// The visual direction of each house style (ch. 6 §5): the same 10 as the Reels, so a brand looks the
// same in its videos and its posters.
export const STYLE_VISUEL: Record<StyleMaison, string> = {
  comptoir: "chaleureux et gourmand : la vraie photo du plat ou du lieu en grand, un aplat crème ou à la couleur de la marque, un titre sérif généreux, l'adresse lisible",
  atelier: "artisanal : gros plan sur la matière ou les mains, beaucoup d'air, petites mentions en capitales espacées, filets fins",
  coach: "énergique mais net : un mot fort très grand, une seule couleur vive de la marque, alignement à gauche",
  conseil: "posé et sérieux : grille stricte, grotesque sobre, une photo cadrée serrée, le message principal en une phrase",
  vitrine: "produit héros : le produit détouré ou en photo plein cadre, le prix en grand dans un badge, fond uni",
  "avant-apres": "deux photos côte à côte ou l'une sur l'autre, étiquettes « avant » et « après » discrètes, rien d'autre",
  coulisses: "authentique : photo prise sur le vif plein cadre, texte court posé dessus comme une note, sans décor ajouté",
  evenement: "affiche d'événement : la date et le lieu très lisibles, hiérarchie forte, une photo du lieu ou des gens",
  chic: "luxe discret : sérif fine, beaucoup d'espace, photo désaturée, petites capitales espacées, aucune couleur criarde",
  temoignage: "la citation du client en grand, son prénom en petit, une photo de lui ou du lieu, guillemets typographiques",
};

// Average glyph width in em, used to wrap and fit texts the same way on the server, in tests and on
// the phone (no canvas there).
const EM: Record<string, number> = {
  "Bricolage Grotesque": 0.55, "DM Sans": 0.53, Fraunces: 0.54, Inter: 0.54, "Playfair Display": 0.52, "Bebas Neue": 0.4, Anton: 0.44,
  "Archivo Black": 0.64, "Cormorant Garamond": 0.44, Caveat: 0.4, Montserrat: 0.6, Poppins: 0.6,
};
export type Font = (typeof POLICES)[number];

export type Fill = string | { type: "linear" | "radial"; colors: string[]; angle: number; cx: number; cy: number };
export type Background =
  | { type: "solid"; color: string }
  | { type: "linear" | "radial" | "mesh"; colors: string[]; angle: number; cx: number; cy: number }
  | { type: "image"; asset: string; filter: string; focusX: number; focusY: number; overlay?: Fill };
type Base = { id: string; name: string; x: number; y: number; w: number; h: number; rotation: number; opacity: number; blend: string; locked?: boolean; shadow?: { color: string; blur: number; x: number; y: number } };
export type TextLayer = Base & {
  type: "text"; text: string; font: Font; weight: number; italic: boolean; size: number; color: Fill; align: "left" | "center" | "right";
  vAlign: "top" | "middle" | "bottom"; lineHeight: number; letterSpacing: number; transform: "none" | "upper"; strokeOnly: boolean; repeat: boolean; fit: boolean;
  stroke?: { color: string; width: number }; bg?: { color: Fill; padX: number; padY: number; radius: number };
};
export const SHAPES = ["rect", "rounded", "ellipse", "circle", "pill", "arch", "star", "blob", "triangle", "line"] as const;
export const MASKS = ["rect", "rounded", "circle", "ellipse", "arch", "blob", "star", "pill"] as const;
export type ShapeLayer = Base & {
  type: "shape"; shape: (typeof SHAPES)[number]; fill: Fill | null; radius: number; points: number; inner: number; seed: number; blur: number;
  stroke?: { color: Fill; width: number; dash?: number[] };
};
export type ImageLayer = Base & {
  type: "image"; asset: string; fit: "cover" | "contain"; focusX: number; focusY: number; zoom: number; mask: (typeof MASKS)[number]; radius: number;
  filter: string; frame: "none" | "polaroid"; tape: boolean; border?: { color: string; width: number };
};
export type PatternLayer = Base & { type: "pattern"; kind: string; color: string; size: number; spacing: number; angle: number };
export type Layer = TextLayer | ShapeLayer | ImageLayer | PatternLayer;
export type Design = { w: number; h: number; background: Background; fx: { grain: number; vignette: number }; layers: Layer[] };

const FILTERS = ["none", "warm", "cool", "bw", "vintage", "vivid", "dream", "duotone"];
const BLENDS = ["normal", "multiply", "screen", "overlay", "soft-light", "difference", "lighten", "darken"];
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {});
let seq = 0;
export const layerId = () => `l${(++seq).toString(36)}${Date.now().toString(36).slice(-4)}`;

// Colours come back as "#RRGGBB" or "#RRGGBBAA", so the phone, the contrast check and the AI read
// the same thing (the web accepted rgba() and named colours: they are converted).
export function color(c: unknown, d: string): string;
export function color(c: unknown, d: null): string | null;
export function color(c: unknown, d: string | null) {
  if (typeof c !== "string") return d;
  const s = c.trim().toLowerCase(), h2 = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(s)) return s.toUpperCase();
  if (/^#[0-9a-f]{3,4}$/.test(s)) return ("#" + [...s.slice(1)].map(x => x + x).join("")).toUpperCase();
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return ("#" + h2(+m[1]) + h2(+m[2]) + h2(+m[3]) + (a < 1 ? h2(a * 255) : "")).toUpperCase();
  }
  return ({ white: "#FFFFFF", black: "#000000", transparent: "#00000000" } as Record<string, string>)[s] ?? d;
}
export const solid = (c: string) => c.slice(0, 7);
export const VIGNETTE = "#000000";
// Always offered beside the brand colours in the editor.
export const NEUTRALS = ["#FFFFFF", "#1F1B16"];
const alpha = (c: string) => (c.length === 9 ? parseInt(c.slice(7), 16) / 255 : 1);
function fill(f: unknown, d: Fill | null): Fill | null {
  if (f === null) return null;
  if (typeof f === "string") return color(f, null) ?? d;
  const o = obj(f);
  if (Array.isArray(o.colors)) {
    const colors = o.colors.map((c: unknown) => color(typeof c === "object" && c ? (c as any).color : c, null)).filter(Boolean).slice(0, 5) as string[];
    if (!colors.length) return d;
    return { type: o.type === "radial" ? "radial" : "linear", colors, angle: num(o.angle, 180), cx: num(o.cx, 0.5), cy: num(o.cy, 0.5) };
  }
  return d;
}
function font(f: unknown): Font {
  if (typeof f !== "string") return "DM Sans";
  const s = f.trim().toLowerCase();
  return POLICES.find(n => n.toLowerCase() === s) ?? POLICES.find(n => s.includes(n.toLowerCase())) ?? "DM Sans";
}

// Validates and repairs an AI (or web) design. `assets` are the image ids the person really has
// ("img1", "logo"…): a layer pointing elsewhere is dropped, never invented.
export function sanitizeDesign(raw: unknown, W: number, H: number, assets: readonly string[] = []): Design {
  const r = obj(raw);
  if (!Array.isArray(r.layers)) throw new Error("Visuel invalide : pas de calques.");
  const sx = W / num(r.w, W) || 1, sy = H / num(r.h, H) || 1, sm = Math.min(sx, sy);
  const has = (a: unknown) => (typeof a === "string" && assets.includes(a) ? a : null);
  const b = obj(r.background);
  let background: Background;
  if (b.type === "image" && has(b.asset)) {
    background = { type: "image", asset: b.asset, filter: FILTERS.includes(b.filter) ? b.filter : "none", focusX: clamp(num(b.focusX, 0.5), 0, 1), focusY: clamp(num(b.focusY, 0.5), 0, 1) };
    const ov = fill(b.overlay, null);
    if (ov) background.overlay = ov;
  } else if (["linear", "radial", "mesh"].includes(b.type)) {
    const colors = (Array.isArray(b.colors) ? b.colors : []).map((c: unknown) => color(c, null)).filter(Boolean).slice(0, 5) as string[];
    background = colors.length ? { type: b.type, colors, angle: num(b.angle, 180), cx: num(b.cx, 0.5), cy: num(b.cy, 0.5) } : { type: "solid", color: "#111111" };
  } else background = { type: "solid", color: color(b.color, "#111111") };
  const fx = obj(r.fx);
  const out: Design = { w: W, h: H, background, fx: { grain: clamp(num(fx.grain, 0), 0, 0.4), vignette: clamp(num(fx.vignette, 0), 0, 0.8) }, layers: [] };
  const seen = new Set<string>();
  for (const l of r.layers.slice(0, 48)) {
    const o = obj(l);
    if (!["text", "shape", "image", "pattern"].includes(o.type)) continue;
    const base: Base = {
      id: typeof o.id === "string" && /^[\w-]{1,40}$/.test(o.id) && !seen.has(o.id) ? o.id : layerId(), name: String(o.name ?? "").slice(0, 40),
      x: Math.round(num(o.x, 0) * sx), y: Math.round(num(o.y, 0) * sy), w: Math.max(4, Math.round(num(o.w, 200) * sx)), h: Math.max(2, Math.round(num(o.h, 100) * sy)),
      rotation: clamp(num(o.rotation, 0), -360, 360), opacity: clamp(num(o.opacity, 1), 0, 1), blend: BLENDS.includes(o.blend) ? o.blend : "normal",
    };
    seen.add(base.id);
    if (o.locked === true) base.locked = true;
    const sh = obj(o.shadow);
    if (color(sh.color, null)) base.shadow = { color: color(sh.color, "#000000"), blur: clamp(num(sh.blur, 20), 0, 200), x: num(sh.x, 0), y: num(sh.y, 8) };
    if (o.type === "text") {
      const t: TextLayer = {
        ...base, type: "text", text: String(o.text ?? "").slice(0, 800), font: font(o.font), weight: clamp(Math.round(num(o.weight, 400) / 100) * 100, 100, 900),
        italic: !!o.italic, size: clamp(num(o.size, 60) * sm, 6, 1600), color: fill(o.color, "#FFFFFF") ?? "#FFFFFF",
        align: ["left", "center", "right"].includes(o.align) ? o.align : "left", vAlign: ["top", "middle", "bottom"].includes(o.vAlign) ? o.vAlign : "top",
        lineHeight: clamp(num(o.lineHeight, 1.1), 0.7, 2.4), letterSpacing: clamp(num(o.letterSpacing, 0), -0.2, 1), transform: o.transform === "upper" ? "upper" : "none",
        strokeOnly: !!o.strokeOnly, repeat: !!o.repeat, fit: o.fit !== false,
      };
      if (num(o.stroke?.width, 0) > 0) t.stroke = { color: color(o.stroke.color, "#000000"), width: clamp(num(o.stroke.width, 2) * sm, 0.5, 60) };
      const bg = fill(o.bg?.color, null);
      if (bg) t.bg = { color: bg, padX: num(o.bg.padX, t.size * 0.3), padY: num(o.bg.padY, t.size * 0.1), radius: num(o.bg.radius, 0) };
      if (t.text.trim()) out.layers.push(t);
    } else if (o.type === "shape") {
      const s: ShapeLayer = {
        ...base, type: "shape", shape: (SHAPES as readonly string[]).includes(o.shape) ? o.shape : "rect", fill: fill(o.fill === undefined ? "#FFFFFF" : o.fill, null),
        radius: Math.max(0, num(o.radius, 0)), points: num(o.points, 12), inner: num(o.inner, 0.78), seed: Math.round(num(o.seed, 3)), blur: clamp(num(o.blur, 0), 0, 600),
      };
      if (num(o.stroke?.width, 0) > 0) s.stroke = { color: fill(o.stroke.color, "#FFFFFF") ?? "#FFFFFF", width: clamp(num(o.stroke.width, 2), 0.5, 80), ...(Array.isArray(o.stroke.dash) ? { dash: o.stroke.dash.slice(0, 2).map((n: unknown) => num(n, 6)) } : {}) };
      out.layers.push(s);
    } else if (o.type === "image") {
      const asset = has(o.asset);
      if (!asset) continue;
      const im: ImageLayer = {
        ...base, type: "image", asset, fit: o.fit === "contain" ? "contain" : "cover", focusX: clamp(num(o.focusX, 0.5), 0, 1), focusY: clamp(num(o.focusY, 0.5), 0, 1),
        zoom: clamp(num(o.zoom, 1), 1, 3), mask: (MASKS as readonly string[]).includes(o.mask) ? o.mask : "rect", radius: Math.max(0, num(o.radius, 0)),
        filter: FILTERS.includes(o.filter) ? o.filter : "none", frame: o.frame === "polaroid" ? "polaroid" : "none", tape: !!o.tape,
      };
      if (num(o.border?.width, 0) > 0) im.border = { color: color(o.border.color, "#FFFFFF"), width: clamp(num(o.border.width, 4), 0.5, 80) };
      out.layers.push(im);
    } else {
      out.layers.push({
        ...base, type: "pattern", kind: ["dots", "grid", "stripes", "halftone", "waves", "concentric"].includes(o.kind) ? o.kind : "dots",
        color: color(o.color, "#FFFFFF33"), size: clamp(num(o.size, 6), 0.5, 200), spacing: clamp(num(o.spacing, 28), 4, 600), angle: num(o.angle, 0),
      });
    }
  }
  if (!out.layers.length) throw new Error("Visuel invalide : aucun calque utilisable.");
  return out;
}

// ---------- Shapes and masks as SVG paths (the phone draws them, the native export will too) ----------

function rng(seed: number) { let x = (seed | 0) || 7; return () => { x = (x * 16807) % 2147483647; return (x & 0xffff) / 0xffff; }; }
const f1 = (n: number) => Math.round(n * 10) / 10;
export function shapePath(kind: string, w: number, h: number, o: { radius?: number; points?: number; inner?: number; seed?: number } = {}): string {
  const rr = (r: number) => {
    r = Math.min(r, w / 2, h / 2);
    return r <= 0 ? `M0,0H${f1(w)}V${f1(h)}H0Z` : `M${f1(r)},0H${f1(w - r)}A${f1(r)},${f1(r)} 0 0 1 ${f1(w)},${f1(r)}V${f1(h - r)}A${f1(r)},${f1(r)} 0 0 1 ${f1(w - r)},${f1(h)}H${f1(r)}A${f1(r)},${f1(r)} 0 0 1 0,${f1(h - r)}V${f1(r)}A${f1(r)},${f1(r)} 0 0 1 ${f1(r)},0Z`;
  };
  switch (kind) {
    case "ellipse": case "circle": return `M0,${f1(h / 2)}A${f1(w / 2)},${f1(h / 2)} 0 1 1 ${f1(w)},${f1(h / 2)}A${f1(w / 2)},${f1(h / 2)} 0 1 1 0,${f1(h / 2)}Z`;
    case "pill": return rr(Math.min(w, h) / 2);
    case "rounded": return rr(o.radius || Math.min(w, h) * 0.08);
    case "arch": { const r = Math.min(w / 2, h); return `M0,${f1(h)}V${f1(r)}A${f1(w / 2)},${f1(r)} 0 0 1 ${f1(w)},${f1(r)}V${f1(h)}Z`; }
    case "triangle": return `M${f1(w / 2)},0L${f1(w)},${f1(h)}H0Z`;
    case "star": {
      const n = clamp(Math.round(o.points ?? 12), 3, 40), inner = clamp(o.inner ?? 0.78, 0.2, 0.98);
      return Array.from({ length: n * 2 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / n, k = i % 2 ? inner : 1; return `${i ? "L" : "M"}${f1(w / 2 + (Math.cos(a) * w * k) / 2)},${f1(h / 2 + (Math.sin(a) * h * k) / 2)}`; }).join("") + "Z";
    }
    case "blob": {
      const rnd = rng((o.seed ?? 3) * 9973 + 11), n = 7, pts: [number, number][] = [];
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.72 + rnd() * 0.28; pts.push([w / 2 + (Math.cos(a) * w * k) / 2, h / 2 + (Math.sin(a) * h * k) / 2]); }
      let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
      for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
        d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`;
      }
      return d + "Z";
    }
    default: return rr(o.radius ?? 0);
  }
}

// ---------- Text layout without a canvas ----------

export function textLines(l: Pick<TextLayer, "text" | "font" | "transform" | "letterSpacing">, size: number, width: number): string[] {
  const em = (EM[l.font] ?? 0.55) * (l.transform === "upper" ? 1.12 : 1) + Math.max(0, l.letterSpacing);
  const per = Math.max(1, Math.floor(width / (size * em)));
  const lines: string[] = [];
  for (const para of (l.transform === "upper" ? l.text.toUpperCase() : l.text).split("\n")) {
    let cur = "";
    for (const w of para.split(/\s+/).filter(Boolean)) {
      if (!cur) cur = w;
      else if ((cur + " " + w).length <= per) cur += " " + w;
      else { lines.push(cur); cur = w; }
      while (cur.length > per) { lines.push(cur.slice(0, per)); cur = cur.slice(per); }
    }
    lines.push(cur);
  }
  return lines;
}
// The size a text really gets: shrunk until it fits its box when `fit` is on (the web did the same).
export function fittedSize(l: TextLayer): number {
  if (!l.fit || l.repeat) return l.size;
  let s = l.size;
  for (let i = 0; i < 40 && s > 8; i++) {
    const lines = textLines(l, s, l.w);
    const widest = Math.max(...lines.map(x => x.length)) * s * (EM[l.font] ?? 0.55);
    if (lines.length * s * l.lineHeight <= l.h * 1.02 && widest <= l.w * 1.1) break;
    s *= 0.93;
  }
  return Math.round(s);
}

// ---------- The « naturel » check (no AI) ----------

export type BrandLook = { couleurs: string[]; polices?: { titres: string; texte: string } | null };
const fillColors = (f: Fill | null | undefined): string[] => (!f ? [] : typeof f === "string" ? [f] : f.colors);
function mapFill(f: Fill, fn: (c: string) => string): Fill;
function mapFill(f: Fill | null, fn: (c: string) => string): Fill | null;
function mapFill(f: Fill | null, fn: (c: string) => string): Fill | null {
  if (!f) return f;
  return typeof f === "string" ? fn(f) : { ...f, colors: f.colors.map(fn) };
}
// The colour behind a point, as far as the JSON tells: the top shape under it, else the background.
function behind(d: Design, upTo: number, x: number, y: number): string | null {
  for (let i = upTo - 1; i >= 0; i--) {
    const l = d.layers[i];
    if (l.type === "image" && x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h) return null;
    if (l.type === "shape" && l.fill && !l.blur && l.opacity > 0.8 && x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h) {
      const cs = fillColors(l.fill);
      if (cs.length === 1 && alpha(cs[0]) > 0.8) return solid(cs[0]);
    }
  }
  const b = d.background;
  if (b.type === "solid") return solid(b.color);
  if (b.type === "image") return null;
  return solid(b.colors[Math.min(b.colors.length - 1, Math.round(clamp(y / d.h, 0, 1) * (b.colors.length - 1)))]);
}

export function naturalDesign(d: Design, brand: BrandLook = { couleurs: [] }): { design: Design; fixes: string[] } {
  const fixes: string[] = [];
  const W = d.w, H = d.h, k = W / 1080, m = Math.round(Math.min(W, H) * 0.06);
  const brandCols = brand.couleurs.filter(c => /^#[0-9a-f]{6}$/i.test(c));
  let layers = d.layers.map(l => ({ ...l })) as Layer[];
  let background = d.background;

  // Néon et dégradés violets → brand colours (or a warm neutral).
  const main = brandCols[0] ?? "#1F1B16";
  let neon = false;
  const calm = (c: string) => (isNeon(solid(c), brandCols) ? ((neon = true), main + (c.length === 9 ? c.slice(7) : "")) : c);
  if (background.type !== "solid" && background.type !== "image") background = { ...background, colors: background.colors.map(calm) };
  else if (background.type === "solid") background = { ...background, color: calm(background.color) };
  if (background.type === "mesh") background = { ...background, type: "linear", colors: background.colors.slice(0, 2) };
  layers = layers.map(l => {
    if (l.type === "text") return { ...l, color: mapFill(l.color, calm), ...(l.bg ? { bg: { ...l.bg, color: mapFill(l.bg.color, calm) } } : {}) };
    if (l.type === "shape") return { ...l, fill: mapFill(l.fill, calm), ...(l.stroke ? { stroke: { ...l.stroke, color: mapFill(l.stroke.color, calm) } } : {}) };
    return l;
  });
  if (neon) fixes.push("J'ai remplacé des couleurs néon par celles de ta marque.");

  // Halos and glowing blends.
  const halos = layers.filter(l => (l.type === "shape" && l.blur > 0) || l.blend === "screen" || l.blend === "difference").length;
  if (halos) {
    layers = layers.filter(l => !(l.type === "shape" && l.blur > 0)).map(l => (l.blend === "normal" ? l : { ...l, blend: "normal" }));
    fixes.push("J'ai enlevé les halos lumineux : ils font effet « IA ».");
  }
  if (d.fx.grain > 0.12) fixes.push("J'ai allégé le grain de l'image.");

  // Emojis.
  if (layers.some(l => l.type === "text" && hasEmoji(l.text))) {
    layers = layers.map(l => (l.type === "text" ? { ...l, text: stripEmoji(l.text) } : l)).filter(l => l.type !== "text" || l.text);
    fixes.push("J'ai enlevé les emojis.");
  }

  // Two font families at most: the brand's when it has some.
  const texts = layers.filter((l): l is TextLayer => l.type === "text");
  const families = [...new Set(texts.map(t => t.font))];
  if (families.length > 2) {
    const big = [...texts].sort((a, b) => b.size - a.size)[0].font;
    const titres = font(brand.polices?.titres ?? big), texte = font(brand.polices?.texte ?? families.find(f => f !== big) ?? "DM Sans");
    const top = Math.max(...texts.map(t => t.size));
    layers = layers.map(l => (l.type === "text" && l.font !== titres && l.font !== texte ? { ...l, font: l.size >= top * 0.6 ? titres : texte } : l));
    fixes.push(`J'ai gardé 2 polices au lieu de ${families.length}.`);
  }

  // Readable sizes, straight texts, inside the margins and the story's safe zones.
  let small = 0, tilted = 0, moved = 0;
  const story = H / W > 1.7, top = Math.round(220 * k), bottom = Math.round(320 * k);
  layers = layers.map(l => {
    const isLogo = l.type === "image" && l.asset === "logo";
    if (l.type !== "text" && !isLogo) return l;
    let n = { ...l } as Layer;
    if (n.type === "text") {
      if (n.size < 26 * k) { n.size = Math.round(26 * k); small++; }
      if (!n.repeat && Math.abs(n.rotation) > 8) { n.rotation = Math.sign(n.rotation) * 4; tilted++; }
    }
    if (n.type === "text" && n.repeat) return n;
    const before = `${n.x},${n.y}`;
    if (n.w <= W - 2 * m) n.x = clamp(n.x, m, W - m - n.w);
    if (story && n.h <= H - top - bottom) n.y = clamp(n.y, top, H - bottom - n.h);
    else if (n.h <= H - 2 * m) n.y = clamp(n.y, m, H - m - n.h);
    if (`${n.x},${n.y}` !== before) moved++;
    return n;
  });
  if (small) fixes.push(`J'ai agrandi ${small > 1 ? `${small} textes trop petits` : "un texte trop petit"} pour qu'on le lise sur un téléphone.`);
  if (tilted) fixes.push("J'ai redressé un texte trop penché.");
  if (moved) fixes.push(story ? "J'ai sorti un texte des zones cachées par Instagram." : "J'ai remis un texte dans les marges.");

  // Contrast: every text reads on what is behind it.
  let dark = false, recolored = 0;
  const probe: Design = { ...d, background, layers };
  layers = layers.map((l, i) => {
    if (l.type !== "text" || l.bg) return l;
    const under = behind(probe, i, l.x + l.w / 2, l.y + l.h / 2);
    const cs = fillColors(l.color);
    if (!under) {
      if (background.type === "image" && !background.overlay && !dark && !layers.slice(0, i).some(x => x.type === "shape" && x.fill)) dark = true;
      return l;
    }
    if (cs.length && Math.min(...cs.map(c => contrast(solid(c), under))) < (l.size >= 48 * k ? 3 : 4.5)) {
      recolored++;
      const on = brandCols.find(c => contrast(c, under) >= 4.5) ?? textOn(under);
      return { ...l, color: on };
    }
    return l;
  });
  if (dark && background.type === "image") {
    background = { ...background, overlay: { type: "linear", colors: ["#00000000", "#000000A6"], angle: 180, cx: 0.5, cy: 0.5 } };
    fixes.push("J'ai assombri le bas de la photo pour que le texte se lise.");
  }
  if (recolored) fixes.push(`J'ai changé la couleur ${recolored > 1 ? `de ${recolored} textes` : "d'un texte"} qui ne se lisait pas assez.`);

  return { design: { ...d, background, fx: { grain: Math.min(d.fx.grain, 0.06), vignette: Math.min(d.fx.vignette, 0.4) }, layers }, fixes };
}

// ---------- The AI art director (POST /api/visuel) ----------

export const DESIGN_SCHEMA_TXT = `SCHÉMA (coordonnées en px, x/y = coin haut-gauche de la boîte, rotation en degrés, couleurs "#RRGGBB" ou "#RRGGBBAA") :
background : {"type":"solid","color"} | {"type":"linear","colors":[2 couleurs],"angle":0-360 (180 = de haut en bas)} | {"type":"image","asset":"img1","focusX":0-1,"focusY":0-1,"overlay":couleur ou dégradé de lisibilité}
Champs communs : "type","name","x","y","w","h","rotation","opacity"(0-1)
"text" : "text","font","weight"(400 ou 700),"italic","size"(px),"color","align"(left|center|right),"vAlign"(top|middle|bottom),"lineHeight"(0.85-1.5),"letterSpacing"(em, -0.04 à 0.3),"transform"(none|upper),"bg":{"color","padX","padY","radius"} (surlignage),"fit":true
"shape" : "shape"(rect|rounded|ellipse|pill|arch|star|line),"fill"(couleur, dégradé {"type":"linear","colors":[2],"angle"} ou null),"stroke":{"color","width"},"radius","points"(star, 5-30)
"image" : "asset","fit"(cover|contain),"focusX","focusY","zoom"(1-2),"mask"(rect|rounded|circle|arch),"radius","border":{"color","width"}
fx : {"grain":0-0.06,"vignette":0-0.4}`;

export const DESIGN_SYSTEM = `Tu es MaDA, directrice artistique et graphiste senior. Tu fais des visuels qui ressemblent à ceux d'un bon graphiste indépendant : naturels, maîtrisés, propres à cette marque. Jamais un template, jamais l'air « fait par une IA ».

EXIGENCES
1. Un parti pris clair pour ce brief et cette marque, pas une mise en page par défaut.
2. Les vraies photos de la personne d'abord, sans filtre : c'est ce qui rend le visuel crédible. Ne couvre ni les visages ni le produit.
3. Hiérarchie nette : un élément héros, un message principal, les infos regroupées. Le regard suit un parcours évident.
4. Typographie : 2 familles au maximum, de préférence celles de la marque ; titre au moins 3 fois plus grand que le texte courant ; titres en lineHeight 0.9 à 1.0 ; petites mentions en capitales espacées ; jamais de texte sous 26 px sur un format de 1080 de large.
5. Couleurs : celles de la marque, 2 à 4 au plus, avec un contraste de lecture irréprochable (sur photo : dégradé de lisibilité ou bandeau).
6. Marges d'au moins 6 % du petit côté, éléments alignés sur des axes communs, espaces réguliers. Rien ne déborde par accident.
7. Textes en français, sans faute, sans emoji. Recopie exactement les infos données ; n'invente ni date, ni prix, ni adresse, ni chiffre.
JAMAIS : ${CLICHES.join(", ")}, halos lumineux, dégradés arc-en-ciel ou irisés, effets chromés, texte en contour, étoiles et paillettes décoratives.
TECHNIQUES QUI RESTENT NATURELLES : photo plein cadre avec dégradé de lisibilité ; photo masquée en arche ou en cercle sur un aplat de la couleur de la marque ; grand titre aligné à gauche ; filets fins et petites mentions éditoriales ; badge rond pour un prix ou une date ; cadre fin intérieur ; deux photos côte à côte.

${DESIGN_SCHEMA_TXT}
POLICES DISPONIBLES (aucune autre) : ${POLICES.join(", ")}.

Dans « relecture », écris ce que tu as vérifié et corrigé avant de rendre (lisibilité, marges, textes coupés), en phrases courtes adressées à la personne (« J'ai raccourci le titre »), 3 au maximum. N'invente pas de correction.`;

const shapeProps = {
  type: { type: "string", enum: ["text", "shape", "image"] }, id: { type: "string" }, name: { type: "string" },
  x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" }, rotation: { type: "number" }, opacity: { type: "number" },
  text: { type: "string" }, font: { type: "string", enum: [...POLICES] }, weight: { type: "integer" }, italic: { type: "boolean" }, size: { type: "number" },
  color: { type: "string" }, align: { type: "string", enum: ["left", "center", "right"] }, vAlign: { type: "string", enum: ["top", "middle", "bottom"] },
  lineHeight: { type: "number" }, letterSpacing: { type: "number" }, transform: { type: "string", enum: ["none", "upper"] },
  bg: { type: "object", additionalProperties: false, properties: { color: { type: "string" }, padX: { type: "number" }, padY: { type: "number" }, radius: { type: "number" } } },
  shape: { type: "string", enum: ["rect", "rounded", "ellipse", "pill", "arch", "star", "line"] }, fill: { type: "string" },
  stroke: { type: "object", additionalProperties: false, properties: { color: { type: "string" }, width: { type: "number" } } },
  radius: { type: "number" }, points: { type: "integer" },
  asset: { type: "string" }, fit: { type: "string", enum: ["cover", "contain"] }, focusX: { type: "number" }, focusY: { type: "number" }, zoom: { type: "number" },
  mask: { type: "string", enum: ["rect", "rounded", "circle", "arch"] },
  border: { type: "object", additionalProperties: false, properties: { color: { type: "string" }, width: { type: "number" } } },
};
// What the AI fills in (structured outputs). Gradients are written as one string "#A,#B,angle" in
// `fill` and in the background to keep the schema flat; `fromAi` turns them back into objects.
export const AI_DESIGN_SCHEMA = {
  type: "object", additionalProperties: false, required: ["concept", "design", "relecture"],
  properties: {
    concept: { type: "string", description: "Une phrase : l'idée visuelle" },
    relecture: { type: "array", items: { type: "string" } },
    design: {
      type: "object", additionalProperties: false, required: ["w", "h", "background", "layers"],
      properties: {
        w: { type: "integer" }, h: { type: "integer" },
        background: {
          type: "object", additionalProperties: false, required: ["type"],
          properties: { type: { type: "string", enum: ["solid", "linear", "image"] }, color: { type: "string" }, colors: { type: "array", items: { type: "string" } }, angle: { type: "number" }, asset: { type: "string" }, focusX: { type: "number" }, focusY: { type: "number" }, overlay: { type: "string", description: "Couleur, ou dégradé écrit \"#RRGGBBAA,#RRGGBBAA,angle\"" } },
        },
        fx: { type: "object", additionalProperties: false, properties: { grain: { type: "number" }, vignette: { type: "number" } } },
        layers: { type: "array", items: { type: "object", additionalProperties: false, required: ["type", "x", "y", "w", "h"], properties: shapeProps } },
      },
    },
  },
} as const;
const gradient = (v: unknown) => {
  if (typeof v !== "string" || !v.includes(",") || /^rgba?\(/i.test(v.trim())) return v;
  const parts = v.split(",").map(s => s.trim()), angle = Number(parts[parts.length - 1]);
  const colors = Number.isFinite(angle) ? parts.slice(0, -1) : parts;
  return { type: "linear", colors, angle: Number.isFinite(angle) ? angle : 180 };
};
export function fromAi(raw: unknown): unknown {
  const d = obj(raw), b = obj(d.background);
  return {
    ...d, background: { ...b, overlay: gradient(b.overlay) },
    layers: (Array.isArray(d.layers) ? d.layers : []).map((l: any) => (l && typeof l === "object" && l.type === "shape" ? { ...l, fill: gradient(l.fill) } : l)),
  };
}
// The JSON sent back to the AI for a retouch: rounded numbers; ids kept so the layers placed by hand
// (« verrouille ») can be matched on return (keepLockedLayers).
export function toAi(d: Design) {
  return {
    ...d, layers: d.layers.map(({ locked, ...l }) => {
      const o: Record<string, unknown> = { ...l, ...(locked ? { verrouille: true } : {}) };
      for (const k of ["x", "y", "w", "h", "size"]) if (typeof o[k] === "number") o[k] = Math.round(o[k] as number);
      return o;
    }),
  };
}

export type VisualBrief = { kind: Kind; idee: string; infos: Infos; style?: StyleMaison | null };
export function designContent(b: VisualBrief, dna: string, assets: { id: string; desc: string }[]) {
  const K = KINDS[b.kind];
  const infos = INFOS.filter(k => b.infos[k]?.trim()).map(k => `- ${k} : ${b.infos[k]!.trim()}`).join("\n");
  const story = b.kind === "story" ? " Garde titre, infos et logo hors des 220 px du haut et des 320 px du bas (interface Instagram)." : "";
  return `TYPE : ${K.desc}
FORMAT : ${K.w} × ${K.h} px.${story}
DEMANDE : ${b.idee.trim() || "(non précisée : propose le visuel le plus juste pour cette marque)"}
INFOS À AFFICHER (exactement) :
${infos || "Aucune info imposée : écris des textes courts, sans inventer de date, de prix, d'adresse ni de chiffre."}
DIRECTION : ${b.style ? STYLE_VISUEL[b.style] : "celle qui va le mieux à cette marque"}
MARQUE :
${dna || "Pas encore de carnet de marque : reste sobre et chaleureux."}
IMAGES DISPONIBLES (référence-les par leur identifiant) :
${assets.map(a => `${a.id} : ${a.desc}`).join("\n") || "Aucune : compose avec la typographie, les aplats et les formes simples."}
Les vignettes jointes, dans l'ordre : ${assets.map(a => a.id).join(", ") || "aucune"}.
Réponds avec 4 à 16 calques, du fond vers l'avant, nombres entiers pour x, y, w, h. Chaque photo pertinente est utilisée au moins une fois ; le logo, s'il est fourni, reste petit et propre.`;
}

// ---------- Without the server: hand-made layouts at the brand's colours ----------

export function offlineDesign(b: VisualBrief, look: BrandLook & { nom?: string }, assets: { photo?: boolean; logo?: boolean } = {}): Design {
  const { w: W, h: H } = KINDS[b.kind], k = W / 1080, m = Math.round(Math.min(W, H) * 0.08);
  const c = look.couleurs.filter(x => /^#[0-9a-f]{6}$/i.test(x));
  const titres = font(look.polices?.titres ?? "Bricolage Grotesque"), texte = font(look.polices?.texte ?? "DM Sans");
  const paper = c.find(x => contrast(x, "#111111") > 9) ?? "#F4EFE6", ink = c.find(x => contrast(x, paper) >= 4.5) ?? "#1F1B16";
  const accent = c.find(x => x !== paper && x !== ink && contrast(x, paper) >= 3) ?? ink;
  const story = b.kind === "story", top = story ? Math.round(240 * k) : m, bottom = story ? Math.round(340 * k) : m;
  const i = b.infos, title = i.titre?.trim() || b.idee.trim().split(/[.!?\n]/)[0].slice(0, 60) || look.nom || "Ton titre";
  const details = [i.date, i.lieu, i.prix, i.contact, i.autre].map(x => x?.trim()).filter(Boolean).join("\n");
  const t = (o: Partial<TextLayer> & Pick<TextLayer, "text" | "x" | "y" | "w" | "h">): TextLayer => ({
    id: layerId(), type: "text", name: "", rotation: 0, opacity: 1, blend: "normal", font: texte, weight: 400, italic: false, size: Math.round(34 * k), color: ink,
    align: "left", vAlign: "top", lineHeight: 1.2, letterSpacing: 0, transform: "none", strokeOnly: false, repeat: false, fit: true, ...o,
  });
  const layers: Layer[] = [];
  let background: Background = { type: "solid", color: paper };
  if (assets.photo && (b.kind === "story" || b.kind === "post")) {
    // Full-bleed photo, legibility gradient, title at the bottom left (coulisses, comptoir).
    background = { type: "image", asset: "img1", filter: "none", focusX: 0.5, focusY: 0.4, overlay: { type: "linear", colors: ["#00000000", "#000000B3"], angle: 180, cx: 0.5, cy: 0.5 } };
    const tb = Math.round(H * 0.2);
    layers.push(t({ name: "Titre", text: title, font: titres, weight: 700, size: Math.round(110 * k), color: "#FFFFFF", lineHeight: 0.95, letterSpacing: -0.02, x: m, y: H - bottom - tb - Math.round(150 * k), w: W - 2 * m, h: tb, vAlign: "bottom" }));
    if (details) layers.push(t({ name: "Infos", text: details, color: "#FFFFFF", x: m, y: H - bottom - Math.round(130 * k), w: W - 2 * m, h: Math.round(130 * k), vAlign: "bottom" }));
  } else if (assets.photo) {
    // Poster: photo in an arch on the brand's paper colour, serif title, details on a fine rule.
    const pw = W - 2 * m, ph = Math.round(H * 0.46);
    layers.push({ id: layerId(), type: "image", name: "Photo", asset: "img1", x: m, y: top, w: pw, h: ph, rotation: 0, opacity: 1, blend: "normal", fit: "cover", focusX: 0.5, focusY: 0.5, zoom: 1, mask: "arch", radius: 0, filter: "none", frame: "none", tape: false });
    const ty = top + ph + Math.round(60 * k);
    layers.push(t({ name: "Titre", text: title, font: titres, weight: 700, size: Math.round(120 * k), lineHeight: 0.95, letterSpacing: -0.02, x: m, y: ty, w: pw, h: Math.round(H * 0.17) }));
    layers.push({ id: layerId(), type: "shape", name: "Filet", shape: "line", x: m, y: ty + Math.round(H * 0.19), w: pw, h: 2, rotation: 0, opacity: 1, blend: "normal", fill: accent, radius: 0, points: 12, inner: 0.78, seed: 3, blur: 0 });
    if (details) layers.push(t({ name: "Infos", text: details, x: m, y: ty + Math.round(H * 0.2) + Math.round(20 * k), w: pw, h: H - bottom - ty - Math.round(H * 0.2) - Math.round(20 * k) }));
  } else {
    // Typographic: one big title on the brand colour, details below.
    background = { type: "solid", color: accent !== ink ? accent : paper };
    const on = textOn(accent !== ink ? accent : paper);
    layers.push(t({ name: "Titre", text: title, font: titres, weight: 700, size: Math.round(150 * k), color: on, lineHeight: 0.92, letterSpacing: -0.03, x: m, y: top + Math.round(H * 0.08), w: W - 2 * m, h: Math.round(H * 0.4) }));
    if (details) layers.push(t({ name: "Infos", text: details, color: on, size: Math.round(40 * k), x: m, y: H - bottom - Math.round(H * 0.22), w: W - 2 * m, h: Math.round(H * 0.22), vAlign: "bottom" }));
  }
  if (b.kind === "menu" && !details) layers.push(t({ name: "Carte", text: "Entrée\nPlat\nDessert", size: Math.round(44 * k), x: m, y: Math.round(H * 0.7), w: W - 2 * m, h: Math.round(H * 0.2) }));
  if (assets.logo) {
    const s = Math.round(120 * k);
    layers.push({ id: layerId(), type: "image", name: "Logo", asset: "logo", x: W - m - s, y: top, w: s, h: s, rotation: 0, opacity: 1, blend: "normal", fit: "contain", focusX: 0.5, focusY: 0.5, zoom: 1, mask: "rect", radius: 0, filter: "none", frame: "none", tape: false });
  }
  return { w: W, h: H, background, fx: { grain: 0.03, vignette: 0 }, layers };
}

// ---------- Hand edits (the layer editor) ----------

export function setLayer(d: Design, id: string, patch: Partial<Layer>): Design {
  return { ...d, layers: d.layers.map(l => (l.id === id ? ({ ...l, ...patch, locked: true } as Layer) : l)) };
}
export function moveLayer(d: Design, id: string, dx: number, dy: number): Design {
  const l = d.layers.find(x => x.id === id);
  if (!l) return d;
  return setLayer(d, id, { x: Math.round(clamp(l.x + dx, -l.w / 2, d.w - l.w / 2)), y: Math.round(clamp(l.y + dy, -l.h / 2, d.h - l.h / 2)) });
}
export function resizeText(d: Design, id: string, factor: number): Design {
  const l = d.layers.find(x => x.id === id);
  if (!l || l.type !== "text") return d;
  return setLayer(d, id, { size: Math.round(clamp(fittedSize(l) * factor, 12, 1600)) });
}
export function deleteLayer(d: Design, id: string): Design {
  const layers = d.layers.filter(l => l.id !== id);
  return layers.length ? { ...d, layers } : d;
}
export function reorder(d: Design, id: string, dir: 1 | -1): Design {
  const i = d.layers.findIndex(l => l.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= d.layers.length) return d;
  const layers = [...d.layers];
  [layers[i], layers[j]] = [layers[j], layers[i]];
  return { ...d, layers };
}
export function addText(d: Design, text: string, look: BrandLook): Design {
  const k = d.w / 1080, m = Math.round(Math.min(d.w, d.h) * 0.08);
  const under = behind(d, d.layers.length, d.w / 2, d.h / 2) ?? "#000000";
  const l: TextLayer = {
    id: layerId(), type: "text", name: "Texte", text, font: font(look.polices?.texte ?? "DM Sans"), weight: 700, italic: false, size: Math.round(64 * k),
    color: look.couleurs.find(c => contrast(c, under) >= 4.5) ?? textOn(under), align: "left", vAlign: "top", lineHeight: 1.1, letterSpacing: 0, transform: "none",
    strokeOnly: false, repeat: false, fit: true, x: m, y: Math.round(d.h / 2 - 60 * k), w: d.w - 2 * m, h: Math.round(160 * k), rotation: 0, opacity: 1, blend: "normal", locked: true,
  };
  return { ...d, layers: [...d.layers, l] };
}
// After an AI retouch, what the person placed by hand comes back as it was.
export function keepLockedLayers(before: Design, ai: Design): Design {
  const locked = before.layers.filter(l => l.locked);
  if (!locked.length) return ai;
  const layers = ai.layers.filter(l => !locked.some(x => x.id === l.id));
  for (const l of locked) {
    const at = before.layers.indexOf(l);
    layers.splice(Math.min(at, layers.length), 0, l);
  }
  return { ...ai, layers };
}

export type DesignHistory = { past: Design[]; present: Design; future: Design[] };
export const startDesignHistory = (d: Design): DesignHistory => ({ past: [], present: d, future: [] });
export const pushDesign = (h: DesignHistory, d: Design): DesignHistory => (d === h.present ? h : { past: [...h.past, h.present].slice(-200), present: d, future: [] });
export const undoDesign = (h: DesignHistory): DesignHistory => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h);
export const redoDesign = (h: DesignHistory): DesignHistory => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h);

export const STYLE_OF = (dna: Pick<Dna, "style_maison"> | null | undefined): StyleMaison | null => (dna && (STYLES_MAISON as readonly string[]).includes(dna.style_maison) ? dna.style_maison : null);
