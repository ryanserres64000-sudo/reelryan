import type { TimelineV1, Plateforme } from "../../../core/timeline";
import type { Frame, Probed } from "../../../core/triage";
import type { MusicChoice, TriageBadge } from "../design";
import type { LoadedSound } from "../music/common";

export type Rush = { id: string; duration: number; photo: boolean; uri?: string; badges: TriageBadge[]; sound: boolean; triage?: Triaged };
// What the iPhone measured on a rush (app/src/flow/triage.ts, core/triage.ts).
export type Triaged = { probed: Probed; frames: Frame[] };
export type Trade = "coach" | "restaurant" | "artisan" | "commerce" | "freelance";
export type Brief = { text: string; trade: Trade; goal: number | null; tone: number | null; duration: number; platforms: Plateforme[]; cta: number | null };
export type Analysis = { bpm: number; confidence: number; beats: number[]; downbeats: number[]; peaks: number[]; perSecond: number[]; duration: number; tapped: boolean };
export type Music = {
  choice: MusicChoice;
  sound: LoadedSound | null; fromLink: boolean; analysis: Analysis | null;
  passage: { debut: number; fin: number } | null; length: number;
  rightsAt: string | null; trendingTempo: number;
};
export type Variant = { timeline: TimelineV1; duration: number; warnings: string[] };
export type MontageResult = { variantes: Variant[]; cout_usd: number; temps_s: number; manuel?: boolean };

// Free plan limits (étude, ch. 8 §2 ; décisions de Ryan : rushes de 60 à 90 s en gratuit).
export const LIMITS = { minRushes: 3, maxRushes: 25, freeSeconds: 90 } as const;

// Runs one AI edit: the sample one for now, POST /api/montage later (flow/api.ts).
export type Runner = (onStep: (step: number) => void, signal: AbortSignal) => Promise<MontageResult>;
