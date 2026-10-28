import { Pressable, StyleSheet } from "react-native";
import { tokens } from "../tokens";
import { useTheme } from "../theme";

// A brand colour, read from the person's logo: it is data, not a design token.
export function Swatch({ color, label, onPress }: { color: string; label: string; onPress?: () => void }) {
  const { c, opacity } = useTheme();
  return (
    <Pressable accessibilityRole={onPress ? "button" : "image"} accessibilityLabel={label} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [styles.base, { backgroundColor: color, borderColor: c.line, opacity: pressed ? opacity.pressed : 1 }]} />
  );
}

const styles = StyleSheet.create({
  base: { width: tokens.size.button, height: tokens.size.button, borderRadius: tokens.radius.button, borderWidth: tokens.size.border },
});
