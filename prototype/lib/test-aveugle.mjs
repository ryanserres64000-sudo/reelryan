// Blind test (lot 0): brief folders, anonymised versions, judges' votes -> preference rates.
// Pure functions only, so they can be tested without videos or API calls.
import { randomInt } from "node:crypto";

export const OUTILS = { mada: "MaDa", capcut: "CapCut", edits: "Edits", youtube: "YouTube Edit with AI" };
export const CONCURRENTS = ["capcut", "edits", "youtube"];
export const CRITERES = [
  ["style", "Dans ton style, sans template"],
  ["plans", "Choix des plans"],
  ["rythme", "Rythme"],
  ["textes", "Textes clairs en une seconde"],
  ["publier", "Prêt à publier"]
];
export const SEUIL = 0.7;

// brief.txt: the sentence, plus optional lines « durée : 30 » and « bpm : 110 » anywhere.
export function parseBrief(text) {
  const reglages = {}, lignes = [];
  for (const line of String(text).replace(/^﻿/, "").split(/\r?\n/)) {
    const m = /^\s*(dur[ée]e|bpm)\s*:\s*(\d+(?:[.,]\d+)?)\s*(s|secondes)?\s*$/i.exec(line);
    if (m) reglages[/^bpm$/i.test(m[1]) ? "bpm" : "duree"] = Number(m[2].replace(",", "."));
    else lignes.push(line);
  }
  return { brief: lignes.join("\n").trim(), ...reglages };
}

// Which tool a competitor file belongs to, from its name (capcut.mp4, Edits final.mov, youtube.mp4…).
export function outilDuFichier(name) {
  const n = name.toLowerCase();
  return CONCURRENTS.find(o => n.includes(o)) || (n.includes("you tube") || n.includes("yt") ? "youtube" : null);
}

// Fisher-Yates with an injectable random source (crypto by default).
export function melanger(items, rnd = n => randomInt(n)) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// { mada: file, capcut: file, … } -> letters in random order: { A: "edits", B: "mada", … }
export function attribuerLettres(outils, rnd) {
  return Object.fromEntries(melanger(outils, rnd).map((o, i) => [String.fromCharCode(65 + i), o]));
}

// Wilson score interval at 95 %, robust for small samples.
export function wilson(gagnes, total, z = 1.96) {
  if (!total) return [0, 0];
  const p = gagnes / total, d = 1 + z * z / total;
  const centre = (p + z * z / (2 * total)) / d, marge = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / d;
  return [Math.max(0, centre - marge), Math.min(1, centre + marge)];
}

// A ranking is valid when each letter of the brief has a distinct rank from 1 to n.
export function classementValide(classement, lettres) {
  const rangs = lettres.map(l => Number(classement?.[l]));
  return rangs.every(r => Number.isInteger(r) && r >= 1 && r <= lettres.length) && new Set(rangs).size === lettres.length;
}

// cle: { "brief-01": { nom, lettres: { A: "mada", … } } }; votes: [{ juge, briefs: { "brief-01": { classement, notes, commentaire } } }]
export function calculerResultats(cle, votes) {
  const duel = Object.fromEntries(CONCURRENTS.map(c => [c, { gagnes: 0, total: 0 }]));
  const notes = {}, parBrief = {}, ignores = [];
  for (const v of votes) {
    for (const [id, rep] of Object.entries(v.briefs || {})) {
      const k = cle[id];
      if (!k) { ignores.push(`${v.juge} : ${id} inconnu`); continue; }
      const lettres = Object.keys(k.lettres);
      if (!classementValide(rep.classement, lettres)) { ignores.push(`${v.juge} : ${id} classement incomplet`); continue; }
      const rang = Object.fromEntries(lettres.map(l => [k.lettres[l], Number(rep.classement[l])]));
      const b = (parBrief[id] ??= { nom: k.nom, juges: 0, mada_premier: 0, duels: {} });
      b.juges++;
      if (rang.mada === 1) b.mada_premier++;
      for (const c of CONCURRENTS) {
        if (rang[c] === undefined || rang.mada === undefined) continue;
        const gagne = rang.mada < rang[c] ? 1 : 0;
        duel[c].total++; duel[c].gagnes += gagne;
        const bd = (b.duels[c] ??= { gagnes: 0, total: 0 }); bd.total++; bd.gagnes += gagne;
      }
      for (const [lettre, crit] of Object.entries(rep.notes || {})) {
        const outil = k.lettres[lettre]; if (!outil) continue;
        for (const [c] of CRITERES) {
          const n = Number(crit?.[c]); if (!(n >= 1 && n <= 5)) continue;
          const s = ((notes[outil] ??= {})[c] ??= { somme: 0, nb: 0 }); s.somme += n; s.nb++;
        }
      }
    }
  }
  const duels = Object.fromEntries(Object.entries(duel).filter(([, d]) => d.total).map(([c, d]) => {
    const taux = d.gagnes / d.total;
    return [c, { ...d, taux, intervalle: wilson(d.gagnes, d.total), reussi: taux >= SEUIL }];
  }));
  const moyennes = Object.fromEntries(Object.entries(notes).map(([o, cs]) => [o, Object.fromEntries(Object.entries(cs).map(([c, s]) => [c, s.somme / s.nb]))]));
  const obligatoires = ["capcut", "edits"].filter(c => duels[c]);
  const verdict = obligatoires.length < 2 ? "incomplet" : obligatoires.every(c => duels[c].reussi) ? "reussi" : "rate";
  return { duels, moyennes, parBrief, ignores, verdict };
}

const pct = x => `${Math.round(x * 100)} %`;

export function rapportMarkdown(r, { date = new Date().toISOString().slice(0, 10) } = {}) {
  const L = [`# Résultats du test à l'aveugle MaDa (${date})`, ""];
  L.push(r.verdict === "reussi" ? `**Réussi** : MaDa est préféré dans au moins ${pct(SEUIL)} des comparaisons face à CapCut et face à Edits.`
    : r.verdict === "rate" ? `**Raté** : l'objectif de ${pct(SEUIL)} n'est pas atteint face à tous les concurrents. On corrige les consignes et le tri, puis on refait 10 briefs (étude, ch. 11 §2).`
    : "**Incomplet** : il manque des votes face à CapCut ou face à Edits.", "");
  L.push("| Face à | Comparaisons | MaDa préféré | Taux | Fourchette probable (95 %) | Objectif 70 % |", "| --- | --- | --- | --- | --- | --- |");
  for (const [c, d] of Object.entries(r.duels)) L.push(`| ${OUTILS[c]} | ${d.total} | ${d.gagnes} | ${pct(d.taux)} | ${pct(d.intervalle[0])} à ${pct(d.intervalle[1])} | ${d.reussi ? "atteint" : "non atteint"} |`);
  const outils = Object.keys(OUTILS).filter(o => r.moyennes[o]);
  if (outils.length) {
    L.push("", "## Notes moyennes sur 5 (grille de diagnostic)", "", `| Critère | ${outils.map(o => OUTILS[o]).join(" | ")} |`, `| --- |${outils.map(() => " --- |").join("")}`);
    for (const [c, label] of CRITERES) L.push(`| ${label} | ${outils.map(o => r.moyennes[o][c] ? r.moyennes[o][c].toFixed(1).replace(".", ",") : "").join(" | ")} |`);
  }
  L.push("", "## Par brief", "", "| Brief | Juges | MaDa classé 1er | Gagné face à CapCut | Gagné face à Edits |", "| --- | --- | --- | --- | --- |");
  for (const [id, b] of Object.entries(r.parBrief).sort()) {
    const d = c => b.duels[c] ? `${b.duels[c].gagnes} / ${b.duels[c].total}` : "";
    L.push(`| ${id} (${b.nom}) | ${b.juges} | ${b.mada_premier} | ${d("capcut")} | ${d("edits")} |`);
  }
  if (r.ignores.length) L.push("", "## Votes écartés", "", ...r.ignores.map(x => `- ${x}`));
  return L.join("\n") + "\n";
}
