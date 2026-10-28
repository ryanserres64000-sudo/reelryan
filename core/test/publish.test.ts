import { test } from "node:test";
import assert from "node:assert/strict";
import { START_REVIEW, instagramUrl, markAsked, nextSunday, recordExport, reviewDue, weeklySummary } from "../publish.ts";

test("the review is asked after the third good export, never right after an error", () => {
  const now = new Date("2026-11-02T10:00:00");
  let s = START_REVIEW;
  s = recordExport(recordExport(s, true, now), true, now);
  assert.equal(reviewDue(s, now), false);
  s = recordExport(s, true, now);
  assert.equal(reviewDue(s, now), true);
  const failed = recordExport(s, false, now);
  assert.equal(reviewDue(failed, new Date("2026-11-02T10:10:00")), false);
  assert.equal(reviewDue(failed, new Date("2026-11-02T11:00:00")), true);
  const asked = markAsked(s, now);
  assert.equal(reviewDue(asked, new Date("2026-12-02T10:00:00")), false);
  assert.equal(reviewDue(asked, new Date("2027-04-02T10:00:00")), true);
});

test("the summary comes on Sunday at 18 h", () => {
  const wed = nextSunday(new Date("2026-10-28T09:00:00"));
  assert.equal(wed.getDay(), 0); assert.equal(wed.getHours(), 18); assert.equal(wed.getDate(), 1);
  assert.equal(nextSunday(new Date("2026-11-01T12:00:00")).getDate(), 1);
  assert.equal(nextSunday(new Date("2026-11-01T19:00:00")).getDate(), 8);
});

test("the summary counts this week's Reels and invents nothing", () => {
  const now = new Date("2026-11-01T18:00:00");
  const made = [{ at: "2026-10-26T10:00:00" }, { at: "2026-10-29T10:00:00" }, { at: "2026-10-20T10:00:00" }];
  assert.equal(weeklySummary(made, { now }).body, "2 Reels cette semaine. Bravo.");
  assert.match(weeklySummary(made, { now, views: 2400, idea: "le geste du chef" }).body, /2 Reels cette semaine, 2\s400 vues\. Bravo\. Pour lundi : le geste du chef/);
  assert.match(weeklySummary([], { now }).body, /Pas de Reel cette semaine/);
  assert.equal(instagramUrl("A/B 1"), "instagram://library?LocalIdentifier=A%2FB%201");
});
