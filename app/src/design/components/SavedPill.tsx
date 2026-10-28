import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { fr } from "../../copy/fr";
import { tokens } from "../tokens";
import { Text } from "../Text";
import { useTheme } from "../theme";

// « Enregistré » fades in after each save (étude, ch. 6 §3 ; ch. 3 n°3).
export function SavedPill({ visible }: { visible: boolean }) {
  const { c, motion } = useTheme();
  const o = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => { Animated.timing(o, { toValue: visible ? 1 : 0, duration: motion.fast, useNativeDriver: true }).start(); }, [visible]);
  return (
    <Animated.View accessibilityLiveRegion="polite" accessibilityElementsHidden={!visible} style={[styles.pill, { opacity: o, backgroundColor: c.surfaceRaised, borderColor: c.line }]}>
      <View style={[styles.dot, { backgroundColor: c.ok }]} />
      <Text variant="caption" tone="textMuted">{fr.status.saved}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: tokens.space.xs, height: tokens.size.pill, paddingHorizontal: tokens.space.sm, borderRadius: tokens.radius.full, borderWidth: tokens.size.border },
  dot: { width: tokens.size.beatDot, height: tokens.size.beatDot, borderRadius: tokens.radius.full },
});
