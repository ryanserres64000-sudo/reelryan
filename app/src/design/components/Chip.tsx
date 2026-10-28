import { Pressable, StyleSheet, type PressableProps } from "react-native";
import { tokens } from "../tokens";
import { Text } from "../Text";
import { useTheme } from "../theme";

type Props = Omit<PressableProps, "children"> & { label: string; selected?: boolean; kind?: "user" | "ai" };

// A user choice turns gold when picked; a MaDa suggestion is lavender (étude, ch. 6 §3).
export function Chip({ label, selected = false, kind = "user", style, ...rest }: Props) {
  const { c, opacity } = useTheme();
  const ai = kind === "ai";
  const on = selected && !ai;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={state => [
        styles.base,
        { borderColor: ai ? c.ai : on ? c.action : c.line, backgroundColor: on ? c.action : "transparent", opacity: state.pressed ? opacity.pressed : 1 },
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      <Text variant="callout" tone={on ? "onAction" : ai ? "ai" : "text"}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: tokens.size.touch, paddingHorizontal: tokens.space.sm, borderRadius: tokens.radius.chip, borderWidth: tokens.size.border, alignItems: "center", justifyContent: "center" },
});
