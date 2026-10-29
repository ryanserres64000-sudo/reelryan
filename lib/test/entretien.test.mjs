import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { handleEntretien, parseRequest } from "../entretien.js";

function http() {
  const res = new EventEmitter();
  Object.assign(res, { statusCode: 0, body: "", setHeader() {}, end(c) { if (c) this.body += c; } });
  return { req: { headers: {}, socket: { remoteAddress: "e" } }, res, out: () => JSON.parse(res.body) };
}
const body = { profil: "restaurant", libelle_profil: "Restaurant, café", historique: [{ question: "Le nom ?", reponse: "Chez Lou" }], prochaine: { id: "specialite", titre: "Ce qui fait ta différence", pourquoi: "Je le montrerai." } };

test("only a known profile and a known question are worded", () => {
  assert.throws(() => parseRequest({ ...body, profil: "pirate" }), /Profil/);
  assert.throws(() => parseRequest({ ...body, prochaine: { id: "motdepasse", titre: "x" } }), /Question/);
  const r = parseRequest(body);
  assert.equal(r.next.kind, "texte");
  assert.equal(r.history[0].reponse, "Chez Lou");
});

test("the small model words the next card for this person", async () => {
  let seen;
  const callJson = async a => { seen = a; return { reaction: "Chez Lou, joli nom.", titre: "Le plat qu'on vient chercher chez Lou", pourquoi: "Pour la montrer d'abord.", exemple: "Le pot-au-feu", suggestions: ["Le pot-au-feu"] }; };
  const h = http();
  await handleEntretien(h.req, h.res, body, { callJson });
  assert.equal(h.res.statusCode, 200);
  assert.equal(h.out().titre, "Le plat qu'on vient chercher chez Lou ?");
  assert.match(seen.model, /haiku/);
  assert.match(seen.content[0].text, /Chez Lou/);
  const bad = http();
  await handleEntretien(bad.req, bad.res, { profil: "x" }, { callJson });
  assert.equal(bad.res.statusCode, 400);
});
