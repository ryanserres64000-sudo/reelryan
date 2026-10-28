// Publish and come back (étape 7 de la refonte): when to ask for an App Store review, and the one
// notification a week (étude : « une notification par semaine au plus, réglable, jamais pour vendre »).
// Pure rules, shared by the app and its tests.

export type ReviewState = { exports: number; asked: string | null; lastError: string | null };
export const START_REVIEW: ReviewState = { exports: 0, asked: null, lastError: null };
const DAY = 24 * 3600 * 1000;
export const REVIEW_AFTER = 3;
const REVIEW_GAP_DAYS = 120;
const CALM_MINUTES = 30;

// Every export, good or not.
export const recordExport = (s: ReviewState, ok: boolean, now = new Date()): ReviewState =>
  ok ? { ...s, exports: s.exports + 1 } : { ...s, lastError: now.toISOString() };

// After the third export that worked, never right after an error, and not again for four months
// (iOS shows the prompt three times a year at most anyway).
export function reviewDue(s: ReviewState, now = new Date()): boolean {
  if (s.exports < REVIEW_AFTER) return false;
  if (s.lastError && now.getTime() - Date.parse(s.lastError) < CALM_MINUTES * 60 * 1000) return false;
  return !s.asked || now.getTime() - Date.parse(s.asked) > REVIEW_GAP_DAYS * DAY;
}
export const markAsked = (s: ReviewState, now = new Date()): ReviewState => ({ ...s, asked: now.toISOString() });

// The Sunday summary: next Sunday at 18 h, local time (today if it is Sunday before 18 h).
export function nextSunday(now = new Date(), hour = 18): Date {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  const ahead = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + ahead);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

// What it says: the week's Reels, counted from Monday, and the idea for next week. Views come only
// once an account is connected (étape 8); without them, nothing is invented.
export function weeklySummary(made: { at: string }[], o: { now?: Date; idea?: string | null; views?: number | null } = {}): { title: string; body: string } {
  const now = o.now ?? new Date(), monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const n = made.filter(m => { const t = Date.parse(m.at); return t >= monday.getTime() && t <= now.getTime(); }).length;
  const idea = o.idea ? ` Pour lundi : ${o.idea}` : "";
  if (!n) return { title: "Ta semaine", body: `Pas de Reel cette semaine, ça arrive.${idea || " Une idée t'attend dans Ma DA."}` };
  const reels = n > 1 ? `${n} Reels` : "1 Reel";
  const views = o.views ? `, ${o.views.toLocaleString("fr-FR")} vues` : "";
  return { title: "Ta semaine", body: `${reels} cette semaine${views}. Bravo.${idea}` };
}

// The share targets once the files are in Photos: Instagram opens on the video itself; TikTok and
// YouTube go through the share sheet (direct publishing needs their review, étape 9).
export const SHARE_TARGETS = ["reels", "tiktok", "shorts"] as const;
export const instagramUrl = (assetId: string) => `instagram://library?LocalIdentifier=${encodeURIComponent(assetId)}`;
