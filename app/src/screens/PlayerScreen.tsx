import { useCallback, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { H, W, exportPlan, inside, safeZone, textBox, type Box } from "../../../core/export";
import { clock, jump, segments, shotAt } from "../../../core/playback";
import type { Plateforme, TimelineV1 } from "../../../core/timeline";
import { fr } from "../copy/fr";
import { Button, Chip, Icon, Text, haptic, tokens, useTheme } from "../design";
import { Frame } from "../video/Frame";
import type { PlayerHandle } from "../video/Player";
import type { Sources } from "../video/sources";

type Props = { timeline: TimelineV1; sources: () => Promise<Sources>; onClose: () => void; onRetouch: (shot: number) => void; onExport: () => void };
const t = fr.player;
const PLATFORMS: Plateforme[] = ["reels", "tiktok", "shorts"];
// The area no button of Instagram, TikTok or YouTube covers.
function strictZone(): Box {
  const zs = PLATFORMS.map(safeZone);
  const x = Math.max(...zs.map(z => z.x)), y = Math.max(...zs.map(z => z.y));
  return { x, y, w: Math.min(...zs.map(z => z.x + z.w)) - x, h: Math.min(...zs.map(z => z.y + z.h)) - y };
}
const CONTROLS = tokens.size.button * 3 + tokens.size.touch * 2 + tokens.space.lg * 2;

// The full-screen player (étude de la refonte, ch. 4 « Voir en grand, puis retoucher »): bars per
// shot like the stories, tap to pause, tap left or right to change shot, drag the bar to move, drag
// down to close. « Voir comme sur Instagram » lays the app's buttons over the frame to check that no
// text is hidden. « Retoucher ce moment » opens the editor on the shot under the play head.
export function PlayerScreen({ timeline, sources, onClose, onRetouch, onExport }: Props) {
  const { c, motion, reduceMotion } = useTheme();
  const { width: sw, height: sh } = useWindowDimensions();
  const player = useRef<PlayerHandle>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  // One vertical video for every platform (Ryan's first test: the per-platform tabs made no sense):
  // a single switch shows what the apps' buttons hide, the strictest of the three.
  const [check, setCheck] = useState(false);
  const segs = useMemo(() => segments(timeline), [timeline]);
  const file = useMemo(() => exportPlan(timeline)[0], [timeline]);
  const src = useMemo(() => sources(), [timeline]);
  const duration = segs.length ? segs[segs.length - 1].end : timeline.duree;
  const { index, progress } = shotAt(segs, time);
  const fw = Math.min(sw, (sh - CONTROLS) * 9 / 16), fh = fw * 16 / 9, k = fw / W;
  const onTime = useCallback((s: number) => setTime(s), []);
  const seek = (s: number) => { const v = Math.max(0, Math.min(duration, s)); player.current?.seek(v); setTime(v); };

  // Tap zones and the drag down to close, on the frame.
  const drop = useRef(new Animated.Value(0)).current;
  const frame = useRef({ w: fw }); frame.current.w = fw;
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => { if (g.dy > 0 && Math.abs(g.dy) > Math.abs(g.dx)) drop.setValue(g.dy); },
    onPanResponderRelease: (e, g) => {
      if (g.dy > tokens.size.dismissDrag) { haptic("tap"); onClose(); return; }
      Animated.spring(drop, { toValue: 0, ...motion.spring, useNativeDriver: true }).start();
      if (Math.abs(g.dx) < tokens.space.xs && Math.abs(g.dy) < tokens.space.xs) {
        const x = e.nativeEvent.locationX, third = frame.current.w / 3;
        if (x < third) { haptic("tick"); seek(jump(segs, time, -1)); }
        else if (x > third * 2) { haptic("tick"); seek(jump(segs, time, 1)); }
        else { haptic("tap"); setPlaying(p => !p); }
      }
    },
  }), [segs, time, duration]);

  // The scrub bar: drag to move, a tick at each cut.
  const bar = useRef({ x: 0, w: 1 });
  const scrub = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: e => { bar.current.x = e.nativeEvent.locationX; setPlaying(false); seek((bar.current.x / bar.current.w) * duration); },
    onPanResponderMove: (_, g) => {
      const s = ((bar.current.x + g.dx) / bar.current.w) * duration;
      if (shotAt(segs, s).index !== shotAt(segs, time).index) haptic("tick");
      seek(s);
    },
    onPanResponderRelease: () => setPlaying(true),
  }), [segs, time, duration]);

  const zone = check ? strictZone() : null;
  const hidden = zone ? timeline.textes.filter(x => !PLATFORMS.every(p => inside(textBox(x, p), zone))).length : 0;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.media }]} edges={["top", "bottom"]}>
      <Animated.View style={[styles.root, { transform: [{ translateY: drop }], opacity: drop.interpolate({ inputRange: [0, tokens.size.dismissDrag * 3], outputRange: [1, reduceMotion ? 1 : 0.5], extrapolate: "clamp" }) }]}>
        <View style={styles.top}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={fr.nav.close} hitSlop={tokens.space.xs} style={styles.icon}><Icon name="close" tone="onMedia" /></Pressable>
          <View style={[styles.shrink, styles.chips]}>
            <Chip label={t.checkZones} selected={check} onPress={() => setCheck(x => !x)} />
          </View>
          <Pressable onPress={() => { setMuted(m => { player.current?.mute(!m); return !m; }); }} accessibilityRole="button" accessibilityLabel={muted ? t.unmute : t.mute} hitSlop={tokens.space.xs} style={styles.icon}>
            <Icon name={muted ? "soundOff" : "sound"} tone="onMedia" />
          </Pressable>
        </View>

        <View {...pan.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={t.label(timeline.titre)} accessibilityHint={t.hint}
          accessibilityActions={[{ name: "activate" }, { name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={e => e.nativeEvent.actionName === "activate" ? setPlaying(p => !p) : seek(jump(segs, time, e.nativeEvent.actionName === "increment" ? 1 : -1))}
          style={[styles.frame, { width: fw, height: fh, backgroundColor: c.media }]}>
          <Frame ref={player} timeline={timeline} file={file} sources={src} time={time} playing={playing} onTime={onTime} width={fw} />
          <View pointerEvents="none" style={styles.bars}>
            {segs.map((s, i) => (
              <View key={i} style={[styles.seg, { flex: s.end - s.start, backgroundColor: c.line }]}>
                <View style={[styles.fill, { width: `${(i < index ? 1 : i === index ? progress : 0) * 100}%`, backgroundColor: c.onMedia }]} />
              </View>
            ))}
          </View>
          {zone ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View accessibilityLabel={t.hiddenZone} style={[styles.hide, { top: 0, left: 0, right: 0, height: zone.y * k, backgroundColor: c.scrim }]} />
              <View style={[styles.hide, { bottom: 0, left: 0, right: 0, height: (H - zone.y - zone.h) * k, backgroundColor: c.scrim }]} />
              <View style={[styles.hide, { top: zone.y * k, bottom: (H - zone.y - zone.h) * k, right: 0, width: (W - zone.x - zone.w) * k, backgroundColor: c.scrim }]} />
              <View style={[styles.verdict, { bottom: (H - zone.y - zone.h) * k + tokens.space.xs, backgroundColor: hidden ? c.danger : c.ok }]}>
                <Icon name={hidden ? "close" : "check"} tone="onAi" size={tokens.size.icon * 0.8} />
                <Text variant="caption" tone="onAi">{hidden ? t.hidden(hidden) : t.allVisible}</Text>
              </View>
            </View>
          ) : null}
          {!playing ? <View pointerEvents="none" style={[styles.paused, { backgroundColor: c.scrim }]}><Icon name="play" tone="text" size={tokens.size.touch} /></View> : null}
        </View>

        <View style={[styles.controls, { width: Math.max(fw, Math.min(sw, tokens.layout.largePhoneWidth)) }]}>
          <View style={styles.between}>
            <Text variant="mono" tone="onMedia">{t.time(clock(time), clock(duration))}</Text>
            <Text variant="caption" tone="onMedia">{t.shot(index + 1, segs.length)}</Text>
          </View>
          <View {...scrub.panHandlers} onLayout={e => { bar.current.w = e.nativeEvent.layout.width; }}
            accessible accessibilityRole="adjustable" accessibilityLabel={t.scrub} accessibilityValue={{ text: t.time(clock(time), clock(duration)) }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={e => seek(jump(segs, time, e.nativeEvent.actionName === "increment" ? 1 : -1))}
            style={styles.scrub}>
            <View style={[styles.track, { backgroundColor: c.line }]}>
              <View style={[styles.trackFill, { width: `${(time / (duration || 1)) * 100}%`, backgroundColor: c.onMedia }]} />
            </View>
            <View style={[styles.knob, { left: `${(time / (duration || 1)) * 100}%`, backgroundColor: c.onMedia }]} />
          </View>
          <Button label={t.export} onPress={onExport} />
          <Button variant="secondary" label={t.retouch} onPress={() => { setPlaying(false); onRetouch(index); }} />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", alignSelf: "stretch" },
  flex: { flex: 1 },
  center: { textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: tokens.space.xs, flexWrap: "wrap", justifyContent: "center" },
  shrink: { flex: 1, minWidth: 0 },
  chips: { gap: tokens.space.xs, alignItems: "center" },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: tokens.space.xs, gap: tokens.space.xs, minHeight: tokens.size.button },
  icon: { width: tokens.size.touch, height: tokens.size.touch, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  frame: { borderRadius: tokens.radius.card, overflow: "hidden" },
  fallback: { alignItems: "center", justifyContent: "center" },
  bars: { position: "absolute", top: tokens.space.xs, left: tokens.space.xs, right: tokens.space.xs, flexDirection: "row", gap: tokens.space.xxs },
  seg: { height: tokens.size.selection * 1.5, borderRadius: tokens.radius.full, overflow: "hidden" },
  fill: { height: "100%" },
  hide: { position: "absolute" },
  verdict: { position: "absolute", alignSelf: "center", left: tokens.space.md, right: tokens.space.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: tokens.space.xxs, minHeight: tokens.size.pill, borderRadius: tokens.radius.full, paddingHorizontal: tokens.space.sm },
  paused: { position: "absolute", alignSelf: "center", top: "45%", width: tokens.size.button * 1.4, height: tokens.size.button * 1.4, borderRadius: tokens.radius.full, alignItems: "center", justifyContent: "center" },
  controls: { gap: tokens.space.sm, paddingHorizontal: tokens.layout.gutter, paddingTop: tokens.space.sm },
  scrub: { height: tokens.size.touch, justifyContent: "center" },
  track: { height: tokens.size.selection * 2, borderRadius: tokens.radius.full, overflow: "hidden" },
  trackFill: { height: "100%" },
  knob: { position: "absolute", width: tokens.size.beatDot * 2.5, height: tokens.size.beatDot * 2.5, borderRadius: tokens.radius.full, marginLeft: -tokens.size.beatDot * 1.25 },
});
