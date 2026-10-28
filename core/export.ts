// Export (étude, ch. 5 §7 « Export et partage ») : one edit, three files (Reels, TikTok, Shorts) in
// 1080 × 1920 at 30 fps, every text inside the safe zone of its platform, the caption and hashtags
// ready to paste, and the trending-sound reminder. Pure functions: the iPhone's AVFoundation module
// reads the plan and renders each file from the same composition as the preview (CLAUDE.md, stack).
import type { Answers, Dna, Profil } from "./brand.ts";
import { stripEmoji } from "./natural.ts";
import { PLATEFORMES, type Effet, type Plateforme, type Texte, type TimelineV1 } from "./timeline.ts";
import { duoById, type Duo } from "./typo.ts";

export const W = 1080, H = 1920, FPS = 30;
export const SAFE_LEFT = 60;
const TEXT_H: Record<Texte["style"], number> = { accroche: 300, titre: 240, info: 180, signature: 200 };
const SUBTITLE_H = 180, GAP = 24;
// Hashtags each platform shows or counts [À VÉRIFIER avant la soumission] : Instagram limits a post
// to 5 since December 2025, TikTok advises 3 to 5, YouTube shows the first 3 above the title.
export const HASHTAGS_MAX: Record<Plateforme, number> = { reels: 5, tiktok: 5, shorts: 3 };
export const CAPTION_MAX: Record<Plateforme, number> = { reels: 2200, tiktok: 4000, shorts: 100 };

export type Box = { x: number; y: number; w: number; h: number };
export type PlacedText = Texte & { box: Box };
export type ExportFile = {
  plateforme: Plateforme; nom: string; w: number; h: number; fps: number; duree: number; coupe: boolean;
  textes: PlacedText[]; sous_titres: Box | null; logo: Box | null; zone: Box; legende: string;
  metadonnees: Record<string, string>;
  // The brand's typographic duo, resolved (core/typo.ts), and the sound effects inside the file.
  duo: Duo | null; effets: Effet[];
};

// AI Act, article 50 (étude, ch. 9) : every file made with the AI says so in machine-readable metadata,
// not on the image. The native module writes these as AVMetadataItem (QuickTime keys) and, once
// chosen, as Content Credentials (C2PA) [À VÉRIFIER : outil C2PA sur iOS]. A montage made by hand says
// only the software.
export function provenance(ia: boolean): Record<string, string> {
  return {
    "com.apple.quicktime.software": "Ma DA",
    ...(ia ? { "com.apple.quicktime.description": "Montage assisté par IA (Ma DA, avec Claude d'Anthropic) à partir de vidéos réelles. Aucune image générée." } : {}),
  };
}

// The area no platform button or caption covers, in 1080 × 1920 px.
export function safeZone(p: Plateforme): Box {
  const m = PLATEFORMES[p];
  return { x: SAFE_LEFT, y: m.marge_haut, w: W - SAFE_LEFT - m.marge_droite, h: H - m.marge_haut - m.marge_bas };
}
export const inside = (b: Box, z: Box) => b.x >= z.x && b.y >= z.y && b.x + b.w <= z.x + z.w && b.y + b.h <= z.y + z.h;

// A title with a duo accent takes the accent line too.
export function textBox(t: Pick<Texte, "position" | "style"> & { accent?: string }, p: Plateforme): Box {
  const z = safeZone(p), h = Math.round(TEXT_H[t.style] * (t.accent ? 1.45 : 1));
  const y = t.position === "haut" ? z.y + GAP : t.position === "centre" ? Math.round(z.y + (z.h - h) / 2) : z.y + z.h - h - GAP;
  return { x: z.x, y, w: z.w, h };
}
export function logoBox(t: TimelineV1, p: Plateforme): Box | null {
  const l = t.charte.logo;
  if (!l || l.position === "aucun") return null;
  const z = safeZone(p), s = Math.round(W * l.taille);
  // All along: small, top left, out of the way. At the start or the end: centred, as a sign-off.
  return l.position === "partout" ? { x: z.x, y: z.y, w: s, h: s } : { x: Math.round((W - s) / 2), y: Math.round(z.y + (z.h - s) / 2), w: s, h: s };
}
const overlaps = (a: { debut: number; fin: number }, b: { debut: number; fin: number }) => a.debut < b.fin && b.debut < a.fin;

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "montage";

export function captionFor(t: TimelineV1, p: Plateforme, legende = t.legende): string {
  const tags = legende.hashtags.slice(0, HASHTAGS_MAX[p]);
  if (p === "shorts") {
    // A Short's title: one line, then the hashtags YouTube shows.
    const first = legende.texte.split(/\n|(?<=[.!?])\s/)[0].trim() || t.titre;
    return [first.slice(0, CAPTION_MAX.shorts - 10), [...tags.filter(h => h.toLowerCase() !== "#shorts").slice(0, HASHTAGS_MAX.shorts - 1), "#Shorts"].join(" ")].join("\n");
  }
  return [legende.texte.trim(), tags.join(" ")].filter(Boolean).join("\n\n").slice(0, CAPTION_MAX[p]);
}

// One file per platform the person ticked; an edit longer than the platform allows is cut there.
export function exportPlan(t: TimelineV1, ia = true): ExportFile[] {
  return t.exports.map(({ plateforme: p, duree_max }) => {
    const duree = Math.min(t.duree, duree_max), z = safeZone(p);
    const sub = t.sous_titres.actifs
      ? t.sous_titres.position === "centre" ? { x: z.x, y: Math.round(z.y + (z.h - SUBTITLE_H) / 2), w: z.w, h: SUBTITLE_H } : { x: z.x, y: z.y + z.h - SUBTITLE_H - GAP, w: z.w, h: SUBTITLE_H }
      : null;
    const textes = t.textes.filter(x => x.debut < duree).map(x => {
      let box = textBox(x, p);
      // A text at the bottom while subtitles run goes just above them.
      if (sub && x.position === "bas" && box.y + box.h > sub.y) box = { ...box, y: Math.max(z.y, sub.y - box.h - GAP) };
      return { ...x, fin: Math.min(x.fin, duree), box };
    });
    // Two texts on screen at once in the same place: the later one moves to the other half.
    for (let i = 0; i < textes.length; i++) for (let j = 0; j < i; j++) {
      if (textes[i].position === textes[j].position && overlaps(textes[i], textes[j])) {
        const other = textes[j].box.y > z.y + z.h / 2 ? "haut" : "bas";
        textes[i] = { ...textes[i], box: textBox({ ...textes[i], position: other }, p) };
      }
    }
    // A text at the top clears a logo shown all along.
    const logo = logoBox(t, p);
    const under = (b: Box) => (logo && t.charte.logo?.position === "partout" && b.y < logo.y + logo.h ? { ...b, y: logo.y + logo.h + GAP } : b);
    for (let i = 0; i < textes.length; i++) textes[i] = { ...textes[i], box: under(textes[i].box) };
    return {
      plateforme: p, nom: `MaDa-${slug(t.titre)}-${p}.mp4`, w: W, h: H, fps: FPS, duree: Math.round(duree * 100) / 100, coupe: t.duree > duree_max,
      textes, sous_titres: sub, logo, zone: z, legende: captionFor(t, p), metadonnees: provenance(ia),
      duo: duoById(t.charte.duo), effets: (t.effets ?? []).filter(e => e.t < duree),
    };
  });
}

// « Mode son tendance » : the edit is cut on a tempo; the person adds the sound in the app when posting.
export function trendTip(t: TimelineV1): { bpm: number } | null {
  return t.musique.mode === "tendance" && t.musique.bpm ? { bpm: Math.round(t.musique.bpm) } : null;
}

// Without the AI (offline, or an empty answer): a short caption from the brief, the brand's address
// and a few honest hashtags. The person edits it before copying.
const PROFIL_TAGS: Record<Profil, string[]> = {
  commerce: ["#commercelocal", "#boutique"], restaurant: ["#restaurant", "#faitmaison"], "petite-entreprise": ["#artisan", "#savoirfaire"],
  "grande-entreprise": ["#entreprise", "#coulisses"], ecole: ["#ecole", "#formation"], createur: ["#createur", "#contenu"], debutant: ["#nouveau", "#lancement"],
};
export function offlineCaption(brief: string, dna: Pick<Dna, "nom" | "profil"> | null, answers: Answers = {}): TimelineV1["legende"] {
  const first = stripEmoji(brief.replace(/«|»|"/g, "").split(/\n|(?<=[.!?])\s/)[0] ?? "").replace(/\s+([.!?,])/g, "$1").trim();
  const adresse = typeof answers.adresse === "string" ? answers.adresse.trim() : "";
  const texte = [first && first[0].toUpperCase() + first.slice(1).replace(/[.!?]?$/, "."), adresse].filter(Boolean).join("\n");
  const nom = dna?.nom ? `#${slug(dna.nom).replace(/-/g, "")}` : null;
  const ville = adresse ? `#${slug(adresse.split(",").pop() ?? "").replace(/-/g, "")}` : null;
  const hashtags = [...new Set([nom, ville, ...(dna ? PROFIL_TAGS[dna.profil] : [])].filter((h): h is string => !!h && h.length > 2))].slice(0, 5);
  return { texte, hashtags };
}
