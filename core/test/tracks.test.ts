import { test } from "node:test";
import assert from "node:assert/strict";
import { addAudio, addCalque, deleteAudio, duplicatePlan, planTimes, setCalque, setCle, splitPlan, toDoc } from "../edit.ts";
import { lanes, magnets, snap } from "../tracks.ts";
import { sanitizeTimeline } from "../timeline.ts";

const clips = { a: { duration: 10 }, b: { duration: 8 } };
const shot = (source: string, debut: number, fin: number, extra = {}) => ({ source, debut, fin, cadrage: "centre", transition: "coupe", garder_son: true, vitesse: 1, etalonnage: "naturel", mouvement: "aucun", raison: "", ...extra });
const tl = () => sanitizeTimeline({ titre: "T", plans: [shot("a", 0, 4), shot("b", 0, 3)], textes: [{ texte: "Hop", debut: 0, fin: 1, position: "bas", style: "titre" }], musique: { mode: "tendance", bpm: 120, temps_forts: Array.from({ length: 21 }, (_, i) => i / 2) } }, clips).timeline;

test("an old timeline stays valid, the new tracks survive a second check", () => {
  const t = tl();
  assert.equal(t.audios, undefined);
  const again = sanitizeTimeline({ ...t, audios: [{ type: "voix-off", source: "voix1.m4a", t: 1, debut: 0, fin: 3, texte: "Bonjour", voix: "camille", ia: true }], calques: [{ source: "b", t: 0, debut: 0, fin: 2 }] }, clips).timeline;
  assert.equal(again.audios?.[0].ia, true);
  assert.equal(again.calques?.[0].source, "b");
  assert.ok(again.calques?.[0].id);
});

test("split at the play head and duplicate keep the length right", () => {
  let d = toDoc(tl());
  d = splitPlan(d, 2);
  assert.equal(d.timeline.plans.length, 3);
  assert.deepEqual(d.timeline.plans.slice(0, 2).map(p => [p.debut, p.fin]), [[0, 2], [2, 4]]);
  assert.equal(d.timeline.duree, 7);
  assert.equal(splitPlan(d, 0.2), d, "pas de morceau de moins d'une demi-seconde");
  d = duplicatePlan(d, 0);
  assert.equal(d.timeline.duree, 9);
  assert.deepEqual(planTimes(d.timeline).map(x => x.start), [0, 2, 4, 6]);
});

test("sounds and layers live on their tracks, three layers at once at most", () => {
  let d = toDoc(tl());
  d = addAudio(d, { type: "voix-off", source: "v.m4a", nom: "Voix off", t: 1, debut: 0, fin: 20, volume: 1, fondu_entree: 0, fondu_sortie: 0, texte: "Salut", voix: "camille", ia: true });
  assert.equal(d.timeline.audios?.[0].fin, 6, "coupée à la fin du montage");
  for (let i = 0; i < 4; i++) d = addCalque(d, { source: "b", t: 0, debut: 0, fin: 2 }, clips);
  assert.equal(d.timeline.calques?.length, 3);
  const id = d.timeline.calques![0].id;
  d = setCalque(d, id, { x: 0.2, opacite: 0.5 }, clips);
  d = setCle(d, id, { t: 1, x: 0.8, y: 0.2, echelle: 1.2, rotation: 0, opacite: 1, courbe: "rebond" }, clips);
  assert.equal(d.timeline.calques![0].cles.length, 1);
  d = deleteAudio(d, d.timeline.audios![0].id);
  assert.equal(d.timeline.audios?.length, 0);
});

test("Simple mode keeps texts, shots and music; the magnet finds beats and edges", () => {
  let d = toDoc(tl());
  d = addAudio(d, { type: "son", source: "s.m4a", nom: "Son", t: 0, debut: 0, fin: 2, volume: 1, fondu_entree: 0, fondu_sortie: 0, texte: "", voix: null, ia: false });
  const ids = { plans: d.planIds, textes: d.texteIds };
  const simple = lanes(d.timeline, ids, "simple"), full = lanes(d.timeline, ids, "complet");
  assert.deepEqual(simple.shown.map(l => l.key), ["textes", "plans", "musique"]);
  assert.deepEqual(simple.hidden, ["voix"]);
  assert.deepEqual(full.shown.map(l => l.key), ["textes", "plans", "voix", "musique"]);
  const m = magnets(d.timeline, 3.3, null, full.shown);
  assert.deepEqual(snap(1.07, m, 0.1), { time: 1, snapped: true });
  assert.deepEqual(snap(3.25, m, 0.1), { time: 3.3, snapped: true });
  assert.equal(snap(2.7, m, 0.1).snapped, false);
});
