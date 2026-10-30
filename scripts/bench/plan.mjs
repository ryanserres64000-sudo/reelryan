// Writes the plan.json the render bench reads (app/modules/mada-video/bench): a timeline shaped like the
// AI's, over the real files that `bench probe` measured, passed through the very sanitizeTimeline and
// exportPlan of the app. Usage:
//   node scripts/bench/plan.mjs <probe.json> <plan.json> [--gonfle] [--muet] [--duree 30] [--plateforme reels]
// --gonfle adds 0.05 s to each rush's length, as a rounded duration from the photo picker would.
import { readFileSync, writeFileSync } from "node:fs";
import { sanitizeTimeline } from "../../core/timeline.ts";
import { exportPlan } from "../../core/export.ts";

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
  textes: [{ texte: "Ce soir 🔥 on ouvre", debut: 0.3, fin: 2.8, position: "haut", style: "accroche", accent: "" }],
  effets: [], sous_titres: { actifs: false, style: "marque" }, musique: { mode: "aucune", bpm: 110 },
  charte: {}, exports: [{ plateforme }], style_utilise: [], relecture: { corrections: [], plans_a_tourner: [] }, legende: { texte: "Banc", hashtags: [] },
};
const { timeline, warnings } = sanitizeTimeline(raw, clips, { maxDuration: 90 });
const file = exportPlan(timeline)[0];
const sources = {
  rushes: Object.fromEntries(ids.map(id => [id, probe[id].uri])), logo: null, music: null,
  fonts: { titre: null, texte: null, accent: null }, effets: {}, audios: {},
};
writeFileSync(outPath, JSON.stringify({ timeline, file, sources }, null, 2));
const vids = timeline.plans.filter(p => !probe[p.source].photo).length;
console.log(`${timeline.plans.length} plans (${vids} vidéos), ${timeline.duree} s, export ${file.duree} s${warnings.length ? `\navertissements : ${warnings.join(" | ")}` : ""}`);
for (const p of timeline.plans) console.log(`  ${p.source} ${p.debut}–${p.fin} s (rush ${probe[p.source].duration.toFixed(3)} s) ×${p.vitesse} ${p.transition}${p.garder_son ? " son" : ""}`);
