// Drafts (étude de la refonte, « Ne jamais rien perdre »): the Reel in progress is saved at every
// gesture and picked up at the exact step, after a call, a crash or a week away. Pure functions: the
// app stores the string (app/src/flow/draft.ts), this file decides what is worth resuming.

export const DRAFT_VERSION = 1;
// Older drafts are dropped: past a month, the rushes may be gone from the iPhone.
export const DRAFT_MAX_AGE_DAYS = 30;
// Steps that can be reopened as they were. Waiting screens fall back to the step before them.
export const RESUMABLE = ["import", "brief", "music", "result", "editor", "export"] as const;
export type ResumableStep = (typeof RESUMABLE)[number];
const FALLBACK: Record<string, ResumableStep> = { generation: "music", paywall: "music", consent: "music" };

export type Draft<T> = { version: number; savedAt: string; step: ResumableStep; data: T };

// The step to save for where the person is now; null when there is nothing in progress (home, brand…).
export function resumableStep(step: string): ResumableStep | null {
  return (RESUMABLE as readonly string[]).includes(step) ? (step as ResumableStep) : FALLBACK[step] ?? null;
}

export function packDraft<T>(step: string, data: T, now = new Date()): string | null {
  const s = resumableStep(step);
  return s ? JSON.stringify({ version: DRAFT_VERSION, savedAt: now.toISOString(), step: s, data } satisfies Draft<T>) : null;
}

// A stored draft, or null when it is unreadable, from another version, too old or from the future.
export function readDraft<T>(raw: string | null | undefined, now = new Date()): Draft<T> | null {
  if (!raw) return null;
  let d: any;
  try { d = JSON.parse(raw); } catch { return null; }
  if (!d || typeof d !== "object" || d.version !== DRAFT_VERSION || !d.data || typeof d.data !== "object") return null;
  const at = Date.parse(d.savedAt);
  if (!Number.isFinite(at) || at > now.getTime() + 60_000 || now.getTime() - at > DRAFT_MAX_AGE_DAYS * 86_400_000) return null;
  const step = resumableStep(String(d.step));
  return step ? { version: d.version, savedAt: new Date(at).toISOString(), step, data: d.data as T } : null;
}
