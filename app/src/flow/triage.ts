import { requireOptionalNativeModule } from "expo";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Platform } from "react-native";
import { charteOf, montageStyle } from "../../../core/brand";
import { candidateEvery, LIMITS, sceneStep, withTimeout } from "../../../core/progress";
import { badgesOf, candidateTimes, judge, MAX_FRAMES, pickFrames, rushForAi, type Measure, type Probed } from "../../../core/triage";
import type { Brand } from "../brand/types";
import { toMusique } from "../music/musique";
import { composeBrief } from "./brief";
import type { Brief, Music, Rush, Triaged } from "./types";

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

// A small frame of the rush for its card and for the player when the native preview is missing.
export async function thumbnailOf(r: Rush): Promise<string | null> {
  if (!r.uri) return null;
  if (r.photo) return r.uri;
  try { return (await VideoThumbnails.getThumbnailAsync(r.uri, { time: Math.min(300, r.duration * 500), quality: 0.6 })).uri; } catch { return null; }
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
const lite = (r: Rush) => withTimeout(triageLite(r), LIMITS.liteMs);
export const triageAny = (r: Rush) => (canTriage() ? withTimeout(triageRush(r), LIMITS.visionMs).catch(() => lite(r)) : lite(r));

// What the server needs: the rushes, the 15 to 30 frames kept, read only now (after consent).
export async function montageBody(rushes: Rush[], brief: Brief, music: Music, brand: Brand | null, rules: string[]) {
  const ready = rushes.filter((r): r is Rush & { triage: Triaged } => !!r.triage);
  const kept = pickFrames(ready.flatMap(r => r.triage.frames), ready.map(r => r.id), MAX_FRAMES);
  const images = await Promise.all(kept.map(async (f, i) => ({ id: `f${i + 1}`, rush: f.rush, temps: f.t, data: await new File(f.jpeg).base64() })));
  const dna = brand?.dna ?? null;
  return {
    brief: composeBrief(brief), duree: brief.duration, variantes: 3, plateformes: brief.platforms,
    rushes: ready.map(r => rushForAi(r.triage.probed)), images,
    style: montageStyle(dna, rules), musique: toMusique(music, brief.duration),
    charte: charteOf(dna, !!brand?.logoUri),
  };
}
