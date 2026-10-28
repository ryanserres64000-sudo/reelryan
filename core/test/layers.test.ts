import { test } from "node:test";
import assert from "node:assert/strict";
import { addCalque, toDoc } from "../edit.ts";
import { addKey, boxAt, ease, isOn, moveLayer, newLayer, placeAt, poseAt, presetOf } from "../layers.ts";
import { sanitizeTimeline } from "../timeline.ts";

const clips = { a: { duration: 10 }, b: { duration: 8 }, p: { duration: 3 } };
const shot = (source: string, debut: number, fin: number) => ({ source, debut, fin, cadrage: "centre", transition: "coupe", garder_son: true, vitesse: 1, etalonnage: "naturel", mouvement: "aucun", raison: "" });
const doc = () => toDoc(sanitizeTimeline({ titre: "T", plans: [shot("a", 0, 5), shot("a", 5, 10)], textes: [], musique: { mode: "aucune" } }, clips).timeline);

test("a new layer is a few seconds of the clip, in its corner, sound off", () => {
  const l = newLayer("b", 2, clips.b, "coin", 10);
  assert.equal(l.fin, 4);
  assert.equal(l.volume, 0);
  const d = addCalque(doc(), l, clips);
  const c = d.timeline.calques![0];
  assert.equal(presetOf(c), "coin");
  assert.ok(isOn(c, 3) && !isOn(c, 6.1));
  // Near the end of the edit, it stops with it.
  assert.equal(newLayer("b", 9, clips.b, "plein", 10).fin, 1);
  assert.equal(newLayer("b", 0, clips.b, "detoure", 10).detourage, "personne");
});

test("easing goes from 0 to 1, the bounce overshoots", () => {
  for (const c of ["regulier", "doux", "rebond"] as const) { assert.equal(Math.round(ease(c, 0) * 1000), 0); assert.equal(ease(c, 1), 1); }
  assert.ok(ease("rebond", 0.8) > 1);
  assert.equal(ease("doux", 0.5), 0.5);
});

test("keyframes move the layer, the finger sets the keyframe at the play head", () => {
  let d = addCalque(doc(), newLayer("b", 2, clips.b, "coin", 10), clips);
  const id = d.timeline.calques![0].id;
  // Without keyframes, a move changes the layer itself.
  d = moveLayer(d, id, 3, { x: 0.3, y: 0.3 }, clips);
  assert.equal(d.timeline.calques![0].x, 0.3);
  assert.equal(d.timeline.calques![0].cles.length, 0);
  // A keyframe 2 s in: the start is kept as the first one.
  d = addKey(d, id, 4, clips, { x: 0.7, y: 0.7 });
  const c = d.timeline.calques![0];
  assert.deepEqual(c.cles.map(k => k.t), [0, 2]);
  assert.equal(poseAt(c, 2).x, 0.3);
  assert.equal(poseAt(c, 3).x, 0.5);
  assert.equal(poseAt(c, 5).x, 0.7);
  // Now a move edits the keyframe there instead of the whole layer.
  d = moveLayer(d, id, 4, { x: 0.6, echelle: 1.5 }, clips);
  const after = d.timeline.calques![0];
  assert.equal(after.cles.length, 2);
  assert.equal(poseAt(after, 4).x, 0.6);
  const b = boxAt(after, 4);
  assert.equal(b.w, Math.round(after.w * 1.5 * 1000) / 1000);
  assert.equal(b.left, Math.round((0.6 - b.w / 2) * 1000) / 1000);
});

test("a preset puts the layer back in place and drops its movement", () => {
  let d = addCalque(doc(), newLayer("b", 0, clips.b, "coin", 10), clips);
  const id = d.timeline.calques![0].id;
  d = addKey(d, id, 2, clips, { x: 0.1 });
  d = placeAt(d, id, "haut", clips);
  assert.equal(presetOf(d.timeline.calques![0]), "haut");
  assert.equal(d.timeline.calques![0].cles.length, 0);
});
