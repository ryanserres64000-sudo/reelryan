// Shot sorting before any AI call: probe rushes, find shot changes, extract small
// keyframes and drop blurry, dark or burnt ones. On the iPhone this will be Apple Vision.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";

const run = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;
export const VIDEO_EXT = new Set([".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi"]);

export async function probe(file) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { maxBuffer: MAX_BUFFER });
  const info = JSON.parse(stdout);
  const v = info.streams.find(s => s.codec_type === "video");
  if (!v) throw new Error(`Pas de piste vidéo dans ${path.basename(file)}.`);
  const rotate = Math.abs(Number(v.tags?.rotate || v.side_data_list?.find(d => d.rotation !== undefined)?.rotation || 0));
  const [w, h] = rotate === 90 || rotate === 270 ? [v.height, v.width] : [v.width, v.height];
  return {
    duration: Number(info.format.duration || v.duration || 0),
    width: w, height: h,
    hasAudio: info.streams.some(s => s.codec_type === "audio")
  };
}

// Timestamps where the picture changes a lot (ffmpeg scene score).
async function sceneChanges(file, threshold = 0.3) {
  const { stderr } = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-an",
    "-vf", `scale=160:-2,select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"], { maxBuffer: MAX_BUFFER });
  return [...stderr.matchAll(/pts_time:([\d.]+)/g)].map(m => Number(m[1]));
}

// Candidate keyframes: shot changes plus regular sampling, at least `spacing` apart.
function candidateTimes(duration, scenes, every = 2, spacing = 0.8) {
  const times = [Math.min(0.3, duration / 2)];
  for (let t = every; t < duration - 0.2; t += every) times.push(t);
  for (const s of scenes) times.push(Math.min(s + 0.2, duration - 0.1));
  times.sort((a, b) => a - b);
  return times.filter((t, i, a) => i === 0 || t - a[i - 1] >= spacing);
}

// Small vertical-friendly JPEG (fits in 288x512) plus blur and brightness measures.
// Blur is measured at 720 px: after the final downscale every frame looks sharp.
async function extractFrame(file, t, out) {
  const { stderr } = await run("ffmpeg", ["-hide_banner", "-nostats", "-y", "-ss", String(t), "-i", file, "-frames:v", "1",
    "-vf", "scale=720:720:force_original_aspect_ratio=decrease,blurdetect,signalstats,scale=288:512:force_original_aspect_ratio=decrease,metadata=print",
    "-q:v", "4", out], { maxBuffer: MAX_BUFFER });
  const num = re => { const v = Number(stderr.match(re)?.[1]); return Number.isFinite(v) ? v : null; };
  return { blur: num(/lavfi\.blur=([\d.]+)/), luma: num(/lavfi\.signalstats\.YAVG=([\d.]+)/) };
}

// Probes every rush, keeps at most `maxFrames` usable keyframes spread across rushes.
export async function sortRushes(files, workDir, { maxFrames = 30, onProgress = () => {} } = {}) {
  await mkdir(workDir, { recursive: true });
  const clips = {}, frames = [];
  let n = 0;
  for (const [i, file] of files.entries()) {
    const id = `clip${String(i + 1).padStart(2, "0")}`;
    const info = await probe(file);
    clips[id] = { id, file, name: path.basename(file), ...info };
    const scenes = await sceneChanges(file);
    const own = [];
    for (const t of candidateTimes(info.duration, scenes)) {
      const out = path.join(workDir, `${id}_${t.toFixed(1)}.jpg`);
      const m = await extractFrame(file, t, out);
      own.push({ id: `f${++n}`, clip: id, time: Math.round(t * 10) / 10, file: out, blur: m.blur, luma: m.luma, scene: scenes.some(s => Math.abs(s - t) < 0.5) });
    }
    // Blur depends on the content, so compare each frame with the sharpest quarter of its rush.
    const blurs = own.map(f => f.blur).filter(b => b !== null).sort((a, b) => a - b);
    const ref = blurs[Math.floor(blurs.length / 4)] ?? 0;
    for (const f of own) {
      f.sharpness = f.blur === null || !ref ? 1 : ref / f.blur;
      f.reject = f.luma !== null && f.luma < 18 ? "trop sombre" : f.luma !== null && f.luma > 238 ? "brûlée"
        : f.blur !== null && ref && f.blur > ref * 1.35 ? "floue" : null;
      frames.push(f);
    }
    onProgress(`${clips[id].name} : ${info.duration.toFixed(1)} s, ${scenes.length} changements de plan`);
  }
  const usable = frames.filter(f => !f.reject);
  return { clips, frames, kept: pickSpread(usable, Object.keys(clips), maxFrames) };
}

// Sharpest frames first, but every rush keeps at least one.
function pickSpread(frames, clipIds, max) {
  const score = f => f.sharpness + (f.scene ? 0.2 : 0);
  const bySharp = [...frames].sort((a, b) => score(b) - score(a));
  const kept = new Set();
  for (const id of clipIds) { const f = bySharp.find(x => x.clip === id); if (f) kept.add(f); }
  for (const f of bySharp) { if (kept.size >= max) break; kept.add(f); }
  return [...kept].sort((a, b) => a.clip.localeCompare(b.clip) || a.time - b.time);
}

export async function frameAsBase64(frame) {
  return (await readFile(frame.file)).toString("base64");
}
