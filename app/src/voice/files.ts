import { Directory, File, Paths } from "expo-file-system";

// The voices live next to the saved Reels (Documents, not Caches: iOS may empty the cache, and a
// saved Reel must still play its voice-over). The timeline only keeps the file name (AudioClip.source).
const dir = () => { const d = new Directory(Paths.document, "mada-voix"); if (!d.exists) d.create({ intermediates: true }); return d; };

export function saveVoice(name: string, base64: string): string {
  const f = new File(dir(), name);
  f.write(base64, { encoding: "base64" });
  return f.uri;
}
// A recording made by expo-audio, moved in with the others.
export function keepRecording(name: string, uri: string): string {
  const from = new File(uri), to = new File(dir(), name);
  if (to.exists) to.delete();
  from.moveSync(to);
  return to.uri;
}
export function voiceUri(name: string): string | null {
  const f = new File(dir(), name);
  return f.exists ? f.uri : null;
}
