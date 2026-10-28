import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { fr } from "../../copy/fr";
import { tokens } from "../tokens";
import { Text } from "../Text";
import { LogoLabel, LogoSlash } from "./Logo";
import { useTheme } from "../theme";

// The opening of the app (Ryan, 28 octobre 2026), with logo 15 « Ma / DA étiquette »: « Ma » rises,
// the gradient slash cuts through like scissors between two shots, the « DA » camera label lands, then the whole
// logo fades into the home screen. Under a second; with « Réduire les animations », nothing moves.
// The native splash is plain white, so the logo only ever appears through this animation.
export function Intro({ onDone }: { onDone: () => void }) {
  const { c, motion, reduceMotion } = useTheme();
  const ma = useRef(new Animated.Value(0)).current;
  const cut = useRef(new Animated.Value(0)).current;
  const label = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) { onDone(); return; }
    const ease = Easing.out(Easing.cubic);
    const anim = Animated.sequence([
      Animated.timing(ma, { toValue: 1, duration: motion.fast, easing: ease, useNativeDriver: true }),
      Animated.timing(cut, { toValue: 1, duration: motion.fast, easing: ease, useNativeDriver: true }),
      Animated.spring(label, { toValue: 1, ...motion.spring, useNativeDriver: true }),
      Animated.delay(motion.base),
      Animated.timing(out, { toValue: 0, duration: motion.fast, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => finished && onDone());
    return () => anim.stop();
  }, []);

  const rise = (v: Animated.Value) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [tokens.space.xs, 0] }) }] });
  return (
    <Animated.View pointerEvents="none" accessibilityLabel={fr.app.name} style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.bg, opacity: out }]}>
      <View style={styles.row}>
        <Animated.View style={rise(ma)}><Text variant="logo">{fr.intro.ma}</Text></Animated.View>
        {/* The slash sweeps in from above, like a cut. */}
        <Animated.View style={{ opacity: cut, transform: [{ translateY: cut.interpolate({ inputRange: [0, 1], outputRange: [-tokens.space.md, 0] }) }, { translateX: cut.interpolate({ inputRange: [0, 1], outputRange: [tokens.space.xs, 0] }) }] }}>
          <LogoSlash />
        </Animated.View>
        <Animated.View style={{ opacity: label, transform: [{ scale: label.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
          <LogoLabel />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", zIndex: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: tokens.space.xxs },
});
