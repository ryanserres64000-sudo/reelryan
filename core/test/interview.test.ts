import { test } from "node:test";
import assert from "node:assert/strict";
import { BASES_FOR_TEST, PROFILS, PROFIL_GROUPES, offlineDna, type Kit } from "../brand.ts";
import { asked, entretienContent, interviewFor, keptAnswers, sanitizeWording } from "../interview.ts";

const labels: Record<string, Record<string, string>> = { objectifs: { reservations: "Avoir des réservations", ventes: "Vendre en ligne", recrutement: "Recruter", evenements: "Remplir mes événements" } };
const labelOf = (q: string, o: string) => labels[q]?.[o] ?? o;
const ids = (p: Parameters<typeof interviewFor>[0], a = {}) => interviewFor(p, a, labelOf).map(q => q.id);

test("every profile sits in exactly one family and gets its own carnet without AI", () => {
  const grouped = PROFIL_GROUPES.flatMap(g => g.profils);
  assert.deepEqual([...grouped].sort(), [...PROFILS].sort());
  assert.equal(new Set(grouped).size, grouped.length);
  const kit: Kit = { couleurs: [], polices: { titres: "", texte: "" }, logo: false };
  const firsts = new Set(PROFILS.map(p => offlineDna(p, {}, kit).idees[0].titre));
  assert.equal(firsts.size, PROFILS.length, "pas deux profils avec la même première idée");
  assert.equal(BASES_FOR_TEST.length, PROFILS.length);
});

test("follow-ups only come when an earlier answer calls for them, right after it", () => {
  assert.ok(!ids("restaurant").includes("creneaux"));
  const withBooking = ids("restaurant", { objectifs: ["Avoir des réservations"] });
  assert.ok(withBooking.includes("creneaux"));
  assert.equal(withBooking.indexOf("creneaux"), withBooking.indexOf("objectifs") + 1);
  assert.ok(ids("coach", { objectifs: ["Recruter", "Vendre en ligne"] }).includes("postes"));
  assert.ok(ids("coach", { objectifs: ["Vendre en ligne"] }).includes("offre"));
  // Events: always for a school, otherwise only when asked for.
  assert.ok(ids("ecole").includes("evenements"));
  assert.ok(!ids("createur").includes("evenements"));
  assert.ok(ids("createur", { objectifs: ["Remplir mes événements"] }).includes("evenements"));
  assert.ok(ids("beaute").includes("adresse") && !ids("coach").includes("adresse"));
  const q = interviewFor("restaurant", {}, labelOf).find(x => x.id === "nom")!;
  assert.ok(asked(q, "restaurant", {}, labelOf));
});

test("an answer to a question no longer asked does not reach the carnet", () => {
  const a = { nom: "Lou", objectifs: ["Vendre en ligne"], creneaux: "Le mardi soir" };
  assert.deepEqual(keptAnswers("restaurant", a, labelOf), { nom: "Lou", objectifs: ["Vendre en ligne"] });
});

test("the small model's wording is cleaned and never empty-handed", () => {
  const w = sanitizeWording({ reaction: "Un bistrot du marché 🍅, ça se filme bien.", titre: "Le plat qu'on vient chercher chez Lou", pourquoi: "Je le montrerai en premier.", exemple: "« Le pot-au-feu du jeudi »", suggestions: ["Le pot-au-feu", "Le pot-au-feu", "La tarte du jour", 3] }, "texte");
  assert.equal(w.reaction, "Un bistrot du marché, ça se filme bien.");
  assert.equal(w.titre, "Le plat qu'on vient chercher chez Lou ?");
  assert.equal(w.exemple, "Le pot-au-feu du jeudi");
  assert.deepEqual(w.suggestions, ["Le pot-au-feu", "La tarte du jour"]);
  assert.deepEqual(sanitizeWording({ titre: "Ton ton ?", suggestions: ["a"] }, "choix").suggestions, []);
  assert.equal(sanitizeWording(null, "texte").titre, "");
  const c = entretienContent("Restaurant, café", [{ question: "Le nom ?", reponse: "Chez Lou" }, { question: "Ce que tu fais ?", reponse: "" }], { id: "specialite", kind: "texte", titre: "Ta spécialité ?", pourquoi: "Pour la montrer." });
  assert.match(c, /Chez Lou/);
  assert.match(c, /elle a passé la question/);
});
