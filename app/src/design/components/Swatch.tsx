import { Pressable, StyleSheet } from "react-native";
import { tokens } from "../tokens";
import { useTheme } from "../theme";

// A brand colour, read from the person's logo: it is data, not a design token.
// With `selected`, the picked one is outlined in gold (visual editor, lot 6).
export function Swatch({ color, label, onPress, selected }: { color: string; label: string; onPress?: () => void; selected?: boolean }) {
  const { c, opacity } = useTheme();
  return (
    <Pressable accessibilityRole={onPress ? "button" : "image"} accessibilityLabel={label} accessibilityState={onPress ? { selected: !!selected } : undefined} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [styles.base, { backgroundColor: color, borderColor: selected ? c.action : c.line, opacity: pressed ? opacity.pressed : 1 }, selected ? styles.selected : null]} />
  );
}

const styles = StyleSheet.create({
  selected: { borderWidth: tokens.size.selection },
  base: { width: tokens.size.button, height: tokens.size.button, borderRadius: tokens.radius.button, borderWidth: tokens.size.border },
});
