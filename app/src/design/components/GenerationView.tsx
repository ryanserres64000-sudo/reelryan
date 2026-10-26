import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { fr } from "../../copy/fr";
import { tokens } from "../tokens";
import { Text } from "../Text";
import { useTheme } from "../theme";

type Props = { rushes: number; kept: number[]; variants?: number; step: number; beat?: number; thumbnails?: ImageSourcePropType[] };

// The wait shows the work (étude, ch. 6 §3 « Motion design » ; ch. 5 §4): the rushes drop onto a strip,
// a lavender line sweeps each one (the triage), the kept shots light up in gold on the music's beat.
// With « Réduire les animations », only fades.
export function GenerationView({ rushes, kept, variants = 3, step, beat = 0.5, thumbnails = [] }: Props) {
  const { c, motion, reduceMotion } = useTheme();
  const steps = fr.generation.steps(rushes, kept.length, variants);
  const anim = useMemo(() => Array.from({ length: rushes }, () => ({ drop: new Animated.Value(0), sweep: new Animated.Value(0), keep: new Animated.Value(0), pulse: new Animated.Value(0) })), [rushes]);
  const orb = useRef(new Animated.Value(0)).current;
  const [cell, setCell] = useState(0);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    const t = (v: Animated.Value, to: number, duration: number, delay = 0) => Animated.timing(v, { toValue: to, duration, delay, easing: ease, useNativeDriver: true });
    let run: Animated.CompositeAnimation | null = null;
    if (step === 0) {
      anim.forEach(a => { a.drop.setValue(0); a.sweep.setValue(0); a.keep.setValue(0); });
      run = Animated.parallel(anim.flatMap((a, i) => [
        t(a.drop, 1, motion.slow, i * motion.stagger),
        reduceMotion ? t(a.sweep, 0, 0) : Animated.sequence([Animated.delay(rushes * motion.stagger + i * motion.base), t(a.sweep, 1, motion.slow)]),
      ]));
    } else if (step >= 1) {
      anim.forEach(a => { a.drop.setValue(1); a.sweep.setValue(0); });
      run = Animated.parallel(anim.map((a, i) => t(a.keep, kept.includes(i) ? 1 : -1, motion.base, reduceMotion ? 0 : kept.indexOf(i) * beat * 1000)));
      if (!reduceMotion && step < 4) {
        const loop = Animated.loop(Animated.stagger(beat * 1000, kept.map(i => Animated.sequence([t(anim[i].pulse, 1, motion.fast), t(anim[i].pulse, 0, motion.fast)]))));
        run = Animated.parallel([run, loop]);
      }
    }
    run?.start();
    const o = Animated.loop(Animated.sequence([t(orb, 1, motion.slow * 2), t(orb, 0, motion.slow * 2)]));
    if (step < 4 && !reduceMotion) o.start(); else orb.setValue(step < 4 ? 0.5 : 1);
    return () => { run?.stop(); o.stop(); };
  }, [step, rushes, reduceMotion]);

  return (
    <View style={styles.wrap}>
      <View style={styles.strip} onLayout={e => setCell(e.nativeEvent.layout.width / Math.max(1, rushes))}>
        {anim.map((a, i) => (
          <Animated.View key={i} style={[styles.thumb, {
            backgroundColor: c.surfaceRaised, borderColor: c.actionStrong,
            opacity: Animated.multiply(a.drop, a.keep.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.35, 1, 1] })),
            borderWidth: step >= 1 && kept.includes(i) ? tokens.size.selection : 0,
            transform: reduceMotion ? [] : [
              { translateY: a.drop.interpolate({ inputRange: [0, 1], outputRange: [-tokens.space.lg, 0] }) },
              { scale: a.pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
            ],
          }]}>
            {thumbnails[i] ? <Image source={thumbnails[i]} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
            {!reduceMotion && cell ? (
              <Animated.View pointerEvents="none" style={[styles.sweep, { backgroundColor: c.ai, opacity: a.sweep.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] }),
                transform: [{ translateX: a.sweep.interpolate({ inputRange: [0, 1], outputRange: [0, cell - tokens.space.xxs] }) }] }]} />
            ) : null}
          </Animated.View>
        ))}
      </View>
      <View style={styles.steps} accessibilityLiveRegion="polite">
        {steps.map((s, i) => i > step ? null : (
          <View key={i} style={styles.step}>
            {i === step && step < 4 ? <Animated.View style={[styles.orb, { backgroundColor: c.ai, opacity: orb.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }]} />
              : <Text variant="mono" tone={i === step ? "ai" : "textMuted"}>✓</Text>}
            <Text variant={i === step ? "bodyStrong" : "callout"} tone={i === step ? "ai" : "textMuted"}>{s}{i === step && step < 4 ? "…" : ""}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.lg },
  strip: { flexDirection: "row", gap: tokens.space.xxs, height: tokens.size.frise },
  thumb: { flex: 1, borderRadius: tokens.radius.chip, overflow: "hidden" },
  sweep: { position: "absolute", top: 0, bottom: 0, width: tokens.size.selection },
  steps: { gap: tokens.space.xs },
  step: { flexDirection: "row", alignItems: "center", gap: tokens.space.xs, minHeight: tokens.size.touch / 2 },
  orb: { width: tokens.space.sm, height: tokens.space.sm, borderRadius: tokens.radius.full },
});
