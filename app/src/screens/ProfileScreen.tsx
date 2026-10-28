import { Pressable, StyleSheet, View } from "react-native";
import { PROFILS, type Profil } from "../../../core/brand";
import { fr } from "../copy/fr";
import { Button, MadaSays, Screen, Text, tokens, useTheme } from "../design";

type Props = { profil: Profil | null; onChange: (p: Profil) => void; onBack: () => void; onNext: () => void };

// Onboarding 2 (étude, ch. 7 « Métier ») : the one required answer. It picks the questions that
// follow and the house style to start from; MaDa answers at once, without AI.
export function ProfileScreen({ profil, onChange, onBack, onNext }: Props) {
  const { c, opacity } = useTheme();
  const t = fr.dna.profile;
  return (
    <Screen title={t.title} detail={t.detail} onBack={onBack}
      footer={<Button label={fr.nav.next} disabled={!profil} onPress={onNext} haptic />}>
      <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel={t.title}>
        {PROFILS.map(p => {
          const on = profil === p;
          return (
            <Pressable key={p} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(p)}
              style={({ pressed }) => [styles.option, { borderColor: on ? c.action : c.line, backgroundColor: on ? c.surfaceRaised : c.surface, opacity: pressed ? opacity.pressed : 1 }]}>
              <View style={[styles.dot, { borderColor: on ? c.action : c.line, backgroundColor: on ? c.action : "transparent" }]} />
              <Text variant="bodyStrong" style={styles.flex}>{t.names[p]}</Text>
            </Pressable>
          );
        })}
      </View>
      {profil ? <MadaSays text={t.reactions[profil]} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: tokens.space.xs },
  option: { flexDirection: "row", alignItems: "center", gap: tokens.space.sm, minHeight: tokens.size.button, paddingHorizontal: tokens.space.md, borderRadius: tokens.radius.button, borderWidth: tokens.size.border },
  dot: { width: tokens.space.md, height: tokens.space.md, borderRadius: tokens.radius.full, borderWidth: tokens.size.selection },
  flex: { flex: 1 },
});
