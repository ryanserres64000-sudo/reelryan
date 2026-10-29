import { useEffect, useMemo, useRef, useState } from "react";
import { Image, PanResponder, Platform, StyleSheet, View } from "react-native";
import { CADRE_ZOOM, type Cadre, type Plan } from "../../../core/timeline";
import { fr } from "../copy/fr";
import { haptic, tokens, useTheme } from "../design";
import { isPhoto, stillOf } from "../video/Still";
import type { Sources } from "../video/sources";

type Props = { plan: Plan; sources: Promise<Sources> | null; width: number; height: number; onCadre: (c: Cadre) => void; onDragging?: (on: boolean) => void };
const t = fr.crop;
const STEP = 0.05;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const CENTRE: Cadre = { x: 0.5, y: 0.5, z: 1 };

// Where the rush's picture sits in the frame for a reframe: the same sums as fill() in Compositor.swift
// (zoomed cover, the chosen point at the centre, never an empty edge), with y from the top.
export function cropRect(c: Cadre, iw: number, ih: number, W: number, H: number) {
  const k = Math.max(W / iw, H / ih) * clamp(c.z, ...CADRE_ZOOM), w = iw * k, h = ih * k;
  return { left: clamp(W / 2 - c.x * w, W - w, 0), top: clamp(H / 2 - c.y * h, H - h, 0), width: w, height: h };
}

// Reframing a shot by hand, on the picture (étape 4 du parcours): one finger slides the footage, two
// fingers zoom. Thirds lines help place a face or a product. The change is kept on release: one gesture, one step to undo.
export function CropGrip({ plan, sources, width, height, onCadre, onDragging }: Props) {
  const { c } = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [live, setLiveState] = useState<Cadre | null>(null);
  const liveRef = useRef<Cadre | null>(null);
  const setLive = (v: Cadre | null) => { liveRef.current = v; setLiveState(v); };
  const cur = useRef<Cadre>(plan.cadre ?? CENTRE); cur.current = plan.cadre ?? CENTRE;
  // The footage's size on screen at a zoom, to turn a finger's move into a move of the centre point.
  const scaled = (q: Cadre) => { if (!size) return { w: width, h: height }; const k = Math.max(width / size.w, height / size.h) * q.z; return { w: size.w * k, h: size.h * k }; };
  const dims = useRef(scaled(cur.current)); dims.current = scaled(cur.current);
  const cb = useRef({ onCadre, onDragging }); cb.current = { onCadre, onDragging };
  const g = useRef({ start: CENTRE, dist: 0, w: width, h: height });

  useEffect(() => {
    let on = true;
    if (Platform.OS === "web" || !sources) return;
    sources.then(s => {
      const src = s.rushes[plan.source];
      return src ? stillOf(src, plan.debut + Math.min(0.3, (plan.fin - plan.debut) / 2), isPhoto(src)) : null;
    }).then(u => { if (on && u) { setUri(u); Image.getSize(u, (w, h) => on && setSize({ w, h }), () => {}); } }).catch(() => {});
    return () => { on = false; };
  }, [sources, plan.source, plan.debut]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { g.current = { start: cur.current, dist: 0, w: dims.current.w, h: dims.current.h }; cb.current.onDragging?.(true); },
    onPanResponderMove: (e, d) => {
      const s = g.current.start, touches = e.nativeEvent.touches;
      if (touches.length >= 2) {
        const dist = Math.hypot(touches[1].pageX - touches[0].pageX, touches[1].pageY - touches[0].pageY);
        if (!g.current.dist) g.current.dist = dist;
        setLive({ ...s, z: Math.round(clamp(s.z * dist / g.current.dist, ...CADRE_ZOOM) * 100) / 100 });
      } else {
        // The footage follows the finger: the point at the centre moves the other way.
        setLive({ ...s, x: clamp(s.x - d.dx / g.current.w, 0, 1), y: clamp(s.y - d.dy / g.current.h, 0, 1) });
      }
    },
    onPanResponderRelease: () => {
      cb.current.onDragging?.(false);
      const next = liveRef.current;
      setLive(null);
      if (next) { haptic("tick"); cb.current.onCadre(next); }
    },
    onPanResponderTerminate: () => { cb.current.onDragging?.(false); setLive(null); },
  }), []);

  const cadre = live ?? plan.cadre ?? CENTRE;
  const rect = size ? cropRect(cadre, size.w, size.h, width, height) : null;
  const nudge = (name: string) => {
    const q = cur.current;
    const next = name === "increment" ? { ...q, z: clamp(q.z * 1.15, ...CADRE_ZOOM) } : name === "decrement" ? { ...q, z: clamp(q.z / 1.15, ...CADRE_ZOOM) }
      : name === "left" ? { ...q, x: clamp(q.x - STEP, 0, 1) } : name === "right" ? { ...q, x: clamp(q.x + STEP, 0, 1) }
      : name === "up" ? { ...q, y: clamp(q.y - STEP, 0, 1) } : name === "down" ? { ...q, y: clamp(q.y + STEP, 0, 1) } : null;
    if (next) onCadre(next);
  };
  return (
    <View {...pan.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={t.grip} accessibilityHint={t.gesture} accessibilityValue={{ text: t.zoom(cadre.z) }}
      accessibilityActions={[{ name: "increment", label: t.zoomIn }, { name: "decrement", label: t.zoomOut }, { name: "left", label: t.left }, { name: "right", label: t.right }, { name: "up", label: t.up }, { name: "down", label: t.down }]}
      onAccessibilityAction={e => nudge(e.nativeEvent.actionName)}
      style={[StyleSheet.absoluteFill, { backgroundColor: c.media }]}>
      {uri && rect ? <Image source={{ uri }} style={[styles.abs, rect]} /> : null}
      {/* Thirds, as in the camera app, to place a face or a product. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frame, { borderColor: c.action }]}>
        {[1, 2].map(n => <View key={`v${n}`} style={[styles.abs, styles.v, { left: (width * n) / 3, backgroundColor: c.onMedia }]} />)}
        {[1, 2].map(n => <View key={`h${n}`} style={[styles.abs, styles.h, { top: (height * n) / 3, backgroundColor: c.onMedia }]} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  frame: { borderWidth: tokens.size.selection },
  v: { top: 0, bottom: 0, width: tokens.size.border, opacity: tokens.opacity.waveOutside },
  h: { left: 0, right: 0, height: tokens.size.border, opacity: tokens.opacity.waveOutside },
});
