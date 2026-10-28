import { forwardRef } from "react";
import { StyleSheet, View } from "react-native";
import { H, W, type ExportFile } from "../../../core/export";
import { shotAt, segments, textsAt } from "../../../core/playback";
import type { TimelineV1 } from "../../../core/timeline";
import { duoById } from "../../../core/typo";
import { fr } from "../copy/fr";
import { Text, tokens, useTheme } from "../design";
import { DuoTitle } from "./DuoTitle";
import { Player, type PlayerHandle } from "./Player";
import type { Sources } from "./sources";

type Props = { timeline: TimelineV1; file: ExportFile; sources: Promise<Sources> | null; time: number; playing: boolean; onTime: (t: number) => void; width: number };
const POSITION = { haut: "flex-start", centre: "center", bas: "flex-end" } as const;

// The picture at `time`, shared by the full-screen player and the editor: the native player when it
// is compiled, otherwise a plain frame with the shot number; texts and layers drawn on top where the
// native render puts them (Overlay.swift), so the drawing never lies about the export.
export const Frame = forwardRef<PlayerHandle, Props>(function Frame({ timeline, file, sources, time, playing, onTime, width }, ref) {
  const { c } = useTheme();
  const segs = segments(timeline), { index } = shotAt(segs, time), k = width / W;
  const height = width * 16 / 9, duo = duoById(timeline.charte.duo);
  const duration = segs.length ? segs[segs.length - 1].end : timeline.duree;
  const layers = (timeline.calques ?? []).filter(l => time >= l.t && time < l.t + l.fin - l.debut);
  return (
    <View style={[styles.frame, { width, height, backgroundColor: c.media }]}>
      <Player ref={ref} timeline={timeline} file={file} sources={sources} duration={duration} playing={playing} onTime={onTime} style={StyleSheet.absoluteFill}
        fallback={
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.surface }]}>
            <Text variant="mono" tone="textMuted">{fr.player.shot(index + 1, segs.length)}</Text>
            {/* Layers over the frame, placed as the export will (fractions of 1080 × 1920). */}
            {layers.map(l => (
              <View key={l.id} style={[styles.layer, { left: (l.x - l.w / 2) * width, top: (l.y - l.h / 2) * height, width: l.w * width, height: l.h * height, opacity: l.opacite, borderRadius: l.arrondi * Math.min(l.w * width, l.h * height), backgroundColor: c.surfaceRaised, borderColor: c.text }]} />
            ))}
          </View>
        } />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { paddingTop: file.zone.y * k, paddingBottom: (H - file.zone.y - file.zone.h) * k, paddingLeft: file.zone.x * k, paddingRight: (W - file.zone.x - file.zone.w) * k }]}>
        {(["haut", "centre", "bas"] as const).map(pos => (
          <View key={pos} style={[styles.flex, { justifyContent: POSITION[pos] }]}>
            {textsAt(timeline, time).filter(x => x.position === pos).map(x => x.accent && duo
              ? <DuoTitle key={x.texte} duo={duo} texte={x.texte} accent={x.accent} variant="headline" />
              : <Text key={x.texte} variant={x.style === "accroche" || x.style === "titre" ? "headline" : "callout"} tone="onMedia" style={styles.text} numberOfLines={3}>{x.texte}</Text>)}
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { borderRadius: tokens.radius.card, overflow: "hidden" },
  center: { alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  text: { textAlign: "center" },
  layer: { position: "absolute", borderWidth: tokens.size.border },
});
