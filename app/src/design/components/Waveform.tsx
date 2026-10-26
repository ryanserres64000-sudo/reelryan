import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { fr } from "../../copy/fr";
import { tokens } from "../tokens";
import { Chip } from "./Chip";
import { Text } from "../Text";
import { useTheme } from "../theme";

type Props = { peaks: number[]; duration: number; start: number; length: number; downbeats?: number[]; onLengthChange?: (s: number) => void };

// 2 pt bars 1 pt apart, the chosen passage in gold, the rest muted at 40 %, 44 pt handles,
// downbeats as thin ticks, 15 / 30 / 60 s chips above (étude, ch. 6 §4 ; dragging comes with lot 3).
export function Waveform({ peaks, duration, start, length, downbeats = [], onLengthChange }: Props) {
  const { c, size, opacity } = useTheme();
  const [width, setWidth] = useState(0);
  const step = size.waveBar + size.waveGap;
  const count = Math.max(1, Math.floor(width / step));
  const bars = Array.from({ length: count }, (_, i) => peaks[Math.floor((i / count) * peaks.length)] ?? 0);
  const x = (t: number) => (t / duration) * width;
  const inside = (i: number) => { const t = (i / count) * duration; return t >= start && t < start + length; };
  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {fr.music.lengths.map(s => <Chip key={s} label={fr.music.length(s)} selected={s === length} onPress={() => onLengthChange?.(s)} />)}
      </View>
      <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={styles.wave} accessibilityLabel={fr.music.passage}>
        {width ? (
          <Svg width={width} height={size.waveHeight}>
            {downbeats.map((b, i) => <Line key={"d" + i} x1={x(b)} x2={x(b)} y1={0} y2={size.waveHeight} stroke={c.line} strokeWidth={size.border} />)}
            {bars.map((p, i) => {
              const h = Math.max(size.waveBar, p * size.waveHeight);
              return <Rect key={i} x={i * step} y={(size.waveHeight - h) / 2} width={size.waveBar} height={h} rx={size.waveBar / 2}
                fill={inside(i) ? c.actionStrong : c.textMuted} opacity={inside(i) ? 1 : opacity.waveOutside} />;
            })}
          </Svg>
        ) : null}
        {width ? [start, start + length].map((t, i) => (
          <View key={i} style={[styles.handle, { left: x(t) - size.touch / 2 }]}>
            <View style={[styles.grip, { backgroundColor: c.actionStrong }]} />
          </View>
        )) : null}
      </View>
      <Text variant="caption" tone="textMuted">{fr.music.passage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.xs },
  chips: { flexDirection: "row", gap: tokens.space.xs },
  wave: { height: tokens.size.waveHeight },
  handle: { position: "absolute", top: 0, bottom: 0, width: tokens.size.touch, alignItems: "center" },
  grip: { width: tokens.size.selection, height: tokens.size.waveHeight, borderRadius: tokens.size.selection },
});
