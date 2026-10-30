// The « naturel » check (étude, ch. 6 §5 « clichés à proscrire » ; ch. 12, ligne DA n°5 ; Ryan,
// 28 octobre : « que ça ne fasse jamais IA »). The consignes already forbid the clichés; this code
// removes what slips through anyway, and says what it fixed in plain French, so the person sees it
// in « J'ai corrigé N choses avant de te montrer » (ch. 4, relecture visible). No AI call.
import { RECIPES } from "./recipes.ts";
import { timelineDuration, type TimelineV1 } from "./timeline.ts";

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu;
export const stripEmoji = (s: string) => s.replace(EMOJI, "").replace(/\s{2,}/g, " ").trim();
export const hasEmoji = (s: string) => new RegExp(EMOJI.source, "u").test(s);

// Hue (0-360) and saturation (0-1) of a "#RRGGBB" colour.
export function hsl(h: string): { h: number; s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (hue * 60 + 360) % 360, s, l };
}
// Electric violet, magenta and neon tones: the first look of « fait par une IA ». A brand colour is
// never one of them, whatever its hue: the person chose it.
export function isNeon(hex: string, brand: string[] = []): boolean {
  if (!/^#[0-9a-f]{6}$/i.test(hex) || brand.some(b => b.toLowerCase() === hex.toLowerCase())) return false;
  const { h, s, l } = hsl(hex);
  return s > 0.55 && l > 0.25 && l < 0.8 && ((h >= 255 && h <= 330) || (s > 0.85 && l > 0.45 && ((h >= 160 && h <= 200) || (h >= 75 && h <= 110))));
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

// Timeline v1. Locked shots come back afterwards anyway (core/edit.ts keepLocked).
// `photos`: the rushes that are photos. For a new AI edit (not a retouch, where the person decides),
// `sons`: the videos that have sound, `brief`: the person's words.
export function naturalTimeline(t: TimelineV1, opts: { photos?: string[]; sons?: string[]; brief?: string } = {}): { timeline: TimelineV1; fixes: string[] } {
  const fixes: string[] = [];
  let plans = t.plans;
  const still = new Set(opts.photos ?? []);

  // Ryan's first test: the rushes are the edit. A photo shown again and again pads a short edit into
  // a slideshow; with videos there, each photo comes once, and the edit is shorter, said plainly.
  if (opts.sons && plans.some(p => !still.has(p.source))) {
    const seen = new Set<string>();
    const kept = plans.filter(p => !still.has(p.source) || (!seen.has(p.source) && !!seen.add(p.source)));
    if (kept.length < plans.length) {
      plans = kept;
      fixes.push(`Tes vidéos sont courtes : j'ai fait un montage de ${Math.round(timelineDuration(plans))} s plutôt que de répéter tes photos.`);
    }
  }
  // The sound of a video is its life (voices, place, laughter): kept unless the person asked for silence.
  const silent = /sans (le |aucun )?son|\bmuets?\b|coupe[rz]? (le )?son/i.test(opts.brief ?? "");
  const sons = new Set(opts.sons ?? []);
  if (!silent && plans.some(p => sons.has(p.source) && !p.garder_son)) {
    plans = plans.map(p => (sons.has(p.source) && !p.garder_son ? { ...p, garder_son: true } : p));
    fixes.push("J'ai gardé le son d'origine de tes vidéos.");
  }

  // « Zoom à chaque coupe » : one zoom transition at most.
  let zooms = 0;
  const z = plans.filter(p => p.transition === "zoom").length;
  if (z > 1) {
    plans = plans.map(p => (p.transition === "zoom" && zooms++ > 0 ? { ...p, transition: "coupe" as const } : p));
    fixes.push(`J'ai remplacé ${plural(z - 1, "zoom", "zooms")} par des coupes nettes : un seul suffit.`);
  }
  // Camera moves on more than a third of the video shots look automatic. A photo keeps its slow
  // zoom: without it, a still looks frozen.
  const moving = plans.map((p, i) => (p.mouvement !== "aucun" && !still.has(p.source) ? i : -1)).filter(i => i >= 0);
  const maxMoves = Math.max(1, Math.floor(plans.length / 3));
  if (moving.length > maxMoves) {
    const keep = new Set(moving.filter((_, k) => k % Math.ceil(moving.length / maxMoves) === 0).slice(0, maxMoves));
    plans = plans.map((p, i) => (p.mouvement !== "aucun" && !still.has(p.source) && !keep.has(i) ? { ...p, mouvement: "aucun" as const } : p));
    fixes.push(`J'ai laissé ${plural(moving.length - keep.size, "plan", "plans")} fixe${moving.length - keep.size > 1 ? "s" : ""} : trop de mouvements faisaient artificiel.`);
  }
  // One grade for the whole edit (two at most), like a real shoot.
  const grades = new Map<string, number>();
  for (const p of plans) grades.set(p.etalonnage, (grades.get(p.etalonnage) ?? 0) + (p.fin - p.debut));
  if (grades.size > 2) {
    const [main] = [...grades.entries()].sort((a, b) => b[1] - a[1])[0];
    plans = plans.map(p => ({ ...p, etalonnage: main as typeof p.etalonnage }));
    fixes.push("J'ai gardé une seule couleur d'image pour tout le montage.");
  }

  // Emojis in burnt-in texts.
  let textes = t.textes;
  if (textes.some(x => hasEmoji(x.texte))) {
    textes = textes.map(x => (x.impose ? x : { ...x, texte: stripEmoji(x.texte) })).filter(x => x.texte);
    fixes.push("J'ai enlevé les emojis des textes à l'écran.");
  }
  // A title duo is a signature, not an effect: two accents at most, never a copy of the title.
  const accents = textes.filter(x => x.accent).length;
  const echo = textes.some(x => x.accent && x.texte.toLowerCase().includes(x.accent.toLowerCase()));
  if (accents > 2 || echo || textes.some(x => hasEmoji(x.accent))) {
    let n = 0;
    textes = textes.map(x => {
      const accent = stripEmoji(x.accent);
      return { ...x, accent: accent && !x.texte.toLowerCase().includes(accent.toLowerCase()) && n++ < 2 ? accent : "" };
    });
    fixes.push("J'ai allégé les titres en duo : deux au plus, sans répéter le titre.");
  }
  // « Mots géants qui rebondissent » : about one text every 4 s, imposed texts always kept.
  // A recipe sets its own pace (core/recipes.ts): a teaser has a word on almost every shot.
  const max = t.recette ? RECIPES[t.recette].maxTextes(t.duree) : Math.max(3, Math.ceil(t.duree / 4));
  if (textes.length > max) {
    const free = textes.map((x, i) => (x.impose ? -1 : i)).filter(i => i >= 0);
    const extra = textes.length - max;
    // Keep the hook (first) and the sign-off (last); drop the shortest texts in between.
    const drop = new Set(free.slice(1, -1).sort((a, b) => (textes[a].fin - textes[a].debut) - (textes[b].fin - textes[b].debut)).slice(0, extra));
    if (drop.size) {
      textes = textes.filter((_, i) => !drop.has(i));
      fixes.push(`J'ai retiré ${plural(drop.size, "texte", "textes")} : l'image doit respirer.`);
    }
  }
  if (!fixes.length) return { timeline: t, fixes };
  // A zoom turned into a cut no longer overlaps the next shot, a dropped photo shortens the edit.
  const duree = Math.round(timelineDuration(plans) * 100) / 100;
  textes = textes.map(x => ({ ...x, fin: Math.min(x.fin, duree) })).filter(x => x.fin - x.debut >= 0.4);
  const corrections = [...fixes, ...t.relecture.corrections].slice(0, 6);
  return { timeline: { ...t, duree, plans, textes, relecture: { ...t.relecture, corrections } }, fixes };
}
