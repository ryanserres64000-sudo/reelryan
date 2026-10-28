import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { PanResponder, Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent } from "react-native";
import { clock } from "../../../core/playback";
import { clampZoom, magnets, snap, type Lane, type LaneKey, type Piece } from "../../../core/tracks";
import type { TimelineV1 } from "../../../core/timeline";
import { fr } from "../copy/fr";
import { Text, haptic, tokens, useTheme } from "../design";
import type { ColorName } from "../design/tokens";

export type Selection = { lane: LaneKey; id: string; index: number } | null;
type Props = {
  timeline: TimelineV1; lanes: Lane[]; time: number; zoom: number; selection: Selection;
  onSeek: (t: number) => void; onZoom: (z: number) => void; onSelect: (s: Selection) => void;
  // Edges and moves in edit time; Flow turns them into edit functions (core/edit.ts).
  onTrim: (s: NonNullable<Selection>, start: number, end: number) => void;
  onMove: (s: NonNullable<Selection>, start: number) => void;
  onReorder: (from: number, to: number) => void;
  onDragging?: (on: boolean) => void;
};
const t = fr.tracks;
const FILL: Record<LaneKey, ColorName> = { textes: "ai", calques: "text", plans: "surfaceRaised", voix: "ok", musique: "surface", effets: "danger" };
const INK: Record<LaneKey, "onAi" | "bg" | "text" | "textMuted"> = { textes: "onAi", calques: "bg", plans: "text", voix: "bg", musique: "textMuted", effets: "bg" };
// Pieces that can move freely in time; the shots are a magnetic row (they reorder instead).
const FREE: LaneKey[] = ["textes", "calques", "voix"];

// The editor's strip (étude de la refonte, décision 6 « une frise qu'on manipule au doigt »): one lane
// per kind of piece, the play head fixed in the middle and the edit scrolling under it, pinch to zoom.
// Touch a piece to select it; drag its white handles to trim, drag it to move it (texts, sounds,
// layers) or to put a shot elsewhere. Edges stick to the play head, the beats and the other pieces,
// with a tick.
export function Timeline({ timeline, lanes, time, zoom, selection, onSeek, onZoom, onSelect, onTrim, onMove, onReorder, onDragging }: Props) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // Scrolls the code makes (following the play head) are not the person seeking.
  const auto = useRef(false);
  const pps = zoom, half = width / 2, total = timeline.duree;
  // Where a drag currently puts the selected piece (drawn live, applied once on release).
  const [ghost, setGhost] = useState<{ start: number; end: number } | null>(null);
  const [slot, setSlot] = useState<number | null>(null);

  const dragged = useRef(false);
  useEffect(() => { if (!dragged.current) { auto.current = true; scroll.current?.scrollTo({ x: time * pps, animated: false }); } }, [time, pps, width]);

  // Pinch to zoom, caught before the scroll when two fingers are down.
  const pinch = useRef({ d: 0, z: zoom });
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const dist = (e: GestureResponderEvent) => { const [a, b] = e.nativeEvent.touches; return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0; };
  const pinchPan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: e => e.nativeEvent.touches.length === 2,
    onPanResponderGrant: e => { pinch.current = { d: dist(e), z: zoomRef.current }; onDragging?.(true); },
    onPanResponderMove: e => { const d = dist(e); if (d && pinch.current.d) onZoom(clampZoom(pinch.current.z * d / pinch.current.d)); },
    onPanResponderRelease: () => onDragging?.(false),
    onPanResponderTerminate: () => onDragging?.(false),
  }), []);

  const live = useRef({ timeline, lanes, time, pps, selection, onTrim, onMove, onReorder });
  live.current = { timeline, lanes, time, pps, selection, onTrim, onMove, onReorder };
  const lastSnap = useRef<number | null>(null);
  const stick = (x: number, except: string) => {
    const L = live.current, s = snap(x, magnets(L.timeline, L.time, except, L.lanes), tokens.size.snapPx / L.pps);
    if (s.snapped && lastSnap.current !== s.time) haptic("tick");
    lastSnap.current = s.snapped ? s.time : null;
    return s.time;
  };
  const drag = (kind: "start" | "end" | "body", piece: Piece) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { onDragging?.(true); haptic("tap"); },
    onPanResponderMove: (_, g) => {
      const L = live.current, dt = g.dx / L.pps, sel = L.selection!;
      if (kind === "start") setGhost({ start: Math.min(stick(piece.start + dt, piece.id), piece.end - 0.5), end: piece.end });
      else if (kind === "end") setGhost({ start: piece.start, end: Math.max(stick(piece.end + dt, piece.id), piece.start + 0.5) });
      else if (FREE.includes(sel.lane)) { const s = Math.max(0, stick(piece.start + dt, piece.id)); setGhost({ start: s, end: s + piece.end - piece.start }); }
      else {
        // A shot is put where its middle lands, between the others.
        const mid = (piece.start + piece.end) / 2 + dt, row = L.lanes.find(l => l.key === "plans")!.pieces;
        const to = row.filter(p => p.id !== piece.id && (p.start + p.end) / 2 < mid).length;
        if (to !== slot) haptic("tick");
        setSlot(to); setGhost({ start: piece.start + dt, end: piece.end + dt });
      }
    },
    onPanResponderRelease: () => {
      const L = live.current, sel = L.selection!;
      setGhost(g => {
        if (g) {
          if (kind !== "body") L.onTrim(sel, g.start, g.end);
          else if (FREE.includes(sel.lane)) L.onMove(sel, g.start);
        }
        return null;
      });
      setSlot(s => { if (kind === "body" && !FREE.includes(sel.lane) && s !== null && s !== sel.index) L.onReorder(sel.index, s); return null; });
      lastSnap.current = null; onDragging?.(false);
    },
    onPanResponderTerminate: () => { setGhost(null); setSlot(null); onDragging?.(false); },
  });

  const selectedPiece = selection ? lanes.find(l => l.key === selection.lane)?.pieces.find(p => p.id === selection.id) ?? null : null;
  const pans = useMemo(() => selectedPiece ? { start: drag("start", selectedPiece), end: drag("end", selectedPiece), body: drag("body", selectedPiece) } : null,
    [selectedPiece?.id, selectedPiece?.start, selectedPiece?.end]);
  // Seconds on the ruler: fewer labels when zoomed out.
  const every = pps >= 80 ? 1 : pps >= 30 ? 2 : pps >= 15 ? 5 : 10;
  const ticks = Array.from({ length: Math.floor(total / every) + 1 }, (_, i) => i * every);
  const from = timeline.musique.passage?.debut ?? 0;
  const beats = timeline.musique.temps_forts.map(b => b - from).filter(b => b >= 0 && b <= total);

  return (
    <View {...pinchPan.panHandlers} accessibilityLabel={t.label} onLayout={e => setWidth(e.nativeEvent.layout.width)} style={styles.wrap}>
      {width ? (
        <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: half }}
          onScrollBeginDrag={() => { dragged.current = true; auto.current = false; }}
          onScroll={e => { if (auto.current) { auto.current = false; return; } onSeek(Math.max(0, Math.min(total, e.nativeEvent.contentOffset.x / pps))); }}
          onMomentumScrollEnd={() => { dragged.current = false; }}
          onScrollEndDrag={e => { if (!e.nativeEvent.velocity?.x) dragged.current = false; }}>
          <View style={{ width: total * pps }}>
            <View style={styles.ruler}>
              {ticks.map(s => (
                <View key={s} style={[styles.tick, { left: s * pps }]}>
                  <View style={[styles.tickMark, { backgroundColor: c.line }]} />
                  <Text variant="caption" tone="textMuted">{clock(s)}</Text>
                </View>
              ))}
            </View>
            {lanes.map(l => (
              <View key={l.key} accessibilityLabel={t.lanes[l.key]} style={[styles.lane, { height: l.key === "plans" ? tokens.size.laneMain : tokens.size.lane }]}>
                {!l.pieces.length ? <Text variant="caption" tone="textMuted" style={styles.empty}>{t.lanes[l.key]}</Text> : null}
                {l.key === "musique" ? beats.map((b, i) => <View key={i} style={[styles.beat, { left: b * pps, backgroundColor: c.actionStrong }]} />) : null}
                {l.pieces.map(p => {
                  const sel = selection?.lane === l.key && selection.id === p.id;
                  const g = sel && ghost ? ghost : p;
                  return (
                    <View key={p.id} style={[styles.piece, { left: g.start * pps, width: Math.max((g.end - g.start) * pps, tokens.size.selection * 2), backgroundColor: c[FILL[l.key]], borderColor: sel ? c.text : c.line, borderWidth: sel ? tokens.size.selection : tokens.size.border, zIndex: sel ? 2 : 1 }]}
                      {...(sel && pans ? pans.body.panHandlers : {})}>
                      <Pressable accessibilityRole="button" accessibilityState={{ selected: sel }}
                        accessibilityLabel={t.piece(t.lanes[l.key], p.index + 1, clock(p.start), clock(p.end))}
                        accessibilityActions={sel && l.key !== "musique" && l.key !== "effets" ? [{ name: "longer", label: t.longer }, { name: "shorter", label: t.shorter }, ...(FREE.includes(l.key) ? [{ name: "later", label: t.later }, { name: "earlier", label: t.earlier }] : [])] : undefined}
                        onAccessibilityAction={e => {
                          const n = e.nativeEvent.actionName, s = { lane: l.key, id: p.id, index: p.index };
                          if (n === "longer" || n === "shorter") onTrim(s, p.start, p.end + (n === "longer" ? 0.5 : -0.5));
                          else onMove(s, Math.max(0, p.start + (n === "later" ? 0.5 : -0.5)));
                        }}
                        onPress={() => { haptic("tick"); onSelect(sel ? null : { lane: l.key, id: p.id, index: p.index }); }} style={styles.fill}>
                        {p.label && (g.end - g.start) * pps > tokens.size.touch ? <Text variant="caption" tone={INK[l.key]} numberOfLines={1}>{l.key === "plans" ? String(p.index + 1) : p.label}</Text> : null}
                      </Pressable>
                      {sel && pans && l.key !== "musique" && l.key !== "effets" ? (
                        <>
                          <View {...pans.start.panHandlers} accessibilityLabel={t.startHandle} style={[styles.handle, styles.left, { backgroundColor: c.text }]} />
                          <View {...pans.end.panHandlers} accessibilityLabel={t.endHandle} style={[styles.handle, styles.right, { backgroundColor: c.text }]} />
                        </>
                      ) : null}
                    </View>
                  );
                })}
                {l.key === "plans" && slot !== null ? <View pointerEvents="none" style={[styles.slot, { left: slotX(l.pieces, slot, selection?.id) * pps, backgroundColor: c.actionStrong }]} /> : null}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}
      <View pointerEvents="none" style={[styles.playhead, { left: half - tokens.size.playhead / 2, backgroundColor: c.text }]} />
    </View>
  );
}

// Where the drop line of a moved shot goes: the start of the shot it lands before.
function slotX(row: Piece[], to: number, moving?: string) {
  const others = row.filter(p => p.id !== moving);
  return to < others.length ? others[to].start : others[others.length - 1]?.end ?? 0;
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  ruler: { height: tokens.size.ruler, marginBottom: tokens.space.xxs },
  tick: { position: "absolute", top: 0, flexDirection: "row", gap: tokens.space.xxs, alignItems: "flex-start" },
  tickMark: { width: tokens.size.border, height: tokens.size.ruler * 0.6 },
  lane: { position: "relative", marginBottom: tokens.space.xxs },
  piece: { position: "absolute", top: 0, bottom: 0, borderRadius: tokens.radius.chip, overflow: "visible" },
  fill: { flex: 1, justifyContent: "center", paddingHorizontal: tokens.space.xs, overflow: "hidden" },
  handle: { position: "absolute", top: 0, bottom: 0, width: tokens.size.handleGrip, borderRadius: tokens.radius.chip },
  left: { left: -tokens.size.handleGrip / 2 },
  right: { right: -tokens.size.handleGrip / 2 },
  empty: { position: "absolute", left: 0, top: tokens.space.xxs },
  beat: { position: "absolute", top: "40%", width: tokens.size.beatDot / 2, height: tokens.size.beatDot / 2, borderRadius: tokens.radius.full },
  slot: { position: "absolute", top: -tokens.space.xxs, bottom: -tokens.space.xxs, width: tokens.size.playhead * 2, borderRadius: tokens.radius.full, zIndex: 3 },
  playhead: { position: "absolute", top: 0, bottom: 0, width: tokens.size.playhead, borderRadius: tokens.radius.full },
});
