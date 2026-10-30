import { requireOptionalNativeModule } from "expo";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Platform } from "react-native";
import { charteOf, montageStyle } from "../../../core/brand";
import { candidateEvery, LIMITS, queue, sceneStep, visionLimitMs, withTimeout } from "../../../core/progress";
import { badgesOf, candidateTimes, judge, MAX_FRAMES, pickFrames, rushForAi, type Measure, type Probed } from "../../../core/triage";
import type { Brand } from "../brand/types";
import { noteError } from "../diag";
import { toMusique } from "../music/musique";
import { composeBrief } from "./brief";
import type { Brief, Music, Rush, Triaged } from "./types";
import { keepMedia } from "../media/keep";

// Triage on the iPhone with Vision (app/modules/mada-vision measures, core/triage.ts decides), then
// the body of POST /api/montage. Without the compiled module the app keeps its sample data.
type Native = {
  probe(uri: string): Promise<Omit<Probed, "id" | "scenes" | "voix">>;
  scenes(uri: string, step: number, threshold: number): Promise<number[]>;
  measure(uri: string, times: number[], photo: boolean): Promise<Measure[]>;
  voice(uri: string): Promise<[number, number][]>;
};
const native = () => requireOptionalNativeModule<Native>("MadaVision");
export const canTriage = () => !!native();

// Feature-print distance above which two frames 0,5 s apart are two shots [À CALIBRER sur de vrais rushes].
const SCENE_THRESHOLD = 0.8;

export async function triageRush(r: Rush): Promise<Rush> {
  const m = native();
  if (!m || !r.uri) return r;
  const info = await m.probe(r.uri);
  const scenes = info.photo ? [] : await m.scenes(r.uri, sceneStep(info.duration), SCENE_THRESHOLD).catch(() => []);
  const voix = info.hasAudio ? await m.voice(r.uri).catch(() => [] as [number, number][]) : [];
  const probed: Probed = { ...info, id: r.id, scenes, voix };
  const frames = judge(r.id, await m.measure(r.uri, info.photo ? [0] : candidateTimes(info.duration, scenes, candidateEvery(info.duration)), info.photo), scenes);
  const triage: Triaged = { probed, frames };
  return { ...r, duration: info.duration, photo: info.photo, sound: info.hasAudio, badges: badgesOf(frames, voix), triage };
}

// A small frame of the rush for its card and for the player when the native preview is missing. Always
// re-saved as a small JPEG in the app's own cache: a picture straight from the picker (HEIC, a file the
// system may move) stayed grey on Ryan's iPhone (build 9, 29 octobre). A failure is noted for Réglages.
// Build 10 still showed grey cards: 21 rushes were read at once and the pictures waited behind them.
// They now have their own short line, ahead of the reading, and a resize that fails keeps the frame.
// Build 11 still showed grey cards, the photo too: each picture now has 8 s, so one that never answers
// cannot hold the line, and the reading's own first frame stands in (Flow.tsx).
const THUMB_PX = 360, THUMB_MS = 8_000;
const thumbs = queue(3);
export const thumbnailOf = (r: Rush): Promise<string | null> => thumbs(() => withTimeout(thumbnail(r), THUMB_MS).catch(e => {
  noteError("miniature", `${r.id} : ${e instanceof Error ? e.message : String(e)}`);
  return null;
}));
async function thumbnail(r: Rush): Promise<string | null> {
  if (!r.uri) return null;
  let src: string | null = null;
  try {
    src = r.photo ? r.uri : (await VideoThumbnails.getThumbnailAsync(r.uri, { time: Math.min(300, r.duration * 500), quality: 0.7 })).uri;
    const out = await (await ImageManipulator.manipulate(src).resize({ width: THUMB_PX }).renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
    // Kept beside the rush: the cache folder is emptied by iOS, and the cover went black.
    return keepMedia(out.uri, `${r.id}-vignette`);
  } catch (e) {
    noteError("miniature", e instanceof Error ? e.message : String(e));
    return src;
  }
}

// Without Vision (module missing or failing): the same candidate frames, read with expo-video-thumbnails
// and shrunk to 512 px, without sharpness or faces. The AI still sees the real footage, never a sample.
const LITE_PER_RUSH = 6, FRAME_PX = 512;
async function frameAt(r: Rush & { uri: string }, t: number): Promise<string> {
  const src = r.photo ? r.uri : (await VideoThumbnails.getThumbnailAsync(r.uri, { time: Math.round(t * 1000), quality: 0.7 })).uri;
  const out = await (await ImageManipulator.manipulate(src).resize({ width: FRAME_PX }).renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.6 });
  return out.uri;
}
export async function triageLite(r: Rush): Promise<Rush> {
  if (!r.uri) return r;
  const uri = r.uri;
  const all = r.photo ? [0] : candidateTimes(r.duration, []);
  const times = all.length <= LITE_PER_RUSH ? all : Array.from({ length: LITE_PER_RUSH }, (_, i) => all[Math.round(i * (all.length - 1) / (LITE_PER_RUSH - 1))]);
  const ms: Measure[] = [];
  for (const t of times) { try { ms.push({ t, sharp: null, luma: null, faces: 0, jpeg: await frameAt({ ...r, uri }, t) }); } catch { /* a frame that cannot be read is skipped */ } }
  if (!ms.length) throw new Error("frames");
  const probed: Probed = { id: r.id, duration: r.duration, photo: r.photo, width: r.width ?? 1080, height: r.height ?? 1920, hasAudio: r.sound, scenes: [], voix: [] };
  return { ...r, triage: { probed, frames: judge(r.id, ms, []) } };
}

// Vision when compiled, the light reading otherwise; nothing on the web preview, which keeps its samples.
export const canRead = () => Platform.OS !== "web";
// Each reading has a time limit (core/progress.ts): a rush Vision cannot read in time falls back to the
// light reading, never to an endless wait.
// A Vision reading that runs out of time keeps going in the background, so after one failure the
// other rushes take the light reading straight away instead of piling up behind it.
const lite = (r: Rush) => withTimeout(triageLite(r), LIMITS.liteMs);
let visionOk = true;
const read = (r: Rush) => (canTriage() && visionOk
  ? withTimeout(triageRush(r), visionLimitMs(r.duration)).catch(e => { visionOk = false; noteError("vision", e instanceof Error ? e.message : String(e)); return lite(r); })
  : lite(r));
// One line for the whole app (LIMITS.readers at once), and one reading per rush: the edit waits for
// the reading the import screen already started instead of starting another.
const reads = queue(LIMITS.readers);
const inflight = new Map<string, Promise<Rush>>();
export function triageAny(r: Rush): Promise<Rush> {
  const known = inflight.get(r.id);
  if (known) return known;
  const p = reads(() => read(r));
  inflight.set(r.id, p);
  p.catch(() => inflight.delete(r.id));
  return p;
}

// What the server needs: the rushes, the 15 to 30 frames kept, read only now (after consent).
export async function montageBody(rushes: Rush[], brief: Brief, music: Music, brand: Brand | null, rules: string[]) {
  const ready = rushes.filter((r): r is Rush & { triage: Triaged } => !!r.triage);
  const kept = pickFrames(ready.flatMap(r => r.triage.frames), ready.map(r => r.id), MAX_FRAMES);
  const images = await Promise.all(kept.map(async (f, i) => ({ id: `f${i + 1}`, rush: f.rush, temps: f.t, data: await new File(f.jpeg).base64() })));
  const dna = brand?.dna ?? null;
  return {
    brief: composeBrief(brief), duree: brief.duration, variantes: 2, plateformes: brief.platforms,
    rushes: ready.map(r => rushForAi(r.triage.probed)), images,
    style: montageStyle(dna, rules), musique: toMusique(music, brief.duration),
    charte: charteOf(dna, !!brand?.logoUri),
  };
}
