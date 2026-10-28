import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fill, PAGES } from "../../scripts/legal.mjs";

const page = p => readFileSync(new URL(`../../public/${p}`, import.meta.url), "utf8");
const values = JSON.parse(readFileSync(new URL("../../docs/legal/editeur.json", import.meta.url), "utf8"));

test("chaque champ des pages légales existe dans editeur.json, et inversement", () => {
  const used = new Set(PAGES.flatMap(p => [...page(p).matchAll(/data-champ="([a-z_]+)"/g)].map(m => m[1])));
  const known = new Set(Object.keys(values).filter(k => !k.startsWith("_")));
  assert.deepEqual([...used].sort(), [...known].sort());
});

test("remplir, vider un champ facultatif, puis remplir à nouveau", () => {
  const html = '<p><span class="todo" data-champ="editeur_nom">[À COMPLÉTER : nom]</span><span class="todo" data-champ="editeur_capital">[À COMPLÉTER : capital]</span></p>';
  const a = fill(html, { editeur_nom: "Ryan <Studio>", editeur_capital: "" });
  assert.equal(a.html, '<p><span data-champ="editeur_nom">Ryan &lt;Studio&gt;</span><span data-champ="editeur_capital"></span></p>');
  assert.deepEqual(a.missing, []);
  assert.match(fill(a.html, { editeur_nom: "Autre", editeur_capital: "1 000 €" }).html, /Autre.*, au capital de 1 000 €/);
  assert.deepEqual(fill(a.html, { editeur_nom: null, editeur_capital: "" }).missing, ["editeur_nom"]);
});

test("chaque page mène aux mentions légales et ne promet pas plus qu'Anthropic", () => {
  for (const p of PAGES) {
    assert.match(page(p), /href="mentions-legales.html"/, p);
    assert.doesNotMatch(page(p), /ni gardées/, p);
  }
  assert.match(page("confidentialite.html"), /30 jours/);
});
