import { useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { fr } from "../../copy/fr";
import { tokens } from "../tokens";
import { Text } from "../Text";
import { useTheme } from "../theme";

export type FriseShot = { id: string; duration: number; thumbnail?: ImageSourcePropType; changed?: boolean };
export type FriseText = { start: number; end: number; label: string };
type Props = { shots: FriseShot[]; beats?: number[]; texts?: FriseText[]; selected?: number; onSelect?: (i: number) => void };

// Blocks proportional to their duration, gold dots on the beats, texts as lavender pills above,
// what MaDa just changed highlighted for 2 s (étude, ch. 6 §4 ; ch. 5 §6). With `onSelect`, a tap
// picks a shot to adjust by hand (lot 5) and the picked one is outlined in gold.
export function Frise({ shots, beats = [], texts = [], selected, onSelect }: Props) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const total = shots.reduce((s, x) => s + x.duration, 0) || 1;
  const px = (t: number) => (t / total) * width;
  return (
    <View accessibilityLabel={fr.frise.label} onLayout={e => setWidth(e.nativeEvent.layout.width)} style={styles.wrap}>
      <View style={styles.texts}>
        {width ? texts.map((t, i) => (
          <View key={i} style={[styles.textPill, { left: px(t.start), width: Math.max(px(t.end - t.start), tokens.size.touch), borderColor: c.ai }]}>
            <Text variant="caption" tone="ai" numberOfLines={1}>{t.label}</Text>
          </View>
        )) : null}
      </View>
      <View style={styles.track}>
        {shots.map((s, i) => <Block key={s.id} shot={s} index={i + 1} width={px(s.duration)} selected={selected === i} onPress={onSelect ? () => onSelect(i) : undefined} />)}
      </View>
      <View style={styles.beats}>
        {width ? beats.filter(b => b <= total).map((b, i) => (
          <View key={i} accessibilityLabel={fr.frise.beat} style={[styles.beat, { left: px(b) - tokens.size.beatDot / 2, backgroundColor: c.actionStrong }]} />
        )) : null}
      </View>
    </View>
  );
}

function Block({ shot, index, width, selected, onPress }: { shot: FriseShot; index: number; width: number; selected: boolean; onPress?: () => void }) {
  const { c, motion, reduceMotion } = useTheme();
  const glow = useRef(new Animated.Value(shot.changed ? 1 : 0)).current;
  useEffect(() => {
    if (!shot.changed) return;
    glow.setValue(1);
    Animated.timing(glow, { toValue: 0, duration: reduceMotion ? motion.base : motion.highlight, useNativeDriver: false }).start();
  }, [shot.changed]);
  return (
    <Pressable accessibilityLabel={fr.frise.shot(index, shot.duration)} accessibilityRole={onPress ? "button" : undefined} accessibilityState={onPress ? { selected } : undefined}
      disabled={!onPress} onPress={onPress} style={[styles.block, { width, backgroundColor: c.surfaceRaised, borderColor: c.line }]}>
      {shot.thumbnail ? <Image source={shot.thumbnail} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow, { borderColor: c.ai, opacity: glow }]} />
      {selected ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow, { borderColor: c.action }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.xxs },
  texts: { height: tokens.size.pill },
  textPill: { position: "absolute", height: tokens.size.pill, borderWidth: tokens.size.border, borderRadius: tokens.radius.chip, paddingHorizontal: tokens.space.xxs, justifyContent: "center" },
  track: { flexDirection: "row", height: tokens.size.frise, borderRadius: tokens.radius.chip, overflow: "hidden" },
  block: { height: tokens.size.frise, borderRightWidth: tokens.size.border, overflow: "hidden" },
  glow: { borderWidth: tokens.size.selection, borderRadius: tokens.radius.chip },
  beats: { height: tokens.size.beatDot },
  beat: { position: "absolute", width: tokens.size.beatDot, height: tokens.size.beatDot, borderRadius: tokens.radius.full },
});
