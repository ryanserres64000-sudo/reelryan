#!/usr/bin/env node
// MaDA desktop prototype: rushes + one sentence -> sorted keyframes -> Claude -> timeline JSON -> MP4.
// Usage: node prototype/mada-montage.mjs --help
import { parseArgs } from "node:util";
import { readdir, readFile, writeFile, mkdir, copyFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { sortRushes, probeMedia, VIDEO_EXT, IMAGE_EXT } from "./lib/sort.mjs";
import { tagFrames, decideEdit, reviewEdit, imposedTexts, MODELS } from "./lib/ai.mjs";
import { sanitizeTimeline } from "./lib/timeline.mjs";
import { renderTimeline, snapshots } from "./lib/render.mjs";
import { parseBrief, outilDuFichier, attribuerLettres, calculerResultats, rapportMarkdown, OUTILS, CRITERES } from "./lib/test-aveugle.mjs";

const HELP = `MaDA, prototype de montage sur ordinateur

  node prototype/mada-montage.mjs monter <dossier des rushes> --brief "ta phrase" [options]
      Trie les rushes, demande le montage à Claude et rend la vidéo.
      --style <fichier.json>   ton style (couleurs, police, ton, corrections)
      --duree <secondes>       durée visée (défaut : 20)
      --bpm <nombre>           cale les coupes sur ce tempo
      --musique <fichier>      ajoute une musique sous le son d'origine
      --modele sonnet|opus     modèle de décision (défaut : sonnet)
      --relecture              relecture critique du rendu, puis correction
      --images <nombre>        images clés envoyées à Claude (défaut : 30)
      --sortie <dossier>       dossier de sortie (défaut : sortie/<date>)

  node prototype/mada-montage.mjs trier <dossier des rushes>
      Montre le tri des plans, sans appel à l'IA (gratuit).

  node prototype/mada-montage.mjs rendre <timeline.json> <dossier des rushes> [--style] [--musique] [--sortie]
      Rend une timeline existante (retouchée à la main par exemple), sans IA.

  node prototype/mada-montage.mjs corriger <style.json> "ta correction"
      Ajoute une correction à la mémoire de ton style.

  Test à l'aveugle (lot 0) :
  node prototype/mada-montage.mjs lot <dossier des briefs> [--style] [--modele] [--relecture] [--sortie]
      Monte tous les briefs (un sous-dossier par brief, avec brief.txt et les rushes).
      Reprend là où il s'est arrêté ; écrit resume.csv (temps, coût, textes manquants).

  node prototype/mada-montage.mjs preparer-test <dossier des briefs> <dossier du lot> [--sortie]
      Rassemble MaDa et les concurrents (sous-dossier « concurrents »), les renomme au hasard
      et crée la fiche de vote des juges.

  node prototype/mada-montage.mjs resultats <dossier du test>
      Lit les votes (fichiers votes-*.json dans le dossier du test) et calcule les résultats.

La clé de l'API se lit dans ANTHROPIC_API_KEY (fichier .env à la racine accepté).`;

const log = m => console.log(m);

async function listRushes(dir) {
  const names = (await readdir(dir)).filter(n => !n.startsWith(".") && (VIDEO_EXT.has(path.extname(n).toLowerCase()) || IMAGE_EXT.has(path.extname(n).toLowerCase())));
  if (!names.length) throw new Error(`Aucune vidéo ni photo dans ${dir}.`);
  return names.sort((a, b) => a.localeCompare(b, "fr", { numeric: true })).map(n => path.join(dir, n));
}

async function loadStyle(file) {
  if (!file) return {};
  return JSON.parse(await readFile(file, "utf8"));
}

function outDir(opt) {
  return opt.sortie || path.join("sortie", new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-"));
}

const usd = n => `${n.toFixed(3)} $`;

// Imposed texts from the brief that the timeline does not show word for word.
const norm = s => s.normalize("NFC").replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
const missingTexts = (timeline, brief) => imposedTexts(brief).filter(t => !timeline.textes.some(x => norm(x.texte) === norm(t)));

async function monter(dir, opt) {
  if (!opt.brief) throw new Error("Il manque --brief \"ta phrase\".");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY manquante (ajoute-la dans .env à la racine).");
  const model = opt.modele === "opus" ? MODELS.opus : MODELS.sonnet;
  const duration = Number(opt.duree) || 20, bpm = Number(opt.bpm) || 0, beat = bpm ? 60 / bpm : 0;
  const style = await loadStyle(opt.style);
  const out = outDir(opt), work = path.join(out, "travail");
  await mkdir(out, { recursive: true });
  const started = Date.now(), ledger = [];

  log("1/4 Tri des plans…");
  const sorted = await sortRushes(await listRushes(dir), path.join(work, "images"), { maxFrames: Number(opt.images) || 30, onProgress: log });
  log(`    ${sorted.frames.length} images candidates, ${sorted.kept.length} gardées pour l'IA.`);

  log("2/4 Étiquetage (Claude Haiku 5.5)…");
  const tags = await tagFrames(sorted.kept, ledger, { onProgress: m => log("    " + m) });

  log(`3/4 Décision de montage (${model})…`);
  const raw = await decideEdit({ brief: opt.brief, style, clips: sorted.clips, frames: sorted.kept, tags, duration, beat, model }, ledger);
  let { timeline, duration: total, warnings } = sanitizeTimeline(raw, sorted.clips, { beat, maxDuration: duration * 1.5 + 5 });
  warnings.forEach(w => log("    ! " + w));
  log(`    « ${timeline.titre} » : ${timeline.plans.length} plans, ${total} s. ${timeline.intention}`);

  log("4/4 Rendu…");
  const file = path.join(out, "montage.mp4");
  await renderTimeline(timeline, sorted.clips, style, file, { music: opt.musique, workDir: work });

  if (opt.relecture) {
    log("+   Relecture critique du rendu…");
    await writeFile(path.join(out, "timeline-avant-relecture.json"), JSON.stringify(timeline, null, 2));
    const shots = await snapshots(file, total);
    const fixed = await reviewEdit({ brief: opt.brief, style, timeline, snapshots: shots, duration, model }, ledger);
    const reviewed = sanitizeTimeline(fixed, sorted.clips, { beat, maxDuration: duration * 1.5 + 5 });
    reviewed.warnings.forEach(w => log("    ! " + w));
    // The review may only polish: a much shorter edit, or one that lost imposed texts, is not kept.
    const short = reviewed.duration < duration * 0.85 && reviewed.duration < total;
    const lost = missingTexts(reviewed.timeline, opt.brief).length > missingTexts(timeline, opt.brief).length;
    if (short || lost) log(`    ! Relecture écartée (${short ? `montage ramené à ${reviewed.duration} s` : "textes imposés perdus"}) : on garde la première version.`);
    else {
      ({ timeline, duration: total } = reviewed);
      log(`    ${timeline.intention}`);
      await renderTimeline(timeline, sorted.clips, style, file, { music: opt.musique, workDir: work });
    }
  }
  for (const t of missingTexts(timeline, opt.brief)) log(`    ! Texte demandé absent du montage : « ${t} »`);

  const cost = ledger.reduce((s, l) => s + l.cout_usd, 0);
  const seconds = Math.round((Date.now() - started) / 1000);
  await writeFile(path.join(out, "timeline.json"), JSON.stringify(timeline, null, 2));
  await writeFile(path.join(out, "etiquettes.json"), JSON.stringify({ rushes: sorted.clips, images: sorted.frames.map(f => ({ ...f, etiquette: tags[f.id] })) }, null, 2));
  await writeFile(path.join(out, "cout.json"), JSON.stringify({ brief: opt.brief, modele: model, duree_montage_s: total, temps_total_s: seconds, cout_total_usd: Math.round(cost * 10000) / 10000, appels: ledger }, null, 2));
  log(`\nTerminé en ${seconds} s : ${file}`);
  log(`Coût IA réel : ${usd(cost)} (${ledger.map(l => `${l.etape} ${usd(l.cout_usd)}`).join(", ")})`);
  return { file, duree: total, plans: timeline.plans.length, manquants: missingTexts(timeline, opt.brief), temps: seconds, cout: cost };
}

async function trier(dir, opt) {
  const out = outDir(opt);
  const sorted = await sortRushes(await listRushes(dir), path.join(out, "images"), { maxFrames: Number(opt.images) || 30, onProgress: log });
  for (const f of sorted.frames) log(`  ${sorted.kept.includes(f) ? "✓" : f.reject ? "✗" : "·"} ${f.id} ${f.clip} ${String(f.time).padStart(5)} s  netteté ${f.sharpness.toFixed(2)}  lumière ${f.luma?.toFixed(0)}${f.reject ? "  (" + f.reject + ")" : ""}${f.scene ? "  changement de plan" : ""}`);
  log(`\n${sorted.kept.length} images gardées sur ${sorted.frames.length}. Images dans ${path.join(out, "images")}`);
}

async function rendre(timelineFile, dir, opt) {
  const files = await listRushes(dir);
  const clips = {}, out = outDir(opt);
  for (const [i, file] of files.entries()) {
    const id = `clip${String(i + 1).padStart(2, "0")}`;
    clips[id] = { id, ...(await probeMedia(file, path.join(out, "travail", "photos"))) };
  }
  const { timeline, duration, warnings } = sanitizeTimeline(JSON.parse(await readFile(timelineFile, "utf8")), clips, { beat: opt.bpm ? 60 / Number(opt.bpm) : 0 });
  warnings.forEach(w => log("! " + w));
  await mkdir(out, { recursive: true });
  const file = path.join(out, "montage.mp4");
  await renderTimeline(timeline, clips, await loadStyle(opt.style), file, { music: opt.musique, workDir: path.join(out, "travail") });
  log(`${file} (${duration} s, ${timeline.plans.length} plans)`);
}

async function corriger(styleFile, text) {
  if (!text) throw new Error("Écris la correction entre guillemets.");
  let style = {};
  try { style = JSON.parse(await readFile(styleFile, "utf8")); } catch (e) { if (e.code !== "ENOENT") throw e; }
  style.corrections = [...(style.corrections || []), text];
  await writeFile(styleFile, JSON.stringify(style, null, 2) + "\n");
  log(`Correction enregistrée (${style.corrections.length} au total). Elle sera respectée aux prochains montages.`);
}

/* ---------- Test à l'aveugle (lot 0) ---------- */

// Same container, no metadata: an extension or an encoder tag ("CapCut", "Edits") must not give a version away.
async function copieAnonyme(src, dest) {
  try { await promisify(execFile)("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy", "-map_metadata", "-1", "-map_chapters", "-1", "-movflags", "+faststart", dest]); }
  catch { await promisify(execFile)("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-map_metadata", "-1", "-movflags", "+faststart", dest]); }
}

const exists = f => access(f).then(() => true, () => false);
const isVideo = n => VIDEO_EXT.has(path.extname(n).toLowerCase());

// Brief folders: every sub-folder holding a brief.txt, in natural order.
async function listBriefs(dir) {
  const out = [];
  for (const e of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }))) {
    if (!e.isDirectory() || e.name.startsWith(".")) continue;
    const f = path.join(dir, e.name, "brief.txt");
    if (await exists(f)) out.push({ nom: e.name, dossier: path.join(dir, e.name), ...parseBrief(await readFile(f, "utf8")) });
  }
  if (!out.length) throw new Error(`Aucun brief dans ${dir} : il faut un sous-dossier par brief, avec un fichier brief.txt.`);
  return out;
}

const csvCell = v => /[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
const fr = n => String(n).replace(".", ",");

async function lot(dir, opt) {
  const briefs = await listBriefs(dir);
  const out = opt.sortie || path.join("sortie", "lot-" + new Date().toISOString().slice(0, 10));
  await mkdir(out, { recursive: true });
  const lignes = [];
  for (const [i, b] of briefs.entries()) {
    const sortie = path.join(out, b.nom);
    log(`\n===== Brief ${i + 1}/${briefs.length} : ${b.nom} =====`);
    if (!b.brief) { lignes.push({ nom: b.nom, statut: "brief.txt vide" }); log("! brief.txt est vide, brief ignoré."); continue; }
    if (await exists(path.join(sortie, "cout.json")) && await exists(path.join(sortie, "montage.mp4"))) {
      const c = JSON.parse(await readFile(path.join(sortie, "cout.json"), "utf8"));
      const t = JSON.parse(await readFile(path.join(sortie, "timeline.json"), "utf8"));
      lignes.push({ nom: b.nom, statut: "déjà fait", duree: c.duree_montage_s, plans: t.plans.length, manquants: missingTexts(t, b.brief), temps: c.temps_total_s, cout: c.cout_total_usd });
      log("Déjà monté, je passe au suivant.");
      continue;
    }
    const style = await exists(path.join(b.dossier, "style.json")) ? path.join(b.dossier, "style.json") : opt.style;
    const musique = (await readdir(b.dossier)).find(n => /^musique\.(mp3|m4a|wav|aac)$/i.test(n));
    try {
      const r = await monter(b.dossier, { ...opt, brief: b.brief, duree: b.duree ?? opt.duree, bpm: b.bpm ?? opt.bpm, style, musique: musique ? path.join(b.dossier, musique) : opt.musique, sortie });
      lignes.push({ nom: b.nom, statut: "ok", ...r });
    } catch (e) {
      lignes.push({ nom: b.nom, statut: "erreur : " + (e.message || e) });
      console.error(`! Échec de ${b.nom} : ${e.message || e}. Je continue avec le brief suivant.`);
    }
  }
  const head = ["brief", "statut", "durée (s)", "plans", "textes imposés manquants", "temps (s)", "coût IA ($)"];
  const rows = lignes.map(l => [l.nom, l.statut, l.duree ?? "", l.plans ?? "", (l.manquants || []).join(" | "), l.temps ?? "", l.cout !== undefined ? fr(Math.round(l.cout * 1000) / 1000) : ""]);
  await writeFile(path.join(out, "resume.csv"), "\uFEFF" + [head, ...rows].map(r => r.map(csvCell).join(";")).join("\n") + "\n");
  const ok = lignes.filter(l => l.temps !== undefined);
  const moy = k => ok.reduce((s, l) => s + Number(l[k]), 0) / (ok.length || 1);
  log(`\nLot terminé : ${ok.length}/${briefs.length} briefs montés dans ${out}.`);
  if (ok.length) log(`Temps moyen ${Math.round(moy("temps"))} s, coût moyen ${usd(moy("cout"))}, coût total ${usd(ok.reduce((s, l) => s + Number(l.cout), 0))}.`);
  const erreurs = lignes.filter(l => String(l.statut).startsWith("erreur") || l.statut === "brief.txt vide");
  if (erreurs.length) { log(`${erreurs.length} brief(s) à refaire : ${erreurs.map(l => l.nom).join(", ")}. Relance la même commande, les briefs déjà faits sont gardés.`); process.exitCode = 1; }
  log(`Résumé : ${path.join(out, "resume.csv")}`);
}

async function preparerTest(briefsDir, lotDir, opt) {
  const briefs = await listBriefs(briefsDir);
  const out = opt.sortie || "test-aveugle";
  if (await exists(path.join(out, "cle-secrete.json"))) throw new Error(`${out} contient déjà un test préparé. Choisis un autre dossier avec --sortie, ou supprime celui-ci.`);
  const cle = {}, donnees = [], manques = [];
  let n = 0;
  for (const b of briefs) {
    const versions = {};
    const mada = path.join(lotDir, b.nom, "montage.mp4");
    if (await exists(mada)) versions.mada = mada; else manques.push(`${b.nom} : pas de montage MaDa dans ${lotDir}`);
    const dc = path.join(b.dossier, "concurrents");
    for (const f of await exists(dc) ? (await readdir(dc)).filter(isVideo) : []) {
      const o = outilDuFichier(f); if (o && !versions[o]) versions[o] = path.join(dc, f);
    }
    for (const o of ["capcut", "edits"]) if (!versions[o]) manques.push(`${b.nom} : pas de vidéo ${OUTILS[o]} dans ${dc}`);
    if (!versions.mada || !(versions.capcut || versions.edits)) continue;
    const id = `brief-${String(++n).padStart(2, "0")}`;
    const lettres = attribuerLettres(Object.keys(versions));
    await mkdir(path.join(out, "videos", id), { recursive: true });
    for (const [l, o] of Object.entries(lettres)) await copieAnonyme(versions[o], path.join(out, "videos", id, `${l}.mp4`));
    cle[id] = { nom: b.nom, lettres };
    donnees.push({ id, brief: b.brief, videos: Object.keys(lettres).map(l => ({ lettre: l, src: `videos/${id}/${l}.mp4` })) });
  }
  if (!donnees.length) throw new Error("Aucun brief complet : il faut au moins MaDa et CapCut ou Edits.\n" + manques.join("\n"));
  const here = path.dirname(fileURLToPath(import.meta.url));
  await writeFile(path.join(out, "cle-secrete.json"), JSON.stringify(cle, null, 2) + "\n");
  await writeFile(path.join(out, "donnees.js"), `window.MADA_TEST = ${JSON.stringify({ briefs: donnees, criteres: CRITERES }, null, 1)};\n`);
  await copyFile(path.join(here, "test-aveugle", "fiche-de-vote.html"), path.join(out, "fiche-de-vote.html"));
  manques.forEach(m => log("! " + m));
  log(`\nTest prêt : ${donnees.length} brief(s) dans ${out}.`);
  log(`Donne aux juges le dossier « videos », donnees.js et fiche-de-vote.html, JAMAIS cle-secrete.json.`);
  log(`Chaque juge ouvre fiche-de-vote.html, vote, puis t'envoie son fichier votes-<prénom>.json à mettre dans ${out}.`);
}

async function resultats(dir) {
  const cle = JSON.parse(await readFile(path.join(dir, "cle-secrete.json"), "utf8"));
  const fichiers = (await readdir(dir)).filter(n => /^votes.*\.json$/i.test(n));
  if (!fichiers.length) throw new Error(`Aucun fichier votes-*.json dans ${dir}.`);
  const votes = [];
  for (const f of fichiers) {
    try { votes.push(JSON.parse(await readFile(path.join(dir, f), "utf8"))); }
    catch { log(`! ${f} illisible, ignoré.`); }
  }
  const r = calculerResultats(cle, votes);
  const md = rapportMarkdown(r);
  await writeFile(path.join(dir, "resultats.md"), md);
  log(md);
  log(`(${votes.length} juge(s). Rapport enregistré dans ${path.join(dir, "resultats.md")})`);
}

const { values: opt, positionals: [cmd, ...rest] } = parseArgs({
  allowPositionals: true,
  options: {
    brief: { type: "string" }, style: { type: "string" }, duree: { type: "string" }, bpm: { type: "string" },
    musique: { type: "string" }, modele: { type: "string" }, relecture: { type: "boolean" }, images: { type: "string" },
    sortie: { type: "string" }, help: { type: "boolean", short: "h" }
  }
});

try {
  try { process.loadEnvFile(".env"); } catch {}
  if (opt.help || !cmd) log(HELP);
  else if (cmd === "monter" && rest[0]) await monter(rest[0], opt);
  else if (cmd === "trier" && rest[0]) await trier(rest[0], opt);
  else if (cmd === "rendre" && rest[1]) await rendre(rest[0], rest[1], opt);
  else if (cmd === "corriger" && rest[0]) await corriger(rest[0], rest[1]);
  else if (cmd === "lot" && rest[0]) await lot(rest[0], opt);
  else if (cmd === "preparer-test" && rest[1]) await preparerTest(rest[0], rest[1], opt);
  else if (cmd === "resultats" && rest[0]) await resultats(rest[0]);
  else { log(HELP); process.exitCode = 1; }
} catch (e) {
  console.error(`Erreur : ${e.stderr ? String(e.stderr).trim().split("\n").slice(-3).join("\n") : e.message}`);
  process.exitCode = 1;
}
