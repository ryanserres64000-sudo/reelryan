import { requireOptionalNativeModule } from "expo";
import type { ExportFile } from "../../../core/export";
import type { TimelineV1 } from "../../../core/timeline";

// The AVFoundation module (CLAUDE.md, stack : one AVComposition for the preview and the export)
// renders each file of the plan and saves it to Photos. It is not compiled yet: it needs a Mac with
// Xcode. Until then the app says so plainly and still copies the caption.
type Native = { exportVideo(timeline: TimelineV1, file: ExportFile, rushes: Record<string, string>): Promise<{ uri: string }> };
const native = () => requireOptionalNativeModule<Native>("MadaVideo");
export const canExportVideo = () => !!native();

export async function exportVideos(t: TimelineV1, files: ExportFile[], rushes: Record<string, string>, onFile: (i: number) => void): Promise<string[]> {
  const m = native();
  if (!m) return [];
  const out: string[] = [];
  for (const [i, f] of files.entries()) { onFile(i); out.push((await m.exportVideo(t, f, rushes)).uri); }
  return out;
}
