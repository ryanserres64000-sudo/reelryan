import { test } from "node:test";
import assert from "node:assert/strict";
import { offlineDna, compactDna, contrast, montageStyle, paletteFromPixels, QUESTIONS, questionsFor, sanitizeDna, STYLE_PAR_PROFIL, textOn, type Kit } from "../brand.ts";

// A 64 × 64 logo: white background, a big red disc, a small navy bar, a few anti-aliased grey pixels.
function logo({ transparent = false } = {}) {
  const w = 64, h = 64, px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    let c = [255, 255, 255], a = transparent ? 0 : 255;
    if ((x - 32) ** 2 + (y - 26) ** 2 < 18 ** 2) { c = [214, 40, 57]; a = 255; }
    else if (y > 50 && y < 58 && x > 12 && x < 52) { c = [20, 33, 61]; a = 255; }
    else if (y === 49 && x % 9 === 0) { c = [128, 128, 128]; a = 255; }
    px.set([...c, a], i);
  }
  return { px, w, h };
}

test("logo colours: the background is left out, the main colours come first", () => {
  for (const transparent of [false, true]) {
    const { px, w, h } = logo({ transparent });
    const pal = paletteFromPixels(px, w, h);
    assert.equal(pal[0], "#d62839", `fond ${transparent ? "transparent" : "blanc"}`);
    assert.equal(pal[1], "#14213d");
    assert.ok(!pal.includes("#ffffff"));
    assert.ok(!pal.includes("#808080"), "les quelques pixels gris d'anticrénelage ne comptent pas");
  }
  assert.deepEqual(paletteFromPixels(new Uint8ClampedArray(16 * 16 * 4), 16, 16), []);
});

test("contrast picks a readable text colour on a brand colour", () => {
  assert.equal(textOn("#d62839"), "#ffffff");
  assert.equal(textOn("#f5d547"), "#111111");
  assert.ok(contrast("#ffffff", "#000000") > 20);
});

test("questions follow the profile, every profile keeps the common ones", () => {
  const common = QUESTIONS.filter(q => !q.profils).map(q => q.id);
  for (const p of Object.keys(STYLE_PAR_PROFIL) as (keyof typeof STYLE_PAR_PROFIL)[]) {
    const ids = questionsFor(p).map(q => q.id);
    for (const c of common) assert.ok(ids.includes(c), `${p} : ${c}`);
  }
  assert.ok(questionsFor("debutant").some(q => q.id === "frein"));
  assert.ok(!questionsFor("ecole").some(q => q.id === "adresse"));
  assert.ok(questionsFor("restaurant").some(q => q.id === "specialite"));
});

const kit: Kit = { couleurs: ["#d62839", "#14213d", "nope"], polices: { titres: "", texte: "" }, logo: true };
const answers = { nom: "Chez Lou", activite: "Bistrot de quartier, cuisine du marché", valeurs: ["Fait maison", "Partage"], ton: "Chaleureux" };

test("the AI carnet is checked, and the person's own data always wins", () => {
  const d = sanitizeDna({
    resume: "Un bistrot  où l'on revient.", ton: "Chaleureux et simple", valeurs: ["Autre"], public: "Les voisins",
    piliers: [{ titre: "Le marché", idee: "Le chef choisit ses légumes" }, { titre: "" }, { titre: "Le service", idee: "Le coup de feu" }, { titre: "Les habitués", idee: "x" }, { titre: "Trop", idee: "y" }],
    style_maison: "inconnu", sous_titres: "mot-a-mot", regles: ["Logo petit, à la fin", 4, ""], a_eviter: ["Le néon"],
    idees: [{ titre: "Le plat du jour", format: "gif", pourquoi: "Facile" }], polices: { titres: "Comic Sans", texte: "DM Sans" },
  }, "restaurant", answers, kit);
  assert.equal(d.nom, "Chez Lou");
  assert.equal(d.resume, "Un bistrot où l'on revient.");
  assert.deepEqual(d.valeurs, ["Fait maison", "Partage"], "ses valeurs, pas celles de l'IA");
  assert.equal(d.piliers.length, 3);
  assert.equal(d.style_maison, "comptoir", "style inconnu : celui du profil");
  assert.deepEqual(d.regles, ["Logo petit, à la fin"]);
  assert.equal(d.idees[0].format, "reel");
  assert.deepEqual(d.couleurs, ["#d62839", "#14213d"]);
  assert.deepEqual(d.polices, { titres: "Bricolage Grotesque", texte: "DM Sans" }, "police hors liste remplacée");
  assert.deepEqual(sanitizeDna({ polices: { titres: "Anton", texte: "Inter" } }, "restaurant", answers, { ...kit, polices: { titres: "Fraunces", texte: "Inter" } }).polices, { titres: "Fraunces", texte: "Inter" });
});

test("without AI, the carnet is built from the answers alone", () => {
  const d = sanitizeDna(null, "debutant", { nom: "Sam", activite: "Je fais des bijoux" }, { couleurs: [], polices: { titres: "", texte: "" }, logo: false });
  assert.equal(d.resume, "Je fais des bijoux");
  assert.equal(d.style_maison, "coulisses");
  assert.deepEqual(d.idees, []);
});

test("the DNA sent with each edit stays short (about 200 tokens)", () => {
  const long = "x".repeat(120);
  const d = sanitizeDna({
    resume: "r".repeat(300), ton: long, valeurs: ["a", "b", "c"], public: long, piliers: [], style_maison: "comptoir", sous_titres: "sobre",
    regles: [long, long, long, long, long], a_eviter: [long, long, long, long, long], idees: [], polices: { titres: "Fraunces", texte: "DM Sans" },
  }, "restaurant", answers, kit);
  const text = compactDna(d);
  assert.ok(text.length <= 1200, `${text.length} caractères`);
  assert.ok(text.includes("tout effet qui fait « IA »"));
  const short = compactDna(sanitizeDna({ resume: "Un bistrot de quartier.", ton: "Chaleureux", regles: ["Logo à la fin"] }, "restaurant", answers, kit));
  assert.ok(short.length / 4 < 250, `${short.length} caractères`);
  assert.equal(compactDna(d), text, "toujours les mêmes mots pour la même marque");
  assert.deepEqual(montageStyle(null, ["plus rythmé"]), { corrections: ["plus rythmé"] });
  assert.equal(montageStyle(d).adn, text);
});

test("without the server, every profile still gets a full carnet", () => {
  for (const p of Object.keys(STYLE_PAR_PROFIL) as (keyof typeof STYLE_PAR_PROFIL)[]) {
    const d = offlineDna(p, { nom: "Test" }, kit);
    assert.equal(d.piliers.length, 3, p);
    assert.ok(d.idees.length >= 6, p);
    assert.ok(d.regles.length >= 3, p);
    assert.equal(d.style_maison, STYLE_PAR_PROFIL[p]);
  }
  assert.equal(offlineDna("debutant", {}, kit).idees.length, 10);
});
