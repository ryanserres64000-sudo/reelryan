import type { AudioFormat, MusicError } from "../../../core/music";

// A sound ready to analyse: in the app cache (iPhone) or a blob URL (web preview).
export type LoadedSound = { uri: string; key: string; name: string; format: AudioFormat; bytes: number };
export type Decoded = { samples: Float32Array; rate: number; duration: number };
export type DownloadOptions = { onProgress?: (share: number | null) => void; signal?: AbortSignal };

// Analysis rate: enough for 95 % of beats within 40 ms, light enough for a 10 min song (core/test/music.test.ts).
export const ANALYSIS_RATE = 22050;

export class MusicFailure extends Error {
  constructor(public readonly reason: MusicError | "cancelled") { super(reason); }
}

const NAME = /[^/?#]+(?=[?#]|$)/;
export const nameOf = (url: string) => decodeURIComponent(url.match(NAME)?.[0] ?? "son");
