import * as Haptics from "expo-haptics";
import { Platform, Pressable, StyleSheet, type PressableProps } from "react-native";
import { tokens } from "../tokens";
import { Text } from "../Text";
import { useTheme } from "../theme";

type Props = Omit<PressableProps, "children"> & { label: string; variant?: "primary" | "secondary"; haptic?: boolean };

// Primary: the blue, one per screen, full width at the bottom. Secondary: 1 pt outline. Both are capsules
// (« Atelier clair »).
export function Button({ label, variant = "primary", haptic = false, disabled, onPress, style, ...rest }: Props) {
  const { c, opacity } = useTheme();
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={e => { if (haptic && Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress?.(e); }}
      style={state => [
        styles.base,
        primary ? { backgroundColor: c.action } : { borderWidth: tokens.size.border, borderColor: c.line },
        { opacity: disabled ? opacity.disabled : state.pressed ? opacity.pressed : 1 },
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      <Text variant="button" tone={primary ? "onAction" : "text"} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: tokens.size.button, borderRadius: tokens.radius.full, paddingHorizontal: tokens.space.lg, alignItems: "center", justifyContent: "center", alignSelf: "stretch" },
});
