import { test } from "node:test";
import assert from "node:assert/strict";
import { ideaOfTheDay, monday, refuse, weekDays, weekPlan } from "../week.ts";

const ideas = ["Plat du jour", "Marché", "Coup de feu", "Menu", "Habitué", "Recette"].map(titre => ({ titre, format: "reel" as const, pourquoi: "" }));
const wed = new Date(2026, 9, 28, 10); // mercredi 28 octobre 2026

test("the week starts on Monday and knows today", () => {
  assert.equal(monday(wed).getDate(), 26);
  const days = weekDays(wed);
  assert.equal(days.length, 7);
  assert.deepEqual(days.filter(d => d.today).map(d => d.index), [2]);
  assert.deepEqual(days.filter(d => d.past).map(d => d.index), [0, 1]);
});

test("three ideas on Monday, Wednesday, Friday, a different set next week", () => {
  const plan = weekPlan(ideas, {}, wed);
  assert.deepEqual(plan.map(p => p.day), [0, 2, 4]);
  assert.equal(new Set(plan.map(p => p.key)).size, 3);
  const next = weekPlan(ideas, {}, new Date(2026, 10, 4));
  assert.notDeepEqual(next.map(p => p.key), plan.map(p => p.key));
  assert.equal(ideaOfTheDay(plan, wed)?.day, 2);
});

test("a refused idea stays away for a month, then comes back", () => {
  const plan = weekPlan(ideas, {}, wed);
  const r = refuse({}, plan[1].idee, wed);
  assert.ok(!weekPlan(ideas, r, wed).some(p => p.key === plan[1].key));
  const later = new Date(2026, 11, 2);
  assert.ok(weekPlan(ideas, r, later).length === 3);
  assert.deepEqual(weekPlan([], {}, wed), []);
});
