import { test } from "node:test";
import assert from "node:assert/strict";
import { candidateEvery, mapLimit, percent, queue, sceneStep, Timeout, visionLimitMs, withTimeout } from "../progress.ts";

test("le pourcentage suit les rushes lus, puis avance avec le temps sans dépasser son étape", () => {
  assert.equal(percent(0, { read: 0, total: 10 }), 0);
  assert.equal(percent(0, { read: 5, total: 10 }), 15);
  assert.equal(percent(0, { read: 10, total: 10 }), 30);
  assert.equal(percent(1, { elapsed: 0 }), 30);
  const a = percent(2, { elapsed: 10 }), b = percent(2, { elapsed: 60 }), c = percent(2, { elapsed: 3600 });
  assert.ok(a > 45 && a < b && b < c && c < 80, `${a} ${b} ${c}`);
  assert.ok(percent(3, { elapsed: 3600 }) < 100);
  assert.equal(percent(4), 100);
});

test("un long rush reste léger à lire", () => {
  assert.equal(sceneStep(20), 0.5);
  assert.ok(300 / sceneStep(300) <= 121);
  assert.equal(candidateEvery(20), 2);
  assert.ok(600 / candidateEvery(600) <= 41);
});

test("délai dépassé et lecture deux par deux", async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 10), (e: unknown) => e instanceof Timeout && (e as Timeout).code === "timeout");
  assert.equal(await withTimeout(Promise.resolve(3), 10), 3);
  let running = 0, max = 0;
  const out = await mapLimit([1, 2, 3, 4, 5], 2, async x => { running++; max = Math.max(max, running); await new Promise(r => setTimeout(r, 5)); running--; return x * 2; });
  assert.deepEqual(out, [2, 4, 6, 8, 10]);
  assert.equal(max, 2);
});

test("une file partagée ne lance jamais plus de travaux que sa limite, et les finit tous", async () => {
  const run = queue(2);
  let now = 0, most = 0;
  const job = (v: number) => run(async () => { now++; most = Math.max(most, now); await new Promise(r => setTimeout(r, 5)); now--; return v; });
  const out = await Promise.all([1, 2, 3, 4, 5].map(job));
  assert.deepEqual(out, [1, 2, 3, 4, 5]);
  assert.equal(most, 2);
  await assert.rejects(run(async () => { throw new Error("x"); }), /x/);
  assert.equal(await run(async () => 7), 7, "une erreur ne bloque pas la file");
});

test("Vision a peu de temps pour un rush court, jamais plus de 45 s", () => {
  assert.equal(visionLimitMs(3), 10_000);
  assert.equal(visionLimitMs(20), 26_000);
  assert.equal(visionLimitMs(600), 45_000);
});
