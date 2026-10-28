import { useEffect, useRef } from "react";
import { Animated, type DimensionValue, type ViewStyle } from "react-native";
import { tokens } from "../tokens";
import { useTheme } from "../theme";

// A grey shape where content is coming, breathing slowly, instead of a spinner (étude de la refonte,
// « Attendre sans s'ennuyer »). Still with « Réduire les animations ».
export function Skeleton({ width = "100%", height = tokens.size.skeletonLine, radius = tokens.radius.chip, style }: { width?: DimensionValue; height?: DimensionValue; radius?: number; style?: ViewStyle }) {
  const { c, motion, opacity, reduceMotion } = useTheme();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: opacity.pulseLow, duration: motion.pulse, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: motion.pulse, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduceMotion]);
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width, height, borderRadius: radius, backgroundColor: c.surfaceRaised, opacity: v }, style]} />;
}
