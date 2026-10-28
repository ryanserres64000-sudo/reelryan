// Corrections in sentences (étude, ch. 5 §6 ; ch. 4 top 5 n°2) and style memory (ch. 5 §8).
// The common asks are understood by plain rules, on the phone, without AI (Ryan, 28 octobre : le moins
// d'IA possible) ; only the rest goes to the server. Locked shots and texts are never touched.
import { setLogo, setSubtitles, type EditDoc } from "./edit.ts";
import { ETALONNAGES, TEXT_POSITIONS, timelineDuration, type Clips, type Plan } from "./timeline.ts";

// What one sentence asked, as a stable key (for the memory) and the phrase MaDa says back.
export type Understood = { key: string; done: string };
export type Applied = { doc: EditDoc; understood: Understood[]; rest: string };

const round = (n: number) => Math.round(n * 100) / 100;
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’']/g, " ").replace(/\s+/g, " ").trim();
const NUM: Record<string, number> = { premier: 1, un: 1, deuxieme: 2, second: 2, deux: 2, troisieme: 3, trois: 3, quatrieme: 4, quatre: 4, cinquieme: 5, cinq: 5, sixieme: 6, six: 6, septieme: 7, sept: 7, huitieme: 8, huit: 8 };
const index = (w: string, n: number) => (w === "dernier" ? n - 1 : /^\d+$/.test(w) ? Number(w) - 1 : (NUM[w] ?? 0) - 1);

// Scales the unlocked shots around their middle; a shot never goes outside its rush.
function scale(d: EditDoc, k: number, clips: Clips, patch: Partial<Plan> = {}): EditDoc {
  const plans = d.timeline.plans.map((p, i) => {
    if (d.locked.includes(d.planIds[i])) return p;
    const len = clips[p.source]?.duration ?? p.fin, mid = (p.debut + p.fin) / 2, half = Math.max(0.25, ((p.fin - p.debut) * k) / 2);
    let debut = Math.max(0, mid - half), fin = Math.min(len, mid + half);
    if (fin - debut < 0.5) fin = Math.min(len, debut + 0.5);
    return { ...p, ...patch, debut: round(debut), fin: round(fin), transition: i === 0 ? "coupe" : patch.transition ?? p.transition };
  });
  return { ...d, timeline: { ...d.timeline, plans, duree: round(timelineDuration(plans)) } };
}
const eachPlan = (d: EditDoc, patch: Partial<Plan>) => {
  const plans = d.timeline.plans.map((p, i) => (d.locked.includes(d.planIds[i]) ? p : { ...p, ...patch, transition: i === 0 ? "coupe" : patch.transition ?? p.transition }));
  return { ...d, timeline: { ...d.timeline, plans, duree: round(timelineDuration(plans)) } };
};
const eachText = (d: EditDoc, f: (t: EditDoc["timeline"]["textes"][number]) => EditDoc["timeline"]["textes"][number] | null) => {
  const keep: number[] = [];
  const textes = d.timeline.textes.flatMap((t, i) => {
    const out = d.locked.includes(d.texteIds[i]) ? t : f(t);
    if (out) keep.push(i);
    return out ? [out] : [];
  });
  return { ...d, texteIds: keep.map(i => d.texteIds[i]), timeline: { ...d.timeline, textes } };
};

const GRADES: [RegExp, (typeof ETALONNAGES)[number], string][] = [
  [/plus chaud|couleurs? chaudes?/, "chaud", "J'ai réchauffé les couleurs"], [/plus froid|couleurs? froides?/, "froid", "J'ai refroidi les couleurs"],
  [/noir.et.blanc/, "noir-et-blanc", "Je suis passée en noir et blanc"], [/plus naturel|couleurs? naturelles?|sans filtre/, "naturel", "J'ai remis des couleurs naturelles"],
  [/plus contraste|plus de contraste/, "contraste", "J'ai ajouté du contraste"], [/desatur|moins sature/, "desature", "J'ai adouci les couleurs"],
];

type Rule = { re: RegExp; run: (d: EditDoc, m: RegExpMatchArray, clips: Clips) => { doc: EditDoc; u: Understood } | null };
const RULES: Rule[] = [
  { re: /plus (rythme|dynamique|rapide|nerveux)|coupes? plus courtes?/, run: (d, _m, c) => ({ doc: scale(d, 0.75, c, { transition: "coupe" }), u: { key: "rythme:rapide", done: "J'ai coupé plus court, sur le rythme" } }) },
  { re: /plus (pose|lent|calme|doux)|moins rapide|prends? (le|ton) temps/, run: (d, _m, c) => ({ doc: scale(d, 1.3, c, { transition: "fondu" }), u: { key: "rythme:pose", done: "J'ai allongé les plans, avec des fondus" } }) },
  { re: /plus court|raccourci|trop long/, run: (d, _m, c) => ({ doc: scale(d, 0.8, c), u: { key: "duree:courte", done: "J'ai raccourci le montage" } }) },
  { re: /plus long|rallonge|trop court/, run: (d, _m, c) => ({ doc: scale(d, 1.2, c), u: { key: "duree:longue", done: "J'ai allongé le montage" } }) },
  { re: /(pas de|sans|enleve le|retire le|supprime le) logo/, run: d => ({ doc: setLogo(d, "aucun"), u: { key: "logo:aucun", done: "J'ai retiré le logo" } }) },
  { re: /logo (a la fin|en fin|a la derniere)/, run: d => ({ doc: setLogo(d, "fin"), u: { key: "logo:fin", done: "Ton logo est à la fin" } }) },
  { re: /logo (au debut|en ouverture|d abord)/, run: d => ({ doc: setLogo(d, "debut"), u: { key: "logo:debut", done: "Ton logo ouvre le Reel" } }) },
  { re: /logo (partout|tout le long|en permanence)/, run: d => ({ doc: setLogo(d, "partout"), u: { key: "logo:partout", done: "Ton logo reste tout le long" } }) },
  { re: /(enleve|retire|supprime|vire|sans) (les |le )?(sous titres?|sous-titres?)/, run: d => ({ doc: setSubtitles(d, false), u: { key: "sous_titres:non", done: "J'ai retiré les sous-titres" } }) },
  { re: /(ajoute|mets?|avec) (des |les )?(sous titres?|sous-titres?)/, run: d => ({ doc: setSubtitles(d, true), u: { key: "sous_titres:oui", done: "J'ai ajouté les sous-titres" } }) },
  { re: /(enleve|retire|supprime|sans|pas de) (les |le |tous les )?textes?/, run: d => ({ doc: eachText(d, t => (t.impose ? t : null)), u: { key: "textes:aucun", done: "J'ai retiré les textes (sauf ceux que tu avais imposés)" } }) },
  { re: /textes? (en |au )(haut|bas|centre|milieu)/, run: (d, m) => {
    const pos = (m[2] === "milieu" ? "centre" : m[2]) as (typeof TEXT_POSITIONS)[number];
    return { doc: eachText(d, t => ({ ...t, position: pos })), u: { key: `textes:${pos}`, done: `Les textes sont ${pos === "centre" ? "au centre" : `en ${pos}`}` } };
  } },
];

// Shot-level rules read the shot number, so they are written apart from the table above.
function shotRule(d: EditDoc, s: string): { doc: EditDoc; u: Understood } | null {
  const n = d.timeline.plans.length;
  const del = s.match(/(?:enleve|retire|supprime|vire) (?:le )?(?:plan )?(\d+|premier|deuxieme|second|troisieme|quatrieme|cinquieme|sixieme|septieme|huitieme|dernier|un|deux|trois|quatre|cinq|six|sept|huit)(?: plan)?\b/);
  if (del) {
    const i = index(del[1], n);
    if (i < 0 || i >= n || n <= 1 || d.locked.includes(d.planIds[i])) return null;
    const plans = d.timeline.plans.filter((_, j) => j !== i);
    plans[0] = { ...plans[0], transition: "coupe" };
    return { doc: { ...d, planIds: d.planIds.filter((_, j) => j !== i), timeline: { ...d.timeline, plans, duree: round(timelineDuration(plans)) } }, u: { key: "plan:retire", done: `J'ai retiré le plan ${i + 1}` } };
  }
  const first = s.match(/(?:commence|ouvre|demarre) (?:par|sur) (?:le )?(?:plan )?(\d+|premier|deuxieme|second|troisieme|quatrieme|cinquieme|sixieme|septieme|huitieme|dernier|un|deux|trois|quatre|cinq|six|sept|huit)/);
  if (first) {
    const i = index(first[1], n);
    if (i <= 0 || i >= n) return null;
    const plans = [...d.timeline.plans], ids = [...d.planIds];
    const [p] = plans.splice(i, 1), [id] = ids.splice(i, 1);
    plans.unshift({ ...p, transition: "coupe" }); ids.unshift(id);
    if (plans[1].transition === "coupe" && d.timeline.plans[0].transition !== "coupe") plans[1] = { ...plans[1], transition: d.timeline.plans[0].transition };
    return { doc: { ...d, planIds: ids, timeline: { ...d.timeline, plans, duree: round(timelineDuration(plans)) } }, u: { key: "structure:ouverture", done: `J'ouvre sur le plan ${i + 1}` } };
  }
  return null;
}

// The shots Vision flagged on the phone (blurred, too dark): « enlève le plan flou » removes them.
function badRule(d: EditDoc, s: string, bad: string[]): { doc: EditDoc; u: Understood } | null {
  if (!/plans? (flous?|sombres?|rates?|moches?)/.test(s)) return null;
  const drop = d.timeline.plans.map((p, i) => bad.includes(p.source) && !d.locked.includes(d.planIds[i]));
  if (!drop.some(Boolean) || drop.every(Boolean)) return null;
  const plans = d.timeline.plans.filter((_, i) => !drop[i]);
  plans[0] = { ...plans[0], transition: "coupe" };
  const n = drop.filter(Boolean).length;
  return { doc: { ...d, planIds: d.planIds.filter((_, i) => !drop[i]), timeline: { ...d.timeline, plans, duree: round(timelineDuration(plans)) } }, u: { key: "plan:retire", done: n > 1 ? `J'ai retiré les ${n} plans ratés` : "J'ai retiré le plan raté" } };
}

// Applies what plain rules understand, clause by clause (« plus rythmé et logo à la fin »).
// `rest` holds what is left for the AI: empty when everything was understood.
export function applyCorrection(d: EditDoc, sentence: string, clips: Clips, bad: string[] = []): Applied {
  const understood: Understood[] = [], rest: string[] = [];
  let doc = d;
  for (const clause of sentence.replace(/noir\s+et\s+blanc/gi, "noir_et_blanc").split(/\s*(?:,|;|\.|\bet\b|\bpuis\b|\baussi\b)\s*/i).filter(Boolean)) {
    const s = fold(clause);
    let hit: { doc: EditDoc; u: Understood } | null = badRule(doc, s, bad) ?? shotRule(doc, s);
    if (!hit) for (const [re, grade, done] of GRADES) if (re.test(s)) { hit = { doc: eachPlan(doc, { etalonnage: grade }), u: { key: `couleur:${grade}`, done } }; break; }
    if (!hit) for (const r of RULES) { const m = s.match(r.re); if (m) { hit = r.run(doc, m, clips); if (hit) break; } }
    if (hit) { doc = hit.doc; understood.push(hit.u); } else rest.push(clause.trim());
  }
  return { doc, understood, rest: rest.join(", ") };
}

// ---------- Style memory ----------

export type Memory = { counts: Record<string, number>; rules: { key: string; text: string; at: string }[]; paused: boolean };
export const emptyMemory = (): Memory => ({ counts: {}, rules: [], paused: false });

// The rule MaDa writes in the carnet, for each key she can learn.
export const RULE_TEXT: Record<string, string> = {
  "rythme:rapide": "Coupes rapides, 1 à 2 s par plan", "rythme:pose": "Plans longs et fondus, on prend le temps",
  "duree:courte": "Des Reels courts", "duree:longue": "Des Reels plus longs",
  "logo:fin": "Logo à la fin", "logo:debut": "Logo au début", "logo:partout": "Logo tout le long", "logo:aucun": "Pas de logo dans les vidéos",
  "sous_titres:non": "Pas de sous-titres", "sous_titres:oui": "Toujours des sous-titres",
  "textes:aucun": "Le moins de texte possible", "textes:haut": "Textes en haut", "textes:bas": "Textes en bas", "textes:centre": "Textes au centre",
  "couleur:chaud": "Couleurs chaudes", "couleur:froid": "Couleurs froides", "couleur:naturel": "Couleurs naturelles, sans filtre",
  "couleur:noir-et-blanc": "Noir et blanc", "couleur:contraste": "Image contrastée", "couleur:desature": "Couleurs douces, désaturées",
  "structure:ouverture": "Ouvrir sur le plan le plus fort",
};
// Keys that cannot both be true: learning one forgets the other.
const OPPOSITE = (k: string) => k.split(":")[0];

// A rule is written only after 2 concordant corrections (étude, ch. 5 §8), and MaDa says so.
export function learn(m: Memory, keys: string[], now = new Date()): { memory: Memory; learned: string[] } {
  if (m.paused) return { memory: m, learned: [] };
  const counts = { ...m.counts };
  let rules = [...m.rules];
  const learned: string[] = [];
  for (const key of new Set(keys)) {
    if (!RULE_TEXT[key] || key === "plan:retire") continue;
    for (const k of Object.keys(counts)) if (k !== key && OPPOSITE(k) === OPPOSITE(key) && OPPOSITE(key) !== "structure") delete counts[k];
    counts[key] = (counts[key] ?? 0) + 1;
    if (counts[key] >= 2 && !rules.some(r => r.key === key)) {
      rules = rules.filter(r => OPPOSITE(r.key) !== OPPOSITE(key));
      rules.push({ key, text: RULE_TEXT[key], at: now.toISOString() });
      learned.push(RULE_TEXT[key]);
    }
  }
  return { memory: { ...m, counts, rules }, learned };
}

export const forget = (m: Memory, key: string): Memory => ({ ...m, rules: m.rules.filter(r => r.key !== key), counts: { ...m.counts, [key]: 0 } });
