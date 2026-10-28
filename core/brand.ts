// Brand DNA: what the sign-up questionnaire collects, what the one AI analysis returns, and the short
// text that goes with every edit (étude, ch. 5 §8 « carnet de style », ch. 7 « Onboarding 2 » and
// « Kit de marque » ; Ryan, 28 octobre : questionnaire poussé, IA présente dès l'inscription).
// The logo colours are read on the iPhone, without AI. Shared by the app and the server.
import { POLICES, SOUS_TITRES_STYLES } from "./timeline.ts";

export const PROFILS = ["commerce", "restaurant", "petite-entreprise", "grande-entreprise", "ecole", "createur", "debutant"] as const;
export type Profil = (typeof PROFILS)[number];

// The house styles of the study (ch. 6 §5), one per row of its table.
export const STYLES_MAISON = ["comptoir", "atelier", "coach", "conseil", "vitrine", "avant-apres", "coulisses", "evenement", "chic", "temoignage"] as const;
export type StyleMaison = (typeof STYLES_MAISON)[number];
export const FORMATS = ["reel", "story", "post", "carrousel", "affiche"] as const;

// Default style when the AI is unavailable, and the one the questionnaire starts from.
export const STYLE_PAR_PROFIL: Record<Profil, StyleMaison> = {
  commerce: "vitrine", restaurant: "comptoir", "petite-entreprise": "coulisses", "grande-entreprise": "temoignage",
  ecole: "evenement", createur: "coulisses", debutant: "coulisses",
};

// One question per card; every card but the profile can be skipped. `options` are ids, the app
// holds their labels (app/src/copy/fr.ts) and sends the labels, so the server reads plain French.
export type Question = { id: string; kind: "texte" | "choix" | "multi" | "mots"; options?: readonly string[]; max?: number; profils?: readonly Profil[] };
export const QUESTIONS: readonly Question[] = [
  { id: "nom", kind: "texte", max: 60 },
  { id: "activite", kind: "texte", max: 200 },
  { id: "specialite", kind: "texte", max: 200, profils: ["restaurant", "commerce", "petite-entreprise", "createur"] },
  { id: "evenements", kind: "texte", max: 200, profils: ["ecole"] },
  { id: "envie", kind: "texte", max: 200, profils: ["debutant"] },
  { id: "frein", kind: "multi", options: ["sujet", "camera", "temps", "montage", "idees"], profils: ["debutant"] },
  { id: "regles", kind: "texte", max: 300, profils: ["grande-entreprise"] },
  { id: "public", kind: "texte", max: 200 },
  { id: "objectifs", kind: "multi", options: ["clients", "reservations", "ventes", "notoriete", "recrutement", "communaute", "evenements", "inscriptions"] },
  { id: "valeurs", kind: "mots", max: 3 },
  { id: "ton", kind: "choix", options: ["chaleureux", "expert", "drole", "chic", "energique", "direct"] },
  { id: "eviter", kind: "texte", max: 200 },
  { id: "references", kind: "texte", max: 200 },
  { id: "plateformes", kind: "multi", options: ["instagram", "tiktok", "youtube", "linkedin", "facebook"] },
  { id: "frequence", kind: "choix", options: ["semaine", "plusieurs", "jour", "inconnu"] },
  { id: "adresse", kind: "texte", max: 120, profils: ["restaurant", "commerce", "petite-entreprise"] },
];
export const questionsFor = (p: Profil) => QUESTIONS.filter(q => !q.profils || q.profils.includes(p));

export type Answers = Record<string, string | string[]>;
export type Kit = { couleurs: string[]; polices: { titres: string; texte: string }; logo: boolean };
export type Idee = { titre: string; format: (typeof FORMATS)[number]; pourquoi: string };
export type Pilier = { titre: string; idee: string };
export type Dna = {
  version: 1; profil: Profil; nom: string;
  resume: string; ton: string; valeurs: string[]; public: string;
  piliers: Pilier[]; style_maison: StyleMaison; sous_titres: (typeof SOUS_TITRES_STYLES)[number];
  regles: string[]; a_eviter: string[]; idees: Idee[];
  couleurs: string[]; polices: { titres: string; texte: string };
};

// Font pairs offered when the person has no brand guide (2 fonts at most, OFL, étude ch. 6 §3).
export const FONT_PAIRS: readonly { titres: (typeof POLICES)[number]; texte: (typeof POLICES)[number] }[] = [
  { titres: "Bricolage Grotesque", texte: "DM Sans" }, { titres: "Fraunces", texte: "Inter" },
  { titres: "Playfair Display", texte: "Montserrat" }, { titres: "Bebas Neue", texte: "Inter" },
  { titres: "Cormorant Garamond", texte: "Poppins" }, { titres: "Archivo Black", texte: "DM Sans" },
];

// What a Reel must never look like (Ryan, 28 octobre : « trop marqué par l'IA »). Always in the DNA.
export const CLICHES = [
  "néon et dégradés violets", "mots géants qui rebondissent", "rafales d'emojis", "zoom à chaque coupe",
  "flash sur chaque temps", "transitions glitch", "plus de 2 polices", "texte sur un visage", "avatar ou image générée",
];

// ---------- Logo colours, on the device ----------

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
export const isHex = (s: unknown): s is string => typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s);
const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function lin(v: number) { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
export function luminance(h: string) { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
export function contrast(a: string, b: string) { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
function saturation(r: number, g: number, b: number) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; }

// Up to `count` brand colours from a small RGBA image of the logo (64 × 64 is plenty): transparent
// pixels and the background (the colour of the corners) are left out, close colours are merged,
// then colours are ranked by how much of the logo they cover, a vivid colour counting double.
export function paletteFromPixels(px: Uint8Array | Uint8ClampedArray, w: number, h: number, count = 4): string[] {
  const at = (x: number, y: number) => (y * w + x) * 4;
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)].filter(i => px[i + 3] >= 128);
  const bg = corners.length >= 3 ? corners.map(i => [px[i], px[i + 1], px[i + 2]]) : [];
  const near = (a: number[], b: number[], d: number) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 < d * d;
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < w * h * 4; i += 4) {
    if (px[i + 3] < 128) continue;
    const c = [px[i], px[i + 1], px[i + 2]];
    if (bg.some(b => near(b, c, 40))) continue;
    const key = (c[0] >> 4) << 8 | (c[1] >> 4) << 4 | (c[2] >> 4);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += c[0]; e.g += c[1]; e.b += c[2];
    buckets.set(key, e);
  }
  const total = [...buckets.values()].reduce((s, e) => s + e.n, 0);
  if (!total) return bg.length ? [hex(bg[0][0], bg[0][1], bg[0][2])] : [];
  const merged: { n: number; c: number[] }[] = [];
  for (const e of [...buckets.values()].sort((a, b) => b.n - a.n)) {
    const c = [e.r / e.n, e.g / e.n, e.b / e.n];
    const m = merged.find(x => near(x.c, c, 48));
    if (m) { m.c = m.c.map((v, i) => (v * m.n + c[i] * e.n) / (m.n + e.n)); m.n += e.n; }
    else merged.push({ n: e.n, c });
  }
  return merged
    .filter(m => m.n / total >= 0.02)
    .map(m => ({ ...m, score: (m.n / total) * (1 + saturation(m.c[0], m.c[1], m.c[2])) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(m => hex(m.c[0], m.c[1], m.c[2]));
}

// The colour that reads on a given background, for a text over a brand cartouche.
export function textOn(bg: string) { return contrast(bg, "#ffffff") >= contrast(bg, "#111111") ? "#ffffff" : "#111111"; }

// ---------- The one AI analysis ----------

const str = (max: number, description?: string) => ({ type: "string", ...(description ? { description: `${description} (${max} caractères au plus)` } : {}) });
export const DNA_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["resume", "ton", "valeurs", "public", "piliers", "style_maison", "sous_titres", "regles", "a_eviter", "idees", "polices"],
  properties: {
    resume: str(300, "La marque en 2 phrases, comme une directrice artistique la présenterait à son équipe"),
    ton: str(120, "Le ton des textes, en une phrase"),
    valeurs: { type: "array", items: { type: "string" }, description: "3 valeurs, un ou deux mots chacune" },
    public: str(160, "À qui parle la marque"),
    piliers: {
      type: "array", description: "3 piliers de contenu propres à cette marque",
      items: { type: "object", additionalProperties: false, required: ["titre", "idee"], properties: { titre: str(40), idee: str(160, "Ce qu'on y montre") } },
    },
    style_maison: { type: "string", enum: [...STYLES_MAISON] },
    sous_titres: { type: "string", enum: [...SOUS_TITRES_STYLES] },
    regles: { type: "array", items: { type: "string" }, description: "5 règles visuelles au plus, concrètes et vérifiables (« Logo petit, à la fin »)" },
    a_eviter: { type: "array", items: { type: "string" }, description: "5 choses au plus à ne jamais faire pour cette marque" },
    idees: {
      type: "array", description: "Premières publications à faire",
      items: { type: "object", additionalProperties: false, required: ["titre", "format", "pourquoi"], properties: { titre: str(70), format: { type: "string", enum: [...FORMATS] }, pourquoi: str(140) } },
    },
    polices: {
      type: "object", additionalProperties: false, required: ["titres", "texte"],
      properties: { titres: { type: "string", enum: [...POLICES] }, texte: { type: "string", enum: [...POLICES] } },
    },
  },
} as const;

export const DNA_SYSTEM = `Tu es la directrice artistique de MaDa. Une personne vient de s'inscrire et a répondu à un questionnaire sur sa marque. Tu écris son carnet ADN : la base de tout ce que MaDa créera pour elle (Reels, stories, posts, affiches).
Règles :
- Pars uniquement de ses réponses et de son logo. N'invente ni chiffre, ni prix, ni récompense, ni adresse.
- Sois précise et propre à cette marque : une phrase qui irait à n'importe quel restaurant ou n'importe quel coach ne sert à rien.
- Le rendu doit rester naturel : ses vraies images d'abord, des textes sobres, un habillage léger à ses couleurs. Jamais : ${CLICHES.join(", ")}.
- Choisis le style maison parmi : comptoir (restaurants, cafés), atelier (artisans, gros plans de mains), coach (énergique, mot à mot), conseil (face caméra, posé), vitrine (produits, prix en grand), avant-apres (transformation), coulisses (authentique, caméra à la main), evenement (soirées, dates), chic (hôtels, bijoux, lent et désaturé), temoignage (avis clients).
- Polices : garde celles de la personne si elle en a donné ; sinon choisis une paire qui lui ressemble, jamais plus de 2.
- Tutoie la personne, phrases courtes, zéro jargon. Écris en français.`;

export function dnaContent(profil: Profil, answers: Answers, kit: Kit, labels: { profil: string }) {
  const lines = questionsFor(profil).map(q => {
    const a = answers[q.id];
    const v = Array.isArray(a) ? a.join(", ") : a;
    return v ? `- ${q.id} : ${v}` : null;
  }).filter(Boolean);
  const ideas = profil === "debutant" ? 10 : 6;
  return `Profil : ${labels.profil}
Réponses au questionnaire :
${lines.join("\n") || "- (aucune réponse, seulement le profil)"}
Couleurs tirées du logo : ${kit.couleurs.join(", ") || "pas de logo"}
Polices données : ${kit.polices.titres && kit.polices.texte ? `${kit.polices.titres} et ${kit.polices.texte}` : "aucune"}

Écris son carnet ADN, avec ${ideas} idées de premières publications${profil === "debutant" ? " (elle débute : des idées faciles à tourner avec un téléphone, sans se montrer si elle n'aime pas la caméra)" : ""}.`;
}

const cut = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const list = (v: unknown, max: number, len: number) => (Array.isArray(v) ? v.map(x => cut(x, len)).filter(Boolean).slice(0, max) : []);
const oneOf = <T extends readonly string[]>(v: unknown, values: T, fallback: T[number]): T[number] => (values.includes(v as string) ? (v as T[number]) : fallback);

// Checks what the AI returned and merges it with what the person gave: her name, colours and fonts
// always win. Also builds the carnet without AI (fallback), from the answers alone.
export function sanitizeDna(raw: unknown, profil: Profil, answers: Answers, kit: Kit): Dna {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const answer = (id: string) => { const a = answers[id]; return Array.isArray(a) ? a.join(", ") : a || ""; };
  const valeurs = list(r.valeurs, 3, 30);
  const given = Array.isArray(answers.valeurs) ? answers.valeurs.map(v => cut(v, 30)).filter(Boolean).slice(0, 3) : [];
  const polices = (r.polices && typeof r.polices === "object" ? r.polices : {}) as Record<string, unknown>;
  const font = (v: string, fallback: string) => (POLICES.includes(v as never) ? v : fallback);
  return {
    version: 1, profil,
    nom: cut(answer("nom"), 60),
    resume: cut(r.resume, 300) || cut(answer("activite"), 300),
    ton: cut(r.ton, 120) || cut(answer("ton"), 120),
    valeurs: given.length ? given : valeurs,
    public: cut(r.public, 160) || cut(answer("public"), 160),
    piliers: (Array.isArray(r.piliers) ? r.piliers : []).map(p => ({ titre: cut(p?.titre, 40), idee: cut(p?.idee, 160) })).filter(p => p.titre).slice(0, 3),
    style_maison: oneOf(r.style_maison, STYLES_MAISON, STYLE_PAR_PROFIL[profil]),
    sous_titres: oneOf(r.sous_titres, SOUS_TITRES_STYLES, "sobre"),
    regles: list(r.regles, 5, 120),
    a_eviter: list(r.a_eviter, 5, 120),
    idees: (Array.isArray(r.idees) ? r.idees : []).map(i => ({ titre: cut(i?.titre, 70), format: oneOf(i?.format, FORMATS, "reel"), pourquoi: cut(i?.pourquoi, 140) })).filter(i => i.titre).slice(0, 10),
    couleurs: kit.couleurs.filter(isHex).slice(0, 4),
    polices: kit.polices.titres && kit.polices.texte
      ? { titres: font(kit.polices.titres, "Bricolage Grotesque"), texte: font(kit.polices.texte, "DM Sans") }
      : { titres: font(cut(polices.titres, 40), "Bricolage Grotesque"), texte: font(cut(polices.texte, 40), "DM Sans") },
  };
}

// The short text sent with every edit, instead of the whole questionnaire (étude, ch. 5 §8 : environ
// 200 jetons). Fixed order, so the same brand always sends the same words.
export function compactDna(d: Dna): string {
  const build = (regles: string[], eviter: string[]) => [
    `Marque : ${d.nom || "sans nom"} (${d.profil}).`,
    d.resume,
    d.ton && `Ton : ${d.ton}`,
    d.valeurs.length && `Valeurs : ${d.valeurs.join(", ")}.`,
    d.public && `Public : ${d.public}`,
    `Style maison : ${d.style_maison} ; sous-titres ${d.sous_titres}.`,
    d.couleurs.length && `Couleurs : ${d.couleurs.join(", ")}.`,
    `Polices : ${d.polices.titres} (titres), ${d.polices.texte} (texte).`,
    regles.length && `Règles : ${regles.join(" ; ")}.`,
    `À éviter : ${[...eviter, "tout effet qui fait « IA »"].join(" ; ")}.`,
  ].filter(Boolean).join("\n");
  // Too long: drop the last rules first, one at a time, so every kept rule stays whole.
  let regles = d.regles, eviter = d.a_eviter, text = build(regles, eviter);
  while (text.length > 1200 && (regles.length || eviter.length)) {
    if (regles.length >= eviter.length) regles = regles.slice(0, -1); else eviter = eviter.slice(0, -1);
    text = build(regles, eviter);
  }
  return text;
}

// The `style` object of a montage request (lib/montage.js): the DNA plus the learnt corrections.
export const montageStyle = (d: Dna | null, corrections: string[] = []) => ({ ...(d ? { adn: compactDna(d), charte: { couleurs: d.couleurs, polices: d.polices } } : {}), corrections });

// ---------- Without AI ----------

// A carnet written from the profile alone, when the server cannot be reached: sign-up never blocks
// on the AI, and the carnet is completed at the next analysis. Plain rules, written by hand.
type Base = { piliers: Pilier[]; idees: Idee[]; regles: string[]; a_eviter: string[] };
const REGLES = ["Tes vraies images d'abord, jamais d'image générée", "Texte en bas, 5 mots au plus", "Ta couleur principale en cartouche, jamais en fond plein", "Ton logo petit, à la fin"];
const idee = (titre: string, format: Idee["format"], pourquoi: string): Idee => ({ titre, format, pourquoi });
const BASES: Record<Profil, Base> = {
  commerce: {
    piliers: [{ titre: "Les nouveautés", idee: "Ce qui vient d'arriver, déballé et montré de près" }, { titre: "Le conseil", idee: "Comment choisir, comment porter, comment utiliser" }, { titre: "La boutique", idee: "L'ambiance, la vitrine, toi derrière le comptoir" }],
    idees: [idee("Les 3 nouveautés de la semaine", "reel", "Un plan par produit, le prix en grand"), idee("Le produit préféré de tes clients", "post", "La preuve que ça plaît"), idee("La vitrine qui change", "story", "Facile à filmer, donne envie de passer"), idee("Un conseil en 15 secondes", "reel", "Tu montres ton expertise"), idee("Les coulisses de l'arrivage", "story", "Authentique, sans te montrer"), idee("L'affiche des soldes ou de l'événement", "affiche", "À imprimer et à poster")],
    regles: REGLES, a_eviter: ["Les promos criardes", "Les photos de catalogue"],
  },
  restaurant: {
    piliers: [{ titre: "L'assiette", idee: "Le plat du jour, du grill à l'assiette" }, { titre: "La cuisine", idee: "Les mains, le feu, le produit du marché" }, { titre: "La salle", idee: "Le service, les habitués, l'ambiance" }],
    idees: [idee("Le plat du jour en 15 secondes", "reel", "Le format qui fait réserver"), idee("Le marché du matin", "story", "Les produits frais, sans parler"), idee("Le coup de feu du midi", "reel", "Le rythme du service sur la musique"), idee("Le menu de la semaine", "affiche", "À poster et à imprimer"), idee("Un habitué raconte", "reel", "Un avis vaut mieux qu'une pub"), idee("La recette de la maison", "carrousel", "On la garde, on la partage")],
    regles: REGLES, a_eviter: ["Les plats froids ou mal éclairés", "Les textes sur l'assiette"],
  },
  "petite-entreprise": {
    piliers: [{ titre: "Le savoir-faire", idee: "Les mains au travail, le geste précis" }, { titre: "Les réalisations", idee: "Le résultat, avant et après" }, { titre: "L'équipe", idee: "Qui fait quoi, et pourquoi on aime ça" }],
    idees: [idee("Un chantier en avant / après", "reel", "La preuve de ton travail"), idee("Le geste du jour", "story", "Gros plan des mains, sans parler"), idee("Présente l'équipe", "carrousel", "On fait confiance à des visages"), idee("La question qu'on te pose toujours", "reel", "Tu y réponds en 20 secondes"), idee("L'avis d'un client", "post", "La citation en grand"), idee("Ton offre du mois", "affiche", "Claire et à ta couleur")],
    regles: REGLES, a_eviter: ["Les photos de banque d'images", "Le jargon technique"],
  },
  "grande-entreprise": {
    piliers: [{ titre: "Les gens", idee: "Les collaborateurs et leur métier, à visage humain" }, { titre: "Les preuves", idee: "Les clients, les résultats, les coulisses" }, { titre: "Les annonces", idee: "Nouveautés, événements, recrutements" }],
    idees: [idee("Un métier de chez vous en 30 secondes", "reel", "Humanise la marque"), idee("Un client témoigne", "reel", "Plus crédible qu'une pub"), idee("Les coulisses d'un projet", "story", "Ce qu'on ne voit jamais"), idee("L'offre d'emploi qui donne envie", "post", "Le recrutement passe par les réseaux"), idee("L'annonce de l'événement", "affiche", "Dans la charte, sans exception"), idee("Les chiffres clés de l'année", "carrousel", "À partir de tes vrais chiffres seulement")],
    regles: [...REGLES.slice(0, 3), "La charte de marque s'applique sans exception"], a_eviter: ["Le ton corporate froid", "Les visuels sans personne"],
  },
  ecole: {
    piliers: [{ titre: "Les événements", idee: "Avant, pendant, après : donner envie de venir" }, { titre: "La vie du campus", idee: "Les assos, les cours, les moments forts" }, { titre: "Les étudiants", idee: "Ceux qui font l'école, en vrai" }],
    idees: [idee("L'affiche de la prochaine soirée", "affiche", "La date en grand, au début et à la fin"), idee("L'after-movie de l'événement", "reel", "Le rythme accélère vers la fin"), idee("Une journée sur le campus", "reel", "Pour les futurs étudiants"), idee("Le compte à rebours", "story", "J-7, J-3, J-1"), idee("Présente le bureau", "carrousel", "Un visage, un rôle"), idee("Le sondage de la semaine", "story", "Fait participer")],
    regles: [...REGLES.slice(0, 3), "La date répétée au début et à la fin"], a_eviter: ["Les affiches surchargées", "Les photos floues de soirée"],
  },
  createur: {
    piliers: [{ titre: "Ton sujet", idee: "Ce que tu sais faire mieux que les autres" }, { titre: "Ton quotidien", idee: "Les coulisses de ta création" }, { titre: "Ta communauté", idee: "Les questions, les réponses, les échanges" }],
    idees: [idee("Ton astuce n°1 en 20 secondes", "reel", "Le format qui se partage"), idee("Les coulisses de ta dernière création", "story", "Authentique et facile"), idee("Ce que j'aurais aimé savoir avant", "carrousel", "Utile, donc sauvegardé"), idee("Réponds à une question", "reel", "Tes abonnés t'écrivent le sujet"), idee("Ta routine de travail", "reel", "Caméra à la main"), idee("Ton avant / après", "post", "La preuve du résultat")],
    regles: REGLES, a_eviter: ["Copier les tendances sans les adapter", "Les effets à la mode qui datent vite"],
  },
  debutant: {
    piliers: [{ titre: "Ce que tu fais", idee: "Ton activité ou ta passion, montrée simplement" }, { titre: "Comment tu le fais", idee: "Les mains, les outils, le résultat" }, { titre: "Pourquoi tu le fais", idee: "Ce qui te motive, en une phrase" }],
    idees: [idee("Filme tes mains pendant 30 secondes", "reel", "Pas besoin de te montrer"), idee("Ton espace de travail", "story", "Trois plans suffisent"), idee("Ton résultat du jour", "post", "Une belle photo, une phrase"), idee("Trois choses que tu utilises tous les jours", "carrousel", "Facile et utile"), idee("Un avant / après", "reel", "Le format qui marche toujours"), idee("Pourquoi tu as commencé", "post", "Une phrase sur une belle photo"), idee("Une journée en 15 secondes", "reel", "Un plan par heure"), idee("La question qu'on te pose", "story", "Avec un sondage"), idee("Ton erreur de débutant", "reel", "Les gens adorent"), idee("Ton affiche de présentation", "affiche", "Qui tu es, ce que tu fais")],
    regles: REGLES, a_eviter: ["Te forcer à parler face caméra", "Les modèles tout faits"],
  },
};

export function offlineDna(profil: Profil, answers: Answers, kit: Kit): Dna {
  return sanitizeDna({ ...BASES[profil], style_maison: STYLE_PAR_PROFIL[profil] }, profil, answers, kit);
}
