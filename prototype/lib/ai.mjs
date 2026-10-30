// The two AI steps: a small model tags the kept keyframes, a large model decides the edit.
// Both return JSON through structured outputs; every call is priced from its real usage.
import Anthropic from "@anthropic-ai/sdk";
import { TIMELINE_SCHEMA, TRANSITION_SECONDS } from "./timeline.mjs";
import { frameAsBase64 } from "./sort.mjs";

export const MODELS = {
  etiquetage: "claude-haiku-5-5",
  sonnet: "claude-sonnet-5-5",
  opus: "claude-opus-5-5"
};

// Public API prices, dollars per million tokens (October 2026).
const PRICES = {
  "claude-haiku-5-5": { in: 0.10, out: 0.50, cacheRead: 0.01 },
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.20 },
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.20 },
  "claude-opus-4-8": { in: 5, out: 25, cacheRead: 0.50 }
};

let client;
const getClient = () => (client ??= new Anthropic());

export function costOf(model, usage) {
  const p = PRICES[model] || PRICES["claude-opus-5-5"];
  const cacheWrite = usage.cache_creation_input_tokens || 0, cacheRead = usage.cache_read_input_tokens || 0;
  return ((usage.input_tokens || 0) * p.in + cacheWrite * p.in * 1.25 + cacheRead * p.cacheRead + (usage.output_tokens || 0) * p.out) / 1e6;
}

// One streamed call returning parsed JSON; `fallback` adds the server-side refusal fallback
// (not available on Haiku). Retries once without it if the account rejects the beta.
export async function callJson({ model, system, content, schema, effort, maxTokens = 32000, fallback = false, step, ledger, signal }) {
  const build = withFallback => {
    const req = {
      model, max_tokens: maxTokens,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      output_config: { effort, format: { type: "json_schema", schema } },
      messages: [{ role: "user", content }]
    };
    if (withFallback) { req.betas = ["server-side-fallback-2026-07-01"]; req.fallbacks = "default"; }
    return req;
  };
  let msg;
  try {
    msg = await getClient().beta.messages.stream(build(fallback), { signal }).finalMessage();
  } catch (e) {
    if (!(fallback && e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message || ""))) throw e;
    msg = await getClient().beta.messages.stream(build(false), { signal }).finalMessage();
  }
  const cost = costOf(msg.model, msg.usage);
  ledger.push({ etape: step, modele: msg.model, entree: msg.usage.input_tokens, cache_lu: msg.usage.cache_read_input_tokens || 0,
    cache_ecrit: msg.usage.cache_creation_input_tokens || 0, sortie: msg.usage.output_tokens, cout_usd: Math.round(cost * 10000) / 10000 });
  if (msg.stop_reason === "refusal") throw new Error(`${step} : l'IA a refusé la demande.`);
  if (msg.stop_reason === "max_tokens") throw new Error(`${step} : réponse coupée (limite de longueur).`);
  const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("");
  return JSON.parse(text);
}

export const TAG_SCHEMA = {
  type: "object", additionalProperties: false, required: ["images"],
  properties: {
    images: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "description", "valeur_plan", "visages", "mouvement", "qualite", "interet", "accroche"],
        properties: {
          id: { type: "string" },
          description: { type: "string", description: "Ce qu'on voit, 15 mots maximum" },
          valeur_plan: { type: "string", enum: ["large", "moyen", "serre", "detail"] },
          visages: { type: "integer", description: "Nombre de visages visibles" },
          mouvement: { type: "string", enum: ["fixe", "lent", "rapide"], description: "Impression de mouvement de l'image" },
          qualite: { type: "integer", description: "Qualité technique de 1 à 5 (netteté, lumière, cadrage)" },
          interet: { type: "integer", description: "Intérêt pour un Reel de 1 à 5" },
          accroche: { type: "boolean", description: "Ferait une bonne première image de Reel" }
        }
      }
    }
  }
};

export const TAG_SYSTEM = `Tu étiquettes des images clés extraites des rushes vidéo d'un indépendant (coach, restaurateur, artisan, commerçant, freelance) qui veut un Reel.
Pour chaque image, décris factuellement ce qu'on voit et note-la. Sois exigeant : 5 = image qu'un monteur professionnel garderait sans hésiter.
Réponds pour chaque identifiant reçu, dans le même ordre.`;

export async function tagFrames(frames, ledger, { batch = 10, onProgress = () => {} } = {}) {
  const tags = {};
  for (let i = 0; i < frames.length; i += batch) {
    const group = frames.slice(i, i + batch);
    const content = [];
    for (const f of group) {
      content.push({ type: "text", text: `Image ${f.id} (rush ${f.clip}, à ${f.time} s) :` });
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: await frameAsBase64(f) } });
    }
    content.push({ type: "text", text: `Étiquette ces ${group.length} images.` });
    const out = await callJson({ model: MODELS.etiquetage, system: TAG_SYSTEM, content, schema: TAG_SCHEMA, effort: "low", maxTokens: 16000, step: "etiquetage", ledger });
    for (const t of out.images || []) tags[t.id] = t;
    onProgress(`Étiquetage : ${Math.min(i + batch, frames.length)}/${frames.length} images`);
  }
  return tags;
}

export const DIRECTOR_SYSTEM = `Tu es la directrice artistique et la monteuse de MaDA. Tu montes un Reel vertical (1080 × 1920) à partir des rushes d'un indépendant, pour Instagram Reels, TikTok et YouTube Shorts.
Tu ne vois pas les vidéos : tu reçois la liste des rushes (durée), des images clés étiquetées avec leur position dans chaque rush, quelques vignettes, le brief et le style de la personne.

Ce qui fait un bon montage MaDA :
- Une accroche dans les 2 premières secondes : l'image la plus forte ou la plus intrigante d'abord, jamais un plan d'installation mou.
- Une histoire lisible : début, montée, fin claire (résultat, produit fini, sourire, lieu, appel à l'action).
- Du rythme, avec une courbe : plans courts au début (0,8 à 1,5 s), une respiration au milieu, un plan final tenu 2 à 3 s. Plus long seulement quand quelqu'un parle. Varie les valeurs de plan (large, moyen, serré, détail) : jamais deux plans de même valeur sur le même sujet à la suite.
- Coupe sur le mouvement : quand c'est possible, la coupe tombe pendant un geste et le geste continue dans le plan suivant.
- Un rush long est une réserve : tu peux en tirer plusieurs passages, à des moments différents du montage.
- La dernière image doit pouvoir s'enchaîner avec la première : le Reel se revoit en boucle sans heurt.
- Surtout des coupes franches. Une transition (fondu, glisse, zoom) seulement quand elle sert l'histoire, 2 au maximum.
- Choisis les débuts et fins de plan autour des images clés bien notées ; évite les moments marqués flous ou sans intérêt.
- Le son d'origine fait vivre le Reel : garde-le sur chaque plan vidéo dont le rush a du son (voix, ambiance du lieu), sauf si la personne demande le silence. La musique passe dessous. Quand quelqu'un parle (voix indiquée dans la liste des rushes), cale le plan sur la phrase entière (début un peu avant, fin un peu après) au lieu de la couper au milieu.
- Textes imposés : si le brief donne des textes (entre guillemets ou en liste), ils sont tous obligatoires, mot pour mot, emojis compris, au moment demandé (sur le plan cité, au début, à la fin). Ne les raccourcis jamais et n'en supprime aucun ; les limites ci-dessous ne valent que pour les textes que tu inventes.
- Textes inventés : 6 mots maximum chacun, 3 textes au maximum, dans le ton de la personne. Une accroche au début, éventuellement une info utile, une signature ou un appel à l'action à la fin. Pas de phrases génériques (« Découvrez… », « Bienvenue… ») : des mots qui ne pourraient venir que de cette activité.
- Respecte le style et les corrections passées de la personne : elles priment sur tes habitudes.
- Les textes ne se chevauchent pas et restent au moins 1 s à l'écran (un texte long : environ 1 s pour 3 mots).
- La durée visée est un engagement : vise-la à 10 % près tant que les rushes le permettent (un même rush peut fournir plusieurs plans à des moments différents). Le montage est fait de vidéos : quand il y en a, chaque photo sert une fois au plus. Si les vidéos ne suffisent pas pour la durée visée, fais un montage plus court plutôt que de répéter des photos ou d'étirer des plans, et dis-le dans « intention » (« Tes vidéos font 12 s en tout : j'ai fait 12 s »).
- Une photo (rush marqué « photo ») est un plan fixe animé d'un léger zoom : 1 à 3 s, jamais plus que sa durée indiquée.
- Le rendu doit rester naturel, comme monté à la main par quelqu'un de doué : une seule couleur d'image pour tout le montage, des mouvements de caméra rares sur les vidéos. Jamais de néon ni de dégradés violets, de mots géants qui rebondissent, de rafales d'emojis, de zoom à chaque coupe, de flash sur chaque temps, de transitions glitch, ni de texte sur un visage.
- Tout ce que tu écris pour la personne (« intention », « raison » de chaque plan, « relecture ») décrit ce qu'on voit vraiment dans SES rushes, d'après les images clés : « La foule sur le pont au coucher du soleil », jamais « Le geste le plus fort ». « plans_a_tourner » : seulement un plan qui manque vraiment à cette histoire.
Une transition non franche fait se chevaucher deux plans de ${TRANSITION_SECONDS} s : compte-le dans la durée.`;

// Texts the person wrote between quotes in the brief: they must appear word for word.
export function imposedTexts(brief) {
  return [...String(brief).matchAll(/«\s*([^»]+?)\s*»|“([^”]+)”|"([^"]+)"/g)].map(m => (m[1] || m[2] || m[3]).trim()).filter(Boolean);
}
const imposedBlock = brief => {
  const list = imposedTexts(brief);
  return list.length ? `\nTextes imposés par la personne (tous obligatoires, mot pour mot, aucun raccourci) :\n${list.map(t => `- « ${t} »`).join("\n")}\n` : "";
};

// The decision prompt, shared with the server route (lib/montage.js) so the app gets exactly what the
// blind test measured. `image(frame)` returns the base64 JPEG of a keyframe.
export async function decisionContent({ brief, style, clips, frames, tags, duration, beat, ask = "Monte le Reel." }, image = frameAsBase64) {
  const rushes = Object.values(clips).map(c => c.still ? `- ${c.id} : photo, ${c.duration} s au maximum, ${c.width}×${c.height}`
    : `- ${c.id} : ${c.duration.toFixed(1)} s, ${c.width}×${c.height}${!c.hasAudio ? ", sans son" : c.voix?.length ? `, voix ou son fort de ${c.voix.map(([a, b]) => `${a} à ${b} s`).join(", ")}` : ", son d'ambiance seulement"}`).join("\n");
  const labelled = frames.map(f => {
    const t = tags[f.id];
    return t ? `- ${f.id} | ${f.clip} à ${f.time} s | ${t.valeur_plan}, ${t.mouvement}, visages ${t.visages}, qualité ${t.qualite}/5, intérêt ${t.interet}/5${t.accroche ? ", accroche" : ""} | ${t.description}`
      : `- ${f.id} | ${f.clip} à ${f.time} s | non étiquetée`;
  }).join("\n");
  const best = [...frames].sort((a, b) => (tags[b.id]?.interet || 0) - (tags[a.id]?.interet || 0)).slice(0, 6);
  const content = [];
  for (const f of best) {
    content.push({ type: "text", text: `Vignette ${f.id} (${f.clip} à ${f.time} s) :` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: await image(f) } });
  }
  const corrections = (style.corrections || []).slice(-15).map(c => `- ${c}`).join("\n") || "aucune pour l'instant";
  content.push({ type: "text", text: `Brief : ${brief}
${imposedBlock(brief)}
Durée visée : ${duration} s (à 10 % près).
${beat ? `Tempo : un temps tous les ${beat.toFixed(3)} s. Les longueurs de plan seront arrondies à un nombre entier de temps.` : "Pas de tempo imposé."}

Style de la personne :
${JSON.stringify({ ...style, corrections: undefined }, null, 2)}

Corrections déjà demandées par la personne (à respecter) :
${corrections}

Rushes :
${rushes}

Images clés triées et étiquetées :
${labelled}

${ask}` });
  return content;
}

export async function decideEdit({ brief, style, clips, frames, tags, duration, beat, model }, ledger) {
  const content = await decisionContent({ brief, style, clips, frames, tags, duration, beat });
  return callJson({ model, system: DIRECTOR_SYSTEM, content, schema: TIMELINE_SCHEMA, effort: "medium", fallback: true, step: "decision", ledger });
}

const REVIEW_SYSTEM = `${DIRECTOR_SYSTEM}

Cette fois, tu relis un montage déjà rendu. Tu reçois des images du résultat final à intervalles réguliers et la timeline qui l'a produit.
Sois critique comme une directrice artistique d'agence : accroche faible, plan raté ou flou, texte illisible ou mal placé, rythme mou, rendu qui fait « modèle tout fait ».
Ne raccourcis pas le montage : si tu retires un plan répété ou raté, remplace-le par un autre moment des rushes pour rester à la durée visée. Garde tous les textes imposés, mot pour mot.
Renvoie la timeline corrigée complète (ou identique si elle est déjà excellente), et résume tes changements dans « intention ».`;

export async function reviewEdit({ brief, style, timeline, snapshots, duration, model }, ledger) {
  const content = [];
  for (const s of snapshots) {
    content.push({ type: "text", text: `Résultat à ${s.time} s :` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: s.data } });
  }
  content.push({ type: "text", text: `Brief : ${brief}
${imposedBlock(brief)}
Durée visée : ${duration} s (à 10 % près).
Style : ${JSON.stringify({ ...style, corrections: undefined })}
Corrections passées : ${(style.corrections || []).slice(-15).join(" ; ") || "aucune"}

Timeline rendue :
${JSON.stringify(timeline, null, 2)}

Relis et corrige.` });
  return callJson({ model, system: REVIEW_SYSTEM, content, schema: TIMELINE_SCHEMA, effort: "medium", fallback: true, step: "relecture", ledger });
}
