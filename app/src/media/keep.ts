import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { noteError } from "../diag";

// The rushes a person picks (audit du 29 octobre, phase 3 et 9). The picker hands copies in the app's
// temporary folder, which iOS may empty at any time: a saved Reel or a draft then pointed at files that
// were gone, and could no longer be played, edited or exported. Each pick is moved once into Documents,
// never the original in Photos, and the files no Reel, draft or screen uses any more are cleared.
const dir = () => { const d = new Directory(Paths.document, "mada-rushes"); if (!d.exists) d.create({ intermediates: true }); return d; };
const OLD_MS = 24 * 3600 * 1000;

// The file's new place, or the picker's own when it cannot be moved (said in Réglages, Diagnostic).
export function keepMedia(uri: string, id: string): string {
  if (Platform.OS === "web" || !uri.startsWith("file:")) return uri;
  try {
    const from = new File(uri);
    if (from.uri.startsWith(dir().uri)) return uri;
    const ext = from.extension || ".mov";
    const to = new File(dir(), `${id}${ext.startsWith(".") ? ext : `.${ext}`}`);
    if (to.exists) to.delete();
    from.moveSync(to);
    return to.uri;
  } catch (e) {
    noteError("import", e instanceof Error ? e.message : String(e));
    return uri;
  }
}

// iOS may move the app's data folder when the app is updated (a new TestFlight build): a path saved by
// an older build then points at the old folder, and the Reel looked empty (black covers, no video).
// A kept file is looked up again by its name in today's folder.
const KEPT = "/mada-rushes/";
export function liveUri(uri: string): string {
  if (Platform.OS === "web" || !uri.startsWith("file:") || !uri.includes(KEPT)) return uri;
  try {
    const f = new File(dir(), decodeURIComponent(uri.slice(uri.lastIndexOf(KEPT) + KEPT.length)));
    return f.exists ? f.uri : uri;
  } catch (e) { noteError("fichiers", e instanceof Error ? e.message : String(e)); return uri; }
}
export function liveRush<T extends { uri?: string; thumb?: string | null }>(r: T): T {
  return { ...r, ...(r.uri ? { uri: liveUri(r.uri) } : {}), ...(r.thumb ? { thumb: liveUri(r.thumb) } : {}) };
}
const nameOf = (uri: string) => decodeURIComponent(uri.slice(uri.lastIndexOf("/") + 1));

// Whether a rush file is still there (a draft from before this fix, a file iOS removed).
export function mediaExists(uri: string | undefined): boolean {
  if (!uri || Platform.OS === "web" || !uri.startsWith("file:")) return !!uri;
  try { return new File(uri).exists; } catch { return false; }
}

// Removes the kept rushes nothing refers to any more, a day after they were picked (never one picked
// in this session). Returns how many were removed.
export function sweepMedia(used: Iterable<string>, now = Date.now()): number {
  if (Platform.OS === "web") return 0;
  // By name: a path saved before an update names the same file under the old folder.
  const keep = new Set([...used].filter(u => u.includes(KEPT)).map(nameOf));
  let removed = 0;
  try {
    for (const f of dir().list()) {
      if (!(f instanceof File) || keep.has(nameOf(f.uri))) continue;
      if (now - (f.modificationTime ?? now) < OLD_MS) continue;
      f.delete(); removed++;
    }
  } catch (e) { noteError("nettoyage", e instanceof Error ? e.message : String(e)); }
  return removed;
}
