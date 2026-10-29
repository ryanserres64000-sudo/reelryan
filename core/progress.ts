// Progress and time limits of an AI edit (Ryan, 29 octobre 2026: « le montage IA met 30 min et n'est
// toujours pas fini », « il faut absolument mettre l'avancée par un repère ou pourcentage »).
// Shared by the iPhone (GenerationScreen, flow/api.ts, flow/triage.ts) and the server (lib/montage.js).

// Steps as the screen numbers them: 0 reading the rushes on the iPhone, 1 tagging, 2 editing,
// 3 review, 4 ready. Each owns a slice of the percentage; the AI steps last about `seconds`.
export const PHASES = [
  { from: 0, to: 30, seconds: 0 },
  { from: 30, to: 45, seconds: 25 },
  { from: 45, to: 80, seconds: 80 },
  { from: 80, to: 97, seconds: 60 },
  { from: 100, to: 100, seconds: 0 },
] as const;

export const LIMITS = {
  // One rush read with Vision, then with the light reading if Vision is too slow or fails.
  visionMs: 60_000, liteMs: 30_000,
  // Rushes read at the same time: 30 at once froze the iPhone.
  readers: 2,
  // The server writes a line at least this often; without any line for `silenceMs`, the app stops.
  pingMs: 10_000, silenceMs: 90_000,
  // The server gives up before Vercel cuts the function (300 s, vercel.json), and says so.
  serverMs: 280_000,
  // The whole edit, reading included, never waits longer on the iPhone.
  totalMs: 9 * 60_000,
} as const;

// Vision work per rush stays bounded on long rushes: at most ~120 frames for shot changes and
// ~40 candidate frames to measure.
export const sceneStep = (duration: number) => Math.max(0.5, Math.round(duration / 120 * 10) / 10);
export const candidateEvery = (duration: number) => Math.max(2, Math.round(duration / 40 * 10) / 10);

// Whole percent shown on screen. In step 0 it follows the rushes read; in an AI step it moves
// with time and slows down near the end of its slice, never passing it before the step is over.
export function percent(step: number, { read = 0, total = 0, elapsed = 0 }: { read?: number; total?: number; elapsed?: number } = {}): number {
  const s = Math.max(0, Math.min(4, Math.floor(step)));
  const p = PHASES[s];
  const share = s === 0 ? (total > 0 ? Math.min(1, read / total) : 0) : p.seconds ? 1 - Math.exp(-Math.max(0, elapsed) / p.seconds) : 1;
  const value = Math.floor(p.from + (p.to - p.from) * share);
  return s === 0 || s === 4 ? value : Math.min(p.to - 1, value);
}

export class Timeout extends Error {
  code = "timeout";
  constructor() { super("timeout"); }
}

// Rejects with Timeout after `ms`; the work itself may go on, its result is then ignored.
export function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Timeout()), ms); })])
    .finally(() => clearTimeout(timer));
}

// Vision's time on one rush grows with its length: a 3 s clip gets 10 s, a long one 45 s at most.
// Build 10 waited 60 s on each short rush (Ryan, 29 octobre : « très compliqué de monter la vidéo »).
export const visionLimitMs = (duration: number) => Math.round(Math.min(45_000, Math.max(10_000, 6_000 + duration * 1_000)));

// A waiting line shared by every caller: at most `limit` jobs run at once, the others wait their turn.
// The import screen and the edit use the same lines, so the iPhone never reads 21 rushes at once.
export function queue(limit: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  const next = () => { if (running < limit && waiting.length) { running++; waiting.shift()!(); } };
  return <T>(job: () => Promise<T>): Promise<T> => new Promise<T>((resolve, reject) => {
    waiting.push(() => job().then(resolve, reject).finally(() => { running--; next(); }));
    next();
  });
}

// Runs `fn` on every item with at most `limit` at once, keeping the order of the results.
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return out;
}
