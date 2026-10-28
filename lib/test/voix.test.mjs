import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { handleVoix, parseRequest, voices } from "../voix.js";
import { testing } from "../quota.js";

function fakeHttp() {
  const res = new EventEmitter();
  Object.assign(res, { statusCode: 0, headers: {}, chunks: [], setHeader(k, v) { this.headers[k] = v; }, end(c) { if (c) this.chunks.push(c); } });
  return { req: { headers: {}, socket: { remoteAddress: `test-${Math.random()}` } }, res, body: () => JSON.parse(res.chunks.join("")) };
}
const alignment = text => { const c = [...text]; return { characters: c, character_start_times_seconds: c.map((_, i) => i * 0.05), character_end_times_seconds: c.map((_, i) => i * 0.05 + 0.05) }; };

test("requests: known voices and speeds only, a text that is not empty", () => {
  assert.deepEqual(parseRequest({ action: "lire", texte: "  Bonjour   Lou ", voix: "camille", vitesse: 3 }), { action: "lire", texte: "Bonjour Lou", voix: "camille", vitesse: 1 });
  assert.throws(() => parseRequest({ action: "lire", texte: "x", voix: "pirate" }), /Voix/);
  assert.throws(() => parseRequest({ action: "ecrire", consigne: " " }), /raconter/);
  assert.equal(voices({ MADA_VOIX_JSON: '{"camille":"abc"}' }).camille, "abc");
});

test("reading returns the sound and the words, the key stays on the server", async () => {
  testing.reset();
  const { req, res, body } = fakeHttp();
  let sent;
  const fetchImpl = async (url, init) => { sent = { url, init }; return { ok: true, json: async () => ({ audio_base64: "SUQz", alignment: alignment("Bonjour Lou.") }) }; };
  await handleVoix(req, res, { action: "lire", texte: "Bonjour Lou.", voix: "hugo", vitesse: 1.1 }, { env: { ELEVENLABS_API_KEY: "k" }, fetchImpl });
  assert.equal(res.statusCode, 200);
  const out = body();
  assert.equal(out.audio, "SUQz");
  assert.deepEqual(out.mots.map(m => m.mot), ["Bonjour", "Lou."]);
  assert.match(sent.url, /ErXwobaYiN019PkySvjV\/with-timestamps/);
  assert.equal(sent.init.headers["xi-api-key"], "k");
  assert.equal(JSON.parse(sent.init.body).voice_settings.speed, 1.1);
});

test("without the ElevenLabs key, a clear answer; a failure is not counted", async () => {
  const a = fakeHttp();
  await handleVoix(a.req, a.res, { action: "lire", texte: "Salut", voix: "camille" }, { env: {} });
  assert.equal(a.res.statusCode, 503);
  const b = fakeHttp();
  await handleVoix(b.req, b.res, { action: "lire", texte: "Salut", voix: "camille" }, { env: { ELEVENLABS_API_KEY: "k" }, fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.equal(b.res.statusCode, 502);
});

test("writing: one small call with the length the video allows", async () => {
  const { req, res, body } = fakeHttp();
  let call;
  const callJson = async o => { call = o; o.ledger.push({ cout_usd: 0.0004 }); return { texte: "Aujourd'hui chez Lou : magret et purée maison." }; };
  await handleVoix(req, res, { action: "ecrire", consigne: "présente le plat du jour", duree: 12, marque: "Chez Lou" }, { callJson, env: {} });
  assert.equal(res.statusCode, 200);
  assert.match(body().texte, /magret/);
  assert.match(call.content[0].text, /180 caractères/);
  assert.match(call.system, /voix off/);
});
