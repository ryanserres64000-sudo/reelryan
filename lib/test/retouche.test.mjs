import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRequest, runRetouche } from "../retouche.js";

const shot = (source, debut, fin) => ({ source, debut, fin, cadrage: "centre", transition: "coupe", garder_son: false, vitesse: 1, etalonnage: "chaud", mouvement: "aucun", raison: "" });
const body = () => ({
  demande: "Mets le plan de la terrasse au début", brief: "Finir sur « Ouvert dès 11h »",
  rushes: [{ id: "a", duree: 10 }, { id: "b", duree: 8 }],
  timeline: { titre: "T", plans: [shot("a", 0, 3), shot("b", 1, 4)], textes: [{ texte: "Ouvert dès 11h", debut: 4, fin: 6, position: "bas", style: "signature" }], musique: { mode: "aucune" }, exports: [{ plateforme: "reels" }] },
  verrous: { plans: [1], textes: [] },
});

test("the request is checked", () => {
  assert.throws(() => parseRequest({ ...body(), demande: "" }), /vide/);
  assert.throws(() => parseRequest({ ...body(), rushes: [] }), /rushes/);
  assert.deepEqual(parseRequest(body()).verrous, { plans: [1], textes: [] });
});

test("one call; locked shots are flagged to the AI; the answer is validated against the rushes", async () => {
  let seen;
  const deps = { callJson: async o => { seen = o; o.ledger.push({ cout_usd: 0.01 }); return { titre: "T", plans: [shot("b", 1, 4), shot("a", 0, 3), shot("zzz", 0, 2)], textes: [{ texte: "Ouvert dès 11h", debut: 4, fin: 6, position: "bas", style: "signature" }], relecture: { corrections: ["J'ai ouvert sur la terrasse"], plans_a_tourner: [] } }; } };
  const out = await runRetouche(parseRequest(body()), { deps });
  assert.match(seen.content[0].text, /"verrouille": true/);
  assert.match(seen.system, /verrouillé/);
  assert.equal(out.timeline.plans.length, 2, "le rush inconnu est retiré");
  assert.equal(out.timeline.plans[0].source, "b");
  assert.deepEqual(out.warnings.filter(w => w.startsWith("Texte demandé absent")), []);
  assert.equal(out.cout_usd, 0.01);
});
