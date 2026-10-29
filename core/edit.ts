// Full manual control over an edit (étude, ch. 5 §6 « Retouches à la main… Annuler et rétablir sans
// limite » ; Ryan, 28 octobre : « donner la main à l'utilisateur »). Pure functions on a timeline v1:
// the phone applies them instantly, without AI. Every shot and text gets a stable id, and what the
// person changes by hand is locked, so a later AI retouch cannot overwrite it.
import { LOGO_POSITIONS, sanitizeCadre, sanitizeReglages, MAX_CALQUES_SIMULTANES, TRANSITION_SECONDS, sanitizeAudios, sanitizeCalques, timelineDuration, type AudioClip, type Calque, type Cle, type Clips, type Plan, type Texte, type TimelineV1 } from "./timeline.ts";
import type { DuoId } from "./typo.ts";

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
    ...d, timeline: {
      ...d.timeline, duree, textes: keep.filter((_, i) => ok[i]), effets: (d.timeline.effets ?? []).filter(e => e.t < duree),
      // Sounds and layers that start after the end go; the others are cut at the end.
      ...(d.timeline.audios ? { audios: d.timeline.audios.filter(a => a.t < duree - 0.2).map(a => ({ ...a, fin: round(Math.min(a.fin, a.debut + duree - a.t)) })) } : {}),
      ...(d.timeline.calques ? { calques: d.timeline.calques.filter(c => c.t < duree - MIN_SHOT).map(c => ({ ...c, fin: round(Math.min(c.fin, c.debut + duree - c.t)) })) } : {}),
    },
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

export function setPlan(d: EditDoc, i: number, patch: Partial<Pick<Plan, "transition" | "etalonnage" | "vitesse" | "cadrage" | "garder_son" | "mouvement" | "volume" | "cadre" | "reglages">>): EditDoc {
  if (!d.timeline.plans[i]) return d;
  const p = { ...d.timeline.plans[i], ...patch };
  if (patch.vitesse !== undefined) p.vitesse = round(clamp(patch.vitesse, 0.5, 2));
  if (patch.volume !== undefined) p.volume = round(clamp(patch.volume, 0, 2));
  // A reframe back to the centre, or settings back to 0, leave no trace.
  if ("cadre" in patch) { const c = sanitizeCadre(patch.cadre); if (c) p.cadre = c; else delete p.cadre; }
  if ("reglages" in patch) { const r = sanitizeReglages(patch.reglages); if (r) p.reglages = r; else delete p.reglages; }
  if (i === 0) p.transition = "coupe";
  return withPlans(d, d.timeline.plans.map((x, j) => (j === i ? p : x)), d.planIds, lock(d, d.planIds[i]));
}

// Where each shot starts and ends in the edit (speed and transitions counted).
export function planTimes(t: Pick<TimelineV1, "plans">): { start: number; end: number }[] {
  let at = 0;
  return t.plans.map((p, i) => {
    const start = Math.max(0, at - (i && p.transition !== "coupe" ? TRANSITION_SECONDS : 0)), end = start + (p.fin - p.debut) / (p.vitesse || 1);
    at = end;
    return { start, end };
  });
}

// Cuts a shot in two at a moment of the edit (« Couper » under the play head). Both halves keep
// everything; the second starts with a plain cut.
export function splitPlan(d: EditDoc, at: number): EditDoc {
  const times = planTimes(d.timeline), i = times.findIndex(x => at > x.start && at < x.end);
  if (i < 0) return d;
  const p = d.timeline.plans[i], cut = round(p.debut + (at - times[i].start) * p.vitesse);
  if (cut - p.debut < MIN_SHOT || p.fin - cut < MIN_SHOT) return d;
  const a = { ...p, fin: cut }, b = { ...p, debut: cut, transition: "coupe" as const };
  const plans = [...d.timeline.plans.slice(0, i), a, b, ...d.timeline.plans.slice(i + 1)];
  const id = newId("p"), ids = [...d.planIds.slice(0, i + 1), id, ...d.planIds.slice(i + 1)];
  return withPlans(d, plans, ids, lock({ ...d, locked: lock(d, d.planIds[i]) }, id));
}

export function duplicatePlan(d: EditDoc, i: number): EditDoc {
  const p = d.timeline.plans[i];
  if (!p) return d;
  const id = newId("p");
  return withPlans(d, [...d.timeline.plans.slice(0, i + 1), { ...p, transition: "coupe" }, ...d.timeline.plans.slice(i + 1)], [...d.planIds.slice(0, i + 1), id, ...d.planIds.slice(i + 1)], lock(d, id));
}

// Another passage of a rush, chosen by hand (Ryan, 28 octobre : « faire un montage à différents
// moments d'une même vidéo »): `debut` to `debut + length` of `source`, put after shot `after` (-1:
// first), with a plain cut. It keeps the look of the shot it follows.
export function addPassage(d: EditDoc, source: string, debut: number, length: number, after: number, clips: Clips): EditDoc {
  const len = clips[source]?.duration;
  if (!len || len < MIN_SHOT) return d;
  const l = clamp(length, MIN_SHOT, len), a = round(clamp(debut, 0, len - l));
  const near = d.timeline.plans[Math.max(0, after)];
  const p: Plan = {
    source, debut: a, fin: round(a + l), cadrage: "centre", transition: "coupe", garder_son: near?.garder_son ?? false, vitesse: 1,
    etalonnage: near?.etalonnage ?? "naturel", mouvement: "aucun", raison: "",
  };
  const at = clamp(after + 1, 0, d.timeline.plans.length), id = newId("p");
  const plans = [...d.timeline.plans.slice(0, at), p, ...d.timeline.plans.slice(at)];
  plans[0] = { ...plans[0], transition: "coupe" };
  return withPlans(d, plans, [...d.planIds.slice(0, at), id, ...d.planIds.slice(at)], lock(d, id));
}

// The passages of a rush already in the edit, in rush time: to show what is taken and what is not.
export function passagesOf(t: Pick<TimelineV1, "plans">, source: string): { debut: number; fin: number; index: number }[] {
  return t.plans.map((p, index) => ({ debut: p.debut, fin: p.fin, index, source: p.source })).filter(p => p.source === source).map(({ debut, fin, index }) => ({ debut, fin, index }));
}

// ---------- Sounds on their own tracks (voice-over, recording, imported sound) ----------

const withAudios = (d: EditDoc, audios: AudioClip[], id?: string) => settle({ ...d, locked: id ? lock(d, id) : d.locked, timeline: { ...d.timeline, audios: sanitizeAudios(audios, d.timeline.duree) } });
export function addAudio(d: EditDoc, a: Omit<AudioClip, "id"> & { id?: string }): EditDoc {
  const id = a.id ?? newId("a");
  return withAudios(d, [...(d.timeline.audios ?? []), { ...a, id }], id);
}
export function setAudio(d: EditDoc, id: string, patch: Partial<Omit<AudioClip, "id">>): EditDoc {
  const list = d.timeline.audios ?? [], a = list.find(x => x.id === id);
  if (!a) return d;
  // Its subtitles follow the voice when it moves.
  const shift = patch.t !== undefined ? patch.t - a.t : 0;
  const moved = shift ? { ...d, timeline: { ...d.timeline, textes: d.timeline.textes.map(x => (x.lie === id ? { ...x, debut: round(x.debut + shift), fin: round(x.fin + shift) } : x)) } } : d;
  return withAudios(moved, list.map(x => (x.id === id ? { ...x, ...patch } : x)), id);
}
// The voice goes with its subtitles.
export function deleteAudio(d: EditDoc, id: string): EditDoc {
  const keep = d.timeline.textes.map(x => x.lie !== id);
  const rest = { ...d, texteIds: d.texteIds.filter((_, i) => keep[i]), timeline: { ...d.timeline, textes: d.timeline.textes.filter((_, i) => keep[i]) } };
  return withAudios(rest, (d.timeline.audios ?? []).filter(a => a.id !== id));
}
// A voice-over and its subtitle lines in one step (one « Annuler »).
// `ducking`: whether the music goes down while someone speaks (left as it was when not given).
export function addVoiceOver(d: EditDoc, a: Omit<AudioClip, "id"> & { id: string }, lines: Texte[], ducking?: boolean): EditDoc {
  const withVoice = addAudio(d, a);
  if (withVoice === d) return d;
  const ids = lines.map(() => newId("t"));
  const next = withTextes(withVoice, [...withVoice.timeline.textes, ...lines], [...withVoice.texteIds, ...ids], [...withVoice.locked, ...ids]);
  return ducking === undefined ? next : { ...next, timeline: { ...next.timeline, musique: { ...next.timeline.musique, ducking_voix: ducking } } };
}

// ---------- Layers over the frame (picture in picture, cut-out, keyframes) ----------

const withCalques = (d: EditDoc, calques: Calque[], clips: Clips, id?: string) => settle({ ...d, locked: id ? lock(d, id) : d.locked, timeline: { ...d.timeline, calques: sanitizeCalques(calques, clips, d.timeline.duree) } });
export function addCalque(d: EditDoc, c: Partial<Calque> & { source: string }, clips: Clips): EditDoc {
  const id = c.id ?? newId("c");
  const before = (d.timeline.calques ?? []).length, next = withCalques(d, [...(d.timeline.calques ?? []), { ...c, id } as Calque], clips, id);
  // Refused when three layers already play at that moment: nothing changes.
  return (next.timeline.calques ?? []).length > before ? next : d;
}
export function setCalque(d: EditDoc, id: string, patch: Partial<Omit<Calque, "id">>, clips: Clips): EditDoc {
  const list = d.timeline.calques ?? [];
  if (!list.some(c => c.id === id)) return d;
  return withCalques(d, list.map(c => (c.id === id ? { ...c, ...patch } : c)), clips, id);
}
export const deleteCalque = (d: EditDoc, id: string, clips: Clips): EditDoc => withCalques(d, (d.timeline.calques ?? []).filter(c => c.id !== id), clips);

// A keyframe at `t` (from the start of the layer) with the layer's place at that moment; replaces one
// within a tenth of a second.
export function setCle(d: EditDoc, id: string, cle: Cle, clips: Clips): EditDoc {
  const c = (d.timeline.calques ?? []).find(x => x.id === id);
  if (!c) return d;
  return setCalque(d, id, { cles: [...c.cles.filter(k => Math.abs(k.t - cle.t) > 0.1), cle].sort((a, b) => a.t - b.t) }, clips);
}
export function deleteCle(d: EditDoc, id: string, t: number, clips: Clips): EditDoc {
  const c = (d.timeline.calques ?? []).find(x => x.id === id);
  return c ? setCalque(d, id, { cles: c.cles.filter(k => Math.abs(k.t - t) > 0.1) }, clips) : d;
}

// ---------- Texts ----------

export function setTexte(d: EditDoc, i: number, patch: Partial<Pick<Texte, "texte" | "position" | "style" | "debut" | "fin" | "accent" | "place" | "look">>): EditDoc {
  const t = d.timeline.textes[i];
  if (!t) return d;
  const next = { ...t, ...patch, texte: (patch.texte ?? t.texte).slice(0, 140) };
  // `place: undefined` puts the text back in its slot (haut, centre, bas).
  if ("place" in patch && !patch.place) delete next.place;
  if ("look" in patch && !patch.look) delete next.look;
  // Only a title carries a duo accent (core/typo.ts).
  next.accent = next.style === "accroche" || next.style === "titre" ? next.accent.trim().slice(0, 30) : "";
  if (!next.texte.trim()) return deleteTexte(d, i);
  return withTextes(d, d.timeline.textes.map((x, j) => (j === i ? next : x)), d.texteIds, lock(d, d.texteIds[i]));
}

export function addTexte(d: EditDoc, texte: string, at = 0): EditDoc {
  const end = Math.min(d.timeline.duree, at + 2);
  const t: Texte = { texte: texte.slice(0, 140), debut: round(Math.max(0, end - 2)), fin: round(end), position: "bas", style: "titre", impose: false, accent: "", place: { x: 0.5, y: 0.5, w: 0.8, s: 1, r: 0 } };
  const id = newId("t");
  return withTextes(d, [...d.timeline.textes, t], [...d.texteIds, id], lock(d, id));
}

// The same text a little lower, so both show and the copy can be dragged away.
export function duplicateTexte(d: EditDoc, i: number): EditDoc {
  const t = d.timeline.textes[i];
  if (!t) return d;
  const p = t.place ?? { x: 0.5, y: 0.5, w: 0.8, s: 1, r: 0 };
  const copy: Texte = { ...t, impose: false, place: { ...p, y: Math.min(1, round(p.y + 0.08)) } };
  const id = newId("t");
  return withTextes(d, [...d.timeline.textes.slice(0, i + 1), copy, ...d.timeline.textes.slice(i + 1)], [...d.texteIds.slice(0, i + 1), id, ...d.texteIds.slice(i + 1)], lock(d, id));
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

// The title duo of this edit; `null` writes titles in the brand fonts only.
export function setDuo(d: EditDoc, duo: DuoId | null): EditDoc {
  return { ...d, locked: lock(d, "duo"), timeline: { ...d.timeline, charte: { ...d.timeline.charte, duo } } };
}

// Sound effects: removed one by one by hand (the AI places them).
export function deleteEffet(d: EditDoc, i: number): EditDoc {
  const effets = d.timeline.effets ?? [];
  if (!effets[i]) return d;
  return { ...d, locked: lock(d, "effets"), timeline: { ...d.timeline, effets: effets.filter((_, j) => j !== i) } };
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
    charte: { ...(before.locked.includes("logo") ? before.timeline.charte : ai.charte), ...(before.locked.includes("duo") ? { duo: before.timeline.charte.duo } : {}) },
    effets: before.locked.includes("effets") ? before.timeline.effets : ai.effets,
    sous_titres: before.locked.includes("sous_titres") ? before.timeline.sous_titres : ai.sous_titres,
    musique: before.timeline.musique,
  };
  return settle({ timeline, planIds: ids, texteIds: tids, locked: before.locked });
}

// ---------- Manual montage (free, no AI: étude, ch. 8 §2 « montage manuel illimité ») ----------

// The chosen rushes in the order they were picked, about the target length, cut plainly; the person
// then edits everything by hand in the editor.
export function manualTimeline(rushes: { id: string; duration: number; photo?: boolean }[], target: number, sanitize: (raw: unknown, clips: Clips) => TimelineV1): TimelineV1 {
  const per = Math.max(1, Math.min(4, target / Math.max(1, rushes.length)));
  const plans = rushes.map(r => {
    const len = Math.min(r.photo ? 2.5 : per, r.duration);
    const debut = r.photo ? 0 : Math.max(0, Math.min(r.duration - len, r.duration * 0.25));
    return { source: r.id, debut: round(debut), fin: round(debut + len), transition: "coupe", cadrage: "centre", vitesse: 1, etalonnage: "naturel", mouvement: r.photo ? "zoom-avant" : "aucun", garder_son: !r.photo, raison: "" };
  });
  return sanitize({ titre: "Mon montage", intention: "", plans, textes: [], musique: { mode: "aucune" } }, Object.fromEntries(rushes.map(r => [r.id, { duration: r.duration }])));
}
