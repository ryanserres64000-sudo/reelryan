import { test } from "node:test";
import assert from "node:assert/strict";
import { clock, jump, segments, shotAt, textsAt } from "../playback.ts";

const plan = (debut: number, fin: number, extra = {}) => ({ source: "a", debut, fin, cadrage: "centre", transition: "coupe", garder_son: false, vitesse: 1, etalonnage: "naturel", mouvement: "aucun", raison: "", ...extra }) as any;
const t = { plans: [plan(0, 3), plan(0, 2, { vitesse: 2 }), plan(0, 2, { transition: "fondu" })], textes: [{ texte: "Bonjour", debut: 0, fin: 1.5 }, { texte: "11 h", debut: 3, fin: 5 }] as any };

test("segments count speed and transitions", () => {
  const s = segments(t);
  assert.deepEqual(s.map(x => [x.start, x.end]), [[0, 3], [3, 4], [3.7, 5.7]]);
  assert.deepEqual(shotAt(s, 3.5), { index: 1, progress: 0.5 });
  assert.equal(shotAt(s, 3.8).index, 2, "dans un fondu, le plan qui arrive l'emporte");
});

test("previous and next behave like the stories", () => {
  const s = segments(t);
  assert.equal(jump(s, 1, 1), 3);
  assert.equal(jump(s, 5.7, 1), 5.7);
  assert.equal(jump(s, 2, -1), 0);
  assert.equal(jump(s, 3.2, -1), 0, "au tout début d'un plan, on revient au précédent");
  assert.equal(jump(s, 4.5, -1), 3.7);
});

test("texts on screen and the clock", () => {
  assert.deepEqual(textsAt(t, 1).map(x => x.texte), ["Bonjour"]);
  assert.deepEqual(textsAt(t, 3).map(x => x.texte), ["11 h"]);
  assert.equal(clock(68.9), "1:08");
});
