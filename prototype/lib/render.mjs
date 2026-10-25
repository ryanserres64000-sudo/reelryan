// Draws a sanitized timeline to a 1080x1920 H.264/AAC MP4 with ffmpeg.
// On the iPhone the same timeline will drive one AVComposition for preview and export.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { TRANSITION_SECONDS } from "./timeline.mjs";

const run = promisify(execFile);
const W = 1080, H = 1920, FPS = 30;
const XFADE = { fondu: "fade", glisse: "slideleft", zoom: "zoomin" };
const TEXT_SIZE = { accroche: 92, titre: 76, info: 64, signature: 60 };
const TEXT_Y = { haut: "h*0.14", centre: "(h-text_h)/2", bas: "h*0.66" };

const FONT_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/Library/Fonts/Arial Bold.ttf",
  "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "C:\\Windows\\Fonts\\arialbd.ttf"
];

async function exists(f) { try { await access(f); return true; } catch { return false; } }
async function pickFont(style) {
  for (const f of [style.police, ...FONT_CANDIDATES].filter(Boolean)) if (await exists(f)) return f;
  throw new Error("Aucune police trouvée : indique un fichier .ttf ou .otf dans « police » du style.");
}

const color = (c, fallback) => /^#?[0-9a-f]{6}$/i.test(c || "") ? "0x" + c.replace("#", "") : fallback;
// Breaks a text into centred lines that fit the 9:16 frame at this font size.
function wrap(text, size) {
  const max = Math.max(8, Math.floor((W * 0.84) / (size * 0.56)));
  const lines = [];
  for (const word of text.split(/\s+/)) {
    const last = lines.at(-1);
    if (last && (last + " " + word).length <= max) lines[lines.length - 1] = last + " " + word;
    else lines.push(word);
  }
  return lines.join("\n");
}

// ffmpeg filter arguments: escape the characters that end or split an option.
const esc = s => String(s).replace(/\\/g, "/").replace(/[:']/g, m => "\\" + m);

export async function renderTimeline(timeline, clips, style, outFile, { music, workDir }) {
  await mkdir(workDir, { recursive: true });
  const font = await pickFont(style);
  const args = ["-hide_banner", "-y"];
  const graph = [];
  const plans = timeline.plans;

  // One input per shot, already trimmed, so every stream starts at 0.
  plans.forEach((p, i) => {
    args.push("-ss", String(p.debut), "-t", String(p.fin - p.debut), "-i", clips[p.source].file);
    const d = p.fin - p.debut;
    const x = p.cadrage === "gauche" ? "0" : p.cadrage === "droite" ? "iw-ow" : "(iw-ow)/2";
    graph.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:${x}:(ih-oh)/2,fps=${FPS},setsar=1,format=yuv420p,trim=duration=${d},setpts=PTS-STARTPTS,settb=1/${FPS}[v${i}]`);
    graph.push(p.garder_son && clips[p.source].hasAudio
      ? `[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=duration=${d},asetpts=PTS-STARTPTS,apad=whole_dur=${d}[a${i}]`
      : `anullsrc=r=48000:cl=stereo,atrim=duration=${d}[a${i}]`);
  });

  // Chain shots: plain concat for cuts, xfade/acrossfade for the others.
  let v = "v0", a = "a0", total = plans[0].fin - plans[0].debut;
  for (let i = 1; i < plans.length; i++) {
    const p = plans[i], d = p.fin - p.debut, nv = `vx${i}`, na = `ax${i}`;
    if (p.transition === "coupe") {
      graph.push(`[${v}][v${i}]concat=n=2:v=1:a=0,settb=1/${FPS}[${nv}]`, `[${a}][a${i}]concat=n=2:v=0:a=1[${na}]`);
      total += d;
    } else {
      graph.push(`[${v}][v${i}]xfade=transition=${XFADE[p.transition]}:duration=${TRANSITION_SECONDS}:offset=${(total - TRANSITION_SECONDS).toFixed(3)}[${nv}]`,
        `[${a}][a${i}]acrossfade=d=${TRANSITION_SECONDS}[${na}]`);
      total += d - TRANSITION_SECONDS;
    }
    v = nv; a = na;
  }

  // Texts, each from its own file so no escaping is needed for the words themselves.
  const main = color(style.couleurs?.texte, "white"), accent = color(style.couleurs?.principale, "black");
  for (const [i, t] of timeline.textes.entries()) {
    const file = path.join(workDir, `texte${i}.txt`);
    await writeFile(file, wrap(t.texte, TEXT_SIZE[t.style]));
    const fade = `if(lt(t,${t.debut}+0.2),(t-${t.debut})/0.2,if(gt(t,${t.fin}-0.2),(${t.fin}-t)/0.2,1))`;
    const box = t.style === "accroche" || t.style === "signature" ? `:box=1:boxcolor=${accent}@0.85:boxborderw=28` : `:borderw=4:bordercolor=black@0.6`;
    graph.push(`[${v}]drawtext=fontfile='${esc(font)}':textfile='${esc(file)}':fontsize=${TEXT_SIZE[t.style]}:fontcolor=${main}${box}:text_align=C:line_spacing=${Math.round(TEXT_SIZE[t.style] * 0.25)}:x=(w-text_w)/2:y=${TEXT_Y[t.position]}:enable='between(t,${t.debut},${t.fin})':alpha='${fade}'[vt${i}]`);
    v = `vt${i}`;
  }

  // Optional logo in the last 2.5 s, top right, inside the safe zone.
  let next = plans.length;
  if (style.logo && await exists(style.logo)) {
    args.push("-i", style.logo);
    graph.push(`[${next}:v]scale=200:-1[logo]`, `[${v}][logo]overlay=x=W-w-60:y=H*0.08:enable='gte(t,${Math.max(0, total - 2.5).toFixed(2)})'[vl]`);
    v = "vl"; next++;
  }

  // Optional music under the original sound.
  if (music) {
    args.push("-stream_loop", "-1", "-i", music);
    graph.push(`[${next}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=duration=${total.toFixed(3)},volume=0.6[mus]`, `[${a}][mus]amix=inputs=2:duration=first:normalize=0[am]`);
    a = "am";
  }

  graph.push(`[${a}]apad,atrim=duration=${total.toFixed(3)}[aout]`);
  a = "aout";
  args.push("-filter_complex", graph.join(";"), "-map", `[${v}]`, "-map", `[${a}]`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-t", total.toFixed(3), outFile);
  await run("ffmpeg", args, { maxBuffer: 64 * 1024 * 1024 });
  return { duration: total };
}

// Evenly spaced stills of the rendered edit, for the AI review.
export async function snapshots(file, duration, count = 6) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = Math.round(((i + 0.5) * duration / count) * 10) / 10;
    const { stdout } = await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", String(t), "-i", file, "-frames:v", "1",
      "-vf", "scale=288:512", "-q:v", "4", "-f", "image2", "-c:v", "mjpeg", "pipe:1"], { encoding: "buffer", maxBuffer: 16 * 1024 * 1024 });
    out.push({ time: t, data: stdout.toString("base64") });
  }
  return out;
}
