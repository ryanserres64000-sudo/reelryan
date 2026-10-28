// Shot triage on the iPhone (CLAUDE.md : « le tri se fait sur l'appareil avec Vision » ; étude, ch. 5 §2).
// The native module (app/modules/mada-vision) only measures: sharpness, brightness, faces, shot
// changes, speech. These pure functions decide, the same way as the desktop prototype
// (prototype/lib/sort.mjs), so the blind test measures what the app will send: 15 to 30 small frames.

export type Measure = { t: number; sharp: number | null; luma: number | null; faces: number; jpeg: string };
export type Probed = { id: string; duration: number; photo: boolean; width: number; height: number; hasAudio: boolean; scenes: number[]; voix: [number, number][] };
export type Frame = Measure & { rush: string; sharpness: number; scene: boolean; reject: "sombre" | "brulee" | "floue" | null };
export type Badge = "blur" | "face" | "speech" | "dark";

export const MAX_FRAMES = 30, MIN_FRAMES = 15;

// Candidate times: shot changes plus a frame every `every` s, at least `spacing` apart (sort.mjs).
export function candidateTimes(duration: number, scenes: number[], every = 2, spacing = 0.8): number[] {
  const times = [Math.min(0.3, duration / 2)];
  for (let t = every; t < duration - 0.2; t += every) times.push(t);
  for (const s of scenes) times.push(Math.min(s + 0.2, duration - 0.1));
  times.sort((a, b) => a - b);
  return times.filter((t, i, a) => i === 0 || t - a[i - 1] >= spacing).map(t => Math.round(t * 10) / 10);
}

// Sharpness is the variance of the Laplacian (higher = sharper), compared with the sharpest quarter
// of the same rush, since it depends on the content. Luma is 0-255.
export function judge(rush: string, ms: Measure[], scenes: number[]): Frame[] {
  const sharps = ms.map(m => m.sharp).filter((s): s is number => s !== null).sort((a, b) => b - a);
  const ref = sharps[Math.floor(sharps.length / 4)] ?? 0;
  return ms.map(m => {
    const sharpness = m.sharp === null || !ref ? 1 : Math.min(1.5, m.sharp / ref);
    const reject = m.luma !== null && m.luma < 18 ? "sombre" : m.luma !== null && m.luma > 238 ? "brulee" : m.sharp !== null && ref && m.sharp < ref * 0.55 ? "floue" : null;
    return { ...m, rush, sharpness, scene: scenes.some(s => Math.abs(s - m.t) < 0.5), reject };
  });
}

// The badges shown on each rush card: most of its frames blurry or dark, a face, speech.
export function badgesOf(frames: Frame[], voix: [number, number][]): Badge[] {
  const out: Badge[] = [];
  const share = (r: Frame["reject"]) => frames.length && frames.filter(f => f.reject === r).length / frames.length;
  if (share("floue") > 0.5) out.push("blur");
  if (share("sombre") > 0.5) out.push("dark");
  if (frames.some(f => f.faces > 0)) out.push("face");
  if (voix.reduce((s, [a, b]) => s + b - a, 0) >= 1) out.push("speech");
  return out;
}

// Sharpest frames first, but every rush keeps one, even a poor one (sort.mjs, pickSpread).
export function pickFrames(frames: Frame[], rushIds: string[], max = MAX_FRAMES): Frame[] {
  const score = (f: Frame) => f.sharpness + (f.scene ? 0.2 : 0) + (f.faces ? 0.1 : 0);
  const usable = frames.filter(f => !f.reject).sort((a, b) => score(b) - score(a));
  const all = [...frames].sort((a, b) => score(b) - score(a));
  const kept = new Set<Frame>();
  for (const id of rushIds) { const f = usable.find(x => x.rush === id) ?? all.find(x => x.rush === id); if (f) kept.add(f); }
  for (const f of usable) { if (kept.size >= max) break; kept.add(f); }
  return [...kept].sort((a, b) => rushIds.indexOf(a.rush) - rushIds.indexOf(b.rush) || a.t - b.t);
}

// What POST /api/montage expects for the rushes (lib/montage.js, parseRequest).
export const rushForAi = (p: Probed) => ({ id: p.id, duree: Math.round(p.duration * 100) / 100, photo: p.photo, largeur: p.width, hauteur: p.height, son: p.hasAudio, voix: p.voix.slice(0, 20) });
