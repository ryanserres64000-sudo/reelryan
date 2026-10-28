import { test } from "node:test";
import assert from "node:assert/strict";
import { addTexte, changedPlans, duplicateTexte, deletePlan, deleteTexte, keepLocked, movePlan, push, redo, replaceSource, setLogo, setPlan, setTexte, startHistory, toDoc, trimPlan, undo } from "../edit.ts";
import { applyCorrection, emptyMemory, forget, learn } from "../corrections.ts";
import { sanitizeTimeline, timelineDuration } from "../timeline.ts";

const clips = { a: { duration: 10 }, b: { duration: 8 }, c: { duration: 6 } };
const shot = (source: string, debut: number, fin: number, extra = {}) => ({ source, debut, fin, cadrage: "centre", transition: "coupe", garder_son: false, vitesse: 1, etalonnage: "chaud", mouvement: "aucun", raison: "", ...extra });
function doc() {
  const { timeline } = sanitizeTimeline({
    titre: "Test", plans: [shot("a", 0, 3), shot("b", 1, 4, { transition: "fondu" }), shot("c", 0, 2)],
    textes: [{ texte: "Ouvert dès 11h", debut: 6, fin: 7.5, position: "bas", style: "signature" }, { texte: "Regarde", debut: 0, fin: 1, position: "haut", style: "accroche" }],
    musique: { mode: "aucune" },
  }, clips, { brief: "Finir sur « Ouvert dès 11h »" });
  return toDoc(timeline);
}

test("hand edits stay inside the rushes, keep the duration true, and lock what they touch", () => {
  let d = doc();
  d = trimPlan(d, 0, -2, 20, clips);
  assert.deepEqual([d.timeline.plans[0].debut, d.timeline.plans[0].fin], [0, 10]);
  assert.ok(d.locked.includes(d.planIds[0]));
  assert.equal(d.timeline.duree, Math.round(timelineDuration(d.timeline.plans) * 100) / 100);
  d = movePlan(d, 1, 0);
  assert.equal(d.timeline.plans[0].source, "b");
  assert.equal(d.timeline.plans[0].transition, "coupe", "le premier plan n'a jamais de transition");
  d = replaceSource(d, 2, "c", clips);
  assert.ok(d.timeline.plans[2].fin <= 6);
  d = setPlan(d, 1, { vitesse: 5, etalonnage: "froid" });
  assert.equal(d.timeline.plans[1].vitesse, 2);
  const before = d.timeline.plans.length;
  d = deletePlan(d, 2);
  assert.equal(d.timeline.plans.length, before - 1);
  assert.equal(d.planIds.length, d.timeline.plans.length);
  let one = doc(); one = deletePlan(deletePlan(deletePlan(one, 0), 0), 0);
  assert.equal(one.timeline.plans.length, 1, "on garde toujours un plan");
});

test("texts: edit, move, add, delete, and an emptied text is removed", () => {
  let d = doc();
  d = setTexte(d, 1, { texte: "Regarde bien", position: "centre" });
  assert.equal(d.timeline.textes[1].texte, "Regarde bien");
  assert.ok(d.locked.includes(d.texteIds[1]));
  d = addTexte(d, "Nouveau", 3);
  assert.equal(d.timeline.textes.length, 3);
  d = setTexte(d, 2, { texte: "  " });
  assert.equal(d.timeline.textes.length, 2);
  d = deleteTexte(d, 0);
  assert.deepEqual(d.timeline.textes.map(t => t.texte), ["Regarde bien"]);
  assert.equal(d.texteIds.length, 1);
  // Shortening the edit pulls texts inside it, and drops one that no longer fits.
  let s = doc();
  s = trimPlan(trimPlan(trimPlan(s, 0, 0, 1, clips), 1, 1, 2, clips), 2, 0, 1, clips);
  assert.ok(s.timeline.textes.every(t => t.fin <= s.timeline.duree));
});

test("undo and redo without limit; what changed is known", () => {
  let h = startHistory(doc());
  const first = h.present;
  for (let i = 0; i < 5; i++) h = push(h, trimPlan(h.present, 0, 0, 1 + i * 0.5, clips));
  assert.equal(h.present.timeline.plans[0].fin, 3);
  for (let i = 0; i < 5; i++) h = undo(h);
  assert.equal(h.present, first);
  h = redo(redo(h));
  assert.equal(h.present.timeline.plans[0].fin, 1.5);
  assert.deepEqual(changedPlans(first, h.present), [first.planIds[0]]);
});

test("an AI retouche never overwrites what was locked by hand", () => {
  let d = doc();
  d = trimPlan(d, 1, 2, 5, clips);
  d = setTexte(d, 1, { texte: "Mon accroche à moi" });
  d = setLogo(d, "debut");
  const ai = sanitizeTimeline({ plans: [shot("c", 0, 2), shot("a", 2, 5)], textes: [{ texte: "Autre", debut: 0, fin: 1, position: "haut", style: "accroche" }], musique: { mode: "aucune" }, charte: { logo: { asset: "logo", position: "fin" } } }, clips).timeline;
  const m = keepLocked(d, ai);
  assert.ok(m.timeline.plans.some(p => p.source === "b" && p.debut === 2 && p.fin === 5), "le plan retouché à la main revient");
  assert.ok(m.timeline.textes.some(t => t.texte === "Mon accroche à moi"));
  assert.equal(m.timeline.charte.logo?.position, "debut");
  assert.equal(m.planIds.length, m.timeline.plans.length);
});

test("common corrections are understood without AI, clause by clause", () => {
  const d = doc();
  const r = applyCorrection(d, "Plus rythmé et logo à la fin, textes en haut", clips);
  assert.deepEqual(r.understood.map(u => u.key), ["rythme:rapide", "logo:fin", "textes:haut"]);
  assert.equal(r.rest, "");
  assert.ok(r.doc.timeline.duree < d.timeline.duree);
  assert.ok(r.doc.timeline.plans.every(p => p.transition === "coupe"));
  assert.equal(r.doc.timeline.charte.logo?.position, "fin");
  const del = applyCorrection(d, "enlève le plan 2", clips);
  assert.equal(del.doc.timeline.plans.length, 2);
  assert.equal(applyCorrection(d, "commence par le dernier", clips).doc.timeline.plans[0].source, "c");
  assert.equal(applyCorrection(d, "en noir et blanc", clips).doc.timeline.plans[0].etalonnage, "noir-et-blanc");
  const flou = applyCorrection(d, "Enlève le plan flou", clips, ["b"]);
  assert.deepEqual(flou.doc.timeline.plans.map(p => p.source), ["a", "c"]);
  assert.equal(applyCorrection(d, "Enlève le plan flou", clips, []).rest, "Enlève le plan flou", "rien de flou : l'IA s'en charge");
  const mixed = applyCorrection(d, "plus chaud, et mets mon chien dans le premier plan", clips);
  assert.equal(mixed.understood.length, 1);
  assert.match(mixed.rest, /chien/, "le reste part à l'IA");
  // Without the imposed text, « enlève les textes » keeps the one the person imposed.
  assert.deepEqual(applyCorrection(d, "enlève les textes", clips).doc.timeline.textes.map(t => t.texte), ["Ouvert dès 11h"]);
});

test("corrections leave locked shots alone", () => {
  let d = doc();
  d = trimPlan(d, 0, 0, 3, clips);
  const r = applyCorrection(d, "plus court", clips);
  assert.deepEqual([r.doc.timeline.plans[0].debut, r.doc.timeline.plans[0].fin], [0, 3]);
  assert.notEqual(r.doc.timeline.plans[1].fin - r.doc.timeline.plans[1].debut, 3);
});

test("style memory writes a rule after 2 concordant corrections, and can forget or pause", () => {
  let { memory, learned } = learn(emptyMemory(), ["logo:fin"]);
  assert.deepEqual(learned, []);
  ({ memory, learned } = learn(memory, ["logo:fin", "rythme:rapide"]));
  assert.deepEqual(learned, ["Logo à la fin"]);
  ({ memory, learned } = learn(memory, ["logo:debut"]));
  assert.equal(memory.counts["logo:fin"], undefined, "la demande contraire repart de zéro");
  ({ memory, learned } = learn(memory, ["logo:debut"]));
  assert.deepEqual(memory.rules.map(r => r.text), ["Logo au début"], "une règle remplace la règle contraire");
  memory = forget(memory, "logo:debut");
  assert.deepEqual(memory.rules, []);
  assert.deepEqual(learn({ ...memory, paused: true }, ["couleur:chaud", "couleur:chaud"]).learned, []);
});

test("a manual montage puts the rushes in order, plainly cut, without AI", async () => {
  const { manualTimeline } = await import("../edit.ts");
  const t = manualTimeline([{ id: "a", duration: 10 }, { id: "p", duration: 4, photo: true }, { id: "c", duration: 1 }], 12, (raw, c) => sanitizeTimeline(raw, c).timeline);
  assert.deepEqual(t.plans.map(p => p.source), ["a", "p", "c"]);
  assert.ok(t.plans.every(p => p.transition === "coupe"));
  assert.equal(t.plans[1].mouvement, "zoom-avant");
  assert.ok(t.plans[2].fin <= 1);
});

test("a text moved by hand: place and look kept, back to its slot, duplicated just below", async () => {
  const { exportPlan, withPlace } = await import("../export.ts");
  let d = doc();
  d = setTexte(d, 1, { place: { x: 0.3, y: 0.4, w: 0.6, s: 1.5, r: 10 }, look: { role: "accent", couleur: "#FFFFFF", fond: "contour", align: "gauche", anim: "mots" } });
  let r = sanitizeTimeline(d.timeline, clips).timeline;
  assert.equal(r.textes[1].place?.r, 10);
  assert.equal(r.textes[1].look?.fond, "contour");
  const placed = exportPlan(d.timeline)[0].textes.find(x => x.n === 1)!;
  assert.equal(placed.libre, true);
  assert.equal(placed.taille, 138);
  assert.equal(Math.round(placed.box.x + placed.box.w / 2), 324);
  assert.equal(withPlace(placed, { x: 0.5, y: 0.5, w: 0.8, s: 1, r: 0 }).taille, 92);
  d = duplicateTexte(d, 1);
  assert.equal(d.timeline.textes.length, 3);
  assert.equal(d.timeline.textes[2].place?.y, 0.48);
  assert.equal(d.texteIds.length, 3);
  d = setTexte(d, 1, { place: undefined, position: "centre" });
  assert.equal("place" in d.timeline.textes[1], false);
  assert.equal(exportPlan(d.timeline)[0].textes.find(x => x.n === 1)!.libre, false);
});
