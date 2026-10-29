import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import { fr } from "../copy/fr";
import { Gradient, Icon, Text, tokens, useTheme } from "../design";

const shots = fr.dna.welcome.hero;
const HOLD = 2400;

// The first page's picture (Ryan, 29 octobre : « la page n'est pas dynamique, ne donne pas envie »):
// a Reel being made. Rushes wait on either side, a plan cuts into the 9:16 frame, its title in duo
// writes itself letter by letter, the strip under the frame fills shot after shot, then the next trade.
// With « Réduire les animations », one finished Reel and nothing moves.
export function Hero() {
  const { c, motion, reduceMotion } = useTheme();
  const { width: W } = useWindowDimensions();
  const w = Math.min(W * 0.42, tokens.layout.largePhoneWidth * 0.45), h = (w * 16) / 9;
  const [k, setK] = useState(0);
  const [typed, setTyped] = useState(reduceMotion ? shots[0].title.length : 0);
  const cut = useRef(new Animated.Value(1)).current;
  const accent = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const strip = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: HOLD, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: HOLD, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    const t = setInterval(() => setK(x => (x + 1) % shots.length), HOLD);
    return () => { loop.stop(); clearInterval(t); };
  }, [reduceMotion]);

  // Each new shot: the cut slides in, the title types, the accent word fades in, the strip fills.
  useEffect(() => {
    if (reduceMotion) return;
    cut.setValue(0); accent.setValue(0); strip.setValue(0); setTyped(0);
    Animated.timing(cut, { toValue: 1, duration: motion.base, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(strip, { toValue: 1, duration: HOLD, easing: Easing.linear, useNativeDriver: false }).start();
    const title = shots[k].title;
    let n = 0;
    const t = setInterval(() => {
      n += 1; setTyped(n);
      if (n >= title.length) { clearInterval(t); Animated.timing(accent, { toValue: 1, duration: motion.base, useNativeDriver: true }).start(); }
    }, motion.fast / 4);
    return () => clearInterval(t);
  }, [k, reduceMotion]);

  const s = shots[k], before = shots[(k + shots.length - 1) % shots.length];
  const slide = cut.interpolate({ inputRange: [0, 1], outputRange: [w, 0] });
  const bob = (d: number) => float.interpolate({ inputRange: [0, 1], outputRange: [0, d] });
  const side = w * 0.5;
  return (
    <View style={[styles.root, { height: h + tokens.space.xl }]} accessible accessibilityRole="image" accessibilityLabel={fr.dna.welcome.heroLabel}>
      {/* Rushes waiting on each side, drifting a little. */}
      <Animated.View style={[styles.rush, { width: side, height: side * 1.3, left: (W - w) / 2 - side * 0.9, top: h * 0.18, backgroundColor: c.surfaceRaised, transform: [{ rotate: "-8deg" }, { translateY: bob(-tokens.space.sm) }] }]}>
        <Icon name={shots[(k + 1) % shots.length].icon} tone="textMuted" />
      </Animated.View>
      <Animated.View style={[styles.rush, { width: side, height: side * 1.3, right: (W - w) / 2 - side * 0.9, top: h * 0.42, backgroundColor: c.surfaceRaised, transform: [{ rotate: "7deg" }, { translateY: bob(tokens.space.sm) }] }]}>
        <Icon name={shots[(k + 2) % shots.length].icon} tone="textMuted" />
      </Animated.View>
      <View style={[styles.frame, { width: w, height: h, backgroundColor: c.media, borderColor: c.line }]}>
        <Shot icon={before.icon} w={w} k={k + shots.length - 1} />
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: slide }] }]}>
          <Shot icon={s.icon} w={w} k={k} />
        </Animated.View>
        <View style={styles.duo}>
          <Text variant="headline" tone="onMedia" numberOfLines={1}>{s.title.slice(0, typed)}</Text>
          <Animated.Text style={[styles.accent, { color: c.onMedia, opacity: accent }]} numberOfLines={1}>{s.accent}</Animated.Text>
        </View>
      </View>
      {/* The strip: one segment per shot, the current one filling. */}
      <View style={[styles.strip, { width: w }]}>
        {shots.map((x, i) => (
          <View key={x.title} style={[styles.segment, { backgroundColor: c.surfaceRaised }]}>
            {i < k ? <Gradient /> : i === k ? <Animated.View style={[styles.fill, { width: strip.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]}><Gradient /></Animated.View> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

// One plan of the Reel: the Ma DA gradient, deeper or lighter for each, and the trade's mark large.
function Shot({ icon, w, k }: { icon: (typeof shots)[number]["icon"]; w: number; k: number }) {
  const { c } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, styles.shot, { backgroundColor: c.media }]}>
      <View style={[StyleSheet.absoluteFill, { opacity: 0.45 + (k % 3) * 0.2 }]}><Gradient /></View>
      <Icon name={icon} tone="onMedia" size={w * 0.38} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "flex-start", overflow: "visible" },
  rush: { position: "absolute", borderRadius: tokens.radius.card, alignItems: "center", justifyContent: "center" },
  frame: { borderRadius: tokens.radius.card, borderWidth: tokens.size.border, overflow: "hidden" },
  shot: { alignItems: "center", justifyContent: "center" },
  duo: { position: "absolute", left: tokens.space.sm, right: tokens.space.sm, bottom: tokens.space.lg, gap: 0 },
  accent: { fontFamily: tokens.font.displayItalic, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight },
  strip: { flexDirection: "row", gap: tokens.space.xxs, marginTop: tokens.space.sm },
  segment: { flex: 1, height: tokens.size.textBar, borderRadius: tokens.radius.full, overflow: "hidden" },
  fill: { height: "100%", overflow: "hidden" },
});
