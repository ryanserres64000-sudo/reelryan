import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { fr } from "../../copy/fr";
import { tokens } from "../tokens";
import { useTheme } from "../theme";
import { LogoLabel, LogoSlash } from "./Logo";

const H = tokens.type.logo.lineHeight;
// Where the flash dot sits on the label (Logo.tsx: the label's viewBox is 36 × 32.8, the dot at 30.6, 8.4).
const DOT = { x: 30.6 / 36, y: 8.4 / 32.8, r: 1.5 / 32.8 };
const LIFT = "-32deg", FLASH = 3;

// While Ma DA edits (Ryan, build 9 : « un logo animé quelque part, pas trop grand, une idée originale ») :
// the logo's slash is a clapperboard arm. It lifts and snaps down on the camera label on every beat,
// the way the cuts land on the music, and the label's flash dot goes off at each clap. A new step of
// the edit gives a double clap. With « Réduire les animations », the logo stays still.
export function LogoWorking({ step = 0 }: { step?: number }) {
  const { c, motion, reduceMotion } = useTheme();
  const arm = useRef(new Animated.Value(0)).current; // 0 down on the label, 1 lifted
  const flash = useRef(new Animated.Value(0)).current;
  const squeeze = useRef(new Animated.Value(1)).current;

  const clap = () => Animated.parallel([
    Animated.sequence([
      Animated.timing(arm, { toValue: 1, duration: motion.base, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(arm, { toValue: 0, duration: motion.fast / 2, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]),
    Animated.sequence([
      Animated.delay(motion.base + motion.fast / 2),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(flash, { toValue: 1, duration: motion.fast / 4, useNativeDriver: true }),
          Animated.timing(flash, { toValue: 0, duration: motion.base, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(squeeze, { toValue: motion.pressScale, duration: motion.fast / 4, useNativeDriver: true }),
          Animated.spring(squeeze, { toValue: 1, ...motion.spring, useNativeDriver: true }),
        ]),
      ]),
    ]),
  ]);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.sequence([clap(), Animated.delay(motion.pulse)]));
    loop.start();
    return () => loop.stop();
  }, [reduceMotion]);
  // A new step: one more clap at once, on top of the beat.
  useEffect(() => { if (!reduceMotion && step > 0) clap().start(); }, [step]);

  const w = (H * 36) / 32.8, r = DOT.r * H;
  const rotate = arm.interpolate({ inputRange: [0, 1], outputRange: ["0deg", LIFT] });
  const glow = flash.interpolate({ inputRange: [0, 1], outputRange: [1, FLASH] });
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel={fr.generation.logoLabel}>
      {/* The arm turns around its foot, where it meets the label. */}
      <Animated.View style={{ transform: [{ translateY: H / 2 }, { rotate }, { translateY: -H / 2 }] }}>
        <LogoSlash />
      </Animated.View>
      <Animated.View style={{ transform: [{ scale: squeeze }] }}>
        <LogoLabel />
        <Animated.View pointerEvents="none" style={[styles.dot, { left: DOT.x * w - r, top: DOT.y * H - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: c.onAction, opacity: flash, transform: [{ scale: glow }] }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", alignSelf: "center" },
  dot: { position: "absolute" },
});
