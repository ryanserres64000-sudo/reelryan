import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { tokens } from "../tokens";
import { Text } from "../Text";
import { useTheme } from "../theme";

// What MaDa says, in lavender (étude, ch. 6 §3 : la lavande pour ce que fait l'IA). Fades in when the
// words change, so an answer gets a visible reply; with « Réduire les animations », it just appears.
export function MadaSays({ text }: { text: string }) {
  const { c, motion, reduceMotion } = useTheme();
  const o = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    o.setValue(0);
    Animated.timing(o, { toValue: 1, duration: motion.base, useNativeDriver: true }).start();
  }, [text, reduceMotion]);
  return (
    <Animated.View accessibilityLiveRegion="polite" style={[styles.row, { opacity: o }]}>
      <View style={[styles.bar, { backgroundColor: c.ai }]} />
      <Text tone="ai" style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: tokens.space.sm },
  bar: { width: tokens.size.selection, borderRadius: tokens.radius.full },
  text: { flex: 1 },
});
