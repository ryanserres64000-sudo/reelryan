import { requireOptionalNativeModule } from "expo";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import { cacheToEvict, checkDuration, checkHead, checkLink, LIMITS, sniffAudio } from "../../../core/music";
import { ANALYSIS_RATE, MusicFailure, nameOf, type Decoded, type DownloadOptions, type LoadedSound } from "./common";

// iPhone: the phone downloads the sound itself (the server never sees it), keeps it in the Caches folder,
// which iOS never backs up to iCloud, named by its SHA-256 (étude, ch. 5 §3).
const dir = () => { const d = new Directory(Paths.cache, "mada-sons"); if (!d.exists) d.create({ intermediates: true }); return d; };
type Entry = { key: string; bytes: number; lastUsed: number; file: string };
const indexFile = () => new File(dir(), "index.json");
const readIndex = (): Entry[] => { try { const f = indexFile(); return f.exists ? JSON.parse(f.textSync()) : []; } catch { return []; } };
const writeIndex = (e: Entry[]) => indexFile().write(JSON.stringify(e));

async function keep(tmp: File, name: string, fromLink = false): Promise<LoadedSound> {
  const bytes = tmp.size ?? 0;
  if (bytes > LIMITS.maxBytes) { tmp.delete(); throw new MusicFailure("tooBig"); }
  const handle = tmp.open();
  const head = handle.readBytesSync(64);
  handle.close();
  const format = sniffAudio(head);
  // An HTML page only makes sense to explain for a link; a picked file is simply unreadable.
  if (!format.ok) { tmp.delete(); throw new MusicFailure(format.error === "webPage" && !fromLink ? "format" : format.error); }
  const key = await tmp.digest("SHA-256");
  const file = new File(dir(), `${key}.${format.value}`);
  if (file.exists) tmp.delete(); else tmp.moveSync(file);
  const now = Date.now(), index = readIndex().filter(e => e.key !== key);
  index.push({ key, bytes, lastUsed: now, file: file.name });
  const gone = cacheToEvict(index, now, [key]);
  for (const e of index.filter(x => gone.includes(x.key))) { try { new File(dir(), e.file).delete(); } catch {} }
  writeIndex(index.filter(e => !gone.includes(e.key)));
  return { uri: file.uri, key, name, format: format.value, bytes };
}

export async function downloadSound(link: string, { onProgress, signal }: DownloadOptions = {}): Promise<LoadedSound> {
  const checked = checkLink(link);
  if (!checked.ok) throw new MusicFailure(checked.error);
  const url = checked.value, ctrl = new AbortController();
  let why: "tooBig" | "network" | "cancelled" = "network";
  const stop = (reason: typeof why) => { why = reason; ctrl.abort(); };
  const timer = setTimeout(() => stop("network"), LIMITS.timeoutMs);
  const cancel = () => stop("cancelled");
  signal?.addEventListener("abort", cancel);
  try {
    try {
      const head = await fetch(url, { method: "HEAD", signal: ctrl.signal });
      const h = checkHead({ status: head.status, contentType: head.headers.get("content-type"), contentLength: Number(head.headers.get("content-length")) || null });
      // Some hosts refuse HEAD: the file itself is checked after download anyway.
      if (!h.ok && head.status !== 405 && head.status !== 403) throw new MusicFailure(h.error);
    } catch (e) {
      if (e instanceof MusicFailure) throw e;
      throw new MusicFailure(why);
    }
    const tmp = new File(dir(), `telechargement-${Date.now()}`);
    try {
      await File.downloadFileAsync(url, tmp, {
        idempotent: true, signal: ctrl.signal,
        onProgress: ({ bytesWritten, totalBytes }) => {
          if (bytesWritten > LIMITS.maxBytes || totalBytes > LIMITS.maxBytes) stop("tooBig");
          onProgress?.(totalBytes > 0 ? bytesWritten / totalBytes : null);
        },
      });
    } catch {
      try { if (tmp.exists) tmp.delete(); } catch {}
      throw new MusicFailure(why);
    }
    return await keep(tmp, nameOf(url), true);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

// Fichiers, iCloud Drive, AirDrop already received, voice memos saved to Fichiers.
export async function importSound(): Promise<LoadedSound | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
  if (res.canceled || !res.assets[0]) return null;
  return openSound(res.assets[0].uri, res.assets[0].name);
}

// A file shared to the app (« Ouvrir avec » from AirDrop or the Dictaphone).
export async function openSound(uri: string, name = nameOf(uri)): Promise<LoadedSound> {
  const tmp = new File(dir(), `import-${Date.now()}`);
  new File(uri).copySync(tmp);
  return keep(tmp, name);
}

export function touchSound(key: string) {
  writeIndex(readIndex().map(e => (e.key === key ? { ...e, lastUsed: Date.now() } : e)));
}

// Decoding goes through AVAudioFile in the native module (app/modules/mada-audio). Without it
// (an old build), the app offers « Tape le rythme » instead of failing.
type Native = { decodeMono(uri: string, rate: number): Promise<{ samples: Uint8Array; rate: number; duration: number }> };
export async function decodeSound(s: LoadedSound): Promise<Decoded | null> {
  const native = requireOptionalNativeModule<Native>("MadaAudio");
  if (!native) return null;
  let out;
  try { out = await native.decodeMono(s.uri, ANALYSIS_RATE); } catch { throw new MusicFailure("format"); }
  const length = checkDuration(out.duration);
  if (!length.ok) throw new MusicFailure(length.error);
  const b = out.samples;
  return { samples: new Float32Array(b.buffer, b.byteOffset, Math.floor(b.byteLength / 4)), rate: out.rate, duration: out.duration };
}
