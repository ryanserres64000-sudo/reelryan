import { test } from "node:test";
import assert from "node:assert/strict";
import { animAt, sanitizeLook, sanitizePlace, sizeOf } from "../textlook.ts";

test("a place is clamped to the frame and its limits", () => {
  assert.equal(sanitizePlace({ y: 0.5 }), undefined);
  assert.deepEqual(sanitizePlace({ x: 1.4, y: -0.2, w: 0.05, s: 9, r: 80 }), { x: 1, y: 0, w: 0.2, s: 2.5, r: 45 });
});

test("a look falls back on the style's defaults and keeps only a real colour", () => {
  assert.deepEqual(sanitizeLook({ couleur: "red", fond: "néon", anim: "mots" }, "signature"), { role: "texte", couleur: null, fond: "arrondi", align: "centre", anim: "mots" });
  assert.equal(sanitizeLook({ couleur: "#1f3bd6" }, "titre").couleur, "#1F3BD6");
});

test("sizes follow the style and the pinch", () => {
  assert.equal(sizeOf("accroche"), 92);
  assert.equal(sizeOf("info", { x: 0.5, y: 0.5, w: 0.8, s: 1.5, r: 0 }), 75);
});

test("animations are short and end fully visible", () => {
  assert.equal(animAt("fondu", 0, 2, 3).opacite, 0);
  assert.equal(animAt("fondu", 1, 2, 3).opacite, 1);
  assert.ok(animAt("glisse", 0.05, 2, 3).dy > 0);
  assert.equal(animAt("glisse", 1, 2, 3).dy, 0);
  assert.equal(animAt("mots", 0, 2, 4).mots, 1);
  assert.equal(animAt("mots", 1, 2, 4).mots, 4);
});
