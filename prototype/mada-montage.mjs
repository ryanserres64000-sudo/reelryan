#!/usr/bin/env node
// MaDA desktop prototype: rushes + one sentence -> sorted keyframes -> Claude -> timeline JSON -> MP4.
// Usage: node prototype/mada-montage.mjs --help
import { parseArgs } from "node:util";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { sortRushes, probeMedia, VIDEO_EXT, IMAGE_EXT } from "./lib/sort.mjs";
import { tagFrames, decideEdit, reviewEdit, imposedTexts, MODELS } from "./lib/ai.mjs";
import { sanitizeTimeline } from "./lib/timeline.mjs";
import { renderTimeline, snapshots } from "./lib/render.mjs";

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
  else { log(HELP); process.exitCode = 1; }
} catch (e) {
  console.error(`Erreur : ${e.stderr ? String(e.stderr).trim().split("\n").slice(-3).join("\n") : e.message}`);
  process.exitCode = 1;
}
