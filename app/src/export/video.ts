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
type Native = { exportVideo(timeline: TimelineV1, file: ExportFile, sources: Sources): Promise<Partial<Exported> & { uri: string }> };
const native = () => requireOptionalNativeModule<Native>("MadaVideo");
export const canExportVideo = () => !!native();
// A real second of 1080p H.264 weighs far more; under this the encoder wrote nothing usable.
const MIN_BYTES = 10_000;

export async function exportVideos(t: TimelineV1, files: ExportFile[], sources: Sources, onFile: (i: number) => void): Promise<Exported[]> {
  const m = native();
  if (!m) return [];
  const out: Exported[] = [];
  for (const [i, f] of files.entries()) {
    onFile(i);
    const r = await m.exportVideo(t, f, sources);
    // Done only when the file is really there and not empty (audit, phase 8): never a success on a call alone.
    const made = new File(r.uri);
    if (!made.exists || made.size < MIN_BYTES) throw new Error(`fichier vide (${made.exists ? made.size : 0} octets)`);
    out.push({ uri: r.uri, asset: r.asset ?? null, photos: r.photos !== false });
  }
  return out;
}

// What went wrong, in words Ryan can act on; the module's own message stays in Réglages > Diagnostic.
export type ExportFailure = "space" | "photos" | "rush" | "other";
export function failureOf(e: unknown): ExportFailure {
  const m = e instanceof Error ? e.message : String(e);
  if (/space|espace|disk|stockage|ENOSPC|-11807/i.test(m)) return "space";
  if (/photos/i.test(m)) return "photos";
  if (/rush/i.test(m)) return "rush";
  return "other";
}
