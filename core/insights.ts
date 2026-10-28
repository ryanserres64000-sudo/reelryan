// What works on the person's account (étape 8 de la refonte, étude ch. 5 « Connecter les réseaux »):
// the posts read through the Instagram API, or from a screenshot of the statistics, turned into a few
// plain sentences for the carnet. Honest by rule: no advice before 5 Reels, the best hour only after
// 10 posts, and every sentence says how many posts it rests on. Shared by the app and the server.
import type { Memory } from "./corrections.ts";

export type Post = {
  id: string; at: string; type: "reel" | "post" | "story"; legende: string; lien: string | null;
  vues: number | null; portee: number | null; likes: number | null; commentaires: number | null; partages: number | null; enregistrements: number | null;
  source: "instagram" | "capture" | "tiktok" | "youtube";
  // Seconds, when the platform gives it (TikTok, YouTube); Instagram does not.
  duree?: number | null;
};
export type Learning = { key: string; phrase: string; regle: string; ratio: number; base: number };
export type Insights = { base: number; attente: string | null; items: Learning[]; heure: Learning | null };

export const MIN_FOR_ADVICE = 5;
export const MIN_FOR_HOUR = 10;
const MIN_RATIO = 1.3;
const MAX_POSTS = 60;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : typeof v === "string" && /^\d[\d\s.,]*$/.test(v.trim()) ? Number(v.replace(/[\s.,]/g, "")) : null);
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export function sanitizePosts(raw: unknown): Post[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.flatMap((r): Post[] => {
    if (!r || typeof r !== "object") return [];
    const p = r as Record<string, unknown>, at = typeof p.at === "string" && !Number.isNaN(Date.parse(p.at)) ? new Date(p.at).toISOString() : null;
    if (!at) return [];
    const lien = typeof p.lien === "string" && /^https:\/\/((www|m|vm)\.)?(instagram\.com|tiktok\.com|youtube\.com|youtu\.be)\//.test(p.lien) ? p.lien : null;
    const duree = num(p.duree);
    return [{
      id: str(p.id, 60) || at, at, type: p.type === "post" || p.type === "story" ? p.type : "reel", legende: str(p.legende, 2200), lien,
      vues: num(p.vues), portee: num(p.portee), likes: num(p.likes), commentaires: num(p.commentaires), partages: num(p.partages), enregistrements: num(p.enregistrements),
      source: p.source === "capture" || p.source === "tiktok" || p.source === "youtube" ? p.source : "instagram",
      ...(duree !== null ? { duree } : {}),
    }];
  }).sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_POSTS);
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const hashtags = (t: string) => (t.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
const percent = (r: number) => (r >= 2 ? `${Math.round(r * 10) / 10} fois plus de vues`.replace(".", ",") : `${Math.round((r - 1) * 100)} % de vues en plus`);
const posts = (n: number) => `sur tes ${n} derniers Reels`;

// The Ma DA montage behind each post: published within three days after the export, the closest one.
export function matchReels(reels: { id: string; at: string; duree: number }[], list: Post[]): Record<string, { id: string; duree: number }> {
  const out: Record<string, { id: string; duree: number }> = {}, used = new Set<string>();
  for (const p of [...list].sort((a, b) => a.at.localeCompare(b.at))) {
    const t = Date.parse(p.at);
    const best = reels.filter(r => !used.has(r.id) && t >= Date.parse(r.at) && t - Date.parse(r.at) < 3 * 24 * 3600 * 1000)
      .sort((a, b) => (t - Date.parse(a.at)) - (t - Date.parse(b.at)))[0];
    if (best) { out[p.id] = { id: best.id, duree: best.duree }; used.add(best.id); }
  }
  return out;
}

type Split = { key: string; test: (p: Post) => boolean | null; yes: string; no: string; regleOui: string; regleNon: string };
// Each comparison: the posts that have the trait against those that do not, by median views.
function splits(durations: Record<string, { duree: number }>): Split[] {
  return [
    { key: "duree", test: p => { const d = p.duree ?? durations[p.id]?.duree; return d == null ? null : d <= 15; }, yes: "courts (15 s ou moins)", no: "plus longs que 15 s", regleOui: "Les Reels courts, 15 s ou moins, marchent mieux chez toi.", regleNon: "Les Reels de plus de 15 s marchent mieux chez toi." },
    { key: "legende", test: p => p.legende.replace(/#\S+/g, "").trim().length < 80, yes: "à légende courte", no: "à légende longue", regleOui: "Une légende courte marche mieux chez toi.", regleNon: "Une légende qui raconte marche mieux chez toi." },
    { key: "hashtags", test: p => hashtags(p.legende) <= 3, yes: "avec 3 hashtags ou moins", no: "avec plus de 3 hashtags", regleOui: "Peu de hashtags, 3 au plus, marchent mieux chez toi.", regleNon: "Plus de hashtags marchent mieux chez toi." },
    { key: "weekend", test: p => { const d = new Date(p.at).getDay(); return d === 0 || d === 6; }, yes: "publiés le week-end", no: "publiés en semaine", regleOui: "Le week-end est ton meilleur moment pour publier.", regleNon: "La semaine est ton meilleur moment pour publier." },
  ];
}

export function insights(list: Post[], durations: Record<string, { duree: number }> = {}): Insights {
  const reels = list.filter(p => p.type === "reel" && p.vues !== null);
  const base = reels.length;
  if (base < MIN_FOR_ADVICE) return { base, attente: `Je donne mon avis à partir de ${MIN_FOR_ADVICE} Reels avec leurs vues. J'en ai ${base} pour l'instant.`, items: [], heure: null };
  const items: Learning[] = [];
  for (const s of splits(durations)) {
    const known = reels.filter(p => s.test(p) !== null), a = known.filter(p => s.test(p)), b = known.filter(p => !s.test(p));
    if (a.length < 2 || b.length < 2) continue;
    const ma = median(a.map(p => p.vues!)), mb = median(b.map(p => p.vues!));
    if (!ma || !mb) continue;
    const up = ma >= mb, ratio = up ? ma / mb : mb / ma;
    if (ratio < MIN_RATIO) continue;
    items.push({ key: `stats:${s.key}`, phrase: `Tes Reels ${up ? s.yes : s.no} font ${percent(ratio)}, ${posts(known.length)}.`, regle: up ? s.regleOui : s.regleNon, ratio: Math.round(ratio * 100) / 100, base: known.length });
  }
  items.sort((x, y) => y.ratio - x.ratio);
  return { base, attente: null, items: items.slice(0, 3), heure: bestHour(reels) };
}

// The three-hour window with the best median views, against the rest. Only from 10 posts on.
export function bestHour(reels: Post[]): Learning | null {
  if (reels.length < MIN_FOR_HOUR) return null;
  let best: { from: number; ratio: number } | null = null;
  for (let from = 6; from <= 21; from++) {
    const inside = (p: Post) => { const h = new Date(p.at).getHours(); return h >= from && h < from + 3; };
    const a = reels.filter(inside), b = reels.filter(p => !inside(p));
    if (a.length < 3 || b.length < 3) continue;
    const ratio = median(a.map(p => p.vues!)) / Math.max(1, median(b.map(p => p.vues!)));
    if (!best || ratio > best.ratio) best = { from, ratio };
  }
  if (!best || best.ratio < MIN_RATIO) return null;
  const window = `entre ${best.from} h et ${best.from + 3} h`;
  return { key: "stats:heure", phrase: `Tes Reels publiés ${window} font ${percent(best.ratio)}, ${posts(reels.length)}.`, regle: `Le meilleur moment pour publier chez toi : ${window}.`, ratio: Math.round(best.ratio * 100) / 100, base: reels.length };
}

// A learning, or what the person says they like in a Reel of theirs, kept in the carnet: it goes with
// every montage like the rules learned from corrections.
export function addRule(m: Memory, key: string, text: string, now = new Date()): Memory {
  const t = text.trim().slice(0, 200);
  if (!t) return m;
  return { ...m, rules: [...m.rules.filter(r => r.key !== key), { key, text: t, at: now.toISOString() }] };
}
export const referenceKey = (lien: string) => `ref:${lien.match(/\/(?:reels?|p)\/([\w-]+)/)?.[1] ?? lien.slice(-20)}`;
export const isInstagramLink = (v: string) => /^https:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[\w-]+/.test(v.trim());

// What the screenshot reader returns (lib/instagram.js): the figures of one post's statistics page.
export const CAPTURE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["lisible", "type", "vues", "portee", "likes", "commentaires", "partages", "enregistrements", "date"],
  properties: {
    lisible: { type: "boolean", description: "true si l'image est bien une page de statistiques Instagram d'une publication" },
    type: { type: "string", enum: ["reel", "post", "story"] },
    vues: { type: ["integer", "null"] }, portee: { type: ["integer", "null"], description: "Comptes touchés" },
    likes: { type: ["integer", "null"] }, commentaires: { type: ["integer", "null"] }, partages: { type: ["integer", "null"] }, enregistrements: { type: ["integer", "null"] },
    date: { type: ["string", "null"], description: "Date de publication au format AAAA-MM-JJ si elle est visible" },
  },
} as const;
export const CAPTURE_SYSTEM = `Tu lis des captures d'écran des statistiques Instagram (page « Statistiques » d'un Reel, d'une publication ou d'une story), en français ou en anglais.
Recopie seulement les chiffres visibles, sans rien deviner : un chiffre absent vaut null. « 2,4 k » ou « 2.4K » vaut 2400, « 1,2 M » vaut 1200000.
Vues = « Vues » ou « Views » (ou « Lectures » / « Plays » sur les anciennes versions). Portée = « Comptes touchés » ou « Accounts reached ».
Si l'image n'est pas une page de statistiques Instagram, réponds lisible: false et mets tout à null.`;
