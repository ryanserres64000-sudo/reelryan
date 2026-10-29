import { useEffect, useState } from "react";
import { Image, Platform, StyleSheet } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";
import type { TimelineV1 } from "../../../core/timeline";
import type { Sources } from "./sources";

// The real picture of a shot (its rush at the shot's first second) when the native preview is not
// there: the person always sees their own footage, never an empty frame (Ryan's first test).
export const isPhoto = (uri: string) => /\.(jpe?g|png|heic|webp)$/i.test(uri);
const cache = new Map<string, Promise<string | null>>();
export function stillOf(uri: string, at: number, photo: boolean): Promise<string | null> {
  if (photo) return Promise.resolve(uri);
  const key = `${uri}@${at.toFixed(1)}`;
  if (!cache.has(key)) cache.set(key, VideoThumbnails.getThumbnailAsync(uri, { time: Math.round(at * 1000), quality: 0.7 }).then(r => r.uri, () => null));
  return cache.get(key)!;
}

export function ShotStill({ timeline, index, sources }: { timeline: TimelineV1; index: number; sources: Promise<Sources> | null }) {
  const [uri, setUri] = useState<string | null>(null);
  const plan = timeline.plans[index];
  useEffect(() => {
    let on = true;
    if (Platform.OS === "web" || !plan || !sources) return;
    sources.then(s => {
      const src = s.rushes[plan.source];
      if (!src) return null;
      return stillOf(src, plan.debut + Math.min(0.3, (plan.fin - plan.debut) / 2), /\.(jpe?g|png|heic|webp)$/i.test(src));
    }).then(u => on && u && setUri(u)).catch(() => {});
    return () => { on = false; };
  }, [sources, plan?.source, plan?.debut]);
  return uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null;
}
