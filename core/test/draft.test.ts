import { test } from "node:test";
import assert from "node:assert/strict";
import { DRAFT_MAX_AGE_DAYS, packDraft, readDraft, resumableStep } from "../draft.ts";

const now = new Date("2026-10-28T12:00:00Z");

test("a draft comes back at the exact step, waiting screens fall back to the step before", () => {
  const raw = packDraft("editor", { brief: "Plat du jour" }, now);
  assert.deepEqual(readDraft(raw, now), { version: 1, savedAt: now.toISOString(), step: "editor", data: { brief: "Plat du jour" } });
  assert.equal(resumableStep("generation"), "music");
  assert.equal(readDraft<{}>(packDraft("generation", {}, now), now)?.step, "music");
});

test("nothing to save on home or the brand screens", () => {
  assert.equal(packDraft("home", {}, now), null);
  assert.equal(packDraft("brand", {}, now), null);
});

test("broken, foreign, old or future drafts are ignored", () => {
  assert.equal(readDraft("{oops", now), null);
  assert.equal(readDraft(JSON.stringify({ version: 9, savedAt: now.toISOString(), step: "brief", data: {} }), now), null);
  const old = new Date(now.getTime() - (DRAFT_MAX_AGE_DAYS + 1) * 86_400_000);
  assert.equal(readDraft(packDraft("brief", {}, old), now), null);
  const future = new Date(now.getTime() + 3_600_000);
  assert.equal(readDraft(packDraft("brief", {}, future), now), null);
  assert.equal(readDraft(JSON.stringify({ version: 1, savedAt: now.toISOString(), step: "home", data: {} }), now), null);
});
