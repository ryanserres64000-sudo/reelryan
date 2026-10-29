import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { handleMontage, parseRequest, runMontage } from "../montage.js";

const body = (extra = {}) => ({
  brief: "Mon nouveau burger, termine sur « Ouvert dès 11h »",
  duree: 15, variantes: 3, plateformes: ["reels", "tiktok"],
  rushes: [{ id: "clip01", duree: 10, son: true, voix: [[1, 4]] }, { id: "clip02", duree: 8 }],
  images: [{ id: "f1", rush: "clip01", temps: 2, data: "AAAA" }, { id: "f2", rush: "clip02", temps: 5, data: "BBBB" }],
  musique: { mode: "aucune" },
  ...extra,
});
const variant = (variante, extra = {}) => ({
  titre: "Burger", intention: "Le burger d'abord", variante,
  plans: [
    { source: "clip01", debut: 0, fin: 4, cadrage: "centre", transition: "coupe", garder_son: true, vitesse: 1, etalonnage: "chaud", mouvement: "aucun", raison: "accroche" },
    { source: "clip02", debut: 1, fin: 7, cadrage: "centre", transition: "coupe", garder_son: false, vitesse: 1, etalonnage: "naturel", mouvement: "aucun", raison: "fin" },
  ],
  textes: [{ texte: "Ouvert dès 11h", debut: 8, fin: 10, position: "bas", style: "signature" }],
  sous_titres: { actifs: false, style: "marque" }, style_utilise: [], relecture: { corrections: [], plans_a_tourner: [] },
  legende: { texte: "Nouveau", hashtags: ["burger"] }, ...extra,
});

// Fake model: tags, then drafts, then the review. Records every call.
function fakeAi({ review = "ok" } = {}) {
  const calls = [];
  return {
    calls,
    callJson: async opts => {
      calls.push(opts.step);
      opts.ledger.push({ etape: opts.step, cout_usd: 0.01 });
      if (opts.step === "etiquetage") return { images: [{ id: "f1", interet: 5 }, { id: "f2", interet: 3 }] };
      if (opts.step === "decision") return { variantes: [variant("accroche-forte"), variant("posee"), variant("rythmee", { plans: [{ source: "inconnu", debut: 0, fin: 3 }] })] };
      if (review === "error") throw new Error("boom");
      return { variantes: [variant("accroche-forte", { relecture: { corrections: ["J'ai raccourci l'accroche"], plans_a_tourner: ["Un gros plan du burger"] } }), variant("posee"), variant("rythmee")] };
    },
  };
}

test("une demande valide donne des variantes vérifiées, la relecture et le coût", async () => {
  const ai = fakeAi(), steps = [];
  const r = await runMontage(parseRequest(body()), { send: o => steps.push(o.etape), deps: ai });
  assert.deepEqual(steps, ["etiquetage", "decision", "relecture"]);
  assert.deepEqual(ai.calls, ["etiquetage", "decision", "relecture"]);
  assert.equal(r.variantes.length, 3);
  assert.deepEqual(r.variantes.map(v => v.timeline.variante), ["accroche-forte", "posee", "rythmee"]);
  assert.deepEqual(r.variantes[0].timeline.relecture.corrections, ["J'ai raccourci l'accroche"]);
  assert.deepEqual(r.variantes[0].timeline.exports.map(e => e.plateforme), ["reels", "tiktok"]);
  assert.equal(r.variantes[0].timeline.textes[0].impose, true);
  assert.equal(r.cout_usd, 0.03);
});

test("une variante invalide après la relecture garde la version d'avant", async () => {
  const ai = fakeAi();
  const orig = ai.callJson;
  ai.callJson = async o => o.step === "relecture" ? { variantes: [variant("accroche-forte", { plans: [] }), variant("posee")] } : orig(o);
  const r = await runMontage(parseRequest(body({ variantes: 2 })), { deps: ai });
  assert.equal(r.variantes.length, 2);
  assert.deepEqual(r.variantes[0].timeline.relecture.corrections, []);
});

test("si la relecture échoue, on garde le premier jet", async () => {
  const r = await runMontage(parseRequest(body()), { deps: fakeAi({ review: "error" }) });
  assert.equal(r.variantes.length, 2); // the third draft had no usable shot
});

test("les demandes mal formées sont refusées avec un message clair", () => {
  assert.throws(() => parseRequest(body({ brief: " " })), /brief est vide/);
  assert.throws(() => parseRequest(body({ rushes: [] })), /entre 1 et 30 rushes/);
  assert.throws(() => parseRequest(body({ images: [{ rush: "clip09", temps: 1, data: "A" }] })), /Image invalide/);
  assert.throws(() => parseRequest(body({ images: [{ rush: "clip01", temps: 1, data: "A".repeat(200_000) }] })), /Image invalide/);
  assert.equal(parseRequest(body({ duree: 400, variantes: 7 })).duree, 90);
  assert.equal(parseRequest(body({ variantes: 7 })).nb, 3);
});

function fakeHttp(headers = {}) {
  const res = new EventEmitter();
  Object.assign(res, { statusCode: 0, headers: {}, chunks: [], writableEnded: false,
    setHeader(k, v) { this.headers[k] = v; }, write(c) { this.chunks.push(c); }, end(c) { if (c) this.chunks.push(c); this.writableEnded = true; } });
  return { req: { headers, socket: { remoteAddress: `test-${Math.random()}` } }, res };
}

test("la route répond en flux : étapes puis résultat, et refuse sans code d'accès", async () => {
  let { req, res } = fakeHttp();
  await handleMontage(req, res, body(), fakeAi());
  const lines = res.chunks.join("").trim().split("\n").map(l => JSON.parse(l));
  assert.deepEqual(lines.slice(0, 3).map(l => l.etape), ["etiquetage", "decision", "relecture"]);
  assert.equal(lines[3].resultat.variantes.length, 3);

  ({ req, res } = fakeHttp());
  await handleMontage(req, res, { brief: "" }, fakeAi());
  assert.equal(res.statusCode, 400);

  process.env.APP_PASSWORD = "secret";
  try {
    ({ req, res } = fakeHttp());
    await handleMontage(req, res, body(), fakeAi());
    assert.equal(res.statusCode, 401);
  } finally { delete process.env.APP_PASSWORD; }
});

test("le client de l'app lit le flux de la route sans perte", async () => {
  const { readLine } = await import("../../app/src/flow/stream.ts");
  const { req, res } = fakeHttp();
  await handleMontage(req, res, body(), fakeAi());
  const steps = [];
  let result = null;
  for (const l of res.chunks.join("").split("\n")) result = readLine(l, s => steps.push(s)) ?? result;
  assert.deepEqual(steps, [1, 2, 3, 4]);
  assert.equal(result.variantes.length, 3);
  assert.throws(() => readLine('{"error":"rate_limited","message":"Trop de demandes."}', () => {}), /Trop de demandes/);
});

test("avec les temps de la musique, les coupes des variantes tombent dessus", async () => {
  const temps = Array.from({ length: 60 }, (_, i) => Math.round((10 + i * 0.536) * 1000) / 1000);
  const musique = { mode: "fichier", source: { type: "lien", empreinte: "abc", droits_confirmes_le: "2026-10-28T08:00:00Z" }, passage: { debut: 10, fin: 25 }, bpm: 112, temps_forts: temps };
  const r = await runMontage(parseRequest(body({ musique })), { deps: fakeAi() });
  const grid = temps.filter(t => t <= 25).map(t => t - 10);
  for (const v of r.variantes) {
    let t = 0;
    for (const p of v.timeline.plans) {
      t += (p.fin - p.debut) / p.vitesse - (t && p.transition !== "coupe" ? 0.3 : 0);
      assert.ok(Math.min(...grid.map(g => Math.abs(g - t))) < 0.04, `coupe à ${t}`);
    }
  }
});

test("un montage trop long : des signes de vie, puis une erreur claire avant la coupure de Vercel", async () => {
  const slow = { callJson: opts => new Promise((_, reject) => opts.signal.addEventListener("abort", () => reject(new Error("aborted")))) };
  const { req, res } = fakeHttp();
  await handleMontage(req, res, body(), slow, { pingMs: 5, serverMs: 40 });
  const lines = res.chunks.join("").trim().split("\n").map(l => JSON.parse(l));
  assert.equal(lines[0].etape, "etiquetage");
  assert.ok(lines.some(l => l.ping), "le serveur écrit pendant que l'IA travaille");
  assert.equal(lines.at(-1).error, "timeout");
  assert.ok(res.writableEnded);
});

test("crédits Anthropic épuisés : un code à part, que l'app traduit", async () => {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { errorCode } = await import("../claude.js");
  const e = new Anthropic.BadRequestError(400, { error: { message: "Your credit balance is too low to access the Anthropic API." } }, "Your credit balance is too low to access the Anthropic API.", new Headers());
  assert.equal(errorCode(e), "credits");
});
