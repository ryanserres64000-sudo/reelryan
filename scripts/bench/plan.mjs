// Writes the plan.json the render bench reads (app/modules/mada-video/bench): a timeline shaped like the
// AI's, over the real files that `bench probe` measured, passed through the very sanitizeTimeline and
// exportPlan of the app. Usage:
//   node scripts/bench/plan.mjs <probe.json> <plan.json> [--gonfle] [--muet] [--duree 30] [--plateforme reels]
//     [--effets] [--musique <fichier audio> [--passage 10]] [--textes]
// --recette teaser|vlog|recit restyles the texts with that edit recipe (core/recipes.ts).
// --textes adds texts with their own font, capitals, letter spacing, an accent word and a « nom — rôle ».
// --gonfle adds 0.05 s to each rush's length, as a rounded duration from the photo picker would.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sanitizeTimeline } from "../../core/timeline.ts";
import { exportPlan } from "../../core/export.ts";
import { applyRecipe } from "../../core/edit.ts";

const [probePath, outPath, ...rest] = process.argv.slice(2);
if (!probePath || !outPath) { console.error("usage : node scripts/bench/plan.mjs <probe.json> <plan.json> [--gonfle] [--muet] [--duree 30]"); process.exit(1); }
const flag = (k) => rest.includes(k);
const value = (k, d) => { const i = rest.indexOf(k); return i >= 0 && rest[i + 1] ? rest[i + 1] : d; };
const target = Number(value("--duree", "30")), plateforme = value("--plateforme", "reels");

const probe = JSON.parse(readFileSync(probePath, "utf8"));
const ids = Object.keys(probe);
if (!ids.length) { console.error("Aucun fichier dans la sonde."); process.exit(1); }
const clips = Object.fromEntries(ids.map(id => [id, { duration: probe[id].duration + (flag("--gonfle") ? 0.05 : 0) }]));

// Shots of about 1.6 s spread across each video, the photos once each with a slow zoom, in turn
// until the target length; every fourth cut a « fondu », one shot in slow motion.
const videos = ids.filter(id => !probe[id].photo), photos = ids.filter(id => probe[id].photo);
const plans = [];
let total = 0, n = 0;
const push = (p) => { plans.push({ cadrage: "centre", etalonnage: "naturel", raison: "banc", ...p, transition: n % 4 === 3 ? "fondu" : "coupe" }); n++; };
for (const id of photos) { push({ source: id, debut: 0, fin: 2.5, garder_son: false, vitesse: 1, mouvement: "zoom-avant" }); total += 2.5; }
for (let pass = 0; total < target && videos.length && pass < 20; pass++) {
  for (const id of videos) {
    if (total >= target) break;
    const d = clips[id].duration, len = 1.6, slots = Math.max(1, Math.floor(d / len));
    const at = ((pass * 3) % slots) * len;
    const slow = n === 5;
    // The last shot of a rush runs right up to its (maybe rounded) end, where suspect n° 2 lives.
    const fin = pass === 0 && id === videos[videos.length - 1] ? d : Math.min(d, at + len);
    push({ source: id, debut: Math.max(0, fin - len), fin, garder_son: !flag("--muet"), vitesse: slow ? 0.5 : 1, mouvement: "aucun" });
    total += (fin - Math.max(0, fin - len)) / (slow ? 0.5 : 1);
  }
}

const raw = {
  titre: "Banc de test", intention: "Vérifier le rendu sur de vrais rushes", variante: "rythmee", plans,
  textes: [{ texte: "Ce soir 🔥 on ouvre", debut: 0.3, fin: 2.8, position: "haut", style: "accroche", accent: "" },
    ...(flag("--textes") ? [
      { texte: "800 personnes chez Hyde", debut: 3, fin: 5.5, position: "centre", style: "titre", accent: "", place: { x: 0.5, y: 0.45, w: 0.85, s: 1.2, r: 0 }, look: { role: "titre", couleur: null, fond: "ombre", align: "centre", anim: "zoom", police: "Anton", majuscules: true, mot: "Hyde", motCouleur: "#FF7A1A" } },
      { texte: "Le Royal Monceau", debut: 6, fin: 8.5, position: "haut", style: "titre", accent: "", place: { x: 0.5, y: 0.3, w: 0.9, s: 1, r: 0 }, look: { role: "titre", couleur: null, fond: "aucun", align: "centre", anim: "fondu", police: "Playfair Display", majuscules: true, espace: 0.15 } },
      { texte: "Marie — trésorière du BDE", debut: 9, fin: 12, position: "bas", style: "info", accent: "", place: { x: 0.38, y: 0.78, w: 0.6, s: 1, r: 0 }, look: { role: "texte", couleur: null, fond: "ombre", align: "gauche", anim: "glisse", police: "DM Sans" } },
      { texte: "Face à l'une des plus belles vues", debut: 12.5, fin: 15, position: "bas", style: "info", accent: "", look: { role: "texte", couleur: null, fond: "ombre", align: "centre", anim: "mots", mot: "vues" } },
    ] : [])],
  // The house sound effects (app/assets/sfx) and a music passage, as the app sends them.
  effets: flag("--effets") ? [{ t: 0.4, type: "whoosh" }, { t: 6, type: "pop" }, { t: 12, type: "impact" }] : [],
  sous_titres: { actifs: false, style: "marque" },
  musique: value("--musique") ? { mode: "fichier", bpm: 110, source: { type: "fichier", empreinte: "banc", droits_confirmes_le: "2026-10-30" }, passage: { debut: Number(value("--passage", "0")), fin: Number(value("--passage", "0")) + target + 5 }, volume: 0.8, ducking_voix: true, fondu_sortie: 1.5 } : { mode: "aucune", bpm: 110 },
  charte: {}, exports: [{ plateforme }], style_utilise: [], relecture: { corrections: [], plans_a_tourner: [] }, legende: { texte: "Banc", hashtags: [] },
};
const clean = sanitizeTimeline(raw, clips, { maxDuration: 90 }), warnings = clean.warnings;
const timeline = value("--recette") ? applyRecipe(clean.timeline, value("--recette")) : clean.timeline;
const file = exportPlan(timeline)[0];
const sources = {
  rushes: Object.fromEntries(ids.map(id => [id, probe[id].uri])), logo: null,
  music: value("--musique") ? { uri: pathToFileURL(resolve(value("--musique"))).href, ...timeline.musique.passage } : null,
  fonts: { titre: null, texte: null, accent: null }, audios: {},
  // The fonts the --textes texts chose, by fontKey (app/src/video/sources.ts), from the app's font packages.
  polices: flag("--textes") ? Object.fromEntries([["Anton:700", "anton/400Regular/Anton_400Regular.ttf"], ["Playfair Display:700", "playfair-display/700Bold/PlayfairDisplay_700Bold.ttf"], ["DM Sans:400", "dm-sans/400Regular/DMSans_400Regular.ttf"]]
    .map(([k, f]) => [k, pathToFileURL(resolve(import.meta.dirname, "../../app/node_modules/@expo-google-fonts", f)).href])) : {},
  effets: Object.fromEntries(["whoosh", "pop", "clic", "ding", "impact"].map(k => [k, pathToFileURL(resolve(import.meta.dirname, "../../app/assets/sfx", `${k}.m4a`)).href])),
};
writeFileSync(outPath, JSON.stringify({ timeline, file, sources }, null, 2));
const vids = timeline.plans.filter(p => !probe[p.source].photo).length;
console.log(`${timeline.plans.length} plans (${vids} vidéos), ${timeline.duree} s, export ${file.duree} s${warnings.length ? `\navertissements : ${warnings.join(" | ")}` : ""}`);
for (const p of timeline.plans) console.log(`  ${p.source} ${p.debut}–${p.fin} s (rush ${probe[p.source].duration.toFixed(3)} s) ×${p.vitesse} ${p.transition}${p.garder_son ? " son" : ""}`);
