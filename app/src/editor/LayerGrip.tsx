import { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import { boxAt } from "../../../core/layers";
import type { Calque } from "../../../core/timeline";
import { fr } from "../copy/fr";
import { haptic, tokens, useTheme } from "../design";

export type LayerMove = { x?: number; y?: number; echelle?: number };
type Props = { layer: Calque; time: number; width: number; height: number; onMove: (m: LayerMove) => void; onDragging?: (on: boolean) => void };
const t = fr.layers;
const SNAP = 0.02, STEP = 0.05;

// The selected layer on the preview (étape 6): one finger moves it, two fingers pinch its size. The
// change is kept on release only, so one gesture is one step to undo. It snaps to the centre lines
// with a tick, like the frise.
export function LayerGrip({ layer, time, width, height, onMove, onDragging }: Props) {
  const { c } = useTheme();
  const b = boxAt(layer, time);
  const [drag, setDrag] = useState({ dx: 0, dy: 0, k: 1 });
  const live = useRef({ dx: 0, dy: 0, k: 1, dist: 0, snapped: false });
  const centre = useRef({ x: 0, y: 0 }); centre.current = { x: b.left + b.w / 2, y: b.top + b.h / 2 };
  const size = useRef({ width, height }); size.current = { width, height };
  const snap = (v: number) => (Math.abs(v - 0.5) < SNAP ? 0.5 : v);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { live.current = { dx: 0, dy: 0, k: 1, dist: 0, snapped: false }; onDragging?.(true); },
    onPanResponderMove: (e, g) => {
      const touches = e.nativeEvent.touches;
      if (touches.length >= 2) {
        const dist = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
        if (!live.current.dist) live.current.dist = dist;
        live.current.k = Math.max(0.2, Math.min(4, dist / live.current.dist));
      } else {
        const { width: w, height: h } = size.current, x = centre.current.x + g.dx / w, y = centre.current.y + g.dy / h;
        const sx = snap(x), sy = snap(y), snapped = sx !== x || sy !== y;
        if (snapped && !live.current.snapped) haptic("tick");
        live.current.snapped = snapped;
        live.current.dx = (sx - centre.current.x) * w; live.current.dy = (sy - centre.current.y) * h;
      }
      setDrag({ dx: live.current.dx, dy: live.current.dy, k: live.current.k });
    },
    onPanResponderRelease: () => {
      const { width: w, height: h } = size.current, l = live.current;
      onDragging?.(false);
      setDrag({ dx: 0, dy: 0, k: 1 });
      if (Math.abs(l.dx) < 1 && Math.abs(l.dy) < 1 && Math.abs(l.k - 1) < 0.02) return;
      onMove({ x: centre.current.x + l.dx / w, y: centre.current.y + l.dy / h, ...(Math.abs(l.k - 1) >= 0.02 ? { echelle: l.k } : {}) });
    },
    onPanResponderTerminate: () => { onDragging?.(false); setDrag({ dx: 0, dy: 0, k: 1 }); },
  }), [onMove, onDragging]);

  const w = b.w * width * drag.k, h = b.h * height * drag.k;
  const left = (b.left + b.w / 2) * width + drag.dx - w / 2, top = (b.top + b.h / 2) * height + drag.dy - h / 2;
  const nudge = (name: string) => {
    const { x, y } = centre.current;
    if (name === "increment") onMove({ echelle: 1.15 }); else if (name === "decrement") onMove({ echelle: 0.87 });
    else if (name === "left") onMove({ x: x - STEP }); else if (name === "right") onMove({ x: x + STEP });
    else if (name === "up") onMove({ y: y - STEP }); else if (name === "down") onMove({ y: y + STEP });
  };
  return (
    <View {...pan.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={t.grip} accessibilityHint={t.gesture}
      accessibilityActions={[{ name: "increment", label: t.bigger }, { name: "decrement", label: t.smaller }, { name: "left", label: t.moveLeft }, { name: "right", label: t.moveRight }, { name: "up", label: t.moveUp }, { name: "down", label: t.moveDown }]}
      onAccessibilityAction={e => nudge(e.nativeEvent.actionName)}
      style={[styles.grip, { left, top, width: w, height: h, borderColor: c.action, transform: [{ rotate: `${b.rotation}deg` }] }]}>
      {(["tl", "tr", "bl", "br"] as const).map(k => (
        <View key={k} style={[styles.corner, { backgroundColor: c.action, borderColor: c.onAction }, k[0] === "t" ? styles.top : styles.bottom, k[1] === "l" ? styles.left : styles.right]} />
      ))}
    </View>
  );
}

const D = tokens.size.handleGrip;
const styles = StyleSheet.create({
  grip: { position: "absolute", borderWidth: tokens.size.selection },
  corner: { position: "absolute", width: D, height: D, borderRadius: tokens.radius.full, borderWidth: tokens.size.border },
  top: { top: -D / 2 }, bottom: { bottom: -D / 2 }, left: { left: -D / 2 }, right: { right: -D / 2 },
});
