import { requireNativeView } from "expo";
import { requireOptionalNativeModule } from "expo";
import { useEffect, useState, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import type { ExportFile } from "../../../core/export";
import type { TimelineV1 } from "../../../core/timeline";
import { fr } from "../copy/fr";
import { noteError } from "../diag";
import { VideoBroken } from "./Broken";
import type { Sources } from "./sources";

// The AVPlayer preview of app/modules/mada-video: the very composition the export writes (CLAUDE.md,
// « on exporte exactement ce qu'on voit »). Without the compiled module, the screen's own drawing stays.
type NativeProps = { source: { timeline: TimelineV1; file: ExportFile; sources: Sources }; style?: StyleProp<ViewStyle>; onError?: (e: { nativeEvent: { message: string } }) => void };
const Native = requireOptionalNativeModule("MadaVideo") ? requireNativeView<NativeProps>("MadaVideo") : null;
export const canPreview = () => !!Native;

export function VideoPreview({ timeline, file, sources, style, fallback }: { timeline: TimelineV1; file: ExportFile; sources: Promise<Sources> | null; style?: StyleProp<ViewStyle>; fallback: ReactNode }) {
  const [ready, setReady] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => { let on = true; sources?.then(s => on && setReady(s)); return () => { on = false; }; }, [sources]);
  const edit = JSON.stringify([timeline, file]);
  useEffect(() => setFailed(null), [edit]);
  if (Native && failed) return <View style={style}><VideoBroken message={failed} /></View>;
  if (!Native || !ready) return <>{fallback}</>;
  return <Native source={{ timeline, file, sources: ready }} style={style} onError={e => { const m = e.nativeEvent?.message ?? fr.player.unknown; noteError("Aperçu", m); setFailed(m); }} />;
}
