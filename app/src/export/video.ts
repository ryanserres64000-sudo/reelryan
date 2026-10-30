import { requireOptionalNativeModule } from "expo";
import { File } from "expo-file-system";
import type { ExportFile } from "../../../core/export";
import type { TimelineV1 } from "../../../core/timeline";
import type { Sources } from "../video/sources";

// The AVFoundation module (CLAUDE.md, stack : one AVComposition for the preview and the export)
// renders each file of the plan and saves it to Photos (app/modules/mada-video). It is written but
// not compiled yet: it needs a Mac with Xcode. Until then the app says so plainly and still copies the caption.
// `asset`: the video's id in Photos, so Instagram can open on it.
// `photos`: false when Ma DA may not add to Photos; the file is then offered in the share sheet.
export type Exported = { uri: string; asset: string | null; photos: boolean };
type Native = {
  exportVideo(timeline: TimelineV1, file: ExportFile, sources: Sources): Promise<Partial<Exported> & { uri: string }>;
  cancelExport?(): Promise<void>;
  addListener?(event: "onExportProgress", listener: (e: { progress: number; nom: string }) => void): { remove(): void };
};
const native = () => requireOptionalNativeModule<Native>("MadaVideo");
export const canExportVideo = () => !!native();
// A real second of 1080p H.264 weighs far more; under this the encoder wrote nothing usable.
const MIN_BYTES = 10_000;

// `onProgress`: 0 to 1 over all the files, from the encoder itself (never a timer).
export async function exportVideos(t: TimelineV1, files: ExportFile[], sources: Sources, onFile: (i: number) => void, onProgress?: (p: number) => void): Promise<Exported[]> {
  const m = native();
  if (!m) return [];
  const out: Exported[] = [];
  for (const [i, f] of files.entries()) {
    onFile(i);
    const sub = onProgress ? m.addListener?.("onExportProgress", e => { if (e.nom === f.nom) onProgress((i + Math.min(1, Math.max(0, e.progress))) / files.length); }) : undefined;
    let r: Partial<Exported> & { uri: string };
    try { r = await m.exportVideo(t, f, sources); } finally { sub?.remove(); }
    // Done only when the file is really there and not empty (audit, phase 8): never a success on a call alone.
    const made = new File(r.uri);
    if (!made.exists || made.size < MIN_BYTES) throw new Error(`fichier vide (${made.exists ? made.size : 0} octets)`);
    out.push({ uri: r.uri, asset: r.asset ?? null, photos: r.photos !== false });
  }
  return out;
}

export async function cancelExport(): Promise<void> {
  await native()?.cancelExport?.();
}

// What went wrong, in words Ryan can act on; the module's own message stays in Réglages > Diagnostic.
// « interrupted »: iOS stopped the encoder when the app left the screen (AVError -11847); the export
// starts again by itself when the person comes back.
export type ExportFailure = "space" | "photos" | "rush" | "cancelled" | "interrupted" | "other";
export function failureOf(e: unknown): ExportFailure {
  const m = e instanceof Error ? e.message : String(e);
  if (/annulé|cancel/i.test(m)) return "cancelled";
  if (/-11847|interrompu|interrupted/i.test(m)) return "interrupted";
  if (/space|espace|disk|stockage|ENOSPC|-11807/i.test(m)) return "space";
  if (/photos/i.test(m)) return "photos";
  if (/rush/i.test(m)) return "rush";
  return "other";
}
