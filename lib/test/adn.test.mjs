import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { handleAdn, parseRequest, runAdn } from "../adn.js";

const body = (extra = {}) => ({
  profil: "restaurant", libelle_profil: "Restaurant",
  reponses: { nom: "Chez Lou", activite: "Bistrot de quartier", valeurs: ["Fait maison", "Partage", "", "Trop"], inconnue: "x", ton: "Chaleureux" },
  kit: { couleurs: ["#d62839", "rouge"], polices: { titres: "", texte: "" } },
  ...extra,
});

function fakeHttp() {
  const res = new EventEmitter();
  Object.assign(res, { statusCode: 0, headers: {}, chunks: [], setHeader(k, v) { this.headers[k] = v; }, end(c) { if (c) this.chunks.push(c); } });
  return { req: { headers: {}, socket: { remoteAddress: `test-${Math.random()}` } }, res };
}

test("the request keeps known questions and valid colours only", () => {
  const r = parseRequest(body());
  assert.deepEqual(Object.keys(r.answers).sort(), ["activite", "nom", "ton", "valeurs"]);
  assert.deepEqual(r.answers.valeurs, ["Fait maison", "Partage", "Trop"]);
  assert.deepEqual(r.kit.couleurs, ["#d62839"]);
  assert.throws(() => parseRequest(body({ profil: "pirate" })), /Profil/);
  assert.throws(() => parseRequest(body({ logo: "<svg>" })), /Logo/);
});

test("one AI call writes the carnet, with the logo when there is one", async () => {
  const calls = [];
  const deps = { callJson: async opts => {
    calls.push(opts);
    opts.ledger.push({ cout_usd: 0.004 });
    return { resume: "Un bistrot où l'on revient.", style_maison: "comptoir", piliers: [{ titre: "Le marché", idee: "Les légumes du jour" }], idees: [{ titre: "Le plat du jour", format: "reel", pourquoi: "Facile" }] };
  } };
  const out = await runAdn(parseRequest(body({ logo: "QUJD" })), { deps });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].content[1].type, "image");
  assert.match(calls[0].content.at(-1).text, /nom : Chez Lou/);
  assert.match(calls[0].system, /néon/);
  assert.equal(out.adn.nom, "Chez Lou");
  assert.equal(out.adn.style_maison, "comptoir");
  assert.equal(out.cout_usd, 0.004);
});

test("the route answers JSON and reports AI failures", async () => {
  let { req, res } = fakeHttp();
  await handleAdn(req, res, body(), { callJson: async o => { o.ledger.push({ cout_usd: 0 }); return {}; } });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.chunks.join("")).adn.resume, "Bistrot de quartier");
  ({ req, res } = fakeHttp());
  await handleAdn(req, res, body({ profil: "" }), { callJson: async () => ({}) });
  assert.equal(res.statusCode, 400);
  ({ req, res } = fakeHttp());
  await handleAdn(req, res, body(), { callJson: async () => { throw new Error("adn : l'IA a refusé la demande."); } });
  assert.equal(res.statusCode, 502);
  assert.equal(JSON.parse(res.chunks.join("")).error, "refused");
});
