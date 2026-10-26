import { imposedTexts, sanitizeTimeline } from "../../../core/timeline";
import type { Brief, MontageResult, Rush } from "./types";
import { composeBrief } from "./brief";

// Lot 2 runs without the native module and without the server: sample rushes and a sample AI answer,
// passed through the same validation as the real one (core/timeline.ts).
export const SAMPLE_RUSHES: Rush[] = [
  { id: "r1", duration: 9, photo: false, badges: ["face", "speech"], sound: true },
  { id: "r2", duration: 6, photo: false, badges: [], sound: false },
  { id: "r3", duration: 4, photo: false, badges: ["blur"], sound: false },
  { id: "r4", duration: 12, photo: false, badges: ["speech"], sound: true },
  { id: "r5", duration: 4, photo: true, badges: [], sound: false },
  { id: "r6", duration: 7, photo: false, badges: ["face"], sound: false },
  { id: "r7", duration: 5, photo: false, badges: ["dark"], sound: false },
  { id: "r8", duration: 8, photo: false, badges: [], sound: false },
  { id: "r9", duration: 6, photo: false, badges: ["face"], sound: true },
];

const shot = (source: string, debut: number, fin: number, raison: string, extra = {}) =>
  ({ source, debut, fin, cadrage: "centre", transition: "coupe", garder_son: false, vitesse: 1, etalonnage: "chaud", mouvement: "aucun", raison, ...extra });

function sampleAnswer(rushes: Rush[], brief: Brief) {
  const ids = rushes.map(r => r.id), at = (i: number) => ids[i % ids.length];
  const end = imposedTexts(brief.text)[0] ?? "À très vite";
  const dur = (i: number) => rushes[i % rushes.length].duration;
  // The sample shots add up to about 11 s; stretch them towards the asked duration, within each rush.
  const k = Math.max(1, brief.duration / 11);
  const cut = (i: number, len: number, raison: string, extra = {}) => shot(at(i), 0, Math.min(len * k, dur(i)), raison, extra);
  const t = (s: number) => Math.round(s * k * 10) / 10;
  return [
    { variante: "accroche-forte", titre: "Le meilleur d'abord", intention: "J'ouvre sur ton plan le plus fort pour arrêter le pouce, puis je raconte la journée dans l'ordre et je finis sur ton message.",
      plans: [cut(1, 1.5, "Le geste le plus fort, en ouverture"), cut(0, 3, "Ta voix qui présente, gardée en entier", { garder_son: true }), cut(3, 2, "Valeur large pour respirer"), cut(5, 1.5, "Le sourire, avant la fin"), cut(7, 2.5, "Le résultat, plan final")],
      textes: [{ texte: "Ça se passe ici", debut: t(0), fin: t(1.5), position: "haut", style: "accroche" }, { texte: end, debut: t(8), fin: t(10.5), position: "bas", style: "signature" }],
      relecture: { corrections: ["J'ai raccourci l'accroche de 2 s", "J'ai retiré un plan flou"], plans_a_tourner: ["Un gros plan de tes mains au travail"] } },
    { variante: "posee", titre: "Prendre le temps", intention: "Des plans plus longs et des fondus : on sent l'ambiance et le soin, ton message arrive calmement à la fin.",
      plans: [cut(3, 3, "Installation douce"), cut(0, 3.5, "Ta voix, sans coupe", { garder_son: true, transition: "fondu" }), cut(5, 2.5, "Détail chaleureux", { transition: "fondu" }), cut(7, 3, "Le résultat")],
      textes: [{ texte: end, debut: t(8), fin: t(11), position: "bas", style: "signature" }],
      relecture: { corrections: ["J'ai allongé ton texte de fin pour qu'on ait le temps de le lire"], plans_a_tourner: [] } },
    { variante: "rythmee", titre: "Sur le rythme", intention: "Des coupes courtes sur chaque temps fort : ça bouge, c'est fait pour être revu en boucle.",
      plans: [cut(1, 1, "Ouverture sèche"), cut(5, 1, "Détail"), cut(7, 1, "Résultat en avant-goût"), cut(3, 1.5, "Large"), cut(8, 1, "Mouvement"), cut(0, 2, "Ta voix, juste la phrase clé", { garder_son: true }), cut(7, 2, "Plan final")],
      textes: [{ texte: "Regarde bien", debut: t(0), fin: t(1), position: "centre", style: "accroche" }, { texte: end, debut: t(7.5), fin: t(9.5), position: "bas", style: "signature" }],
      relecture: { corrections: [], plans_a_tourner: ["Un plan de la porte d'entrée"] } },
  ];
}

export function sampleResult(rushes: Rush[], brief: Brief): MontageResult {
  const clips = Object.fromEntries(rushes.map(r => [r.id, { duration: r.duration }]));
  const text = composeBrief(brief);
  const variantes = sampleAnswer(rushes, brief).map(v => sanitizeTimeline({
    ...v, musique: { mode: "aucune" }, exports: brief.platforms.map(plateforme => ({ plateforme })), legende: { texte: "", hashtags: [] },
  }, clips, { brief: text, maxDuration: Math.ceil(brief.duration * 1.2) }));
  return { variantes, cout_usd: 0, temps_s: 0 };
}

// Mirrors the server stream (lib/montage.js): local triage, then tagging, edit, review.
export function fakeMontage(rushes: Rush[], brief: Brief, onStep: (step: number) => void, signal: AbortSignal, stepMs = 1600): Promise<MontageResult> {
  return new Promise((resolve, reject) => {
    let step = 0;
    const tick = () => {
      if (signal.aborted) return reject(new Error("aborted"));
      step++;
      onStep(step);
      if (step === 4) resolve(sampleResult(rushes, brief)); else timer = setTimeout(tick, stepMs);
    };
    let timer = setTimeout(tick, stepMs);
    signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("aborted")); });
  });
}
