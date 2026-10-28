import { requireOptionalNativeModule } from "expo";
import { File } from "expo-file-system";
import { charteOf, montageStyle } from "../../../core/brand";
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
  const scenes = info.photo ? [] : await m.scenes(r.uri, 0.5, SCENE_THRESHOLD).catch(() => []);
  const voix = info.hasAudio ? await m.voice(r.uri).catch(() => [] as [number, number][]) : [];
  const probed: Probed = { ...info, id: r.id, scenes, voix };
  const frames = judge(r.id, await m.measure(r.uri, info.photo ? [0] : candidateTimes(info.duration, scenes), info.photo), scenes);
  const triage: Triaged = { probed, frames };
  return { ...r, duration: info.duration, photo: info.photo, sound: info.hasAudio, badges: badgesOf(frames, voix), triage };
}

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
