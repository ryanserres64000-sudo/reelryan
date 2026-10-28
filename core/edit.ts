// Full manual control over an edit (étude, ch. 5 §6 « Retouches à la main… Annuler et rétablir sans
// limite » ; Ryan, 28 octobre : « donner la main à l'utilisateur »). Pure functions on a timeline v1:
// the phone applies them instantly, without AI. Every shot and text gets a stable id, and what the
// person changes by hand is locked, so a later AI retouch cannot overwrite it.
import { LOGO_POSITIONS, timelineDuration, type Clips, type Plan, type Texte, type TimelineV1 } from "./timeline.ts";

export type EditDoc = { timeline: TimelineV1; planIds: string[]; texteIds: string[]; locked: string[] };
export type History = { past: EditDoc[]; present: EditDoc; future: EditDoc[] };

const MIN_SHOT = 0.5, MIN_TEXT = 0.4, HISTORY = 200;
const round = (n: number) => Math.round(n * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
let seq = 0;
const newId = (p: string) => `${p}${(++seq).toString(36)}${Date.now().toString(36).slice(-3)}`;

export function toDoc(timeline: TimelineV1): EditDoc {
  return { timeline, planIds: timeline.plans.map(() => newId("p")), texteIds: timeline.textes.map(() => newId("t")), locked: [] };
}

// Keeps `duree` true and every text inside the edit after a change.
function settle(d: EditDoc): EditDoc {
  const duree = round(timelineDuration(d.timeline.plans));
  const keep = d.timeline.textes.map(t => ({ ...t, debut: round(clamp(t.debut, 0, duree)), fin: round(clamp(t.fin, 0, duree)) }));
  const ok = keep.map(t => t.fin - t.debut >= MIN_TEXT);
  return {
    ...d, timeline: { ...d.timeline, duree, textes: keep.filter((_, i) => ok[i]) },
    texteIds: d.texteIds.filter((_, i) => ok[i]),
  };
}
const lock = (d: EditDoc, id: string) => (d.locked.includes(id) ? d.locked : [...d.locked, id]);
const withPlans = (d: EditDoc, plans: Plan[], planIds = d.planIds, locked = d.locked) => settle({ ...d, planIds, locked, timeline: { ...d.timeline, plans } });
const withTextes = (d: EditDoc, textes: Texte[], texteIds = d.texteIds, locked = d.locked) => settle({ ...d, texteIds, locked, timeline: { ...d.timeline, textes } });

// ---------- Shots ----------

export function trimPlan(d: EditDoc, i: number, debut: number, fin: number, clips: Clips): EditDoc {
  const p = d.timeline.plans[i], len = clips[p?.source]?.duration;
  if (!p || !len) return d;
  const a = clamp(debut, 0, len - MIN_SHOT), b = clamp(fin, a + MIN_SHOT, len);
  return withPlans(d, d.timeline.plans.map((x, j) => (j === i ? { ...x, debut: round(a), fin: round(b) } : x)), d.planIds, lock(d, d.planIds[i]));
}

export function movePlan(d: EditDoc, from: number, to: number): EditDoc {
  const n = d.timeline.plans.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return d;
  const plans = [...d.timeline.plans], ids = [...d.planIds];
  const [p] = plans.splice(from, 1), [id] = ids.splice(from, 1);
  plans.splice(to, 0, p); ids.splice(to, 0, id);
  // The first shot never has a transition.
  plans[0] = { ...plans[0], transition: "coupe" };
  return withPlans(d, plans, ids, lock(d, id));
}

export function replaceSource(d: EditDoc, i: number, source: string, clips: Clips): EditDoc {
  const p = d.timeline.plans[i], len = clips[source]?.duration;
  if (!p || !len) return d;
  const want = p.fin - p.debut, fin = Math.min(len, want), debut = 0;
  return withPlans(d, d.timeline.plans.map((x, j) => (j === i ? { ...x, source, debut, fin: round(Math.max(MIN_SHOT, fin)) } : x)), d.planIds, lock(d, d.planIds[i]));
}

export function deletePlan(d: EditDoc, i: number): EditDoc {
  if (d.timeline.plans.length <= 1 || !d.timeline.plans[i]) return d;
  const plans = d.timeline.plans.filter((_, j) => j !== i);
  plans[0] = { ...plans[0], transition: "coupe" };
  return withPlans(d, plans, d.planIds.filter((_, j) => j !== i), d.locked.filter(x => x !== d.planIds[i]));
}

export function setPlan(d: EditDoc, i: number, patch: Partial<Pick<Plan, "transition" | "etalonnage" | "vitesse" | "cadrage" | "garder_son" | "mouvement">>): EditDoc {
  if (!d.timeline.plans[i]) return d;
  const p = { ...d.timeline.plans[i], ...patch };
  if (patch.vitesse !== undefined) p.vitesse = round(clamp(patch.vitesse, 0.5, 2));
  if (i === 0) p.transition = "coupe";
  return withPlans(d, d.timeline.plans.map((x, j) => (j === i ? p : x)), d.planIds, lock(d, d.planIds[i]));
}

// ---------- Texts ----------

export function setTexte(d: EditDoc, i: number, patch: Partial<Pick<Texte, "texte" | "position" | "style" | "debut" | "fin">>): EditDoc {
  const t = d.timeline.textes[i];
  if (!t) return d;
  const next = { ...t, ...patch, texte: (patch.texte ?? t.texte).slice(0, 140) };
  if (!next.texte.trim()) return deleteTexte(d, i);
  return withTextes(d, d.timeline.textes.map((x, j) => (j === i ? next : x)), d.texteIds, lock(d, d.texteIds[i]));
}

export function addTexte(d: EditDoc, texte: string, at = 0): EditDoc {
  const end = Math.min(d.timeline.duree, at + 2);
  const t: Texte = { texte: texte.slice(0, 140), debut: round(Math.max(0, end - 2)), fin: round(end), position: "bas", style: "titre", impose: false };
  const id = newId("t");
  return withTextes(d, [...d.timeline.textes, t], [...d.texteIds, id], lock(d, id));
}

export function deleteTexte(d: EditDoc, i: number): EditDoc {
  if (!d.timeline.textes[i]) return d;
  return withTextes(d, d.timeline.textes.filter((_, j) => j !== i), d.texteIds.filter((_, j) => j !== i), d.locked.filter(x => x !== d.texteIds[i]));
}

// ---------- Brand, subtitles, music ----------

export function setLogo(d: EditDoc, position: (typeof LOGO_POSITIONS)[number]): EditDoc {
  const logo = d.timeline.charte.logo ?? { asset: "logo", position, taille: 0.22 };
  return { ...d, locked: lock(d, "logo"), timeline: { ...d.timeline, charte: { ...d.timeline.charte, logo: { ...logo, position } } } };
}

export function setSubtitles(d: EditDoc, actifs: boolean): EditDoc {
  return { ...d, locked: lock(d, "sous_titres"), timeline: { ...d.timeline, sous_titres: { ...d.timeline.sous_titres, actifs } } };
}

export function setVolume(d: EditDoc, volume: number): EditDoc {
  return { ...d, locked: lock(d, "musique"), timeline: { ...d.timeline, musique: { ...d.timeline.musique, volume: round(clamp(volume, 0, 1)) } } };
}

export const isLocked = (d: EditDoc, id: string) => d.locked.includes(id);

// ---------- Undo, redo ----------

export const startHistory = (d: EditDoc): History => ({ past: [], present: d, future: [] });
export function push(h: History, d: EditDoc): History {
  if (d === h.present) return h;
  return { past: [...h.past, h.present].slice(-HISTORY), present: d, future: [] };
}
export const undo = (h: History): History => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h);
export const redo = (h: History): History => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h);

// ---------- What changed (highlighted on the strip) ----------

export function changedPlans(before: EditDoc, after: EditDoc): string[] {
  const old = new Map(before.planIds.map((id, i) => [id, JSON.stringify(before.timeline.plans[i])]));
  return after.planIds.filter((id, i) => old.get(id) !== JSON.stringify(after.timeline.plans[i]) || before.planIds.indexOf(id) !== i);
}

// After an AI retouche: what the person locked comes back exactly as it was (shots by content, at
// their place; texts by id order). Returns the merged doc.
export function keepLocked(before: EditDoc, ai: TimelineV1): EditDoc {
  const plans = [...ai.plans], ids = ai.plans.map(() => newId("p"));
  const key = (p: Plan) => `${p.source}|${p.debut}|${p.fin}`;
  before.planIds.forEach((id, i) => {
    if (!before.locked.includes(id)) return;
    const p = before.timeline.plans[i];
    const at = plans.findIndex(x => key(x) === key(p));
    if (at >= 0) { plans[at] = p; ids[at] = id; return; }
    const to = Math.min(i, plans.length);
    plans.splice(to, 0, p); ids.splice(to, 0, id);
  });
  if (plans[0]) plans[0] = { ...plans[0], transition: "coupe" };
  const textes = [...ai.textes], tids = ai.textes.map(() => newId("t"));
  before.texteIds.forEach((id, i) => {
    if (!before.locked.includes(id)) return;
    const t = before.timeline.textes[i];
    const at = textes.findIndex(x => x.texte === t.texte);
    if (at >= 0) { textes[at] = t; tids[at] = id; } else { textes.push(t); tids.push(id); }
  });
  const timeline: TimelineV1 = {
    ...ai, plans, textes,
    charte: before.locked.includes("logo") ? before.timeline.charte : ai.charte,
    sous_titres: before.locked.includes("sous_titres") ? before.timeline.sous_titres : ai.sous_titres,
    musique: before.timeline.musique,
  };
  return settle({ timeline, planIds: ids, texteIds: tids, locked: before.locked });
}
