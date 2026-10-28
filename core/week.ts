// The week on the home screen and in Idées (étude de la refonte, « Un accueil qui donne envie de
// créer »): three posting days, an idea from the carnet on each, a new set every week, and ideas the
// person refused kept away for a month. Pure functions; the app keeps the refusals on the iPhone.
import type { Idee } from "./brand.ts";

// Monday, Wednesday, Friday: three posts a week is what independents can hold (étude, ch. 2).
export const POSTING_DAYS = [0, 2, 4] as const;
export const REFUSAL_DAYS = 30;
const DAY = 86_400_000;

export type WeekDay = { date: string; index: number; today: boolean; past: boolean };
export type PlannedIdea = { day: number; date: string; idee: Idee; key: string };
export type Refusals = Record<string, string>;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const ideaKey = (i: Idee) => i.titre.trim().toLowerCase();

// Monday of the week of `now`, local time.
export function monday(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function weekDays(now: Date): WeekDay[] {
  const m = monday(now), today = iso(now);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(m.getFullYear(), m.getMonth(), m.getDate() + i), date = iso(d);
    return { date, index: i, today: date === today, past: date < today };
  });
}

// Ideas still welcome: not refused in the last month.
export function welcome(ideas: Idee[], refusals: Refusals, now: Date): Idee[] {
  return ideas.filter(i => {
    const at = refusals[ideaKey(i)];
    return !at || now.getTime() - Date.parse(at) > REFUSAL_DAYS * DAY;
  });
}

// One idea per posting day, rotating each week so the home changes without asking anything.
export function weekPlan(ideas: Idee[], refusals: Refusals, now: Date): PlannedIdea[] {
  const pool = welcome(ideas, refusals, now);
  if (!pool.length) return [];
  const week = Math.floor(monday(now).getTime() / (7 * DAY));
  const days = weekDays(now);
  return POSTING_DAYS.slice(0, pool.length).map((day, k) => {
    const idee = pool[(week * POSTING_DAYS.length + k) % pool.length];
    return { day, date: days[day].date, idee, key: ideaKey(idee) };
  });
}

// The idea for today, or else the next one this week, or else the last one (late is better than nothing).
export function ideaOfTheDay(plan: PlannedIdea[], now: Date): PlannedIdea | null {
  const today = iso(now);
  return plan.find(p => p.date >= today) ?? plan[plan.length - 1] ?? null;
}

export const refuse = (refusals: Refusals, i: Idee, now: Date): Refusals => ({ ...refusals, [ideaKey(i)]: now.toISOString() });
export const dayOf = (at: string) => iso(new Date(at));
