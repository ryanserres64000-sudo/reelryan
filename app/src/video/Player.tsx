import { requireNativeView, requireOptionalNativeModule } from "expo";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import type { ExportFile } from "../../../core/export";
import type { TimelineV1 } from "../../../core/timeline";
import type { Sources } from "./sources";

// The engine of the full-screen player: the native AVPlayer on the export's composition when the
// module is compiled, otherwise a clock that moves through the edit so the drawn frame follows the
// same time (web preview, simulator without rushes). Both are driven the same way.
export type PlayerHandle = { play: () => void; pause: () => void; seek: (s: number) => void; mute: (m: boolean) => void };
type NativeRef = { play: () => Promise<void>; pause: () => Promise<void>; seek: (s: number) => Promise<void>; setMuted: (m: boolean) => Promise<void> };
type NativeProps = { source: { timeline: TimelineV1; file: ExportFile; sources: Sources }; style?: StyleProp<ViewStyle>; onTime?: (e: { nativeEvent: { time: number } }) => void; onError?: () => void; ref?: unknown };
const Native = requireOptionalNativeModule("MadaVideo") ? requireNativeView<NativeProps>("MadaVideo") : null;
const TICK = 50;

type Props = { timeline: TimelineV1; file: ExportFile; sources: Promise<Sources> | null; duration: number; playing: boolean; onTime: (t: number) => void; style?: StyleProp<ViewStyle>; fallback: ReactNode };

export const Player = forwardRef<PlayerHandle, Props>(function Player({ timeline, file, sources, duration, playing, onTime, style, fallback }, ref) {
  const [ready, setReady] = useState<Sources | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let on = true; sources?.then(s => on && setReady(s)); return () => { on = false; }; }, [sources]);
  const native = useRef<NativeRef | null>(null);
  const time = useRef(0);
  const live = !!Native && !!ready && !failed;

  // The clock, when there is no native player: time moves while playing and loops like a Reel.
  useEffect(() => {
    if (live || !playing) return;
    const id = setInterval(() => { time.current = time.current + TICK / 1000 >= duration ? 0 : time.current + TICK / 1000; onTime(time.current); }, TICK);
    return () => clearInterval(id);
  }, [live, playing, duration]);
  useEffect(() => { if (live) (playing ? native.current?.play() : native.current?.pause())?.catch(() => {}); }, [live, playing]);

  useImperativeHandle(ref, () => ({
    play: () => { native.current?.play().catch(() => {}); },
    pause: () => { native.current?.pause().catch(() => {}); },
    seek: s => { time.current = s; onTime(s); native.current?.seek(s).catch(() => {}); },
    mute: m => { native.current?.setMuted(m).catch(() => {}); },
  }), [onTime]);

  if (!live || !Native) return <>{fallback}</>;
  return <Native ref={native} source={{ timeline, file, sources: ready! }} style={style} onError={() => setFailed(true)}
    onTime={e => {
      const t = e.nativeEvent.time;
      // Loops like a Reel.
      if (t >= duration - 0.05) native.current?.seek(0).catch(() => {});
      time.current = t; onTime(t);
    }} />;
});
