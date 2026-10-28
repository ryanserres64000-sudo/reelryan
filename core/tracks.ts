// The editor's tracks (étude de la refonte, « Un vrai logiciel de montage »): what each lane shows,
// in edit time, and which lanes the Simple mode keeps. Plus the magnet: a dragged edge snaps to the
// play head, the music's beats and the edges of the other pieces.
import { planTimes } from "./edit.ts";
import type { TimelineV1 } from "./timeline.ts";

export const LANES = ["textes", "calques", "plans", "voix", "musique", "effets"] as const;
export type LaneKey = (typeof LANES)[number];
export type Mode = "simple" | "complet";
export type Piece = { id: string; index: number; start: number; end: number; label: string };
export type Lane = { key: LaneKey; pieces: Piece[] };
const SIMPLE: LaneKey[] = ["textes", "plans", "musique"];

export function lanes(t: TimelineV1, ids: { plans: string[]; textes: string[] }, mode: Mode): { shown: Lane[]; hidden: LaneKey[] } {
  const all: Lane[] = [
    { key: "textes", pieces: t.textes.map((x, i) => ({ id: ids.textes[i], index: i, start: x.debut, end: x.fin, label: x.texte })) },
    { key: "calques", pieces: (t.calques ?? []).map((c, i) => ({ id: c.id, index: i, start: c.t, end: c.t + c.fin - c.debut, label: c.source })) },
    { key: "plans", pieces: planTimes(t).map((x, i) => ({ id: ids.plans[i], index: i, start: x.start, end: x.end, label: t.plans[i].source })) },
    { key: "voix", pieces: (t.audios ?? []).map((a, i) => ({ id: a.id, index: i, start: a.t, end: a.t + a.fin - a.debut, label: a.nom || a.texte })) },
    { key: "musique", pieces: t.musique.mode === "aucune" ? [] : [{ id: "musique", index: 0, start: 0, end: t.duree, label: "" }] },
    { key: "effets", pieces: (t.effets ?? []).map((e, i) => ({ id: `e${i}`, index: i, start: e.t, end: e.t + 0.4, label: e.type })) },
  ];
  // Always the texts and the shots (something to add to, something to hold); the others when used.
  const used = all.filter(l => l.key === "plans" || l.key === "textes" || l.pieces.length);
  const shown = mode === "complet" ? used : used.filter(l => SIMPLE.includes(l.key));
  return { shown, hidden: used.filter(l => !shown.includes(l)).map(l => l.key) };
}

// The nearest target within `tolerance` seconds, or the time itself.
export function snap(time: number, targets: number[], tolerance: number): { time: number; snapped: boolean } {
  let best: number | null = null;
  for (const x of targets) if (Math.abs(x - time) <= tolerance && (best === null || Math.abs(x - time) < Math.abs(best - time))) best = x;
  return best === null ? { time, snapped: false } : { time: best, snapped: true };
}

// What a dragged edge can stick to: the play head, the beats of the passage, the edges of every piece
// except the one being dragged.
export function magnets(t: TimelineV1, playhead: number, except: string | null, shown: Lane[]): number[] {
  const from = t.musique.passage?.debut ?? 0;
  const beats = t.musique.temps_forts.map(b => b - from).filter(b => b >= 0 && b <= t.duree);
  const edges = shown.flatMap(l => l.pieces.filter(p => p.id !== except).flatMap(p => [p.start, p.end]));
  return [playhead, 0, t.duree, ...beats, ...edges];
}

// Pixels per second of the strip: pinch to zoom between a whole Reel on screen and a tenth of a second.
export const ZOOM = { min: 8, max: 400, start: 40 } as const;
export const clampZoom = (z: number) => Math.min(ZOOM.max, Math.max(ZOOM.min, z));
