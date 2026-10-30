import { test } from "node:test";
import assert from "node:assert/strict";
import { POLICES } from "../timeline.ts";
import { TEXT_FONTS, animAt, sanitizeLook, sanitizePlace, sizeOf, wordRange } from "../textlook.ts";

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

test("the font families hold the 16 fonts, each once", () => {
  assert.deepEqual([...TEXT_FONTS].sort(), [...POLICES].sort());
});

test("a look keeps its own font, capitals, spacing and accent word only when valid", () => {
  const l = sanitizeLook({ police: "Anton", majuscules: true, espace: 0.9, mot: "  vues ", motCouleur: "#ffd23f" }, "titre");
  assert.deepEqual(l, { role: "titre", couleur: null, fond: "ombre", align: "centre", anim: "fondu", police: "Anton", majuscules: true, espace: 0.5, mot: "vues", motCouleur: "#FFD23F" });
  const bad = sanitizeLook({ police: "Comic Sans", majuscules: "oui", espace: -1, motCouleur: "#FFD23F" }, "titre")!;
  assert.equal("police" in bad || "majuscules" in bad || "espace" in bad || "motCouleur" in bad, false);
});

test("the accent word is found whatever its capitals", () => {
  assert.deepEqual(wordRange("Face à l'une des plus belles vues", { mot: "VUES" }), [29, 33]);
  assert.deepEqual(wordRange("le bar long", { mot: "Bar", majuscules: true }), [3, 6]);
  assert.equal(wordRange("le bar", { mot: "piscine" }), null);
  assert.equal(wordRange("le bar", {}), null);
});
