import { test } from "node:test";
import assert from "node:assert/strict";
import { handleVisuel, parseRequest, runVisuel } from "../visuel.js";

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const body = () => ({
  brief: { kind: "affiche", idee: "Soirée jazz au bistrot", infos: { date: "Vendredi 20h", lieu: "12 rue Thiers", piege: "x" }, style: "comptoir" },
  adn: "Marque : Chez Lou (restaurant).", couleurs: ["#14213D", "#D62839", "nope"], polices: { titres: "Fraunces", texte: "Inter" },
  images: [{ id: "img1", data: PNG, desc: "la salle le soir" }, { id: "logo", data: PNG }],
});
const answer = {
  concept: "La salle en arche sur le bleu de la marque",
  relecture: ["J'ai raccourci le titre"],
  design: {
    w: 620, h: 877, background: { type: "linear", colors: ["#8A2BE2", "#FF00FF"], angle: 180 },
    layers: [
      { type: "image", asset: "img1", mask: "arch", x: 50, y: 50, w: 520, h: 400 },
      { type: "image", asset: "img7", x: 0, y: 0, w: 10, h: 10 },
      { type: "text", text: "Soirée jazz ✨", font: "Fraunces", size: 60, color: "#FFFFFF", x: 50, y: 480, w: 520, h: 140 },
      { type: "shape", shape: "ellipse", fill: "#FF00FF,#00FFFF,90", x: 0, y: 0, w: 300, h: 300 },
    ],
  },
};

test("the request is checked; unknown infos and bad colours are dropped", () => {
  assert.throws(() => parseRequest({ ...body(), brief: { kind: "tshirt" } }), /inconnu/);
  assert.throws(() => parseRequest({ ...body(), images: [{ id: "../x", data: PNG }] }), /Image/);
  assert.throws(() => parseRequest({ ...body(), mode: "retoucher" }), /vide/);
  const r = parseRequest(body());
  assert.deepEqual(Object.keys(r.brief.infos), ["date", "lieu"]);
  assert.deepEqual(r.look.couleurs, ["#14213D", "#D62839"]);
  assert.equal(r.brief.style, "comptoir");
});

test("one call; the design is scaled, checked against the photos, made natural, and the review says so", async () => {
  let seen;
  const deps = { callJson: async o => { seen = o; o.ledger.push({ cout_usd: 0.02 }); return answer; } };
  const out = await runVisuel(parseRequest(body()), { deps });
  assert.match(seen.system, /néon et dégradés violets/);
  assert.match(seen.content[0].text, /12 rue Thiers/);
  assert.match(seen.content[0].text, /chaleureux et gourmand/);
  assert.equal(seen.content.filter(c => c.type === "image").length, 2);
  assert.deepEqual([out.design.w, out.design.h], [1240, 1754]);
  assert.equal(out.design.layers.filter(l => l.type === "image").length, 1, "l'image inventée est retirée");
  assert.equal(out.design.background.colors[0], "#14213D", "le violet devient la couleur de la marque");
  assert.equal(out.design.layers.find(l => l.type === "text").text, "Soirée jazz");
  assert.ok(out.relecture.length >= 3);
  assert.equal(out.relecture.at(-1), "J'ai raccourci le titre");
  assert.equal(out.cout_usd, 0.02);
});

test("a retouch sends the current design and the request", async () => {
  let seen;
  const deps = { callJson: async o => { seen = o; return answer; } };
  await runVisuel(parseRequest({ ...body(), mode: "retoucher", demande: "Titre plus grand", design: answer.design }), { deps });
  assert.match(seen.content.at(-1).text, /Titre plus grand/);
  assert.match(seen.content.at(-1).text, /VISUEL ACTUEL/);
  assert.equal(seen.effort, "low");
});

test("the route answers 400 on a bad request and 200 with the design", async () => {
  const res = () => ({ headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = JSON.parse(b); } });
  const req = { headers: {}, socket: {} };
  const bad = res(); await handleVisuel(req, bad, { brief: {} }, { callJson: async () => answer });
  assert.equal(bad.statusCode, 400);
  const ok = res(); await handleVisuel(req, ok, body(), { callJson: async () => answer });
  assert.equal(ok.statusCode, 200);
  assert.ok(ok.body.design.layers.length);
});
