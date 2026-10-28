import { useId } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../theme";

// The Ma DA gradient (blue, violet, raspberry), laid behind a surface that clips it with its own
// rounded corners (overflow hidden). It runs left to right with a slight lift, like the logo.
export function Gradient({ style }: { style?: StyleProp<ViewStyle> }) {
  const { g } = useTheme();
  const id = "g" + useId().replace(/\W/g, "");
  return (
    <Svg pointerEvents="none" style={[StyleSheet.absoluteFill, style]} viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0.7" x2="1" y2="0.3">
          {g.map((s, i) => <Stop key={s} offset={i / (g.length - 1)} stopColor={s} />)}
        </LinearGradient>
      </Defs>
      <Rect width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}
