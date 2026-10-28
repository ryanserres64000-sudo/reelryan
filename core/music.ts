// Music (lot 3): the rules of the MP3 link, the file check, tempo and beats, tap tempo, the best passage
// and the cache policy (étude, ch. 5 §3 « Spécification du lien MP3 et des imports »). Pure functions:
// the iPhone decodes the audio (AVAudioFile) and downloads; everything that decides lives here and is tested.

export const LIMITS = { maxBytes: 50 * 1024 * 1024, maxSeconds: 600, maxRedirects: 3, timeoutMs: 30_000, minBpm: 60, maxBpm: 200 } as const;
export const CACHE = { maxBytes: 500 * 1024 * 1024, maxAgeDays: 30 } as const;
export const TRENDING_TEMPOS = [90, 110, 128] as const;
export const PASSAGE_LENGTHS = [15, 30, 60] as const;

// The keys of fr.music.errors in the app.
export type MusicError = "invalid" | "streaming" | "insecure" | "webPage" | "format" | "tooBig" | "network" | "noTempo";
export type Check<T> = { ok: true; value: T } | { ok: false; error: MusicError };
const ok = <T>(value: T): Check<T> => ({ ok: true, value });
const no = (error: MusicError): Check<never> => ({ ok: false, error });

// Streaming pages, not files, and their terms forbid extraction.
const STREAMING = ["spotify.com", "spotify.link", "music.apple.com", "itunes.apple.com", "youtube.com", "youtu.be", "deezer.com", "deezer.page.link", "dzr.page.link", "soundcloud.com", "tiktok.com", "instagram.com"];

export function checkLink(input: string): Check<string> {
  let url: URL;
  try { url = new URL(String(input).trim()); } catch { return no("invalid"); }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (STREAMING.some(d => host === d || host.endsWith("." + d))) return no("streaming");
  if (url.protocol === "http:") return no("insecure");
  if (url.protocol !== "https:" || !host.includes(".")) return no("invalid");
  return ok(url.toString());
}

// After the HEAD request (and again on each redirect): what the server says it will send.
export function checkHead({ status, contentType, contentLength, redirects = 0 }: { status: number; contentType?: string | null; contentLength?: number | null; redirects?: number }): Check<true> {
  if (redirects > LIMITS.maxRedirects || status >= 400 || status === 0) return no("network");
  const type = String(contentType ?? "").split(";")[0].trim().toLowerCase();
  if (type === "text/html" || type === "application/xhtml+xml") return no("webPage");
  if (type && !type.startsWith("audio/") && type !== "application/octet-stream" && type !== "binary/octet-stream" && type !== "video/mp4") return no("format");
  if (contentLength && contentLength > LIMITS.maxBytes) return no("tooBig");
  return ok(true);
}

export type AudioFormat = "mp3" | "m4a" | "aac" | "wav";

// The real content, never the extension: the first bytes of the file.
export function sniffAudio(b: Uint8Array): Check<AudioFormat> {
  const ascii = (from: number, len: number) => String.fromCharCode(...b.subarray(from, from + len));
  if (b.length < 12) return no("format");
  const head = ascii(0, 64).trimStart().toLowerCase();
  if (head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("<?xml")) return no("webPage");
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") {
    // PCM 16 or 24 bits (format 1, or 0xFFFE extensible), read from the « fmt » chunk.
    for (let i = 12; i + 8 <= b.length;) {
      const size = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24);
      if (ascii(i, 4) === "fmt " && i + 24 <= b.length) {
        const format = b[i + 8] | (b[i + 9] << 8), bits = b[i + 22] | (b[i + 23] << 8);
        return (format === 1 || format === 0xfffe) && (bits === 16 || bits === 24) ? ok("wav") : no("format");
      }
      i += 8 + size + (size & 1);
    }
    return no("format");
  }
  if (ascii(4, 4) === "ftyp") return ["M4A ", "M4B ", "mp42", "isom", "mp41", "iso2", "dash"].includes(ascii(8, 4)) ? ok("m4a") : no("format");
  if (ascii(0, 3) === "ID3") return ok("mp3");
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return ok("aac"); // ADTS: sync 12 bits, layer 00
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0) return ok("mp3"); // MPEG audio frame
  return no("format");
}

// After decoding: the length rule (10 minutes).
export function checkDuration(seconds: number): Check<number> {
  return seconds > 0 && seconds <= LIMITS.maxSeconds ? ok(seconds) : no(seconds > 0 ? "tooBig" : "format");
}

// Cache in the app folder, named by the file's hash: what to delete (too old first, then least recently used).
export function cacheToEvict(entries: { key: string; bytes: number; lastUsed: number }[], now: number, keep: string[] = []): string[] {
  const maxAge = CACHE.maxAgeDays * 86_400_000, out = new Set<string>();
  for (const e of entries) if (now - e.lastUsed > maxAge && !keep.includes(e.key)) out.add(e.key);
  let total = entries.filter(e => !out.has(e.key)).reduce((s, e) => s + e.bytes, 0);
  for (const e of [...entries].sort((a, b) => a.lastUsed - b.lastUsed)) {
    if (total <= CACHE.maxBytes) break;
    if (out.has(e.key) || keep.includes(e.key)) continue;
    out.add(e.key); total -= e.bytes;
  }
  return [...out];
}

// ---- Tempo and beats ----

export type Tempo = { bpm: number; confidence: number; beats: number[]; downbeats: number[] };

// Onset strength per hop: rectified rise of the log energy of the high-passed signal (transients),
// plus the same on a low band (kick drum) used to find the first beat of each bar.
function onsets(samples: Float32Array, rate: number) {
  // About 11.6 ms per hop whatever the sample rate (512 samples at 44.1 kHz).
  const HOP = Math.max(64, Math.round(rate / 86));
  const frames = Math.floor(samples.length / HOP);
  const hi = new Float32Array(frames), lo = new Float32Array(frames);
  const a = Math.exp(-2 * Math.PI * 150 / rate);
  let prev = 0, low = 0;
  for (let f = 0; f < frames; f++) {
    let eh = 0, el = 0;
    for (let i = f * HOP, end = i + HOP; i < end; i++) {
      const x = samples[i], d = x - prev; prev = x;
      low = (1 - a) * x + a * low;
      eh += d * d; el += low * low;
    }
    hi[f] = Math.log1p(1000 * eh / HOP); lo[f] = Math.log1p(1000 * el / HOP);
  }
  const rise = (e: Float32Array) => {
    const o = new Float32Array(e.length);
    for (let f = 1; f < e.length; f++) o[f] = Math.max(0, e[f] - e[f - 1]);
    // Remove the local mean (about 0.5 s) so loud passages do not dominate.
    const w = Math.max(1, Math.round(0.25 * rate / HOP)), out = new Float32Array(o.length);
    let s = 0;
    for (let f = 0; f < o.length; f++) {
      s += o[f] - (f - 2 * w - 1 >= 0 ? o[f - 2 * w - 1] : 0);
      const n = Math.min(f + 1, 2 * w + 1);
      out[f] = Math.max(0, o[f] - s / n);
    }
    return out;
  };
  return { hi: rise(hi), lo: rise(lo), fps: rate / HOP };
}

const at = (o: Float32Array, x: number) => {
  const i = Math.floor(x), t = x - i;
  return i < 0 || i + 1 >= o.length ? 0 : o[i] * (1 - t) + o[i + 1] * t;
};

export function analyzeTempo(samples: Float32Array, rate: number): Tempo | null {
  const { hi, lo, fps } = onsets(samples, rate);
  if (hi.length < fps * 4) return null;
  const minLag = Math.floor(fps * 60 / LIMITS.maxBpm), maxLag = Math.ceil(fps * 60 / LIMITS.minBpm);
  const n = hi.length;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += hi[i] * hi[i];
  if (energy <= 1e-9) return null;
  // Autocorrelation, weighted towards 120 BPM to settle the double / half tempo ambiguity.
  const ac = new Float64Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += hi[i] * hi[i - lag];
    ac[lag] = s / (n - lag);
  }
  let best = minLag, bestScore = -1, sum = 0, count = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = 60 * fps / lag, w = Math.exp(-0.5 * (Math.log2(bpm / 120) / 1.0) ** 2);
    const score = ac[lag] * w;
    sum += ac[lag]; count++;
    if (score > bestScore) { bestScore = score; best = lag; }
  }
  // A strong pulse at twice the speed means the slow peak was every other beat (kick on 1 and 3).
  const half = best / 2;
  const halfPeak = Math.max(ac[Math.floor(half)] ?? 0, ac[Math.ceil(half)] ?? 0);
  if (half >= minLag && 60 * fps / half <= LIMITS.maxBpm && halfPeak > 0.5 * ac[best]) best = ac[Math.floor(half)] >= ac[Math.ceil(half)] ? Math.floor(half) : Math.ceil(half);
  // Sub-frame period by parabolic interpolation.
  const y0 = ac[best - 1], y1 = ac[best], y2 = ac[best + 1], den = y0 - 2 * y1 + y2;
  let period = best + (den < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (y0 - y2) / den)) : 0);
  const mean = sum / count, zero = energy / n;
  const confidence = Math.max(0, Math.min(1, (ac[best] - mean) / Math.max(1e-9, zero - mean)));

  // Phase: the offset whose comb collects the most onset strength.
  let phase = 0, phaseScore = -1;
  for (let p = 0; p < period; p += 0.25) {
    let s = 0;
    for (let x = p; x < n; x += period) s += at(hi, x);
    if (s > phaseScore) { phaseScore = s; phase = p; }
  }
  // Each beat then follows the music: local peak within ± 10 % of the period, refined below the frame.
  const track = (first: number, step: number) => {
    const out: { pos: number; heard: boolean }[] = [], win = Math.max(1, Math.round(step * 0.1));
    for (let x = first; x < n - 1; x += step) {
      const c = Math.round(x);
      let k = c, v = 0;
      for (let j = Math.max(1, c - win); j <= Math.min(n - 2, c + win); j++) if (hi[j] > v) { v = hi[j]; k = j; }
      let pos = x;
      if (v > 0) {
        const a0 = hi[k - 1], a1 = hi[k], a2 = hi[k + 1], d = a0 - 2 * a1 + a2;
        pos = k + (d < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a0 - a2) / d)) : 0);
        x = pos; // re-anchor on the heard beat so the grid does not drift
      }
      out.push({ pos, heard: v > 0 });
    }
    return out;
  };
  // First pass, then a straight line through the heard beats gives the exact period and phase for the second pass.
  const rough = track(phase, period);
  const pts = rough.map((b, i) => [i, b.pos] as const).filter((_, i) => rough[i].heard);
  let grid = { first: phase, step: period };
  if (pts.length >= 8) {
    const m = pts.length, sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0);
    const sxx = pts.reduce((a, p) => a + p[0] * p[0], 0), sxy = pts.reduce((a, p) => a + p[0] * p[1], 0);
    const step = (m * sxy - sx * sy) / (m * sxx - sx * sx), first = (sy - step * sx) / m;
    if (Math.abs(step - period) < period * 0.05) grid = { first: ((first % step) + step) % step, step };
  }
  period = grid.step;
  // The rise is measured between two hops, so the attack sits half a hop earlier.
  const beats = track(grid.first, grid.step).map(b => Math.max(0, (b.pos - 0.5) / fps));
  // First beat of each bar (4/4): the offset where the low band hits hardest.
  let bar = 0, barScore = -1;
  for (let m = 0; m < 4; m++) {
    let s = 0;
    for (let i = m; i < beats.length; i += 4) s += at(lo, beats[i] * fps + 0.5) + 0.25 * at(hi, beats[i] * fps + 0.5);
    if (s > barScore) { barScore = s; bar = m; }
  }
  const r = (t: number) => Math.round(t * 1000) / 1000;
  return { bpm: Math.round(600 * fps / period) / 10, confidence: Math.round(confidence * 100) / 100, beats: beats.map(r), downbeats: beats.filter((_, i) => i % 4 === bar).map(r) };
}

// Below this, the app proposes « Tape le rythme » (étude, ch. 5 §3).
export const MIN_CONFIDENCE = 0.3;

// Tap tempo: taps in milliseconds, at least 4; the median interval, folded into 60–200 BPM.
export function tapTempo(taps: number[]): number | null {
  if (taps.length < 4) return null;
  const gaps = taps.slice(1).map((t, i) => t - taps[i]).filter(g => g > 0).sort((a, b) => a - b);
  if (gaps.length < 3) return null;
  let bpm = 60000 / gaps[Math.floor(gaps.length / 2)];
  while (bpm > LIMITS.maxBpm) bpm /= 2;
  while (bpm < LIMITS.minBpm) bpm *= 2;
  return Math.round(bpm * 10) / 10;
}

// A regular grid when only the tempo is known (tap tempo, « Son tendance »).
export function beatGrid(bpm: number, duration: number, start = 0): number[] {
  const out: number[] = [], step = 60 / bpm;
  for (let t = start; t <= duration + 1e-9; t += step) out.push(Math.round(t * 1000) / 1000);
  return out;
}

// Peaks for the waveform (0 to 1), and the loudness per second used to propose the passage.
export function waveformPeaks(samples: Float32Array, bars: number): number[] {
  const step = Math.max(1, Math.floor(samples.length / bars)), out: number[] = [];
  let max = 1e-9;
  for (let b = 0; b < bars; b++) {
    let p = 0;
    for (let i = b * step, end = Math.min(samples.length, i + step); i < end; i++) p = Math.max(p, Math.abs(samples[i]));
    out.push(p); max = Math.max(max, p);
  }
  return out.map(p => Math.round((p / max) * 1000) / 1000);
}

export function loudness(samples: Float32Array, rate: number): number[] {
  const out: number[] = [];
  for (let s = 0; s + rate <= samples.length; s += rate) {
    let e = 0;
    for (let i = s; i < s + rate; i++) e += samples[i] * samples[i];
    out.push(Math.sqrt(e / rate));
  }
  return out;
}

// The most intense window (often the chorus), starting on the first beat of a bar.
export function bestPassage(perSecond: number[], downbeats: number[], length: number): { debut: number; fin: number } {
  const duration = perSecond.length;
  if (duration <= length) return { debut: 0, fin: duration };
  const starts = downbeats.filter(d => d + length <= duration);
  const candidates = starts.length ? starts : Array.from({ length: Math.floor((duration - length) * 2) + 1 }, (_, i) => i / 2);
  const mean = (a: number) => {
    let s = 0;
    for (let t = Math.floor(a); t < Math.floor(a + length); t++) s += perSecond[t] ?? 0;
    return s / length;
  };
  let best = candidates[0], score = -1;
  for (const c of candidates) { const m = mean(c); if (m > score + 1e-9) { score = m; best = c; } }
  return { debut: best, fin: Math.round((best + length) * 1000) / 1000 };
}

// Moving the passage with the finger: it lands on the nearest first beat of a bar.
export function snapPassage(start: number, downbeats: number[], length: number, duration: number): { debut: number; fin: number } {
  const options = downbeats.filter(d => d + length <= duration);
  const debut = options.length ? options.reduce((a, b) => (Math.abs(b - start) < Math.abs(a - start) ? b : a)) : Math.max(0, Math.min(start, duration - length));
  return { debut, fin: Math.round((debut + length) * 1000) / 1000 };
}
