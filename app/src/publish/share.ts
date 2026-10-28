import * as Linking from "expo-linking";
import * as Sharing from "expo-sharing";
import { instagramUrl } from "../../../core/publish";
import type { Plateforme } from "../../../core/timeline";
import type { Exported } from "../export/video";

// After the export (étape 7): Instagram opens on the video itself, the caption already copied;
// TikTok and YouTube through the share sheet, where their apps appear. Publishing straight from Ma DA
// waits for their API review (étapes 8 et 9).
export async function shareTo(p: Plateforme, file: Exported): Promise<"app" | "sheet" | "none"> {
  if (p === "reels" && file.asset) {
    const url = instagramUrl(file.asset);
    try { if (await Linking.canOpenURL(url)) { await Linking.openURL(url); return "app"; } } catch { /* not installed: the sheet */ }
  }
  if (!(await Sharing.isAvailableAsync())) return "none";
  await Sharing.shareAsync(file.uri, { mimeType: "video/mp4", UTI: "public.mpeg-4" });
  return "sheet";
}
