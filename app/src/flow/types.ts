import type { TimelineV1, Plateforme } from "../../../core/timeline";
import type { MusicChoice, TriageBadge } from "../design";

export type Rush = { id: string; duration: number; photo: boolean; uri?: string; badges: TriageBadge[]; sound: boolean };
export type Trade = "coach" | "restaurant" | "artisan" | "commerce" | "freelance";
export type Brief = { text: string; trade: Trade; goal: number | null; tone: number | null; duration: number; platforms: Plateforme[]; cta: number | null };
export type Music = { choice: MusicChoice; link: string | null };
export type Variant = { timeline: TimelineV1; duration: number; warnings: string[] };
export type MontageResult = { variantes: Variant[]; cout_usd: number; temps_s: number };

// Free plan limits (étude, ch. 8 §2 ; décisions de Ryan : rushes de 60 à 90 s en gratuit).
export const LIMITS = { minRushes: 3, maxRushes: 25, freeSeconds: 90 } as const;

// Runs one AI edit: the sample one for now, POST /api/montage later (flow/api.ts).
export type Runner = (onStep: (step: number) => void, signal: AbortSignal) => Promise<MontageResult>;
