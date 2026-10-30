import type { Affiche } from "../../../core/poster";
import type { TimelineV1, Plateforme } from "../../../core/timeline";
import type { Frame, Probed } from "../../../core/triage";
import type { MusicChoice, TriageBadge } from "../design";
import type { LoadedSound } from "../music/common";

export type Rush = { id: string; duration: number; photo: boolean; uri?: string; badges: TriageBadge[]; sound: boolean; triage?: Triaged; width?: number; height?: number; thumb?: string | null };
// What the iPhone measured on a rush (app/src/flow/triage.ts, core/triage.ts).
export type Triaged = { probed: Probed; frames: Frame[] };
export type Trade = "coach" | "restaurant" | "artisan" | "commerce" | "freelance" | "evenement";
// `affiche`: the event poster's facts, checked by the person (core/poster.ts); `afficheCouleurs`: the
// edit takes its colours (on unless turned off).
export type Brief = { text: string; trade: Trade; goal: number | null; tone: number | null; duration: number; platforms: Plateforme[]; cta: number | null; ctaText?: string; affiche?: Affiche; afficheCouleurs?: boolean };
export type Analysis = { bpm: number; confidence: number; beats: number[]; downbeats: number[]; peaks: number[]; perSecond: number[]; duration: number; tapped: boolean };
export type Music = {
  choice: MusicChoice;
  sound: LoadedSound | null; fromLink: boolean; analysis: Analysis | null;
  passage: { debut: number; fin: number } | null; length: number;
  rightsAt: string | null; trendingTempo: number;
};
export type Variant = { timeline: TimelineV1; duration: number; warnings: string[] };
export type MontageResult = { variantes: Variant[]; cout_usd: number; temps_s: number; manuel?: boolean };

// Limits (Ryan, 28 octobre 2026): 30 rushes for everyone, and the free plan caps the finished video
// at 60 s rather than the length of the rushes.
export const LIMITS = { minRushes: 3, maxRushes: 30, freeVideo: 60 } as const;

// Runs one AI edit: the sample one for now, POST /api/montage later (flow/api.ts).
// `onRead(read, total)` counts the rushes read on the iPhone during step 0.
export type Runner = (onStep: (step: number) => void, signal: AbortSignal, onRead: (read: number, total: number) => void) => Promise<MontageResult>;
