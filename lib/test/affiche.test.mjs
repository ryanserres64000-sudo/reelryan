import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { handleAffiche, parseRequest, runAffiche } from "../affiche.js";
import { RECETTES_PROMPT } from "../../core/recipes.ts";

function fakeHttp() {
  const res = new EventEmitter();
  Object.assign(res, { statusCode: 0, headers: {}, chunks: [], setHeader(k, v) { this.headers[k] = v; }, end(c) { if (c) this.chunks.push(c); } });
  return { req: { headers: {}, socket: { remoteAddress: `test-${Math.random()}` } }, res };
}

test("the request takes a base64 image only", () => {
  assert.equal(parseRequest({ image: "QUJD", annee: 2026 }).annee, 2026);
  assert.throws(() => parseRequest({ image: "<svg>" }), /Affiche/);
  assert.throws(() => parseRequest({}), /Affiche/);
});

test("one small-model call reads the poster, and what it returns is checked", async () => {
  const calls = [];
  const deps = { callJson: async opts => {
    calls.push(opts); opts.ledger.push({ cout_usd: 0.002 });
    return { evenement: "Hyde Your Face", date: "VENDREDI 23.10", date_iso: "2026-10-23", heures: "23H–05H", lieu: "Club Haussmann", adresse: "", prix: "13,50 €", prix_barre: "15 €", billetterie: "Shotgun", partenaires: ["BDE", "Hyde Paris"], accroche: "", couleurs: ["#ff7a1a", "orange", "#111111"] };
  } };
  const out = await runAffiche(parseRequest({ image: "QUJD", annee: 2026 }), { deps });
  assert.equal(calls.length, 1);
  assert.match(calls[0].model, /haiku/);
  assert.equal(calls[0].content[0].type, "image");
  assert.match(calls[0].system, /n'invente jamais/);
  assert.deepEqual(out.affiche.couleurs, ["#FF7A1A", "#111111"]);
  assert.equal(out.cout_usd, 0.002);
});

test("the route answers 400 on a bad poster and 502 when the AI fails", async () => {
  let h = fakeHttp();
  await handleAffiche(h.req, h.res, { image: "<svg>" }, { callJson: async () => ({}) });
  assert.equal(h.res.statusCode, 400);
  h = fakeHttp();
  await handleAffiche(h.req, h.res, { image: "QUJD" }, { callJson: async () => { throw new Error("boom"); } });
  assert.equal(h.res.statusCode, 502);
  assert.ok(RECETTES_PROMPT.includes("teaser"));
});
