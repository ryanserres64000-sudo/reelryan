import { useId } from "react";
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { fr } from "../../copy/fr";
import { tokens } from "../tokens";
import { useTheme } from "../theme";

// Logo 15 « Ma / DA étiquette », proposition B2 (Ryan, 28 octobre 2026): the slash and the label share
// one gradient, and the label is a camera body, with its viewfinder bump and a flash dot. Same
// geometry as design/icon/mada-icon.svg (a 100 × 100 square), drawn here at the size of the « logo » type.
const H = tokens.type.logo.lineHeight;
const BODY = "M56.9 38H58.5L60.6 34.2H68.4L70.5 38H81.1A5.9 5.9 0 0 1 87 43.9V61.1A5.9 5.9 0 0 1 81.1 67H56.9A5.9 5.9 0 0 1 51 61.1V43.9A5.9 5.9 0 0 1 56.9 38Z";
const BOX = { x: 51, y: 34.2, w: 36, h: 32.8 };

function Stops({ id }: { id: string }) {
  const { g } = useTheme();
  // In the icon's own units, so the slash and the label read as one continuous gradient.
  return (
    <Defs>
      <LinearGradient id={id} gradientUnits="userSpaceOnUse" x1="38" y1="70" x2="90" y2="34">
        {g.map((s, i) => <Stop key={s} offset={i / (g.length - 1)} stopColor={s} />)}
      </LinearGradient>
    </Defs>
  );
}

export function LogoSlash() {
  const id = "s" + useId().replace(/\W/g, "");
  const k = H / BOX.h;
  return (
    <Svg width={10 * k} height={H} viewBox={`38 ${BOX.y} 10 ${BOX.h}`}>
      <Stops id={id} />
      <Path d="M39.6 62.4L46.4 41.6" stroke={`url(#${id})`} strokeWidth={2.3} strokeLinecap="round" />
    </Svg>
  );
}

export function LogoLabel() {
  const { c } = useTheme();
  const id = "l" + useId().replace(/\W/g, "");
  return (
    <Svg width={(H * BOX.w) / BOX.h} height={H} viewBox={`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`}>
      <Stops id={id} />
      <Path d={BODY} fill={`url(#${id})`} />
      <Circle cx={81.6} cy={42.6} r={1.5} fill={c.onAction} />
      <SvgText x={69} y={60.4} textAnchor="middle" fontFamily={tokens.font.bodyStrong} fontWeight="600" fontSize={21} fill={c.onAction}>{fr.intro.da}</SvgText>
    </Svg>
  );
}
