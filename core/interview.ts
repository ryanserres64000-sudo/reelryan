// The sign-up interview (Ryan, 29 octobre : « les questions d'après doivent être plus travaillées et
// adaptées à la réponse précédente »). The code decides which question comes next, from the profile and
// the answers so far (a follow-up when an answer calls for it); the small model only rewords it for this
// person and reacts to what they just said. Without the server, the app's own wording is used.
// Shared by the app and the server (lib/entretien.js).
import { questionsFor, type Answers, type Profil, type Question } from "./brand.ts";

// Answers hold the labels the person saw; `labelOf` gives the label of an option id, to test a follow-up.
export type LabelOf = (q: string, option: string) => string;
const has = (answers: Answers, q: string, label: string) => { const a = answers[q]; return Array.isArray(a) ? a.includes(label) : a === label; };

// Whether a question is asked, given what the person said before it.
export function asked(q: Question, profil: Profil, answers: Answers, labelOf: LabelOf) {
  const byProfil = !q.profils || q.profils.includes(profil);
  if (!q.si) return byProfil;
  return (q.profils ? byProfil : false) || q.si.any.some(o => has(answers, q.si!.q, labelOf(q.si!.q, o)));
}

// The questions as they stand now. A follow-up always comes after the question it depends on, so the
// cards already seen never move when an answer adds or removes one further on.
export const interviewFor = (profil: Profil, answers: Answers, labelOf: LabelOf) => questionsFor(profil).filter(q => asked(q, profil, answers, labelOf));

// Answers to questions that are no longer asked (an option unticked) are dropped before the carnet.
export function keptAnswers(profil: Profil, answers: Answers, labelOf: LabelOf): Answers {
  const ids = new Set(interviewFor(profil, answers, labelOf).map(q => q.id));
  return Object.fromEntries(Object.entries(answers).filter(([k]) => ids.has(k)));
}

// ---------- The small model's wording ----------

export type Wording = { reaction: string; titre: string; pourquoi: string; exemple: string; suggestions: string[] };
export type Turn = { question: string; reponse: string };
export type NextCard = { id: string; kind: Question["kind"]; titre: string; pourquoi: string; options?: string[] };

const str = (max: number, description: string) => ({ type: "string", description: `${description} (${max} caractères au plus)` });
export const ENTRETIEN_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["reaction", "titre", "pourquoi", "exemple", "suggestions"],
  properties: {
    reaction: str(140, "Une réaction courte et précise à sa dernière réponse, qui montre que tu l'as lue. Vide s'il n'y a pas encore de réponse"),
    titre: str(80, "La prochaine question, reformulée pour cette personne, en reprenant ce qu'elle a dit"),
    pourquoi: str(140, "Pourquoi tu poses cette question, en une phrase"),
    exemple: str(80, "Un exemple de réponse plausible pour cette personne, sans rien inventer de chiffré"),
    suggestions: { type: "array", items: { type: "string" }, description: "Pour une question ouverte : 3 à 5 réponses courtes qu'elle pourrait toucher (4 mots au plus chacune). Vide pour une question à choix" },
  },
} as const;

export const ENTRETIEN_SYSTEM = `Tu es Ma DA, la directrice artistique d'une appli de création de vidéos et de visuels. Tu fais connaissance avec une personne qui vient de s'inscrire, une question à la fois.
On te donne son profil, ses réponses jusque-là et la prochaine question à poser (choisie par l'appli, tu ne la changes pas de sujet).
Règles :
- Réagis à sa dernière réponse en une phrase vraie et précise : reprends ses mots, tire-en une conséquence pour ses vidéos. Jamais de flatterie creuse (« Super ! », « Génial ! »), jamais d'emoji.
- Prends sa réponse en entier : si elle cite plusieurs publics, envies ou choses, ne garde pas que les premiers et n'en ignore aucun (regroupe-les si c'est long). Ne lui prête rien qu'elle n'a pas dit.
- Reformule la question pour elle : son métier, ce qu'elle vient de dire. Même sujet, même type de réponse. Si des choix sont proposés, la question doit aller avec ces choix.
- Ne l'appelle jamais par son profil (« créateur », « coach », « commerçant ») : son prénom ou son nom seulement s'il est dans ses réponses, sinon rien. N'accorde pas son genre si tu ne le connais pas.
- N'invente aucun fait sur elle (prix, adresse, chiffres, récompenses).
- Tutoie, phrases courtes, zéro jargon, en français.`;

export function entretienContent(profil: string, history: Turn[], next: NextCard) {
  const said = history.filter(h => h.reponse).map(h => `- ${h.question} → ${h.reponse}`);
  const last = history.at(-1);
  return `Profil : ${profil}
Ses réponses jusque-là :
${said.join("\n") || "- (rien encore)"}
Sa dernière réponse : ${last?.reponse ? `« ${last.reponse} » (à « ${last.question} »)` : last ? "elle a passé la question" : "aucune"}

Prochaine question (${next.kind === "texte" ? "réponse libre" : next.kind === "mots" ? "trois mots" : next.kind === "choix" ? "un choix" : "plusieurs choix"}) : ${next.titre}
Pourquoi : ${next.pourquoi}${next.options?.length ? `\nChoix proposés : ${next.options.join(", ")}` : ""}`;
}

const cut = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
// Emoji-free, short, and a question that ends like one; anything empty falls back to the app's wording.
const plain = (s: string) => s.replace(/[\p{Extended_Pictographic}\u{FE0F}]/gu, "").replace(/\s+/g, " ").replace(/\s+([,.…])/g, "$1").trim();
export function sanitizeWording(raw: unknown, kind: Question["kind"]): Wording {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const titre = plain(cut(r.titre, 80));
  return {
    reaction: plain(cut(r.reaction, 140)),
    titre: titre && !/[?:.…]$/.test(titre) ? `${titre} ?` : titre,
    pourquoi: plain(cut(r.pourquoi, 140)),
    exemple: plain(cut(r.exemple, 80)).replace(/^«\s*|\s*»$/g, ""),
    suggestions: kind === "texte" || kind === "mots"
      ? [...new Set((Array.isArray(r.suggestions) ? r.suggestions : []).map(x => plain(cut(x, 40))).filter(Boolean))].slice(0, 5)
      : [],
  };
}
