import { test } from "node:test";
import assert from "node:assert/strict";
import { badgesOf, candidateTimes, judge, pickFrames, rushForAi } from "../triage.ts";

const m = (t: number, sharp: number | null, luma = 120, faces = 0) => ({ t, sharp, luma, faces, jpeg: `file:///f${t}.jpg` });

test("candidate times: regular frames plus shot changes, never too close", () => {
  const t = candidateTimes(10, [3.1, 3.3]);
  assert.equal(t[0], 0.3);
  assert.ok(t.includes(3.3));
  for (let i = 1; i < t.length; i++) assert.ok(t[i] - t[i - 1] >= 0.8 - 1e-9);
});

test("blurry, dark and burnt frames are rejected against the rush's own sharpest frames", () => {
  const f = judge("a", [m(0, 400), m(2, 380), m(4, 90), m(6, 390, 10), m(8, 410, 250)], []);
  assert.deepEqual(f.map(x => x.reject), [null, null, "floue", "sombre", "brulee"]);
});

test("15 to 30 frames, every rush kept at least once, in rush order", () => {
  const a = judge("a", Array.from({ length: 40 }, (_, i) => m(i, 300 + i)), []);
  const b = judge("b", [m(0, 50, 10)], []);
  const kept = pickFrames([...a, ...b], ["a", "b"]);
  assert.equal(kept.length, 30);
  assert.ok(kept.some(f => f.rush === "b"), "le rush raté garde une image");
  assert.equal(kept.at(-1)!.rush, "b");
});

test("badges and the rush as the server reads it", () => {
  const f = judge("a", [m(0, 100, 10), m(2, 100, 12, 1)], []);
  assert.deepEqual(badgesOf(f, [[0, 2.5]]), ["dark", "face", "speech"]);
  assert.deepEqual(rushForAi({ id: "a", duration: 12.345, photo: false, width: 1080, height: 1920, hasAudio: true, scenes: [], voix: [[0, 2]] }),
    { id: "a", duree: 12.35, photo: false, largeur: 1080, hauteur: 1920, son: true, voix: [[0, 2]] });
});
