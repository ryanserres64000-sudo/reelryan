import { useRef, useState, type ReactElement } from "react";
import { PanResponder, Pressable, StyleSheet, Text as RNText, View } from "react-native";
import Svg, { ClipPath, Defs, Ellipse, G, Image as SvgImage, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";
import { VIGNETTE, fittedSize, shapePath, solid, type Design, type Fill, type ImageLayer, type Layer, type ShapeLayer, type TextLayer } from "../../../core/design";
import { tokens, useTheme } from "../design";
import { face } from "./fonts";

type Props = {
  design: Design; width: number; assets: Record<string, string>; id?: string;
  selected?: string | null; onSelect?: (id: string | null) => void; onMove?: (id: string, dx: number, dy: number) => void;
};

// Draws the layer JSON with native views (étude, ch. 5 §7): what the person sees is the layer list
// itself, so every layer can be picked and moved. Each layer keeps its place in the stack: a shape or
// a photo is a small SVG, a text is a real Text (wrapping with the true font). The grain of the web
// renderer is left out: the natural look does without it.
export function DesignView({ design: d, width, assets, id = "v", selected, onSelect, onMove }: Props) {
  const s = width / d.w;
  return (
    <View style={{ width, height: d.h * s, overflow: "hidden" }}>
      <Pressable accessible={false} disabled={!onSelect} onPress={() => onSelect?.(null)} style={StyleSheet.absoluteFill}>
        <Background d={d} s={s} assets={assets} id={id} />
      </Pressable>
      {d.layers.map(l => <LayerBox key={l.id} l={l} s={s} assets={assets} id={id} picked={selected === l.id} onSelect={onSelect} onMove={onMove} />)}
      {d.fx.vignette > 0 ? (
        <Svg pointerEvents="none" width={width} height={d.h * s} style={StyleSheet.absoluteFill}>
          <Defs><RadialGradient id={`${id}-vig`} cx="50%" cy="50%" r="75%"><Stop offset="0.55" stopColor={VIGNETTE} stopOpacity={0} /><Stop offset="1" stopColor={VIGNETTE} stopOpacity={d.fx.vignette} /></RadialGradient></Defs>
          <Rect width="100%" height="100%" fill={`url(#${id}-vig)`} />
        </Svg>
      ) : null}
    </View>
  );
}

const op = (c: string) => (c.length === 9 ? parseInt(c.slice(7), 16) / 255 : 1);
function Gradient({ id, f }: { id: string; f: Exclude<Fill, string> }) {
  const stops = f.colors.map((c, i) => <Stop key={i} offset={f.colors.length > 1 ? i / (f.colors.length - 1) : 0} stopColor={solid(c)} stopOpacity={op(c)} />);
  if (f.type === "radial") return <RadialGradient id={id} cx={f.cx} cy={f.cy} r="0.75">{stops}</RadialGradient>;
  const a = (f.angle * Math.PI) / 180, dx = Math.sin(a) / 2, dy = -Math.cos(a) / 2;
  return <LinearGradient id={id} x1={0.5 - dx} y1={0.5 - dy} x2={0.5 + dx} y2={0.5 + dy}>{stops}</LinearGradient>;
}
// A fill as SVG props, with its gradient definition when it has one.
function paint(f: Fill | null | undefined, gid: string): { props: { fill: string; fillOpacity?: number }; def: ReactElement | null } {
  if (!f) return { props: { fill: "none" }, def: null };
  if (typeof f === "string") return { props: { fill: solid(f), fillOpacity: op(f) }, def: null };
  return { props: { fill: `url(#${gid})` }, def: <Gradient id={gid} f={f} /> };
}
const aspect = (fx: number, fy: number, contain: boolean) =>
  `x${fx < 0.34 ? "Min" : fx > 0.66 ? "Max" : "Mid"}Y${fy < 0.34 ? "Min" : fy > 0.66 ? "Max" : "Mid"} ${contain ? "meet" : "slice"}`;

function Background({ d, s, assets, id }: { d: Design; s: number; assets: Record<string, string>; id: string }) {
  const { c } = useTheme();
  const b = d.background, W = d.w * s, H = d.h * s;
  if (b.type === "solid") return <View style={[StyleSheet.absoluteFill, { backgroundColor: b.color }]} />;
  if (b.type === "image") {
    const ov = paint(b.overlay, `${id}-bgo`);
    return (
      <Svg width={W} height={H}>
        <Defs>{ov.def}</Defs>
        <Rect width={W} height={H} fill={c.surface} />
        {assets[b.asset] ? <SvgImage href={{ uri: assets[b.asset] }} width={W} height={H} preserveAspectRatio={aspect(b.focusX, b.focusY, false)} /> : null}
        {b.overlay ? <Rect width={W} height={H} {...ov.props} /> : null}
      </Svg>
    );
  }
  const g = paint({ type: b.type === "radial" ? "radial" : "linear", colors: b.colors, angle: b.angle, cx: b.cx, cy: b.cy }, `${id}-bg`);
  return <Svg width={W} height={H}><Defs>{g.def}</Defs><Rect width={W} height={H} {...g.props} /></Svg>;
}

function LayerBox({ l, s, assets, id, picked, onSelect, onMove }: { l: Layer; s: number; assets: Record<string, string>; id: string; picked: boolean; onSelect?: Props["onSelect"]; onMove?: Props["onMove"] }) {
  const { c } = useTheme();
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const live = useRef({ onSelect, onMove, s, id: l.id });
  live.current = { onSelect, onMove, s, id: l.id };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !!live.current.onSelect,
    onMoveShouldSetPanResponder: (_, g) => !!live.current.onMove && Math.hypot(g.dx, g.dy) > 4,
    onPanResponderGrant: () => live.current.onSelect?.(live.current.id),
    // The page must not scroll away while a layer is being dragged.
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => { if (live.current.onMove) setDrag({ x: g.dx, y: g.dy }); },
    onPanResponderRelease: (_, g) => {
      setDrag({ x: 0, y: 0 });
      if (live.current.onMove && Math.hypot(g.dx, g.dy) > 4) live.current.onMove(live.current.id, g.dx / live.current.s, g.dy / live.current.s);
    },
    onPanResponderTerminate: () => setDrag({ x: 0, y: 0 }),
  })).current;
  const box = { left: l.x * s + drag.x, top: l.y * s + drag.y, width: l.w * s, height: l.h * s, opacity: l.opacity, transform: [{ rotate: `${l.rotation}deg` }] };
  return (
    <View {...(onSelect ? pan.panHandlers : {})} pointerEvents={onSelect ? "auto" : "none"} accessibilityLabel={l.name || undefined} style={[styles.layer, box]}>
      {l.type === "text" ? <TextBox l={l} s={s} /> : l.type === "shape" ? <ShapeBox l={l} s={s} gid={`${id}-${l.id}`} /> : l.type === "image" ? <ImageBox l={l} s={s} uri={assets[l.asset]} gid={`${id}-${l.id}`} /> : <PatternBox l={l} s={s} gid={`${id}-${l.id}`} />}
      {picked ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.picked, { borderColor: c.action }]} /> : null}
    </View>
  );
}

function TextBox({ l, s }: { l: TextLayer; s: number }) {
  const size = fittedSize(l) * s;
  const color = typeof l.color === "string" ? l.color : l.color.colors[0];
  const bg = l.bg ? (typeof l.bg.color === "string" ? l.bg.color : l.bg.color.colors[0]) : undefined;
  return (
    <View style={[StyleSheet.absoluteFill, { justifyContent: l.vAlign === "middle" ? "center" : l.vAlign === "bottom" ? "flex-end" : "flex-start" }]}>
      <RNText allowFontScaling={false} style={{
        fontFamily: face(l.font, l.weight), fontSize: size, lineHeight: size * l.lineHeight, letterSpacing: l.letterSpacing * size, color,
        textAlign: l.align, fontStyle: l.italic ? "italic" : "normal", textTransform: l.transform === "upper" ? "uppercase" : "none",
        ...(bg ? { backgroundColor: bg, paddingHorizontal: (l.bg?.padX ?? 0) * s, paddingVertical: (l.bg?.padY ?? 0) * s, borderRadius: (l.bg?.radius ?? 0) * s, alignSelf: l.align === "center" ? "center" : l.align === "right" ? "flex-end" : "flex-start" } : null),
        ...(l.shadow ? { textShadowColor: l.shadow.color, textShadowRadius: l.shadow.blur * s, textShadowOffset: { width: l.shadow.x * s, height: l.shadow.y * s } } : null),
      }}>{l.text}</RNText>
    </View>
  );
}

function ShapeBox({ l, s, gid }: { l: ShapeLayer; s: number; gid: string }) {
  const w = l.w * s, h = l.h * s;
  const f = paint(l.fill, `${gid}-f`);
  const st = l.stroke ? paint(l.stroke.color, `${gid}-s`) : null;
  const stroke = st ? { stroke: st.props.fill, strokeOpacity: st.props.fillOpacity, strokeWidth: l.stroke!.width * s, strokeDasharray: l.stroke!.dash?.map(n => n * s) } : {};
  return (
    <Svg width={w} height={h} style={styles.over}>
      <Defs>{f.def}{st?.def}</Defs>
      {l.shape === "ellipse" || l.shape === "circle"
        ? <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...f.props} {...stroke} />
        : <Path d={shapePath(l.shape, w, h, { radius: l.radius * s, points: l.points, inner: l.inner, seed: l.seed })} {...f.props} {...stroke} />}
    </Svg>
  );
}

function ImageBox({ l, s, uri, gid }: { l: ImageLayer; s: number; uri?: string; gid: string }) {
  const { c } = useTheme();
  const w = l.w * s, h = l.h * s, z = l.zoom;
  const iw = w * z, ih = h * z, ix = -(iw - w) * l.focusX, iy = -(ih - h) * l.focusY;
  const mask = shapePath(l.mask, w, h, { radius: l.radius * s });
  return (
    <Svg width={w} height={h} style={styles.over}>
      <Defs><ClipPath id={`${gid}-m`}><Path d={mask} /></ClipPath></Defs>
      <G clipPath={`url(#${gid}-m)`}>
        <Rect width={w} height={h} fill={c.surfaceRaised} />
        {uri ? <SvgImage href={{ uri }} x={ix} y={iy} width={iw} height={ih} preserveAspectRatio={aspect(l.focusX, l.focusY, l.fit === "contain")} /> : null}
      </G>
      {l.border ? <Path d={mask} fill="none" stroke={solid(l.border.color)} strokeWidth={l.border.width * s * 2} clipPath={`url(#${gid}-m)`} /> : null}
    </Svg>
  );
}

function PatternBox({ l, s, gid }: { l: Extract<Layer, { type: "pattern" }>; s: number; gid: string }) {
  const w = l.w * s, h = l.h * s, sp = l.spacing * s, r = (l.size * s) / 2;
  return (
    <Svg width={w} height={h} style={styles.over}>
      <Defs>
        <Pattern id={`${gid}-p`} width={sp} height={sp} patternUnits="userSpaceOnUse" patternTransform={`rotate(${l.angle})`}>
          {l.kind === "stripes" || l.kind === "grid"
            ? <><Rect width={sp} height={Math.max(1, r)} fill={solid(l.color)} fillOpacity={op(l.color)} />{l.kind === "grid" ? <Rect width={Math.max(1, r)} height={sp} fill={solid(l.color)} fillOpacity={op(l.color)} /> : null}</>
            : <Ellipse cx={sp / 2} cy={sp / 2} rx={r} ry={r} fill={solid(l.color)} fillOpacity={op(l.color)} />}
        </Pattern>
      </Defs>
      <Rect width={w} height={h} fill={`url(#${gid}-p)`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute" },
  over: { overflow: "visible" },
  picked: { borderWidth: tokens.size.selection, borderStyle: "dashed" },
});
