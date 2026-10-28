import { Platform, Text as RNText, type TextProps, type TextStyle } from "react-native";
import { tokens, type ColorName, type TypeName } from "./tokens";
import { useTheme } from "./theme";

type Tone = Extract<ColorName, "text" | "textMuted" | "bg" | "actionStrong" | "ai" | "danger" | "ok" | "onAction" | "onAi" | "onMedia">;

export function typeStyle(variant: TypeName): TextStyle {
  // Widened on purpose: « system » (SF Pro) and a weight stay possible in tokens.json.
  const v: { font: keyof typeof tokens.font; size: number; lineHeight: number; letterSpacing: number; weight?: TextStyle["fontWeight"] } = tokens.type[variant];
  const family: string = tokens.font[v.font];
  return {
    fontFamily: family === "system" ? Platform.select({ ios: undefined, default: "system-ui" }) : family,
    fontWeight: v.weight,
    fontSize: v.size, lineHeight: v.lineHeight, letterSpacing: v.letterSpacing,
  };
}

// Every text in the app goes through this component: tokens for type and colour, Dynamic Type up to XXL.
export function Text({ variant = "body", tone = "text", style, ...rest }: TextProps & { variant?: TypeName; tone?: Tone }) {
  const { c } = useTheme();
  return <RNText maxFontSizeMultiplier={tokens.maxFontScale} {...rest} style={[typeStyle(variant), { color: c[tone] }, style]} />;
}
