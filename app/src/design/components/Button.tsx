import { useRef } from "react";
import { Animated, Pressable, StyleSheet, type PressableProps } from "react-native";
import { haptic as feel } from "../haptics";
import { tokens } from "../tokens";
import { Text } from "../Text";
import { useTheme } from "../theme";

type Props = Omit<PressableProps, "children"> & { label: string; variant?: "primary" | "secondary"; haptic?: boolean };

// Primary: the blue, one per screen, full width at the bottom. Secondary: 1 pt outline. Both are capsules
// (« Atelier clair »). A press shrinks the button a little and springs it back, with a light tap on
// the primary one, so every touch answers at once.
export function Button({ label, variant = "primary", haptic, disabled, onPress, onPressIn, onPressOut, style, ...rest }: Props) {
  const { c, opacity, motion, reduceMotion } = useTheme();
  const primary = variant === "primary";
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => { if (!reduceMotion) Animated.spring(scale, { toValue: v, ...motion.spring, useNativeDriver: true }).start(); };
  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale }] }, typeof style === "function" ? undefined : style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPressIn={e => { to(motion.pressScale); onPressIn?.(e); }}
        onPressOut={e => { to(1); onPressOut?.(e); }}
        onPress={e => { if (haptic ?? primary) feel("tap"); onPress?.(e); }}
        style={state => [
          styles.base,
          primary ? { backgroundColor: c.action } : { borderWidth: tokens.size.border, borderColor: c.line },
          { opacity: disabled ? opacity.disabled : state.pressed ? opacity.pressed : 1 },
          typeof style === "function" ? style(state) : undefined,
        ]}
        {...rest}
      >
        <Text variant="button" tone={primary ? "onAction" : "text"} numberOfLines={1}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch" },
  base: { minHeight: tokens.size.button, borderRadius: tokens.radius.full, paddingHorizontal: tokens.space.lg, alignItems: "center", justifyContent: "center" },
});
