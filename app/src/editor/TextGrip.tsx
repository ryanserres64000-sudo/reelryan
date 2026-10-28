import { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import type { PlacedText } from "../../../core/export";
import { H, W } from "../../../core/export";
import { PLACE_LIMITS, type TextPlace } from "../../../core/textlook";
import { fr } from "../copy/fr";
import { haptic, tokens, useTheme } from "../design";

type Props = { text: PlacedText; place: TextPlace; k: number; onPlace: (p: TextPlace) => void; onTap: () => void; onDragging?: (on: boolean) => void;
  // The place while a finger is on it, so the text under the grip follows the gesture.
  onLive?: (p: TextPlace | null) => void };
const t = fr.textEdit;
const SNAP = 0.02, STEP = 0.03, DOUBLE_TAP = 300;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// The selected text on the video (Ryan's first test): one finger moves it anywhere, two fingers pinch
// its size and turn it; a tap twice writes in it. It snaps to the centre lines with a tick. The change is
// kept on release, so one gesture is one step to undo.
export function TextGrip({ text, place, k, onPlace, onTap, onDragging, onLive }: Props) {
  const { c } = useTheme();
  const [live, setLiveState] = useState<TextPlace | null>(null);
  const liveRef = useRef<TextPlace | null>(null);
  // Callbacks through a ref: the parent re-renders during the gesture, the responder must not change.
  const cb = useRef({ onLive, onPlace, onTap, onDragging }); cb.current = { onLive, onPlace, onTap, onDragging };
  const setLive = (v: TextPlace | null) => { liveRef.current = v; setLiveState(v); cb.current.onLive?.(v); };
  const g = useRef({ start: place, dist: 0, angle: 0, moved: false, snapped: false, last: 0 });
  const cur = useRef(place); cur.current = place;
  const width = W * k, height = H * k;

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { g.current = { ...g.current, start: cur.current, dist: 0, angle: 0, moved: false, snapped: false }; cb.current.onDragging?.(true); },
    onPanResponderMove: (e, d) => {
      const s = g.current.start, touches = e.nativeEvent.touches;
      let next = s;
      if (touches.length >= 2) {
        const dx = touches[1].pageX - touches[0].pageX, dy = touches[1].pageY - touches[0].pageY;
        const dist = Math.hypot(dx, dy), angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (!g.current.dist) { g.current.dist = dist; g.current.angle = angle; }
        next = { ...s, s: clamp(s.s * dist / g.current.dist, ...PLACE_LIMITS.s), r: Math.round(clamp(s.r + angle - g.current.angle, ...PLACE_LIMITS.r)) };
        // Close to straight: straight.
        if (Math.abs(next.r) < 3) next = { ...next, r: 0 };
      } else {
        const x = clamp(s.x + d.dx / width, 0, 1), y = clamp(s.y + d.dy / height, 0, 1);
        const sx = Math.abs(x - 0.5) < SNAP ? 0.5 : x, sy = Math.abs(y - 0.5) < SNAP ? 0.5 : y;
        const snapped = sx !== x || sy !== y;
        if (snapped && !g.current.snapped) haptic("tick");
        g.current.snapped = snapped;
        next = { ...s, x: sx, y: sy };
      }
      if (Math.abs(d.dx) + Math.abs(d.dy) > 3 || touches.length >= 2) g.current.moved = true;
      setLive(next);
    },
    onPanResponderRelease: () => {
      cb.current.onDragging?.(false);
      const moved = g.current.moved, next = liveRef.current;
      setLive(null);
      if (moved && next) { cb.current.onPlace(next); return; }
      // Two taps in a row: write in the text.
      const now = Date.now();
      if (now - g.current.last < DOUBLE_TAP) cb.current.onTap();
      g.current.last = now;
    },
    onPanResponderTerminate: () => { cb.current.onDragging?.(false); setLive(null); },
  }), [width, height]);

  const p = live ?? place;
  const bw = p.w * width, bh = text.box.h * k * (p.s / (place.s || 1));
  const nudge = (name: string) => {
    const q = cur.current;
    if (name === "increment") onPlace({ ...q, s: clamp(q.s * 1.12, ...PLACE_LIMITS.s) });
    else if (name === "decrement") onPlace({ ...q, s: clamp(q.s / 1.12, ...PLACE_LIMITS.s) });
    else if (name === "left") onPlace({ ...q, x: clamp(q.x - STEP, 0, 1) }); else if (name === "right") onPlace({ ...q, x: clamp(q.x + STEP, 0, 1) });
    else if (name === "up") onPlace({ ...q, y: clamp(q.y - STEP, 0, 1) }); else if (name === "down") onPlace({ ...q, y: clamp(q.y + STEP, 0, 1) });
    else if (name === "activate") onTap();
  };
  return (
    <View {...pan.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={t.grip(text.texte)} accessibilityHint={t.gesture}
      accessibilityActions={[{ name: "activate", label: t.write }, { name: "increment", label: t.bigger }, { name: "decrement", label: t.smaller }, { name: "left", label: t.left }, { name: "right", label: t.right }, { name: "up", label: t.up }, { name: "down", label: t.down }]}
      onAccessibilityAction={e => nudge(e.nativeEvent.actionName)}
      style={[styles.grip, { left: p.x * width - bw / 2, top: p.y * height - bh / 2, width: bw, height: bh, borderColor: c.action, transform: [{ rotate: `${p.r}deg` }] }]}>
      {(["tl", "tr", "bl", "br"] as const).map(q => (
        <View key={q} style={[styles.corner, { backgroundColor: c.action, borderColor: c.onAction }, q[0] === "t" ? styles.top : styles.bottom, q[1] === "l" ? styles.left : styles.right]} />
      ))}
    </View>
  );
}

const D = tokens.size.handleGrip;
const styles = StyleSheet.create({
  grip: { position: "absolute", borderWidth: tokens.size.selection, borderStyle: "dashed" },
  corner: { position: "absolute", width: D, height: D, borderRadius: tokens.radius.full, borderWidth: tokens.size.border },
  top: { top: -D / 2 }, bottom: { bottom: -D / 2 }, left: { left: -D / 2 }, right: { right: -D / 2 },
});
