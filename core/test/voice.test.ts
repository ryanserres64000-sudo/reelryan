import { test } from "node:test";
import assert from "node:assert/strict";
import { charsFor, estimate, isVoix, scriptPrompt, subtitles, wordsFrom } from "../voice.ts";

const align = (text: string, per = 0.06) => {
  const characters = [...text];
  return { characters, character_start_times_seconds: characters.map((_, i) => i * per), character_end_times_seconds: characters.map((_, i) => i * per + per) };
};

test("words and their times come from the character alignment", () => {
  const w = wordsFrom(align("Le plat du jour."));
  assert.deepEqual(w.map(x => x.mot), ["Le", "plat", "du", "jour."]);
  assert.equal(w[1].debut, 0.18);
});

test("subtitles: a few words a line, cut at punctuation, placed where the voice starts", () => {
  const s = subtitles(wordsFrom(align("Aujourd'hui chez Lou, magret et purée maison. Venez tôt !")), 2, "a1");
  assert.deepEqual(s.map(x => x.texte), ["Aujourd'hui chez Lou,", "magret et purée maison.", "Venez tôt !"]);
  assert.equal(s[0].debut, 2);
  assert.ok(s.every(x => x.lie === "a1" && x.position === "bas" && x.fin > x.debut));
  assert.ok(s[0].fin <= s[1].debut, "une ligne à la fois");
});

test("length, voices and the script request", () => {
  assert.equal(estimate("x".repeat(150)), 10);
  assert.equal(charsFor(20), 300);
  assert.ok(isVoix("camille") && !isVoix("pirate"));
  assert.match(scriptPrompt("présente le plat du jour", { duree: 20, marque: "Chez Lou" }), /300 caractères/);
});

test("a voice-over comes with its subtitles, moves and goes with them", async () => {
  const { addVoiceOver, deleteAudio, setAudio, toDoc } = await import("../edit.ts");
  const { sanitizeTimeline } = await import("../timeline.ts");
  const shot = (debut: number, fin: number) => ({ source: "a", debut, fin, cadrage: "centre", transition: "coupe", garder_son: false, vitesse: 1, etalonnage: "naturel", mouvement: "aucun", raison: "" });
  let d = toDoc(sanitizeTimeline({ titre: "T", plans: [shot(0, 5), shot(5, 10)], textes: [{ texte: "Titre", debut: 0, fin: 1, position: "haut", style: "titre" }], musique: { mode: "aucune" } }, { a: { duration: 10 } }).timeline);
  const lines = subtitles(wordsFrom(align("Le plat du jour, magret.")), 1, "v1");
  d = addVoiceOver(d, { id: "v1", type: "voix-off", source: "v.mp3", nom: "Voix off", t: 1, debut: 0, fin: 1.5, volume: 1, fondu_entree: 0, fondu_sortie: 0, texte: "Le plat du jour, magret.", voix: "camille", ia: true }, lines, false);
  assert.equal(d.timeline.musique.ducking_voix, false);
  assert.equal(d.timeline.textes.length, 1 + lines.length);
  assert.equal(d.texteIds.length, d.timeline.textes.length);
  d = setAudio(d, "v1", { t: 3 });
  assert.equal(d.timeline.textes.find(x => x.lie === "v1")!.debut, 3);
  d = deleteAudio(d, "v1");
  assert.deepEqual(d.timeline.textes.map(x => x.texte), ["Titre"]);
  assert.equal(d.texteIds.length, 1);
});

test("an export with a synthetic voice says so in its metadata", async () => {
  const { provenance } = await import("../export.ts");
  assert.match(provenance(false, true)["com.apple.quicktime.description"], /Voix off générée par IA/);
  assert.match(provenance(true, true)["com.apple.quicktime.description"], /Montage assisté par IA.*Voix off/);
  assert.equal(provenance(false, false)["com.apple.quicktime.description"], undefined);
});
