import { StyleSheet, View } from "react-native";
import { fr } from "../copy/fr";
import { Button, Screen, Text, tokens } from "../design";

// Onboarding 1 (étude, ch. 7 « Promesse ») : who MaDa is and what sign-up will do, in three lines.
export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const t = fr.dna.welcome;
  return (
    <Screen title={t.title} detail={t.detail}
      footer={<>
        <Text variant="caption" tone="textMuted">{t.privacy}</Text>
        <Button label={t.start} onPress={onStart} haptic />
      </>}>
      <View style={styles.list}>
        {t.points.map((p, i) => (
          <View key={p} style={styles.point}>
            <Text variant="mono" tone="actionStrong">{String(i + 1).padStart(2, "0")}</Text>
            <Text style={styles.flex}>{p}</Text>
          </View>
        ))}
      </View>
      <Text variant="headline" tone="ai">{fr.app.tagline}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: tokens.space.md },
  point: { flexDirection: "row", gap: tokens.space.sm },
  flex: { flex: 1 },
});
