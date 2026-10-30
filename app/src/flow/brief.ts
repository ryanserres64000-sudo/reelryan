import { fr } from "../copy/fr";
import type { Brief } from "./types";

// The sentence sent to the AI: the person's words first (imposed texts stay untouched), then the chips.
export function composeBrief(b: Brief): string {
  const c = fr.brief.compose, lines = [b.text.trim()];
  if (b.goal !== null) lines.push(`${c.goal} : ${fr.brief.goals[b.goal]}`);
  if (b.tone !== null) lines.push(`${c.tone} : ${fr.brief.tones[b.tone]}`);
  // Written by the person: between quotes, so it is shown word for word (imposedTexts).
  if (b.ctaText?.trim()) lines.push(`${c.cta} : « ${b.ctaText.trim()} »`);
  else if (b.cta !== null && b.cta < fr.brief.ctas.length - 1) lines.push(`${c.cta} : ${fr.brief.ctas[b.cta]}`);
  return lines.join("\n");
}
