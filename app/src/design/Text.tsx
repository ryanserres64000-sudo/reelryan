import { Platform, Text as RNText, type TextProps, type TextStyle } from "react-native";
import { tokens, type ColorName, type TypeName } from "./tokens";
import { useTheme } from "./theme";

type Tone = Extract<ColorName, "text" | "textMuted" | "actionStrong" | "ai" | "danger" | "ok" | "onAction" | "onAi" | "onMedia">;

export function typeStyle(variant: TypeName): TextStyle {
  const v = tokens.type[variant];
  const family = tokens.font[v.font];
  return {
    fontFamily: family === "system" ? Platform.select({ ios: undefined, default: "system-ui" }) : family,
    fontWeight: "weight" in v ? v.weight : undefined,
    fontSize: v.size, lineHeight: v.lineHeight, letterSpacing: v.letterSpacing,
  };
}

// Every text in the app goes through this component: tokens for type and colour, Dynamic Type up to XXL.
export function Text({ variant = "body", tone = "text", style, ...rest }: TextProps & { variant?: TypeName; tone?: Tone }) {
  const { c } = useTheme();
  return <RNText maxFontSizeMultiplier={tokens.maxFontScale} {...rest} style={[typeStyle(variant), { color: c[tone] }, style]} />;
}
