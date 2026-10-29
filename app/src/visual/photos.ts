import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

// The photos of a poster or a post (Ryan, build 9 : « je ne peux pas ajouter de photos »). Each one is
// turned into a JPEG of 2160 px at most (iPhone HEIC included, sharp enough for a 4K export) and kept
// in Documents, not in the picker's cache that iOS empties: a saved visual must still show its photos.
const dir = () => { const d = new Directory(Paths.document, "mada-visuels"); if (!d.exists) d.create({ intermediates: true }); return d; };
const MAX_PX = 2160;

// On the web preview there is no Documents folder: the picked file stays where it is.
function keep(uri: string, i: number) {
  if (Platform.OS === "web") return uri;
  const to = new File(dir(), `photo-${Date.now().toString(36)}-${i}.jpg`);
  new File(uri).moveSync(to);
  return to.uri;
}

export type Picked = { uri: string; ratio: number };

// Up to `n` photos; [] when the person cancels. The iOS picker needs no access to the whole library.
// Throws when a photo cannot be read, so the screen says so instead of doing nothing.
export async function pickPhotos(n: number): Promise<Picked[]> {
  if (n <= 0) return [];
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: n > 1, selectionLimit: n, orderedSelection: true, quality: 1 });
  if (res.canceled) return [];
  const out: Picked[] = [];
  for (const a of res.assets.slice(0, n)) {
    const big = Math.max(a.width, a.height) > MAX_PX;
    const ctx = ImageManipulator.manipulate(a.uri);
    if (big) ctx.resize(a.width >= a.height ? { width: MAX_PX } : { height: MAX_PX });
    const r = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
    out.push({ uri: keep(r.uri, out.length), ratio: r.width / Math.max(1, r.height) });
  }
  return out;
}
