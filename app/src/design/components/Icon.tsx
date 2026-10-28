import Svg, { Circle, Path, Rect } from "react-native-svg";
import { tokens } from "../tokens";
import { useTheme } from "../theme";
import type { ColorName } from "../tokens";

// The few line icons of the app (« Atelier clair »): one stroke weight, always with a word next to them.
const PATHS = {
  home: <Path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  brand: <><Circle cx={12} cy={12} r={8} /><Circle cx={12} cy={12} r={3} /></>,
  plan: <><Rect x={3} y={6} width={18} height={12} rx={2} /><Path d="M9 6v12M15 6v12" /></>,
  speed: <Path d="M4 16a8 8 0 1 1 16 0M12 16l4-5" />,
  text: <Path d="M5 6h14M12 6v13" />,
  sound: <><Path d="M9 18V6l10-2v12" /><Circle cx={7} cy={18} r={2} /><Circle cx={17} cy={16} r={2} /></>,
  color: <Path d="M12 4s6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 6-10 6-10z" />,
  undo: <Path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10" />,
  redo: <Path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10" />,
  spark: <Path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3" />,
  grid: <><Rect x={4} y={4} width={7} height={7} rx={1.5} /><Rect x={13} y={4} width={7} height={7} rx={1.5} /><Rect x={4} y={13} width={7} height={7} rx={1.5} /><Rect x={13} y={13} width={7} height={7} rx={1.5} /></>,
  idea: <Path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />,
  hand: <Path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-.5a5 5 0 0 1-4-2l-2.8-3.7a1.5 1.5 0 0 1 2.3-1.9L8 14" />,
  image: <><Rect x={4} y={4} width={16} height={16} rx={2} /><Circle cx={9} cy={9} r={1.5} /><Path d="M20 15l-5-5-9 10" /></>,
  play: <Path d="M8 5v14l11-7z" />,
  pause: <Path d="M8 5v14M16 5v14" />,
  minus: <Path d="M5 12h14" />,
  expand: <Path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />,
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  soundOff: <><Path d="M4 9h4l5-4v14l-5-4H4z" /><Path d="M17 9l4 6M21 9l-4 6" /></>,
  check: <Path d="M5 12l5 5 9-10" />,
  mic: <><Rect x={9} y={3} width={6} height={11} rx={3} /><Path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  voice: <Path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />,
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, tone = "text", size = tokens.size.icon }: { name: IconName; tone?: ColorName; size?: number }) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c[tone]} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {PATHS[name]}
    </Svg>
  );
}
