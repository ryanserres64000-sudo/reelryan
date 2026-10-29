import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { PROFIL_GROUPES, type Profil } from "../../../core/brand";
import { fr } from "../copy/fr";
import { Button, Gradient, Icon, MadaSays, Screen, Text, haptic, tokens, useTheme } from "../design";

type Props = { profil: Profil | null; onChange: (p: Profil) => void; onBack?: () => void; onNext: () => void };
const t = fr.dna.profile;

// Onboarding 2 (étude, ch. 7 « Métier ») : the one required answer. Eleven trades in four families
// (Ryan, 29 octobre : « bien balayer nos segments de clients »), each card with its icon and a line of
// examples so everyone finds themselves. Ma DA answers at once, without AI, with a line of her own.
export function ProfileScreen({ profil, onChange, onBack, onNext }: Props) {
  return (
    <Screen title={t.title} detail={t.detail} onBack={onBack}
      footer={<>
        {profil ? <MadaSays text={t.reactions[profil]} /> : null}
        <Button label={fr.nav.next} disabled={!profil} onPress={onNext} haptic />
      </>}>
      {PROFIL_GROUPES.map((g, gi) => (
        <View key={g.id} style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={t.groups[g.id]}>
          <Text variant="headline">{t.groups[g.id]}</Text>
          <View style={styles.grid}>
            {g.profils.map((p, i) => <Card key={p} p={p} wide={i === g.profils.length - 1 && g.profils.length % 2 === 1} on={profil === p} delay={(gi * 3 + i) * tokens.motion.stagger} onPress={() => onChange(p)} />)}
          </View>
        </View>
      ))}
    </Screen>
  );
}

// The last card of an odd family runs across the row, its icon on the left.
function Card({ p, on, wide, delay, onPress }: { p: Profil; on: boolean; wide: boolean; delay: number; onPress: () => void }) {
  const { c, motion, reduceMotion, opacity } = useTheme();
  // The cards come in one after the other, and the chosen one pops a little.
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => { if (!reduceMotion) Animated.timing(enter, { toValue: 1, duration: motion.base, delay, useNativeDriver: true }).start(); }, []);
  useEffect(() => {
    if (!on || reduceMotion) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: motion.popScale, duration: motion.fast, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, ...motion.spring, useNativeDriver: true }),
    ]).start();
  }, [on]);
  const lift = enter.interpolate({ inputRange: [0, 1], outputRange: [tokens.space.sm, 0] });
  return (
    <Animated.View style={[wide ? styles.wideCell : styles.cell, { opacity: enter, transform: [{ translateY: lift }, { scale }] }]}>
      <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${t.names[p]}. ${t.examples[p]}`}
        onPress={() => { haptic("tick"); onPress(); }}
        style={({ pressed }) => [styles.card, wide && styles.wideCard, { borderColor: on ? c.action : c.line, backgroundColor: c.surface, opacity: pressed ? opacity.pressed : 1 }]}>
        {on ? <Gradient /> : null}
        <View style={[styles.icon, { backgroundColor: on ? c.scrim : c.bg }]}>
          <Icon name={t.icons[p]} tone={on ? "onAction" : "text"} />
        </View>
        <View style={wide ? styles.flex : styles.words}>
          <Text variant="bodyStrong" tone={on ? "onAction" : "text"}>{t.names[p]}</Text>
          <Text variant="caption" tone={on ? "onAction" : "textMuted"} numberOfLines={2}>{t.examples[p]}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  group: { gap: tokens.space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs },
  cell: { flexBasis: "47%", flexGrow: 1 },
  wideCell: { flexBasis: "100%" },
  wideCard: { minHeight: 0, flexDirection: "row", alignItems: "center", gap: tokens.space.sm },
  words: { gap: tokens.space.xxs },
  flex: { flex: 1, gap: tokens.space.xxs },
  card: { minHeight: tokens.size.button * 2.6, padding: tokens.space.sm, gap: tokens.space.xs, borderRadius: tokens.radius.card, borderWidth: tokens.size.border, overflow: "hidden" },
  icon: { width: tokens.size.touch, height: tokens.size.touch, borderRadius: tokens.radius.full, alignItems: "center", justifyContent: "center", },
});
