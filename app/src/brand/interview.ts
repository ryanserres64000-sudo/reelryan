import { fetch } from "expo/fetch";
import type { Answers, Profil, Question } from "../../../core/brand";
import { sanitizeWording, type Turn, type Wording } from "../../../core/interview";
import { fr, type Ctx } from "../copy/fr";
import { serverHeaders } from "../flow/server";

// The sign-up questions as Ma DA asks them (Ryan, 29 octobre : adaptées à chaque réponse). The app's
// own wording first, built from the earlier answers; then, with the server and the person's permission,
// the small model's (lib/entretien.js) if it answers within WAIT ms. Sign-up never waits longer.
export const WAIT = 3500;
type Item = {
  title: string | ((x: Ctx) => string); why: string; placeholder?: string | Partial<Record<Profil, string>>;
  options?: Record<string, string>; suggestions?: readonly string[]; after?: (x: Ctx, v: string) => string;
};
const items = fr.dna.questions.items as unknown as Record<string, Item>;
export const itemOf = (id: string) => items[id];
export const labelOf = (q: string, option: string) => items[q]?.options?.[option] ?? option;
export const answerText = (a: Answers[string] | undefined) => (Array.isArray(a) ? a.join(", ") : a?.trim() ?? "");

export function ctxOf(profil: Profil, answers: Answers): Ctx {
  return {
    profil, nom: answerText(answers.nom), chez: fr.dna.questions.chez[profil],
    has: (q, option) => { const a = answers[q], l = labelOf(q, option); return Array.isArray(a) ? a.includes(l) : a === l; },
  };
}

// What Ma DA says about the previous card: her reaction to the answer, or a word to move on.
export function reactionTo(prev: Question | undefined, profil: Profil, answers: Answers, turn: number) {
  if (!prev) return fr.dna.questions.start;
  const v = answerText(answers[prev.id]);
  if (!v) return fr.dna.questions.skipped[turn % fr.dna.questions.skipped.length];
  return itemOf(prev.id)?.after?.(ctxOf(profil, answers), v) ?? "";
}

export function offlineWording(q: Question, prev: Question | undefined, profil: Profil, answers: Answers, turn: number): Wording {
  const it = itemOf(q.id), x = ctxOf(profil, answers);
  const ph = typeof it.placeholder === "string" ? it.placeholder : it.placeholder?.[profil];
  return {
    reaction: reactionTo(prev, profil, answers, turn),
    titre: typeof it.title === "function" ? it.title(x) : it.title,
    pourquoi: it.why, exemple: ph ?? "",
    suggestions: q.kind === "mots" ? [...(it.suggestions ?? [])] : [],
  };
}

// The small model's version, or null (no server, refused, too slow).
export async function aiWording(url: string, q: Question, offline: Wording, profil: Profil, history: Turn[], signal: AbortSignal): Promise<Wording | null> {
  const timer = new AbortController();
  const stop = () => timer.abort();
  signal.addEventListener("abort", stop);
  const t = setTimeout(stop, WAIT);
  try {
    const res = await fetch(`${url}/api/entretien`, {
      method: "POST", signal: timer.signal, headers: serverHeaders.get(),
      body: JSON.stringify({
        profil, libelle_profil: fr.dna.profile.names[profil], historique: history,
        prochaine: { id: q.id, titre: offline.titre, pourquoi: offline.pourquoi, options: q.options?.map(o => labelOf(q.id, o)) },
      }),
    });
    if (!res.ok) return null;
    const w = sanitizeWording(await res.json(), q.kind);
    if (!w.titre) return null;
    // Anything the model left empty keeps the app's words; a first card keeps Ma DA's own welcome.
    return { reaction: history.length ? w.reaction || offline.reaction : offline.reaction, titre: w.titre, pourquoi: w.pourquoi || offline.pourquoi, exemple: w.exemple || offline.exemple, suggestions: w.suggestions.length ? w.suggestions : offline.suggestions };
  } catch { return null; } finally { clearTimeout(t); signal.removeEventListener("abort", stop); }
}
