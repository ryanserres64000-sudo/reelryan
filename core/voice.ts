// Voice-over (étape 5 de la refonte, demande de Ryan du 28 octobre): a text typed or written by Ma DA
// from a sentence, read by a French voice on the server (ElevenLabs, the key stays there), laid on its
// own track, with subtitles timed on its words. Shared by the app and the server.
import type { Texte } from "./timeline.ts";

// The house voices; the server maps each id to a voice of its provider (MADA_VOIX_JSON).
export const VOIX = [
  { id: "camille", nom: "Camille", ton: "posée" },
  { id: "hugo", nom: "Hugo", ton: "énergique" },
  { id: "ines", nom: "Inès", ton: "douce" },
  { id: "leo", nom: "Léo", ton: "grave" },
] as const;
export type VoixId = (typeof VOIX)[number]["id"];
export const VITESSES = [0.9, 1, 1.1] as const;
export const MAX_TEXTE = 900;
// French read aloud: about 15 characters a second at normal speed.
const CHARS_PER_SECOND = 15;

export const isVoix = (v: unknown): v is VoixId => VOIX.some(x => x.id === v);
export const estimate = (texte: string, vitesse = 1) => Math.round((texte.trim().length / CHARS_PER_SECOND / vitesse) * 10) / 10;
// The longest text that fits in `seconds` of video.
export const charsFor = (seconds: number, vitesse = 1) => Math.max(40, Math.floor(seconds * CHARS_PER_SECOND * vitesse));

export type Mot = { mot: string; debut: number; fin: number };

// Words with their times from a character alignment (ElevenLabs « with-timestamps »).
export function wordsFrom(a: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }): Mot[] {
  const out: Mot[] = [];
  let cur: Mot | null = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) { if (cur) out.push(cur); cur = null; return; }
    const s = a.character_start_times_seconds[i] ?? 0, e = a.character_end_times_seconds[i] ?? s;
    if (!cur) cur = { mot: ch, debut: s, fin: e }; else { cur.mot += ch; cur.fin = e; }
  });
  if (cur) out.push(cur);
  return out.map(m => ({ mot: m.mot, debut: Math.round(m.debut * 100) / 100, fin: Math.round(m.fin * 100) / 100 }));
}

// Subtitles from the words, placed at `t` in the edit: three or four words, a line at a time, cut at
// punctuation, each held until the next one (or 1.2 s at most after its last word).
export function subtitles(mots: Mot[], t: number, lie: string, maxWords = 4): (Texte & { lie: string })[] {
  const lines: Mot[][] = [];
  let line: Mot[] = [];
  for (const m of mots) {
    line.push(m);
    if (line.length >= maxWords || /[.,;:!?…]$/.test(m.mot)) { lines.push(line); line = []; }
  }
  if (line.length) lines.push(line);
  return lines.map((l, i) => {
    const debut = t + l[0].debut, next = lines[i + 1] ? t + lines[i + 1][0].debut : Infinity;
    const fin = Math.min(next, t + l[l.length - 1].fin + 1.2);
    return { texte: l.map(m => m.mot).join(" "), debut: Math.round(debut * 100) / 100, fin: Math.round(Math.max(fin, debut + 0.4) * 100) / 100, position: "bas" as const, style: "info" as const, impose: false, accent: "", lie };
  });
}

// What the AI writes when asked for a voice-over (one small model call).
export const SCRIPT_SYSTEM = `Tu écris des voix off pour des Reels de commerçants, artisans et indépendants français.
Une voix off se dit à voix haute : phrases courtes, mots simples, tutoiement ou vouvoiement selon la marque, aucun emoji, aucun hashtag, pas de guillemets ni de didascalies.
Elle accroche dès la première phrase, dit une seule chose, et finit par une phrase qui donne envie de venir ou d'agir.
Évite les clichés publicitaires (« découvrez », « n'attendez plus », « incontournable »). Reste concret : un produit, un geste, un lieu, une heure.`;
export const SCRIPT_SCHEMA = { type: "object", additionalProperties: false, required: ["texte"], properties: { texte: { type: "string", description: "Le texte lu, prêt à dire" } } } as const;
export function scriptPrompt(consigne: string, o: { duree: number; marque?: string; ton?: string; brief?: string }): string {
  return [
    `Demande : ${consigne}`,
    o.brief ? `Sujet du Reel : ${o.brief}` : "",
    o.marque ? `La marque : ${o.marque}` : "",
    o.ton ? `Ton de la marque : ${o.ton}` : "",
    `La vidéo dure ${Math.round(o.duree)} secondes : ${charsFor(o.duree)} caractères au plus.`,
  ].filter(Boolean).join("\n");
}
