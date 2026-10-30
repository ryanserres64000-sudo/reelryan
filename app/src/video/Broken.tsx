import { StyleSheet, View } from "react-native";
import { fr } from "../copy/fr";
import { Text, tokens, useTheme } from "../design";

// Ryan's first test: when the native render cannot read the edit, the screen says so, with the reason,
// instead of passing one still per shot off as the video. The reason is also in Réglages > Diagnostic.
export function VideoBroken({ message }: { message: string }) {
  const { c } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, styles.box, { backgroundColor: c.media }]} accessibilityRole="alert">
      <Text variant="headline" tone="onMedia" style={styles.center}>{fr.player.broken}</Text>
      <Text variant="caption" tone="onMedia" style={styles.center} numberOfLines={10} selectable>{message}</Text>
      <Text variant="caption" tone="onMedia" style={styles.center}>{fr.player.brokenHelp}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center", gap: tokens.space.sm, padding: tokens.space.lg },
  center: { textAlign: "center" },
});
