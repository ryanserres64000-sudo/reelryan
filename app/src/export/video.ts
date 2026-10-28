import { requireOptionalNativeModule } from "expo";
import type { ExportFile } from "../../../core/export";
import type { TimelineV1 } from "../../../core/timeline";
import type { Sources } from "../video/sources";

// The AVFoundation module (CLAUDE.md, stack : one AVComposition for the preview and the export)
// renders each file of the plan and saves it to Photos (app/modules/mada-video). It is written but
// not compiled yet: it needs a Mac with Xcode. Until then the app says so plainly and still copies the caption.
// `asset`: the video's id in Photos, so Instagram can open on it.
export type Exported = { uri: string; asset: string | null };
type Native = { exportVideo(timeline: TimelineV1, file: ExportFile, sources: Sources): Promise<Exported> };
const native = () => requireOptionalNativeModule<Native>("MadaVideo");
export const canExportVideo = () => !!native();

export async function exportVideos(t: TimelineV1, files: ExportFile[], sources: Sources, onFile: (i: number) => void): Promise<Exported[]> {
  const m = native();
  if (!m) return [];
  const out: Exported[] = [];
  for (const [i, f] of files.entries()) { onFile(i); const r = await m.exportVideo(t, f, sources); out.push({ uri: r.uri, asset: r.asset ?? null }); }
  return out;
}
