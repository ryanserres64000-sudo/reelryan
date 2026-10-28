import { useId } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { tokens } from "../tokens";
import { useTheme } from "../theme";

// The butterfly of the opening (Ryan, 28 octobre 2026): two wings in the Ma DA gradient, an ink body.
// Each wing is its own view, folded towards the body by `flap` (1 open, 0 closed), like a beat.
const S = tokens.size.butterfly;
const LEFT = "M12 11.6C9 4 2.2 3.4 2.6 8.6C2.9 12 7 13 12 12.4ZM12 13C8.6 13.2 4.6 15.4 6 18.8C7.4 21.4 10.8 18.4 12 14Z";
const RIGHT = "M12 11.6C15 4 21.8 3.4 21.4 8.6C21.1 12 17 13 12 12.4ZM12 13C15.4 13.2 19.4 15.4 18 18.8C16.6 21.4 13.2 18.4 12 14Z";

function Wing({ d, side, flap }: { d: string; side: "left" | "right"; flap: Animated.Value }) {
  const { g } = useTheme();
  const id = "w" + useId().replace(/\W/g, "");
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: "center", transform: [{ scaleX: flap.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }) }] }]}>
      <Svg width={S} height={S} viewBox="0 0 24 24">
        <Defs>
          <LinearGradient id={id} x1={side === "left" ? "1" : "0"} y1="0.5" x2={side === "left" ? "0" : "1"} y2="0.2">
            {g.map((s, i) => <Stop key={s} offset={i / (g.length - 1)} stopColor={s} />)}
          </LinearGradient>
        </Defs>
        <Path d={d} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

export function Butterfly({ flap }: { flap: Animated.Value }) {
  const { c } = useTheme();
  return (
    <View style={styles.box}>
      <Wing d={LEFT} side="left" flap={flap} />
      <Wing d={RIGHT} side="right" flap={flap} />
      <Svg style={StyleSheet.absoluteFill} width={S} height={S} viewBox="0 0 24 24">
        <Path d="M12 8.4V17.6" stroke={c.text} strokeWidth={1.5} strokeLinecap="round" />
        <Path d="M11.6 8.6C11 6.6 10 5.6 9 5.2M12.4 8.6C13 6.6 14 5.6 15 5.2" stroke={c.text} strokeWidth={0.7} strokeLinecap="round" fill="none" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ box: { width: S, height: S } });
