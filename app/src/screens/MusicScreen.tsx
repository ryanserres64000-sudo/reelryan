import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { analyzeTempo, beatGrid, bestPassage, loudness, MIN_CONFIDENCE, snapPassage, tapTempo, TRENDING_TEMPOS, waveformPeaks, type MusicError } from "../../../core/music";
import { fr } from "../copy/fr";
import { Button, Chip, MusicPicker, Screen, Text, Waveform, tokens, useTheme } from "../design";
import type { Analysis, Music } from "../flow/types";
import { MusicFailure, type LoadedSound } from "../music/common";
import { decodeSound, downloadSound, importSound, openSound, touchSound } from "../music/sound";

type Props = { music: Music; onChange: (m: Music) => void; briefDuration: number; incoming?: { uri: string; name?: string } | null; onBack: () => void; onNext: () => void };
type Status = { kind: "idle" } | { kind: "loading"; share: number | null } | { kind: "analyzing" } | { kind: "error"; error: MusicError } | { kind: "tap"; reason: "noDecoder" | "noTempo" };
const BARS = 240;

// Step 3 (étude, ch. 5 §3): my sound (MP3 link or file), trending sound, or none. For my sound: download
// with progress, tempo and beats heard on the phone, the loudest passage proposed on a first beat and
// moved with the finger, listening in a loop, the dated rights checkbox and the muted-sound warning.
export function MusicScreen({ music, onChange, briefDuration, incoming, onBack, onNext }: Props) {
  const { c } = useTheme();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [preview, setPreview] = useState<number | null>(null);
  const [taps, setTaps] = useState<number[]>([]);
  const abort = useRef<AbortController | null>(null);
  const set = (p: Partial<Music>) => onChange({ ...music, ...p });
  const a = music.analysis;

  // What a song becomes once heard: waveform, tempo, beats, and the passage to propose.
  const analyse = async (sound: LoadedSound, fromLink: boolean) => {
    setStatus({ kind: "analyzing" });
    touchSound(sound.key);
    const decoded = await decodeSound(sound);
    const base = { ...music, choice: "mine" as const, sound, fromLink, rightsAt: null };
    if (!decoded) { onChange({ ...base, analysis: null, passage: null }); setStatus({ kind: "tap", reason: "noDecoder" }); return; }
    const tempo = analyzeTempo(decoded.samples, decoded.rate);
    const perSecond = loudness(decoded.samples, decoded.rate);
    const analysis: Analysis = { bpm: tempo?.bpm ?? 0, confidence: tempo?.confidence ?? 0, beats: tempo?.beats ?? [], downbeats: tempo?.downbeats ?? [], peaks: waveformPeaks(decoded.samples, BARS), perSecond, duration: decoded.duration, tapped: false };
    const length = Math.min(music.length, Math.floor(decoded.duration));
    onChange({ ...base, analysis, length, passage: bestPassage(perSecond, analysis.downbeats, length) });
    setStatus(tempo && tempo.confidence >= MIN_CONFIDENCE ? { kind: "idle" } : { kind: "tap", reason: "noTempo" });
  };

  const run = async (load: (signal: AbortSignal) => Promise<LoadedSound | null>, fromLink: boolean) => {
    abort.current?.abort();
    const ctrl = new AbortController(); abort.current = ctrl;
    setStatus({ kind: "loading", share: null });
    try {
      const sound = await load(ctrl.signal);
      if (!sound) { setStatus({ kind: "idle" }); return; }
      await analyse(sound, fromLink);
    } catch (e) {
      const reason = e instanceof MusicFailure ? e.reason : "network";
      setStatus(reason === "cancelled" ? { kind: "idle" } : { kind: "error", error: reason });
    }
  };
  const fromLink = (url: string) => run(signal => downloadSound(url, { signal, onProgress: share => setStatus({ kind: "loading", share }) }), true);
  const fromFile = () => run(() => importSound(), false);

  // A sound shared from AirDrop or the Dictaphone lands here directly.
  useEffect(() => { if (incoming) run(() => openSound(incoming.uri, incoming.name), false); }, [incoming?.uri]);
  useEffect(() => () => abort.current?.abort(), []);

  const keepTaps = () => {
    const bpm = tapTempo(taps);
    if (!bpm || !music.sound) return;
    const duration = a?.duration ?? Math.max(briefDuration, 60);
    const beats = beatGrid(bpm, duration);
    const downbeats = beats.filter((_, i) => i % 4 === 0);
    const length = Math.min(music.length, Math.floor(duration));
    const perSecond = a?.perSecond ?? [];
    set({ analysis: { bpm, confidence: 1, beats, downbeats, peaks: a?.peaks ?? [], perSecond, duration, tapped: true }, length, passage: perSecond.length ? bestPassage(perSecond, downbeats, length) : { debut: 0, fin: length } });
    setTaps([]); setStatus({ kind: "idle" });
  };

  const setLength = (length: number) => {
    if (!a) return set({ length });
    const l = Math.min(length, Math.floor(a.duration));
    set({ length: l, passage: snapPassage(music.passage?.debut ?? 0, a.downbeats, l, a.duration) });
  };

  const mineReady = music.choice === "mine" && !!music.sound && !!music.passage && status.kind !== "loading" && status.kind !== "analyzing";
  const blocked = music.choice === "mine" && (!mineReady || !music.rightsAt);
  const start = preview ?? music.passage?.debut ?? 0;

  return (
    <Screen title={fr.music.title} detail={fr.musicScreen.detail} onBack={onBack}
      footer={<>
        {music.choice === "mine" && mineReady && !music.rightsAt ? <Text variant="caption" tone="textMuted">{fr.musicScreen.rightsNeeded}</Text> : null}
        <Button label={fr.nav.next} disabled={blocked} onPress={onNext} haptic />
      </>}>
      <MusicPicker value={music.choice} recommended="trending" onChange={choice => set({ choice })} onLink={fromLink} />

      {music.choice === "mine" ? (
        <View style={styles.block}>
          {status.kind === "idle" && !music.sound ? <>
            <Button variant="secondary" label={fr.musicScreen.importFile} onPress={fromFile} />
            <Text variant="caption" tone="textMuted">{fr.musicScreen.importHint}</Text>
          </> : null}

          {status.kind === "loading" || status.kind === "analyzing" ? (
            <View style={styles.row} accessibilityLiveRegion="polite">
              <Text tone="ai" style={styles.grow}>{status.kind === "loading" ? fr.musicScreen.downloading(status.share) : fr.musicScreen.analyzing}</Text>
              {status.kind === "loading" ? <Chip label={fr.musicScreen.cancel} onPress={() => abort.current?.abort()} /> : null}
            </View>
          ) : null}

          {status.kind === "error" ? <>
            <Text tone="danger" accessibilityLiveRegion="assertive">{fr.music.errors[status.error]}</Text>
            <Button variant="secondary" label={fr.musicScreen.importFile} onPress={fromFile} />
          </> : null}

          {music.sound && status.kind !== "loading" && status.kind !== "analyzing" ? (
            <View style={styles.block}>
              <View style={styles.row}>
                <Text variant="bodyStrong" numberOfLines={1} style={styles.grow}>{music.sound.name}</Text>
                <Chip label={fr.musicScreen.change} onPress={() => { abort.current?.abort(); set({ sound: null, analysis: null, passage: null, rightsAt: null }); setStatus({ kind: "idle" }); }} />
              </View>
              {a && a.bpm ? <Text variant="mono" tone="ai">{a.tapped ? fr.musicScreen.tempoTapped(a.bpm) : fr.musicScreen.tempo(a.bpm)}</Text> : null}

              {status.kind === "tap" ? <TapTempo reason={status.reason} taps={taps} onTap={t => setTaps(x => [...x.slice(-11), t])} onKeep={keepTaps} onReset={() => setTaps([])}
                onSkip={() => { setStatus({ kind: "idle" }); if (!music.passage) set({ passage: { debut: 0, fin: music.length } }); }} /> : null}

              {a && a.peaks.length && music.passage ? <>
                <Waveform peaks={a.peaks} duration={a.duration} start={start} length={music.length} downbeats={a.downbeats} onLengthChange={setLength}
                  onMove={setPreview} onRelease={s => { setPreview(null); set({ passage: snapPassage(s, a.downbeats, music.length, a.duration) }); }} />
                <Listen uri={music.sound.uri} from={music.passage.debut} to={music.passage.fin} />
              </> : null}

              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!music.rightsAt }} onPress={() => set({ rightsAt: music.rightsAt ? null : new Date().toISOString() })} style={styles.check}>
                <View style={[styles.box, { borderColor: music.rightsAt ? c.actionStrong : c.line, backgroundColor: music.rightsAt ? c.action : "transparent" }]}>
                  {music.rightsAt ? <Text variant="caption" tone="onAction">✓</Text> : null}
                </View>
                <Text variant="callout" style={styles.grow}>{fr.music.rights}</Text>
              </Pressable>
            </View>
          ) : null}
          <Text variant="caption" tone="textMuted">{fr.music.warning}</Text>
        </View>
      ) : null}

      {music.choice === "trending" ? (
        <View style={styles.block}>
          <Text variant="callout" tone="textMuted">{fr.musicScreen.trendingTempo}</Text>
          <View style={styles.row}>{TRENDING_TEMPOS.map(t => <Chip key={t} label={fr.musicScreen.tempo(t)} selected={music.trendingTempo === t} onPress={() => set({ trendingTempo: t })} />)}</View>
          <Text variant="caption" tone="textMuted">{fr.musicScreen.trendingDetail}</Text>
        </View>
      ) : null}
      {music.choice === "none" ? <Text variant="caption" tone="textMuted">{fr.musicScreen.noneDetail}</Text> : null}
    </Screen>
  );
}

// « Tape le rythme »: a large area to tap on each beat, at least 4 taps.
function TapTempo({ reason, taps, onTap, onKeep, onReset, onSkip }: { reason: "noDecoder" | "noTempo"; taps: number[]; onTap: (t: number) => void; onKeep: () => void; onReset: () => void; onSkip: () => void }) {
  const { c } = useTheme();
  const bpm = tapTempo(taps);
  return (
    <View style={styles.block}>
      <Text tone="textMuted">{reason === "noDecoder" ? fr.musicScreen.noDecoder : fr.music.errors.noTempo}</Text>
      <Pressable onPressIn={() => onTap(Date.now())} accessibilityRole="button" accessibilityLabel={fr.music.tapTempo}
        style={({ pressed }) => [styles.tap, { borderColor: c.ai, backgroundColor: pressed ? c.surfaceRaised : c.surface }]}>
        <Text variant="headline" tone="ai">{fr.music.tapTempo}</Text>
        <Text variant="mono" tone="textMuted">{bpm ? fr.musicScreen.tempo(bpm) : fr.musicScreen.tapMore(Math.max(1, 4 - taps.length))}</Text>
      </Pressable>
      <View style={styles.row}>
        {bpm ? <Chip label={fr.musicScreen.tapKeep(bpm)} kind="ai" onPress={onKeep} /> : null}
        {taps.length ? <Chip label={fr.musicScreen.tapRetry} onPress={onReset} /> : null}
        <Chip label={fr.musicScreen.noSync} onPress={onSkip} />
      </View>
    </View>
  );
}

// Listening to the passage in a loop.
function Listen({ uri, from, to }: { uri: string; from: number; to: number }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  useEffect(() => { if (status.playing && status.currentTime >= to) player.seekTo(from); }, [status.currentTime]);
  useEffect(() => { if (status.playing) player.seekTo(from); }, [from]);
  const toggle = () => { if (status.playing) player.pause(); else { player.seekTo(from); player.play(); } };
  return <Button variant="secondary" label={status.playing ? fr.musicScreen.stopListening : fr.musicScreen.listen} onPress={toggle} />;
}

const styles = StyleSheet.create({
  block: { gap: tokens.space.sm },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tokens.space.xs },
  grow: { flex: 1 },
  check: { flexDirection: "row", gap: tokens.space.sm, alignItems: "flex-start", minHeight: tokens.size.touch },
  box: { width: tokens.size.icon, height: tokens.size.icon, borderRadius: tokens.radius.chip / 2, borderWidth: tokens.size.selection, alignItems: "center", justifyContent: "center" },
  tap: { minHeight: tokens.size.button * 2.5, borderRadius: tokens.radius.card, borderWidth: tokens.size.border, alignItems: "center", justifyContent: "center", gap: tokens.space.xs },
});
