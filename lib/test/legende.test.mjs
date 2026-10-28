import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRequest, runLegende } from "../legende.js";

const body = () => ({
  brief: "L'after-movie de la soirée d'intégration sur la péniche L'Unic",
  timeline: { titre: "Une nuit sur l'eau", intention: "On ouvre sur la foule", duree: 24, plans: [{ raison: "La foule qui danse sur le pont" }, { raison: "Le DJ au coucher du soleil" }], textes: [{ texte: "Ça se passe", accent: "ici" }] },
  style: { adn: "BDE, ton complice, tutoiement" },
});

test("the request needs an edit", () => {
  assert.throws(() => parseRequest({ brief: "x" }), /vide/);
  assert.equal(parseRequest(body()).video.plans.length, 2);
});

test("the brief is a work order, the shots are the material; generic hashtags are dropped", async () => {
  let seen;
  const deps = { callJson: async o => { seen = o; o.ledger.push({ cout_usd: 0.002 }); return { texte: "Le pont a tremblé jusqu'à 2 h.\nMerci à tous !", hashtags: ["#bdeparis", "love", "peniche unic", "fyp"] }; } };
  const out = await runLegende(parseRequest(body()), { deps });
  assert.match(seen.system, /pas la légende/);
  assert.match(seen.content[0].text, /La foule qui danse/);
  assert.deepEqual(out.legende.hashtags, ["#bdeparis", "#penicheunic"]);
  assert.equal(out.cout_usd, 0.002);
});

test("another proposal sends the previous one to avoid", async () => {
  let seen;
  const deps = { callJson: async o => { seen = o; return { texte: "Autre", hashtags: [] }; } };
  await runLegende(parseRequest({ ...body(), precedente: "Le pont a tremblé" }), { deps });
  assert.match(seen.content[0].text, /autre accroche/);
});
