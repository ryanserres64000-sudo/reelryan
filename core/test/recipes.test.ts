import { test } from "node:test";
import assert from "node:assert/strict";
import { AI_TIMELINE_SCHEMA, sanitizeTimeline } from "../timeline.ts";
import { naturalTimeline } from "../natural.ts";
import { applyRecipe } from "../edit.ts";
import { RECETTES_PROMPT, onCuts, wordIn } from "../recipes.ts";

const clips = { a: { duration: 20 }, b: { duration: 20 } };
const shot = (source: string, debut: number, fin: number) => ({ source, debut, fin, cadrage: "centre", transition: "coupe", garder_son: false, vitesse: 1, etalonnage: "naturel", mouvement: "aucun", raison: "" });
// Ryan's Hyde teaser: 9 shots of about 1,2 s, a word on each, an end card.
const teaser = (extra: Record<string, unknown> = {}) => ({
  titre: "Hyde", plans: [...Array(9)].map((_, i) => shot(i % 2 ? "a" : "b", i, i + 1.2)).concat([shot("a", 12, 15.5)]),
  textes: [
    { texte: "J-6", debut: 0, fin: 1.2, position: "centre", style: "accroche", mot: "J-6" },
    { texte: "800 personnes", debut: 1.3, fin: 2.4, position: "centre", style: "titre", mot: "800" },
    { texte: "Une seule école", debut: 2.5, fin: 3.6, position: "centre", style: "titre", mot: "pizza" },
    { texte: "La nôtre.", debut: 3.7, fin: 4.8, position: "centre", style: "titre", mot: "" },
    { texte: "Hyde your face", debut: 4.9, fin: 6, position: "centre", style: "titre", mot: "Hyde" },
    { texte: "13,50 € au lieu de 15 €", debut: 6.1, fin: 7.2, position: "centre", style: "titre", mot: "13,50 €" },
    { texte: "Il ne manque plus que toi", debut: 8.5, fin: 10.8, position: "centre", style: "titre", mot: "toi" },
    { texte: "Je prends ma place", debut: 11.2, fin: 14.3, position: "bas", style: "signature", mot: "" },
  ],
  musique: { mode: "aucune" }, recette: "teaser", ...extra,
});

test("the AI fills a recipe and a word in colour", () => {
  const p = (AI_TIMELINE_SCHEMA as any).properties;
  assert.deepEqual(p.recette.enum, ["teaser", "vlog", "recit", "aucune"]);
  assert.ok("mot" in p.textes.items.properties);
  assert.match(RECETTES_PROMPT, /N'invente jamais une date/);
});

test("a teaser: poster capitals in Anton, words that land on the cuts, the word in colour only when it is in the text", () => {
  const { timeline: t } = sanitizeTimeline(teaser(), clips);
  assert.equal(t.recette, "teaser");
  const [j6, n800, ecole] = t.textes;
  assert.deepEqual([j6.look?.police, j6.look?.majuscules, j6.look?.anim], ["Anton", true, "zoom"]);
  assert.equal(n800.look?.mot, "800");
  assert.equal(ecole.look?.mot, undefined, "« pizza » n'est pas dans le texte");
  assert.equal(n800.debut, 1.2, "le texte part avec son plan");
  assert.equal(t.textes.at(-1)!.look?.fond, "arrondi", "l'appel à l'action est un bouton");
  // A brand whose title font is a poster font keeps it.
  const own = sanitizeTimeline(teaser({ charte: { polices: { titre: "Bebas Neue", texte: "Inter" } } }), clips).timeline;
  assert.equal(own.textes[0].look?.police, "Bebas Neue");
  // The « naturel » check keeps a word per shot in a teaser.
  assert.equal(naturalTimeline(t).timeline.textes.length, 8);
});

test("a vlog: a spaced elegant title and « nom — rôle » in the lower third; a recit: word-by-word captions", () => {
  const raw = { titre: "Royal Monceau", plans: [shot("a", 0, 5), shot("b", 0, 5)], musique: { mode: "aucune" }, recette: "vlog",
    textes: [{ texte: "Le Royal Monceau", debut: 0, fin: 3, position: "haut", style: "titre", mot: "" }, { texte: "Marie — trésorière du BDE", debut: 5, fin: 8, position: "bas", style: "info", mot: "" }] };
  const v = sanitizeTimeline(raw, clips).timeline;
  assert.deepEqual([v.textes[0].look?.police, v.textes[0].look?.espace, v.textes[0].look?.majuscules], ["Playfair Display", 0.15, true]);
  assert.deepEqual([v.textes[1].look?.align, v.textes[1].place?.y], ["gauche", 0.78]);
  const r = sanitizeTimeline({ ...raw, recette: "recit", textes: [{ texte: "Face à l'une des plus belles vues", debut: 1, fin: 4, position: "bas", style: "info", mot: "vues" }] }, clips).timeline;
  assert.deepEqual([r.textes[0].look?.anim, r.textes[0].look?.mot], ["mots", "vues"]);
  assert.equal(sanitizeTimeline({ ...raw, recette: "aucune" }, clips).timeline.recette, undefined);
});

test("another recipe in one gesture keeps the words and what was styled by hand", () => {
  const { timeline: t } = sanitizeTimeline(teaser(), clips);
  const v = applyRecipe(t, "vlog", i => i === 1);
  assert.equal(v.recette, "vlog");
  assert.equal(v.textes[0].look?.police, "Playfair Display");
  assert.equal(v.textes[1].look?.police, "Anton", "le texte réglé à la main ne bouge pas");
  assert.deepEqual(v.textes.map(x => x.texte), t.textes.map(x => x.texte));
  const orange = { ...t, textes: t.textes.map((x, i) => (i === 1 ? { ...x, look: { ...x.look!, motCouleur: "#FF7A1A" } } : x)) };
  assert.equal(applyRecipe(orange, "vlog").textes[1].look?.motCouleur, "#FF7A1A", "la couleur choisie pour le mot reste");
  const plain = applyRecipe(t, null);
  assert.equal(plain.recette, undefined);
  assert.equal(plain.textes[0].look?.police, undefined);
  assert.equal(plain.textes[1].look?.mot, "800");
  // A saved recipe edit reloads as it was.
  assert.deepEqual(sanitizeTimeline(v, clips).timeline.textes, v.textes);
});

test("helpers: the word must be in the text, a text near a cut starts on it", () => {
  assert.equal(wordIn("Les plus belles vues", "VUES"), "VUES");
  assert.equal(wordIn("Les plus belles vues", "mer"), undefined);
  assert.deepEqual(onCuts([{ debut: 1.5, fin: 2.5 }, { debut: 5, fin: 6 }], [1.2, 3]), [{ debut: 1.2, fin: 2.2 }, { debut: 5, fin: 6 }]);
});
