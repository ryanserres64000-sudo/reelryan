import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeTimeline, imposedTexts, timelineDuration, PLATEFORMES } from "../timeline.ts";
// @ts-ignore: the prototype is plain JavaScript
import { sanitizeTimeline as prototypeSanitize } from "../../prototype/lib/timeline.mjs";

const clips = { clip01: { duration: 10 }, clip03: { duration: 8 }, photo01: { duration: 4 } };

// The example of the study (ch. 5 « Format JSON de la timeline MaDa (v1) »).
const exemple = {
  version: 1, titre: "Menu du jeudi", intention: "Accroche sur le plat fumant, service en rythme, fin sur l'adresse", variante: "accroche-forte",
  format: { w: 1080, h: 1920, fps: 30 }, duree: 29.7,
  plans: [
    { source: "clip03", debut: 2.1, fin: 3.9, cadrage: "centre", transition: "coupe", garder_son: false, vitesse: 1, etalonnage: "chaud", raison: "Plat fumant, meilleure accroche" },
    { source: "photo01", debut: 0, fin: 1.4, cadrage: "centre", transition: "zoom", garder_son: false, vitesse: 1, mouvement: "zoom-avant", raison: "Vitrine" },
  ],
  textes: [{ texte: "Menu du midi 14 €", debut: 0.4, fin: 2.8, position: "centre", style: "accroche", impose: true }],
  sous_titres: { actifs: false, style: "marque", position: "bas" },
  musique: { mode: "fichier", source: { type: "lien", empreinte: "sha256:9f2c", droits_confirmes_le: "2026-10-25T18:02:00Z" }, passage: { debut: 42, fin: 72 }, bpm: 112, temps_forts: [0, 0.54, 1.07], volume: 0.8, ducking_voix: true, fondu_sortie: 1 },
  charte: { couleurs: { principale: "#C2410C", texte: "#FFFFFF" }, polices: { titre: "Bricolage Grotesque", texte: "DM Sans" }, logo: { asset: "logo", position: "fin", taille: 0.22 } },
  style_utilise: ["Coupes rapides", "Logo à la fin"],
  exports: [{ plateforme: "reels", duree_max: 90 }, { plateforme: "tiktok", duree_max: 600 }, { plateforme: "shorts", duree_max: 180 }],
  relecture: { corrections: ["Accroche raccourcie à 1,8 s"], plans_a_tourner: ["Un gros plan de toi qui sers le plat"] },
  legende: { texte: "Jeudi, c'est blanquette 🍲", hashtags: ["#bayonne", "menudumidi", "menu du midi"] },
};

test("l'exemple de l'étude est accepté tel quel, calé sur 112 BPM", () => {
  const { timeline, warnings } = sanitizeTimeline(exemple, clips, { brief: "Menu du jeudi, on écrit « Menu du midi 14 € »" });
  assert.deepEqual(warnings, []);
  assert.equal(timeline.version, 1);
  assert.equal(timeline.plans.length, 2);
  assert.equal(timeline.plans[0].etalonnage, "chaud");
  assert.equal(timeline.plans[1].mouvement, "zoom-avant");
  const beat = 60 / 112;
  assert.ok(Math.abs((timeline.plans[0].fin - timeline.plans[0].debut) / beat - Math.round((timeline.plans[0].fin - timeline.plans[0].debut) / beat)) < 0.02);
  assert.equal(timeline.textes[0].impose, true);
  assert.equal(timeline.musique.bpm, 112);
  assert.equal(timeline.charte.couleurs.principale, "#C2410C");
  assert.deepEqual(timeline.legende.hashtags, ["#bayonne", "#menudumidi"]);
  assert.deepEqual(timeline.exports.map(e => e.plateforme), ["reels", "tiktok", "shorts"]);
  assert.equal(timeline.exports[0].duree_max, PLATEFORMES.reels.duree_max);
});

test("une timeline du prototype reste valide et donne les mêmes plans", () => {
  const proto = { titre: "T", intention: "I", plans: [
    { source: "clip01", debut: 1, fin: 3.2, cadrage: "gauche", transition: "coupe", garder_son: true, raison: "a" },
    { source: "clip03", debut: 0, fin: 2.1, cadrage: "centre", transition: "fondu", garder_son: false, raison: "b" },
  ], textes: [{ texte: "Bonjour", debut: 0, fin: 2, position: "bas", style: "titre" }] };
  for (const beat of [0, 0.5]) {
    const a = sanitizeTimeline(proto, clips, { beat }), b = prototypeSanitize(proto, clips, { beat });
    assert.deepEqual(a.timeline.plans.map(p => [p.source, p.debut, p.fin, p.transition]), b.timeline.plans.map((p: any) => [p.source, p.debut, p.fin, p.transition]));
    assert.equal(a.duration, b.duration);
  }
  const { timeline } = sanitizeTimeline(proto, clips);
  assert.equal(timeline.musique.mode, "aucune");
  assert.equal(timeline.plans[0].vitesse, 1);
  assert.equal(timeline.variante, null);
});

test("les valeurs hors liste ou hors bornes sont réparées", () => {
  const { timeline, warnings } = sanitizeTimeline({
    plans: [
      { source: "inconnu", debut: 0, fin: 2 },
      { source: "clip01", debut: -3, fin: 50, cadrage: "diagonale", transition: "explosion", vitesse: 9, etalonnage: "fluo" },
      { source: "clip03", debut: 7.9, fin: 7.6 },
    ],
    textes: [{ texte: "", debut: 0, fin: 3 }, { texte: "Court", debut: 1, fin: 1.1 }],
    musique: { mode: "fichier", source: { type: "lien" }, bpm: 300 },
    charte: { couleurs: { principale: "rouge" }, polices: { titre: "Comic Sans" }, logo: { asset: "logo", taille: 3 } },
    exports: [{ plateforme: "snapchat" }],
  }, clips);
  assert.equal(timeline.plans.length, 1);
  const p = timeline.plans[0];
  assert.deepEqual([p.debut, p.fin, p.cadrage, p.transition, p.vitesse, p.etalonnage], [0, 10, "centre", "coupe", 2, "naturel"]);
  assert.equal(timeline.duree, 5);
  assert.equal(timeline.textes.length, 0);
  assert.equal(timeline.musique.mode, "aucune");
  assert.equal(timeline.charte.couleurs.principale, null);
  assert.equal(timeline.charte.polices.titre, "Bricolage Grotesque");
  assert.equal(timeline.charte.logo?.taille, 0.4);
  assert.equal(timeline.exports.length, 3);
  assert.ok(warnings.some(w => w.includes("droits")));
  assert.ok(warnings.some(w => w.includes("inconnu")));
});

test("les textes imposés manquants sont signalés", () => {
  assert.deepEqual(imposedTexts("Fin sur « 12 rue Thiers » et \"Réserve\""), ["12 rue Thiers", "Réserve"]);
  const { timeline, warnings } = sanitizeTimeline({ plans: [{ source: "clip01", debut: 0, fin: 6 }], textes: [{ texte: "12 rue thiers", debut: 0, fin: 2 }] }, clips, { brief: "« 12 rue Thiers » puis « Réserve »" });
  assert.equal(timeline.textes[0].impose, true);
  assert.deepEqual(warnings, ["Texte demandé absent du montage : « Réserve »"]);
});

test("la vitesse compte dans la durée et un montage trop long est signalé", () => {
  assert.equal(timelineDuration([{ debut: 0, fin: 4, transition: "coupe", vitesse: 2 }]), 2);
  const long = { plans: Array.from({ length: 20 }, () => ({ source: "clip01", debut: 0, fin: 10 })), exports: [{ plateforme: "reels" }] };
  const { warnings } = sanitizeTimeline(long, clips, { maxDuration: 600 });
  assert.ok(warnings.some(w => w.startsWith("Trop long pour reels")));
});

test("une timeline sans plans est refusée", () => {
  assert.throws(() => sanitizeTimeline({}, clips), /pas de plans/);
  assert.throws(() => sanitizeTimeline({ plans: [{ source: "x" }] }, clips), /aucun plan/);
});
