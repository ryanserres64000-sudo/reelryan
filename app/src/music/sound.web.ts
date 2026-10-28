import * as DocumentPicker from "expo-document-picker";
import { checkDuration, checkHead, checkLink, LIMITS, sniffAudio } from "../../../core/music";
import { ANALYSIS_RATE, MusicFailure, nameOf, type Decoded, type DownloadOptions, type LoadedSound } from "./common";

// Web preview only (the product is the iPhone app): fetch, blob URL and Web Audio, same rules as on the phone.
const blobs = new Map<string, Blob>();

async function keep(blob: Blob, name: string, fromLink = false): Promise<LoadedSound> {
  if (blob.size > LIMITS.maxBytes) throw new MusicFailure("tooBig");
  const format = sniffAudio(new Uint8Array(await blob.slice(0, 64).arrayBuffer()));
  // An HTML page only makes sense to explain for a link; a picked file is simply unreadable.
  if (!format.ok) throw new MusicFailure(format.error === "webPage" && !fromLink ? "format" : format.error);
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const key = [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, "0")).join("");
  blobs.set(key, blob);
  return { uri: URL.createObjectURL(blob), key, name, format: format.value, bytes: blob.size };
}

export async function downloadSound(link: string, { onProgress, signal }: DownloadOptions = {}): Promise<LoadedSound> {
  const checked = checkLink(link);
  if (!checked.ok) throw new MusicFailure(checked.error);
  const ctrl = new AbortController();
  let why: "tooBig" | "network" | "cancelled" = "network";
  const stop = (reason: typeof why) => { why = reason; ctrl.abort(); };
  const timer = setTimeout(() => stop("network"), LIMITS.timeoutMs);
  const cancel = () => stop("cancelled");
  signal?.addEventListener("abort", cancel);
  try {
    let res: Response;
    try { res = await fetch(checked.value, { signal: ctrl.signal }); } catch { throw new MusicFailure(why); }
    const total = Number(res.headers.get("content-length")) || null;
    const h = checkHead({ status: res.status, contentType: res.headers.get("content-type"), contentLength: total, redirects: res.redirected ? 1 : 0 });
    if (!h.ok) throw new MusicFailure(h.error);
    const reader = res.body!.getReader(), parts: Uint8Array[] = [];
    let got = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        got += value.byteLength; parts.push(value);
        if (got > LIMITS.maxBytes) { stop("tooBig"); throw new MusicFailure("tooBig"); }
        onProgress?.(total ? got / total : null);
      }
    } catch (e) { throw e instanceof MusicFailure ? e : new MusicFailure(why); }
    return await keep(new Blob(parts as BlobPart[]), nameOf(checked.value), true);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

export async function importSound(): Promise<LoadedSound | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: "audio/*" });
  const a = res.canceled ? null : res.assets[0];
  if (!a) return null;
  return keep(a.file ?? (await (await fetch(a.uri)).blob()), a.name);
}

export async function openSound(uri: string, name = nameOf(uri)): Promise<LoadedSound> {
  return keep(await (await fetch(uri)).blob(), name);
}

export function touchSound(_key: string) {}

export async function decodeSound(s: LoadedSound): Promise<Decoded | null> {
  const blob = blobs.get(s.key);
  if (!blob) return null;
  let buffer: AudioBuffer;
  try {
    const probe = new OfflineAudioContext(1, 1, ANALYSIS_RATE);
    buffer = await probe.decodeAudioData(await blob.arrayBuffer());
  } catch { throw new MusicFailure("format"); }
  const length = checkDuration(buffer.duration);
  if (!length.ok) throw new MusicFailure(length.error);
  // Mono mix at the analysis rate.
  const ctx = new OfflineAudioContext(1, Math.ceil(buffer.duration * ANALYSIS_RATE), ANALYSIS_RATE);
  const src = ctx.createBufferSource();
  src.buffer = buffer; src.connect(ctx.destination); src.start();
  const out = await ctx.startRendering();
  return { samples: out.getChannelData(0), rate: ANALYSIS_RATE, duration: buffer.duration };
}
