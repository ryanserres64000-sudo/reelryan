import { Pressable, StyleSheet, type PressableProps } from "react-native";
import { haptic } from "../haptics";
import { tokens } from "../tokens";
import { Text } from "../Text";
import { useTheme } from "../theme";
import { Gradient } from "./Gradient";

type Props = Omit<PressableProps, "children"> & { label: string; selected?: boolean; kind?: "user" | "ai" };

// A user choice fills with the Ma DA gradient when picked; a Ma DA suggestion is outlined in its first
// colour (« Atelier clair » : une seule couleur d'action).
export function Chip({ label, selected = false, kind = "user", style, onPress, ...rest }: Props) {
  const { c, opacity } = useTheme();
  const ai = kind === "ai";
  const on = selected && !ai;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      // A selection tick, like the iOS pickers.
      onPress={e => { haptic("tick"); onPress?.(e); }}
      style={state => [
        styles.base,
        { borderColor: ai ? c.ai : on ? c.action : c.line, backgroundColor: on ? c.action : "transparent", overflow: "hidden", opacity: state.pressed ? opacity.pressed : 1 },
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      {on ? <Gradient /> : null}
      <Text variant="callout" tone={on ? "onAction" : ai ? "ai" : "text"}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: tokens.size.touch, paddingHorizontal: tokens.space.sm, borderRadius: tokens.radius.full, borderWidth: tokens.size.border, alignItems: "center", justifyContent: "center" },
});
