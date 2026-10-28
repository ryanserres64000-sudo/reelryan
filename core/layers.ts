// Videos and photos over the frame (étape 6 de la refonte): picture in picture, split screen, a
// round bubble, a person cut out of their background, a green screen. The layer's place can change
// along the way with keyframes. Shared by the app (preview, gestures) and read the same way by the
// native render (Compositor.swift), so what moves on screen is what moves in the file.
import { setCalque, setCle, type EditDoc } from "./edit.ts";
import type { Calque, Cle, Clips, COURBES } from "./timeline.ts";

// Positions and sizes are fractions of the 1080 × 1920 frame, x and y at the centre of the layer.
// With w = h the box keeps the 9:16 of a phone video.
export const PRESETS = {
  coin: { x: 0.72, y: 0.28, w: 0.4, h: 0.4, arrondi: 0.08 },
  bulle: { x: 0.5, y: 0.7, w: 0.42, h: Math.round((0.42 * 1080 / 1920) * 1000) / 1000, arrondi: 0.5 },
  haut: { x: 0.5, y: 0.25, w: 1, h: 0.5, arrondi: 0 },
  bas: { x: 0.5, y: 0.75, w: 1, h: 0.5, arrondi: 0 },
  plein: { x: 0.5, y: 0.5, w: 1, h: 1, arrondi: 0 },
} as const;
export type Preset = keyof typeof PRESETS;
// A cut-out person stands in the frame, feet at the bottom.
const CUTOUT = { x: 0.5, y: 0.58, w: 0.9, h: 0.9, arrondi: 0 };
export const DEFAULT_SECONDS = 4;

export type Pose = { x: number; y: number; echelle: number; rotation: number; opacite: number };
const r3 = (n: number) => Math.round(n * 1000) / 1000;

// The layer to add at `at`: a few seconds of the clip (or until the end of the edit), sound off.
export function newLayer(source: string, at: number, clip: { duration: number; photo?: boolean }, preset: Preset | "detoure", duree: number, detourage: Calque["detourage"] = "aucun"): Partial<Calque> & { source: string } {
  const place = preset === "detoure" ? CUTOUT : PRESETS[preset];
  const length = Math.min(clip.photo ? DEFAULT_SECONDS : clip.duration, DEFAULT_SECONDS, Math.max(0.5, duree - at));
  return { source, photo: !!clip.photo, t: at, debut: 0, fin: length, ...place, rotation: 0, opacite: 1, fusion: "normal", detourage: preset === "detoure" && detourage === "aucun" ? "personne" : detourage, volume: 0, cles: [] };
}

export const presetOf = (c: Calque): Preset | null =>
  (Object.keys(PRESETS) as Preset[]).find(k => { const p = PRESETS[k]; return Math.abs(c.x - p.x) < 0.01 && Math.abs(c.y - p.y) < 0.01 && Math.abs(c.w - p.w) < 0.01 && Math.abs(c.h - p.h) < 0.01; }) ?? null;
export const placeAt = (d: EditDoc, id: string, preset: Preset, clips: Clips) => setCalque(d, id, { ...PRESETS[preset], cles: [] }, clips);

// Easing of the move that arrives at a keyframe: steady, soft (in and out), or a small bounce.
export function ease(courbe: (typeof COURBES)[number], u: number): number {
  const v = Math.min(1, Math.max(0, u));
  if (courbe === "regulier") return v;
  if (courbe === "doux") return v * v * (3 - 2 * v);
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(v - 1, 3) + c1 * Math.pow(v - 1, 2);
}

const base = (c: Calque): Pose => ({ x: c.x, y: c.y, echelle: 1, rotation: c.rotation, opacite: c.opacite });
const of = (k: Cle): Pose => ({ x: k.x, y: k.y, echelle: k.echelle, rotation: k.rotation, opacite: k.opacite });

// Where the layer is at `time` (seconds in the edit).
export function poseAt(c: Calque, time: number): Pose {
  const keys = c.cles, rel = time - c.t;
  if (!keys.length) return base(c);
  if (rel <= keys[0].t) return of(keys[0]);
  const last = keys[keys.length - 1];
  if (rel >= last.t) return of(last);
  const i = keys.findIndex(k => k.t > rel), a = keys[i - 1], b = keys[i];
  const u = ease(b.courbe, (rel - a.t) / Math.max(0.001, b.t - a.t));
  const mix = (p: number, q: number) => p + (q - p) * u;
  return { x: r3(mix(a.x, b.x)), y: r3(mix(a.y, b.y)), echelle: r3(mix(a.echelle, b.echelle)), rotation: r3(mix(a.rotation, b.rotation)), opacite: r3(Math.min(1, Math.max(0, mix(a.opacite, b.opacite)))) };
}

// The box on screen at `time`, as fractions: left, top, width, height.
export function boxAt(c: Calque, time: number): { left: number; top: number; w: number; h: number; rotation: number; opacite: number } {
  const p = poseAt(c, time), w = c.w * p.echelle, h = c.h * p.echelle;
  return { left: r3(p.x - w / 2), top: r3(p.y - h / 2), w: r3(w), h: r3(h), rotation: p.rotation, opacite: p.opacite };
}

export const isOn = (c: Calque, time: number) => time >= c.t && time < c.t + c.fin - c.debut;

// A move or resize with the finger. Without keyframes it changes the layer; with keyframes it sets
// (or adds) the keyframe at that moment, so the movement is kept.
export function moveLayer(d: EditDoc, id: string, time: number, patch: Partial<Pick<Pose, "x" | "y" | "echelle">>, clips: Clips): EditDoc {
  const c = (d.timeline.calques ?? []).find(x => x.id === id);
  if (!c) return d;
  if (!c.cles.length) {
    const k = patch.echelle ?? 1;
    return setCalque(d, id, { x: r3(patch.x ?? c.x), y: r3(patch.y ?? c.y), w: r3(c.w * k), h: r3(c.h * k) }, clips);
  }
  return addKey(d, id, time, clips, patch);
}

// A keyframe at the play head with the layer's place at that moment. The first one also marks the
// start, so the layer moves from where it was.
export function addKey(d: EditDoc, id: string, time: number, clips: Clips, patch: Partial<Pose> = {}, courbe: Cle["courbe"] = "doux"): EditDoc {
  const c = (d.timeline.calques ?? []).find(x => x.id === id);
  if (!c) return d;
  const rel = Math.round(Math.min(c.fin - c.debut, Math.max(0, time - c.t)) * 100) / 100;
  const p = { ...poseAt(c, time), ...patch };
  let next = d;
  if (!c.cles.length && rel > 0.1) next = setCle(next, id, { t: 0, ...base(c), courbe }, clips);
  return setCle(next, id, { t: rel, x: r3(p.x), y: r3(p.y), echelle: r3(p.echelle), rotation: r3(p.rotation), opacite: r3(p.opacite), courbe }, clips);
}


