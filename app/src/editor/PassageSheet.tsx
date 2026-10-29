import { useEffect, useMemo, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, View } from "react-native";
import { passagesOf } from "../../../core/edit";
import { clock } from "../../../core/playback";
import type { Clips, TimelineV1 } from "../../../core/timeline";
import { fr } from "../copy/fr";
import { Button, Chip, Sheet, Text, haptic, tokens, useTheme } from "../design";
import { isPhoto, stillOf } from "../video/Still";
import type { Sources } from "../video/sources";

type Props = {
  visible: boolean; onClose: () => void; timeline: TimelineV1; clips: Clips; sources: Promise<Sources> | null;
  // The shot the passage goes after (-1: at the start), and the rush to open on.
  after: number; source?: string;
  onAdd: (source: string, debut: number, length: number) => void;
};
const p = fr.passage;
const FRAMES = 8, LENGTHS = [1, 1.5, 2, 3, 4], NUDGE = 0.5;

// Another passage of a rush, chosen by hand (Ryan, 28 octobre : « faire un montage à différents
// moments de la vidéo »): the rush laid out as a strip of its own frames, what is already in the edit
// marked under it, a tap for the start, a length, and the passage goes in after the chosen shot.
export function PassageSheet({ visible, onClose, timeline, clips, sources, after, source, onAdd }: Props) {
  const { c } = useTheme();
  const ids = Object.keys(clips);
  const [rush, setRush] = useState(source ?? ids[0]);
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(2);
  const [uri, setUri] = useState<string | null>(null);
  const [frames, setFrames] = useState<(string | null)[]>([]);
  useEffect(() => { if (visible) { setRush(source ?? ids[0]); setStart(0); } }, [visible, source]);
  const dur = clips[rush]?.duration ?? 0;
  const len = Math.min(length, dur);
  const at = Math.min(start, Math.max(0, dur - len));
  const times = useMemo(() => Array.from({ length: FRAMES }, (_, i) => (dur * (i + 0.5)) / FRAMES), [dur]);
  const taken = passagesOf(timeline, rush);

  useEffect(() => {
    let on = true;
    setFrames([]); setUri(null);
    if (!visible || Platform.OS === "web" || !sources) return;
    sources.then(s => {
      const src = s.rushes[rush];
      if (!src) return;
      setUri(src);
      Promise.all(times.map(t => stillOf(src, t, isPhoto(src)))).then(f => on && setFrames(f));
    }).catch(() => {});
    return () => { on = false; };
  }, [visible, rush, sources, times]);

  // The picture where the passage starts, larger.
  const [still, setStill] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    if (!uri) { setStill(null); return; }
    stillOf(uri, at + 0.05, isPhoto(uri)).then(u => on && setStill(u)).catch(() => {});
    return () => { on = false; };
  }, [uri, at]);

  const [strip, setStrip] = useState(0);
  const pick = (x: number) => { if (!Number.isFinite(x)) return; haptic("tick"); setStart(Math.max(0, Math.min(dur - len, (x / Math.max(1, strip)) * dur - len / 2))); };
  const frac = (v: number) => (dur ? v / dur : 0);
  return (
    <Sheet visible={visible} onClose={onClose} title={p.title}>
      <Text variant="caption" tone="textMuted">{p.why}</Text>
      <View style={styles.row}>
        {ids.map((id, k) => <Chip key={id} label={p.rush(k + 1, clock(clips[id].duration))} selected={rush === id} onPress={() => { setRush(id); setStart(0); }} />)}
      </View>
      <View style={[styles.preview, { backgroundColor: c.media }]}>
        {still ? <Image source={{ uri: still }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={p.frame(clock(at))} /> : null}
        <Text variant="mono" tone="onMedia">{p.at(clock(at))}</Text>
      </View>
      <View style={styles.group}>
        <Text variant="caption" tone="textMuted">{p.moment}</Text>
        <Pressable onLayout={e => setStrip(e.nativeEvent.layout.width)} onPress={e => pick(e.nativeEvent.locationX)}
          accessibilityRole="adjustable" accessibilityLabel={p.moment} accessibilityValue={{ text: p.at(clock(at)) }}
          accessibilityActions={[{ name: "increment", label: p.later }, { name: "decrement", label: p.earlier }]}
          onAccessibilityAction={e => setStart(s => Math.max(0, Math.min(dur - len, s + (e.nativeEvent.actionName === "increment" ? NUDGE : -NUDGE))))}
          style={[styles.strip, { backgroundColor: c.surfaceRaised, borderColor: c.line }]}>
          {times.map((t, i) => (
            <View key={t} style={[styles.cell, { borderColor: c.line }]}>
              {frames[i] ? <Image source={{ uri: frames[i]! }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
            </View>
          ))}
          {/* The chosen passage. */}
          <View pointerEvents="none" style={[styles.window, { left: `${frac(at) * 100}%`, width: `${frac(len) * 100}%`, borderColor: c.action }]} />
        </Pressable>
        {/* What is already in the edit, in the rush's own time. */}
        <View style={[styles.marks, { backgroundColor: c.surface }]} accessibilityLabel={p.taken}>
          {taken.map(x => <View key={x.index} style={[styles.mark, { left: `${frac(x.debut) * 100}%`, width: `${frac(x.fin - x.debut) * 100}%`, backgroundColor: c.textMuted }]} />)}
        </View>
        {taken.length ? <Text variant="caption" tone="textMuted">{p.taken}</Text> : null}
        <View style={styles.row}>
          <Chip label={p.earlier} disabled={at <= 0} onPress={() => setStart(Math.max(0, at - NUDGE))} />
          <Chip label={p.later} disabled={at >= dur - len} onPress={() => setStart(Math.min(dur - len, at + NUDGE))} />
        </View>
      </View>
      <View style={styles.group}>
        <Text variant="caption" tone="textMuted">{p.length}</Text>
        <View style={styles.row}>
          {LENGTHS.filter(l => l <= dur).map(l => <Chip key={l} label={p.seconds(l)} selected={length === l} onPress={() => setLength(l)} />)}
        </View>
      </View>
      <Button label={p.add(after + 1)} disabled={!dur} haptic onPress={() => onAdd(rush, at, len)} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs, alignItems: "center" },
  group: { gap: tokens.space.xxs },
  preview: { height: tokens.size.frise * 3, borderRadius: tokens.radius.card, overflow: "hidden", alignItems: "center", justifyContent: "flex-end", padding: tokens.space.xs },
  strip: { flexDirection: "row", height: tokens.size.frise, borderRadius: tokens.radius.button, borderWidth: tokens.size.border, overflow: "hidden" },
  cell: { flex: 1, borderRightWidth: tokens.size.border },
  window: { position: "absolute", top: 0, bottom: 0, borderWidth: tokens.size.selection, borderRadius: tokens.radius.button },
  marks: { height: tokens.size.textBar, borderRadius: tokens.radius.full, overflow: "hidden" },
  mark: { position: "absolute", top: 0, bottom: 0, borderRadius: tokens.radius.full },
});
