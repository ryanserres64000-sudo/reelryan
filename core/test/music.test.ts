import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeTempo, beatGrid, bestPassage, cacheToEvict, checkDuration, checkHead, checkLink, loudness, MIN_CONFIDENCE, sniffAudio, snapPassage, tapTempo, waveformPeaks } from "../music.ts";
import { sanitizeTimeline, timelineDuration } from "../timeline.ts";

const RATE = 44100;
// A drum track: kick on 1 (strong) and 3, a noise hit on every beat, background noise.
function track(bpm: number, secs: number, offset = 0.37) {
  const s = new Float32Array(RATE * secs), beats: number[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < s.length; i++) s[i] = 0.02 * rnd();
  for (let k = 0, t = offset; t < secs - 0.3; k++, t = offset + (k * 60) / bpm) {
    beats.push(t);
    const i0 = Math.round(t * RATE);
    for (let i = 0; i < RATE * 0.25 && i0 + i < s.length; i++) {
      const tt = i / RATE;
      if (k % 2 === 0) s[i0 + i] += (k % 4 === 0 ? 0.9 : 0.4) * Math.sin(2 * Math.PI * 55 * tt) * Math.exp(-tt * 12);
      s[i0 + i] += 0.3 * rnd() * Math.exp(-tt * 60);
    }
  }
  return { s, beats };
}
const nearest = (list: number[], t: number) => Math.min(...list.map(x => Math.abs(x - t)));

test("liens : streaming, http et adresses invalides refusés avec la bonne raison", () => {
  assert.deepEqual(checkLink("https://cdn.exemple.fr/son.mp3"), { ok: true, value: "https://cdn.exemple.fr/son.mp3" });
  for (const u of ["https://open.spotify.com/track/1", "https://music.apple.com/fr/album/x", "https://youtu.be/abc", "https://www.youtube.com/watch?v=1", "https://m.soundcloud.com/a/b", "https://www.deezer.com/track/1", "https://vm.tiktok.com/x", "https://www.instagram.com/reel/x"])
    assert.deepEqual(checkLink(u), { ok: false, error: "streaming" }, u);
  assert.deepEqual(checkLink("http://exemple.fr/son.mp3"), { ok: false, error: "insecure" });
  assert.deepEqual(checkLink("son.mp3"), { ok: false, error: "invalid" });
  assert.deepEqual(checkLink("ftp://exemple.fr/son.mp3"), { ok: false, error: "invalid" });
});

test("réponse du serveur : page web, trop lourd, trop de redirections", () => {
  assert.equal(checkHead({ status: 200, contentType: "audio/mpeg", contentLength: 5e6 }).ok, true);
  assert.equal(checkHead({ status: 200, contentType: "application/octet-stream" }).ok, true);
  assert.deepEqual(checkHead({ status: 200, contentType: "text/html; charset=utf-8" }), { ok: false, error: "webPage" });
  assert.deepEqual(checkHead({ status: 200, contentType: "audio/mpeg", contentLength: 60 * 1024 * 1024 }), { ok: false, error: "tooBig" });
  assert.deepEqual(checkHead({ status: 200, contentType: "image/png" }), { ok: false, error: "format" });
  assert.deepEqual(checkHead({ status: 302, redirects: 4 }), { ok: false, error: "network" });
  assert.deepEqual(checkHead({ status: 404 }), { ok: false, error: "network" });
});

test("format reconnu sur le contenu, pas sur l'extension", () => {
  const bytes = (...parts: (string | number[])[]) => new Uint8Array(parts.flatMap(p => typeof p === "string" ? [...p].map(c => c.charCodeAt(0)) : p).concat(new Array(40).fill(0)));
  assert.deepEqual(sniffAudio(bytes("ID3", [4, 0, 0])), { ok: true, value: "mp3" });
  assert.deepEqual(sniffAudio(bytes([0xff, 0xfb, 0x90, 0x64])), { ok: true, value: "mp3" });
  assert.deepEqual(sniffAudio(bytes([0xff, 0xf1, 0x50, 0x80])), { ok: true, value: "aac" });
  assert.deepEqual(sniffAudio(bytes([0, 0, 0, 0x20], "ftypM4A ")), { ok: true, value: "m4a" });
  const fmt = (format: number, bits: number) => bytes("RIFF", [0, 0, 0, 0], "WAVE", "fmt ", [16, 0, 0, 0, format, 0, 2, 0, 0x44, 0xac, 0, 0, 0, 0, 0, 0, 4, 0, bits, 0]);
  assert.deepEqual(sniffAudio(fmt(1, 16)), { ok: true, value: "wav" });
  assert.deepEqual(sniffAudio(fmt(1, 24)), { ok: true, value: "wav" });
  assert.deepEqual(sniffAudio(fmt(3, 32)), { ok: false, error: "format" });
  assert.deepEqual(sniffAudio(bytes("<!DOCTYPE html><html>")), { ok: false, error: "webPage" });
  assert.deepEqual(sniffAudio(bytes("OggS")), { ok: false, error: "format" });
  assert.deepEqual(checkDuration(601), { ok: false, error: "tooBig" });
  assert.equal(checkDuration(180).ok, true);
});

test("cache : plus de 30 jours effacé, puis le plus ancien jusqu'à 500 Mo", () => {
  const day = 86_400_000, now = 100 * day, mo = 1024 * 1024;
  const entries = [
    { key: "vieux", bytes: 10 * mo, lastUsed: now - 31 * day },
    { key: "a", bytes: 300 * mo, lastUsed: now - 5 * day },
    { key: "b", bytes: 150 * mo, lastUsed: now - 2 * day },
    { key: "c", bytes: 100 * mo, lastUsed: now - 1 * day },
  ];
  assert.deepEqual(cacheToEvict(entries, now), ["vieux", "a"]);
  assert.deepEqual(cacheToEvict(entries, now, ["a"]), ["vieux", "b"]);
});

test("tempo et temps forts de 72 à 174 BPM : 95 % des temps à moins de 40 ms", () => {
  for (const bpm of [72, 96, 112, 128, 150, 174]) {
    const { s, beats } = track(bpm, 30);
    const r = analyzeTempo(s, RATE)!;
    assert.ok(Math.abs(r.bpm - bpm) < 1.5, `${bpm} détecté ${r.bpm}`);
    assert.ok(r.confidence >= MIN_CONFIDENCE, `confiance ${r.confidence}`);
    const within = beats.filter(b => nearest(r.beats, b) < 0.04).length / beats.length;
    assert.ok(within >= 0.95, `${bpm} : ${within}`);
    assert.ok(Math.abs(r.downbeats[0] - beats[0]) < 0.06, `premier temps ${r.downbeats[0]} au lieu de ${beats[0]}`);
  }
});

test("sans rythme : confiance basse, donc « Tape le rythme »", () => {
  let seed = 3;
  const s = Float32Array.from({ length: RATE * 20 }, () => (((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5) * 0.3);
  const r = analyzeTempo(s, RATE);
  assert.ok(!r || r.confidence < MIN_CONFIDENCE, `confiance ${r?.confidence}`);
  assert.equal(analyzeTempo(new Float32Array(RATE), RATE), null);
});

test("tape le rythme : médiane des écarts, ramenée entre 60 et 200", () => {
  assert.equal(tapTempo([0, 500, 1000, 1510, 2000]), 120);
  assert.equal(tapTempo([0, 250, 500, 750, 1000]), 120); // 240 folded
  assert.equal(tapTempo([0, 500, 1000]), null);
  assert.deepEqual(beatGrid(120, 2), [0, 0.5, 1, 1.5, 2]);
});

test("passage : le plus fort, sur un premier temps, et déplacé au doigt sur un premier temps", () => {
  const perSecond = Array.from({ length: 120 }, (_, t) => (t >= 60 && t < 90 ? 1 : 0.2));
  const downbeats = Array.from({ length: 60 }, (_, i) => i * 2.1);
  const p = bestPassage(perSecond, downbeats, 30);
  assert.ok(downbeats.includes(p.debut) && p.debut >= 56 && p.debut <= 62, JSON.stringify(p));
  assert.equal(snapPassage(40.5, downbeats, 30, 120).debut, 39.9);
  assert.deepEqual(bestPassage([1, 1, 1], [], 15), { debut: 0, fin: 3 });
  assert.equal(waveformPeaks(Float32Array.from([0, 0.5, -1, 0.25]), 2).join(), "0.5,1");
  assert.equal(loudness(new Float32Array(RATE * 3).fill(0.5), RATE).length, 3);
});

test("les coupes tombent sur les temps de la musique (passage compris), à moins de 40 ms", () => {
  const { s } = track(112, 40);
  const tempo = analyzeTempo(s, RATE)!;
  const passage = { debut: tempo.downbeats[2], fin: tempo.downbeats[2] + 30 };
  const clips = { a: { duration: 12 }, b: { duration: 9 }, c: { duration: 6 } };
  const plans = [["a", 0, 2.3], ["b", 1, 2.1], ["c", 0.5, 3.7], ["a", 4, 5.2], ["b", 3, 6.6], ["c", 2, 3.1], ["a", 7, 9.4], ["b", 5, 8.8]]
    .map(([source, debut, fin], i) => ({ source, debut, fin, transition: i === 3 ? "fondu" : "coupe" }));
  const { timeline } = sanitizeTimeline({ plans, musique: { mode: "fichier", source: { type: "fichier", empreinte: "x", droits_confirmes_le: "2026-10-28" }, passage, bpm: tempo.bpm, temps_forts: tempo.beats } }, clips, { maxDuration: 60 });
  const grid = timeline.musique.temps_forts.filter(t => t >= passage.debut && t <= passage.fin).map(t => t - passage.debut);
  const cuts = timeline.plans.map((_, i) => timelineDuration(timeline.plans.slice(0, i + 1)));
  const onBeat = cuts.filter(c => nearest(grid, c) < 0.04).length / cuts.length;
  assert.equal(timeline.plans.length, 8);
  assert.ok(onBeat >= 0.95, `${onBeat} : ${cuts.map(c => c.toFixed(3)).join(" ")}`);
});
