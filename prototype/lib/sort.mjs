// Shot sorting before any AI call: probe rushes, find shot changes, extract small
// keyframes and drop blurry, dark or burnt ones. On the iPhone this will be Apple Vision.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";

const run = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;
export const VIDEO_EXT = new Set([".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi"]);
export const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"]);
// A photo becomes a still shot (slow zoom) of at most this length.
export const STILL_SECONDS = 4;
const isImage = file => IMAGE_EXT.has(path.extname(file).toLowerCase());

// iPhone photos are HEIC: convert them to JPEG once (sips ships with macOS, ffmpeg otherwise).
async function readableStill(file, workDir) {
  if (!/\.hei[cf]$/i.test(file)) return file;
  const out = path.join(workDir, path.basename(file).replace(/\.[^.]+$/, ".jpg"));
  try { await run("sips", ["-s", "format", "jpeg", file, "--out", out]); }
  catch { await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", file, "-frames:v", "1", out]); }
  return out;
}

// Probes a rush, video or photo; a photo is returned with `still` and its converted file.
export async function probeMedia(file, workDir) {
  if (!isImage(file)) return { file, ...(await probe(file)) };
  await mkdir(workDir, { recursive: true });
  const readable = await readableStill(file, workDir);
  const info = await probe(readable);
  return { ...info, file: readable, duration: STILL_SECONDS, hasAudio: false, still: true };
}

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

// Stretches where someone is probably talking: audible sound in the voice band (300-3400 Hz).
// Returns [[start, end], ...] in seconds, merged when less than 0.6 s apart.
async function voiceSpans(file, duration) {
  const { stderr } = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn",
    "-af", "highpass=f=300,lowpass=f=3400,silencedetect=noise=-38dB:d=0.4", "-f", "null", "-"], { maxBuffer: MAX_BUFFER });
  const spans = [];
  let start = 0;
  for (const m of stderr.matchAll(/silence_(start|end): ([\d.]+)/g)) {
    const t = Number(m[2]);
    if (m[1] === "start") { if (t - start > 0.5) spans.push([start, t]); }
    else start = t;
  }
  if (!/silence_start/.test(stderr) || stderr.lastIndexOf("silence_end") > stderr.lastIndexOf("silence_start")) {
    if (duration - start > 0.5) spans.push([start, duration]);
  }
  const merged = [];
  for (const sp of spans) {
    const last = merged.at(-1);
    if (last && sp[0] - last[1] < 0.6) last[1] = sp[1]; else merged.push([...sp]);
  }
  return merged.map(([a, b]) => [Math.round(a * 10) / 10, Math.round(b * 10) / 10]);
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
    const info = await probeMedia(file, path.join(workDir, "photos"));
    clips[id] = { id, name: path.basename(file), ...info };
    if (info.hasAudio) clips[id].voix = await voiceSpans(info.file, info.duration);
    const scenes = info.still ? [] : await sceneChanges(file);
    const own = [];
    for (const t of info.still ? [0] : candidateTimes(info.duration, scenes)) {
      const out = path.join(workDir, `${id}_${t.toFixed(1)}.jpg`);
      const m = await extractFrame(info.file, t, out);
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
    onProgress(info.still ? `${clips[id].name} : photo` : `${clips[id].name} : ${info.duration.toFixed(1)} s, ${scenes.length} changements de plan`);
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
