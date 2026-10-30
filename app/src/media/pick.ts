import * as ImagePicker from "expo-image-picker";
import type { Rush } from "../flow/types";
import { keepMedia } from "./keep";

// Videos and photos from the gallery, in the order picked, copied where the app keeps them. Shared by
// the import step and the editor's « Médias » (Ryan, 30 octobre). Empty when the person cancels.
export async function pickMedia(limit: number): Promise<Rush[]> {
  if (limit <= 0) return [];
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos", "images"], allowsMultipleSelection: true, selectionLimit: limit, orderedSelection: true });
  if (res.canceled) return [];
  const stamp = Date.now().toString(36);
  return res.assets.map((a, i) => ({
    id: `p${stamp}${i}`, uri: keepMedia(a.uri, `p${stamp}${i}`), photo: a.type !== "video", sound: a.type === "video", badges: [], width: a.width, height: a.height,
    duration: a.type === "video" && a.duration ? a.duration / 1000 : 4,
  }));
}
