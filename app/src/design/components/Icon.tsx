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
  layers: <><Rect x={3} y={8} width={13} height={13} rx={2} /><Path d="M8 8V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3" /></>,
  cutout: <><Circle cx={12} cy={8} r={3.5} /><Path d="M5 21c.8-4 3.6-6 7-6s6.2 2 7 6" /><Path d="M3 3h3M18 3h3M3 3v3M21 3v3" /></>,
  chart: <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  voice: <Path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />,
  // The editor's bottom bar (Ryan, 30 octobre, d'après Edits).
  split: <Path d="M12 3v18M8 8l-4 4 4 4M16 8l4 4-4 4" />,
  trash: <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  copy: <><Rect x={8} y={8} width={12} height={12} rx={2} /><Path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  crop: <Path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14" />,
  swap: <Path d="M4 8h14l-4-4M20 16H6l4 4" />,
  transition: <><Rect x={3} y={6} width={8} height={12} rx={1.5} /><Rect x={13} y={6} width={8} height={12} rx={1.5} /></>,
  addMedia: <><Rect x={3} y={6} width={13} height={14} rx={2} /><Path d="M19 2v6M16 5h6M6 17l3-4 3 3 2-2" /></>,
  back: <Path d="M15 5l-7 7 7 7" />,
  subtitles: <><Rect x={3} y={5} width={18} height={14} rx={2} /><Path d="M7 12h4M13 12h4M7 15h10" /></>,
  order: <Path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />,
  // The profiles of sign-up (core/brand.ts PROFILS).
  restaurant: <Path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1.5-3 4-3 7v3h3" />,
  shop: <><Path d="M5 8h14l-1 12H6z" /><Path d="M9 10V7a3 3 0 0 1 6 0v3" /></>,
  beauty: <><Circle cx={6} cy={18} r={2.5} /><Circle cx={18} cy={18} r={2.5} /><Path d="M8 16L19 4M16 16L5 4" /></>,
  coach: <Path d="M3 12h3M18 12h3M6 8v8M18 8v8M9 10v4M15 10v4M9 12h6" />,
  craft: <><Path d="M14 4l6 6-3 3-6-6z" /><Path d="M12.5 8.5L4 17l3 3 8.5-8.5" /></>,
  laptop: <><Rect x={5} y={5} width={14} height={10} rx={1.5} /><Path d="M3 19h18" /></>,
  team: <><Circle cx={9} cy={9} r={3} /><Circle cx={17} cy={10} r={2.2} /><Path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5M15.5 14.5c2.6-.3 4.8 1.2 5.5 4.5" /></>,
  building: <><Rect x={5} y={3} width={14} height={18} rx={1} /><Path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M11 21v-3h2v3" /></>,
  school: <><Path d="M2 9l10-5 10 5-10 5z" /><Path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6" /></>,
  camera: <><Rect x={3} y={7} width={18} height={13} rx={2} /><Path d="M8 7l1.5-3h5L16 7" /><Circle cx={12} cy={13.5} r={3.5} /></>,
  ticket: <><Path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" /><Path d="M15 7v2M15 11v2M15 15v2" /></>,
  sprout: <Path d="M12 21v-9M12 12c0-4 3-7 8-7 0 5-3 7-8 7zM12 15c0-3-2.5-5-7-5 0 4 2.5 5 7 5z" />,
  mail: <><Rect x={3} y={5} width={18} height={14} rx={2} /><Path d="M3 7l9 6 9-6" /></>,
  apple: <Path d="M15.5 3c.2 1.5-.5 3-1.7 3.9-1 .8-2.3 1-2.8.9-.2-1.4.6-2.9 1.6-3.7 1-.8 2.3-1.1 2.9-1.1zM19 16.8c-.7 1.6-1.1 2.3-2 3.5-1.2 1.7-2.3 1.7-3.4 1.2-1-.4-2-.4-3.1 0-1.4.6-2.3.4-3.3-1.2C4.4 16.6 4 12 6 9.7c1-1.2 2.4-1.8 3.7-1.8 1.3 0 2.1.7 3.2.7 1.1 0 1.8-.7 3.3-.7 1.2 0 2.4.6 3.3 1.7-2.9 1.6-2.4 5.8-.5 7.2z" />,
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, tone = "text", size = tokens.size.icon }: { name: IconName; tone?: ColorName; size?: number }) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={name === "apple" ? c[tone] : "none"} stroke={name === "apple" ? "none" : c[tone]} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {PATHS[name]}
    </Svg>
  );
}
