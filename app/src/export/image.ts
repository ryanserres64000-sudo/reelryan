import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";

// A visual as a PNG at its real size (1080 px wide and more), saved to Photos, then the iOS share
// sheet (étude, ch. 5 §7 : feuille de partage et enregistrement dans Photos). `ref` is the hidden
// full-size render. Photos access is asked only here, write-only.
export async function exportImage(ref: { current: unknown }, w: number, h: number): Promise<{ saved: boolean; uri: string }> {
  const uri = await captureRef(ref as Parameters<typeof captureRef>[0], { format: "png", quality: 1, width: w, height: h, result: "tmpfile" });
  let saved = false;
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (perm.granted) { await MediaLibrary.saveToLibraryAsync(uri); saved = true; }
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png" });
  return { saved, uri };
}
