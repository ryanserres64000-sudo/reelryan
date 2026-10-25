import test from "node:test";
import assert from "node:assert/strict";
import { parseBrief, outilDuFichier, attribuerLettres, wilson, classementValide, calculerResultats, rapportMarkdown } from "../lib/test-aveugle.mjs";

test("parseBrief garde la phrase et lit durée et bpm", () => {
  const r = parseBrief("﻿Menu du midi, ambiance chaleureuse.\nOn finit sur « 12 rue Thiers ».\nDurée : 30 s\nbpm: 110");
  assert.equal(r.brief, "Menu du midi, ambiance chaleureuse.\nOn finit sur « 12 rue Thiers ».");
  assert.equal(r.duree, 30);
  assert.equal(r.bpm, 110);
  assert.deepEqual(parseBrief("Juste une phrase"), { brief: "Juste une phrase" });
});

test("outilDuFichier reconnaît les concurrents", () => {
  assert.equal(outilDuFichier("CapCut final.mp4"), "capcut");
  assert.equal(outilDuFichier("edits.mov"), "edits");
  assert.equal(outilDuFichier("YouTube.mp4"), "youtube");
  assert.equal(outilDuFichier("autre.mp4"), null);
});

test("attribuerLettres donne une lettre par outil, sans doublon", () => {
  const seq = [0, 1, 0];
  const l = attribuerLettres(["mada", "capcut", "edits"], () => seq.shift());
  assert.deepEqual(Object.keys(l), ["A", "B", "C"]);
  assert.deepEqual(new Set(Object.values(l)), new Set(["mada", "capcut", "edits"]));
  for (let i = 0; i < 50; i++) assert.equal(new Set(Object.values(attribuerLettres(["mada", "capcut", "edits", "youtube"]))).size, 4);
});

test("wilson encadre le taux observé", () => {
  const [lo, hi] = wilson(42, 60);
  assert.ok(lo < 0.7 && hi > 0.7);
  assert.ok(Math.abs(lo - 0.575) < 0.01 && Math.abs(hi - 0.801) < 0.01);
  assert.deepEqual(wilson(0, 0), [0, 0]);
});

test("classementValide refuse les doublons et les trous", () => {
  assert.ok(classementValide({ A: 1, B: 2, C: 3 }, ["A", "B", "C"]));
  assert.ok(!classementValide({ A: 1, B: 1, C: 3 }, ["A", "B", "C"]));
  assert.ok(!classementValide({ A: 1, B: 2 }, ["A", "B", "C"]));
});

const cle = {
  "brief-01": { nom: "01-resto", lettres: { A: "capcut", B: "mada", C: "edits" } },
  "brief-02": { nom: "02-coach", lettres: { A: "mada", B: "edits", C: "capcut" } }
};
const notes = { style: 4, plans: 4, rythme: 5, textes: 3, publier: 4 };

test("calculerResultats compte les duels à partir des classements", () => {
  const votes = [
    { juge: "Élise", briefs: { "brief-01": { classement: { A: 2, B: 1, C: 3 }, notes: { B: notes } }, "brief-02": { classement: { A: 2, B: 1, C: 3 }, notes: {} } } },
    { juge: "Marc", briefs: { "brief-01": { classement: { A: 1, B: 2, C: 3 } }, "brief-02": { classement: { A: 1, B: 1, C: 3 } }, "brief-99": { classement: {} } } }
  ];
  const r = calculerResultats(cle, votes);
  // Duels kept: Élise b1 (MaDa 1er), Élise b2 (MaDa 2e, Edits 1er, CapCut 3e), Marc b1 (CapCut 1er, MaDa 2e, Edits 3e).
  assert.deepEqual([r.duels.capcut.gagnes, r.duels.capcut.total], [2, 3]);
  assert.deepEqual([r.duels.edits.gagnes, r.duels.edits.total], [2, 3]);
  assert.equal(r.verdict, "rate");
  assert.equal(r.ignores.length, 2);
  assert.equal(r.moyennes.mada.rythme, 5);
  assert.equal(r.parBrief["brief-01"].mada_premier, 1);
  const md = rapportMarkdown(r, { date: "2026-11-15" });
  assert.match(md, /Raté/);
  assert.match(md, /\| CapCut \| 3 \| 2 \| 67 %/);
});

test("verdict réussi au-dessus de 70 % face aux deux", () => {
  const v = { juge: "J", briefs: { "brief-01": { classement: { A: 2, B: 1, C: 3 } }, "brief-02": { classement: { A: 1, B: 2, C: 3 } } } };
  assert.equal(calculerResultats(cle, [v]).verdict, "reussi");
  assert.equal(calculerResultats({ "brief-01": { nom: "x", lettres: { A: "mada", B: "capcut" } } }, [{ juge: "J", briefs: { "brief-01": { classement: { A: 1, B: 2 } } } }]).verdict, "incomplet");
});
