import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_AFFICHE, afficheBrief, countdown, sanitizeAffiche } from "../poster.ts";
import { imposedTexts } from "../timeline.ts";
import { PROFILS, offlineDna, questionsFor } from "../brand.ts";

const hyde = { ...EMPTY_AFFICHE, evenement: "Hyde Your Face", date: "VENDREDI 23.10", date_iso: "2026-10-23", heures: "23H–05H", lieu: "Club Haussmann", prix: "13,50 €", prix_barre: "15 €", billetterie: "Shotgun", partenaires: ["BDE"] };

test("a poster read by the AI keeps only well-formed facts", () => {
  const a = sanitizeAffiche({ evenement: "  Hyde  ", date_iso: "23/10/2026", couleurs: ["#ff7a1a", "#FF7A1A", "red"], partenaires: ["A", "", "B", "C", "D", "E"] });
  assert.equal(a.evenement, "Hyde");
  assert.equal(a.date_iso, "");
  assert.deepEqual(a.couleurs, ["#FF7A1A"]);
  assert.equal(a.partenaires.length, 4);
  assert.deepEqual(sanitizeAffiche(null), EMPTY_AFFICHE);
});

test("the countdown: J-6 from 1 to 14 days, CE SOIR on the day, nothing otherwise", () => {
  assert.equal(countdown("2026-10-23", new Date(2026, 9, 17, 22)), "J-6");
  assert.equal(countdown("2026-10-23", new Date(2026, 9, 23, 9)), "CE SOIR");
  assert.equal(countdown("2026-10-23", new Date(2026, 9, 1)), null);
  assert.equal(countdown("2026-10-23", new Date(2026, 9, 24)), null);
  assert.equal(countdown("", new Date()), null);
});

test("the brief gets the checked facts and an end card written word for word", () => {
  const b = afficheBrief(hyde, new Date(2026, 9, 17));
  assert.match(b, /Prix : 13,50 € au lieu de 15 €/);
  assert.match(b, /n'en invente aucune autre/);
  assert.deepEqual(imposedTexts(b), ["J-6", "Hyde Your Face", "VENDREDI 23.10 · 23H–05H", "Club Haussmann", "Billets sur Shotgun"]);
  // An empty field never reaches the brief.
  assert.doesNotMatch(afficheBrief({ ...hyde, lieu: "", prix: "" }, new Date(2026, 9, 17)), /Lieu|Prix/);
});

test("the event organiser profile asks about tickets and partners and has its own carnet", () => {
  assert.ok(PROFILS.includes("organisateur"));
  const ids = questionsFor("organisateur").map(q => q.id);
  for (const id of ["billetterie", "partenaires", "evenements"]) assert.ok(ids.includes(id), id);
  assert.equal(offlineDna("organisateur", { nom: "Hyde" }, { couleurs: [], polices: { titres: "", texte: "" }, logo: false }).style_maison, "evenement");
});
