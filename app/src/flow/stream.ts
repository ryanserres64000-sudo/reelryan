import type { MontageResult } from "./types";

// Client of POST /api/montage (lib/montage.js): newline-delimited JSON, one line per step.
const STEPS: Record<string, number> = { etiquetage: 1, decision: 2, relecture: 3 };

export function readLine(line: string, onStep: (s: number) => void): MontageResult | null {
  if (!line.trim()) return null;
  const msg = JSON.parse(line);
  if (msg.error) throw Object.assign(new Error(msg.message || msg.error), { code: msg.error });
  if (msg.etape in STEPS) onStep(STEPS[msg.etape]);
  if (msg.resultat) { onStep(4); return msg.resultat as MontageResult; }
  return null;
}
