import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, type LayoutRectangle } from "react-native";
import Svg, { Defs, LinearGradient, Polyline, Stop } from "react-native-svg";
import { fr } from "../../copy/fr";
import { tokens } from "../tokens";
import { Text } from "../Text";
import { useTheme } from "../theme";
import { Butterfly } from "./Butterfly";
import { LogoLabel, LogoSlash } from "./Logo";

// The opening of the app (Ryan, 28 octobre 2026), with logo 15 « Ma / DA étiquette » (proposition B2):
// « Ma » rises, the gradient slash cuts through like scissors between two shots, the « DA » camera label
// lands; then a butterfly flies up from the bottom of the screen, unrolling a strip of film behind it,
// and lands on the camera's viewfinder bump. The film fades, the whole logo fades into the home screen.
// About two and a half seconds; with « Réduire les animations », nothing moves.
// The native splash is plain white, so the logo only ever appears through this animation.
const N = 48;
const half = tokens.size.butterfly / 2;
const bump = (64.5 - 51) / 36; // where the viewfinder bump sits along the label (Logo.tsx geometry)

type Pt = { x: number; y: number; a: number };
// The flight: a cubic Bézier from below the screen to the bump, sampled once, with the heading at each point.
function flight(w: number, h: number, to: { x: number; y: number }): Pt[] {
  const p0 = { x: to.x - w * 0.22, y: h + tokens.size.butterfly }, p1 = { x: to.x + w * 0.42, y: h * 0.72 };
  const p2 = { x: to.x - w * 0.34, y: to.y + h * 0.16 }, p3 = to;
  const at = (t: number, k: "x" | "y") => (1 - t) ** 3 * p0[k] + 3 * (1 - t) ** 2 * t * p1[k] + 3 * (1 - t) * t ** 2 * p2[k] + t ** 3 * p3[k];
  return Array.from({ length: N + 1 }, (_, i) => {
    const t = i / N, e = Math.min(1, t + 1 / N), b = Math.max(0, t - 1 / N);
    // Upright once landed; along the path before.
    const a = i === N ? 0 : (Math.atan2(at(e, "x") - at(b, "x"), at(b, "y") - at(e, "y")) * 180) / Math.PI;
    return { x: at(t, "x"), y: at(t, "y"), a };
  });
}

export function Intro({ onDone }: { onDone: () => void }) {
  const { c, g, motion, reduceMotion } = useTheme();
  const ma = useRef(new Animated.Value(0)).current;
  const cut = useRef(new Animated.Value(0)).current;
  const label = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  const flap = useRef(new Animated.Value(1)).current;
  const film = useRef(new Animated.Value(1)).current;
  const out = useRef(new Animated.Value(1)).current;
  const [screen, setScreen] = useState<LayoutRectangle | null>(null);
  const [row, setRow] = useState<LayoutRectangle | null>(null);
  const [tag, setTag] = useState<LayoutRectangle | null>(null);
  const [drawn, setDrawn] = useState(0);

  const path = useMemo(() => screen && row && tag
    ? flight(screen.width, screen.height, { x: row.x + tag.x + tag.width * bump, y: row.y + tag.y - half * 0.6 })
    : null, [screen, row, tag]);

  useEffect(() => {
    if (reduceMotion) { onDone(); return; }
    if (!path) return;
    const ease = Easing.out(Easing.cubic);
    const id = fly.addListener(({ value }) => setDrawn(Math.round(value * N)));
    const beat = Animated.loop(Animated.sequence([
      Animated.timing(flap, { toValue: 0, duration: motion.flap, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(flap, { toValue: 1, duration: motion.flap, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    const anim = Animated.sequence([
      Animated.timing(ma, { toValue: 1, duration: motion.fast, easing: ease, useNativeDriver: true }),
      Animated.timing(cut, { toValue: 1, duration: motion.fast, easing: ease, useNativeDriver: true }),
      Animated.spring(label, { toValue: 1, ...motion.spring, useNativeDriver: true }),
      Animated.timing(fly, { toValue: 1, duration: motion.flight, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      // Landed: the wings close once and open slowly, the film fades.
      Animated.parallel([
        Animated.sequence([
          Animated.timing(flap, { toValue: 0.35, duration: motion.fast, useNativeDriver: true }),
          Animated.timing(flap, { toValue: 1, duration: motion.slow, easing: ease, useNativeDriver: true }),
        ]),
        Animated.timing(film, { toValue: 0, duration: motion.slow, useNativeDriver: true }),
      ]),
      Animated.delay(motion.base),
      Animated.timing(out, { toValue: 0, duration: motion.fast, useNativeDriver: true }),
    ]);
    const beating = setTimeout(() => beat.start(), motion.fast * 2 + motion.base);
    const landing = setTimeout(() => beat.stop(), motion.fast * 2 + motion.base + motion.flight);
    anim.start(({ finished }) => finished && onDone());
    return () => { anim.stop(); beat.stop(); clearTimeout(beating); clearTimeout(landing); fly.removeListener(id); };
  }, [path]);

  const rise = (v: Animated.Value) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [tokens.space.xs, 0] }) }] });
  const along = (k: "x" | "y" | "a") => path
    ? fly.interpolate({ inputRange: path.map((_, i) => i / N), outputRange: path.map(p => (k === "a" ? `${p.a}deg` : p[k] - half)) as never })
    : 0;
  const trail = path ? [...path.slice(0, drawn + 1)].map(p => `${p.x},${p.y}`).join(" ") : "";

  return (
    <Animated.View pointerEvents="none" accessibilityLabel={fr.app.name} onLayout={e => setScreen(e.nativeEvent.layout)}
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.bg, opacity: out }]}>
      {path && screen ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: film }]}>
          <Svg width={screen.width} height={screen.height}>
            <Defs>
              <LinearGradient id="introFilm" gradientUnits="userSpaceOnUse" x1={path[0].x} y1={path[0].y} x2={path[N].x} y2={path[N].y}>
                {g.map((s, i) => <Stop key={s} offset={i / (g.length - 1)} stopColor={s} />)}
              </LinearGradient>
            </Defs>
            {/* A strip of film: the band in the gradient, its perforations in white. */}
            <Polyline points={trail} fill="none" stroke="url(#introFilm)" strokeWidth={tokens.size.butterfly / 2.4} strokeLinejoin="round" strokeOpacity={0.9} />
            <Polyline points={trail} fill="none" stroke={c.bg} strokeWidth={tokens.size.butterfly / 10} strokeDasharray={[tokens.space.xxs, tokens.space.xxs]} />
          </Svg>
        </Animated.View>
      ) : null}
      <View style={styles.row} onLayout={e => setRow(e.nativeEvent.layout)}>
        <Animated.View style={rise(ma)}><Text variant="logo">{fr.intro.ma}</Text></Animated.View>
        {/* The slash sweeps in from above, like a cut. */}
        <Animated.View style={{ opacity: cut, transform: [{ translateY: cut.interpolate({ inputRange: [0, 1], outputRange: [-tokens.space.md, 0] }) }, { translateX: cut.interpolate({ inputRange: [0, 1], outputRange: [tokens.space.xs, 0] }) }] }}>
          <LogoSlash />
        </Animated.View>
        <Animated.View onLayout={e => setTag(e.nativeEvent.layout)} style={{ opacity: label, transform: [{ scale: label.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
          <LogoLabel />
        </Animated.View>
      </View>
      {path ? (
        <Animated.View style={[styles.butterfly, { transform: [{ translateX: along("x") }, { translateY: along("y") }, { rotate: along("a") }] as never }]}>
          <Butterfly flap={flap} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", zIndex: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: tokens.space.xxs },
  butterfly: { position: "absolute", left: 0, top: 0 },
});
