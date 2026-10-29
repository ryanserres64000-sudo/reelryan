import { forwardRef, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { W, placeOf, withPlace, type ExportFile, type PlacedText } from "../../../core/export";
import { boxAt, isOn } from "../../../core/layers";
import { shotAt, segments } from "../../../core/playback";
import { RENDER, type TextPlace } from "../../../core/textlook";
import type { Cadre, TimelineV1 } from "../../../core/timeline";
import { fr } from "../copy/fr";
import { Icon, Text, haptic, tokens, useTheme } from "../design";
import { LayerGrip, type LayerMove } from "../editor/LayerGrip";
import { CropGrip } from "../editor/CropGrip";
import { TextGrip } from "../editor/TextGrip";
import { Player, type PlayerHandle } from "./Player";
import { ShotStill } from "./Still";
import { TextOverlay, fontOf } from "./TextOverlay";
import type { Sources } from "./sources";

type Props = {
  timeline: TimelineV1; file: ExportFile; sources: Promise<Sources> | null; time: number; playing: boolean; onTime: (t: number) => void; width: number;
  // In the editor: the selected layer can be moved and pinched on the picture (étape 6).
  selectedLayer?: string | null; onLayerMove?: (id: string, m: LayerMove) => void; onDragging?: (on: boolean) => void;
  // Texts on the picture (Ryan's first test): touch one to choose it, then move, pinch, turn it, or
  // touch it twice to write in it. `n` is the text's index in the timeline.
  selectedText?: number | null; onTextSelect?: (n: number) => void; onTextPlace?: (n: number, p: TextPlace) => void;
  onTextWrite?: (n: number, texte: string) => void;
  // Reframing a shot by hand (étape 4): the shot shown under the play head, and the new frame.
  crop?: { index: number; onCadre: (c: Cadre) => void } | null;
  // A tap on the picture itself (not on a text or a layer): play or pause.
  onTapPicture?: () => void;
};

// The picture at `time`, shared by the full-screen player and the editor: the native player when it
// is compiled, otherwise a plain frame with the shot number; texts and layers drawn on top where the
// native render puts them (Overlay.swift), so the drawing never lies about the export.
export const Frame = forwardRef<PlayerHandle, Props>(function Frame({ timeline, file, sources, time, playing, onTime, width, selectedLayer, onLayerMove, onDragging, selectedText, onTextSelect, onTextPlace, onTextWrite, onTapPicture, crop }, ref) {
  const { c } = useTheme();
  const segs = segments(timeline), { index } = shotAt(segs, time), k = width / W;
  const height = width * 16 / 9;
  const duration = segs.length ? segs[segs.length - 1].end : timeline.duree;
  const layers = (timeline.calques ?? []).filter(l => isOn(l, time));
  const grip = selectedLayer && onLayerMove ? layers.find(l => l.id === selectedLayer) : undefined;
  // The native preview draws the shots, layers and logo; the texts are drawn here, from the same boxes
  // as Overlay.swift, so a text follows the finger at once and the composition is not rebuilt on every
  // letter. The export draws them natively from the same plan.
  const bare = JSON.stringify({ ...timeline, textes: [] }), bareFile = JSON.stringify({ ...file, textes: [] });
  const playerTimeline = useMemo(() => JSON.parse(bare) as TimelineV1, [bare]);
  const playerFile = useMemo(() => JSON.parse(bareFile) as ExportFile, [bareFile]);
  const [live, setLive] = useState<TextPlace | null>(null);
  const [writing, setWriting] = useState<number | null>(null);
  useEffect(() => { setLive(null); if (writing !== selectedText) setWriting(null); }, [selectedText]);
  // Paused in the editor: every text fully shown, without its entrance, so it can be read and touched.
  const editable = !!onTextSelect && !playing;
  const shown = file.textes.filter(x => (time >= x.debut && time < x.fin) || (editable && x.n === selectedText && time >= x.debut - 0.05 && time < x.fin + 0.05));
  const draw = (x: PlacedText) => (live && x.n === selectedText ? withPlace(x, live) : x);
  const chosen = editable ? shown.find(x => x.n === selectedText) : undefined;
  return (
    <View style={[styles.frame, { width, height, backgroundColor: c.media }]}>
      <Player ref={ref} timeline={playerTimeline} file={playerFile} sources={sources} duration={duration} playing={playing} onTime={onTime} style={StyleSheet.absoluteFill}
        fallback={
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.surface }]}>
            <Text variant="mono" tone="textMuted">{fr.player.shot(index + 1, segs.length)}</Text>
            <ShotStill timeline={timeline} index={index} sources={sources} />
            {/* Layers over the frame, placed as the export will (fractions of 1080 × 1920). */}
            {layers.map(l => {
              const b = boxAt(l, time);
              return (
                <View key={l.id} style={[styles.layer, styles.center, { left: b.left * width, top: b.top * height, width: b.w * width, height: b.h * height, opacity: b.opacite, borderRadius: l.arrondi * Math.min(b.w * width, b.h * height), transform: [{ rotate: `${b.rotation}deg` }], backgroundColor: c.surfaceRaised, borderColor: c.line }]}>
                  <Icon name={l.detourage === "aucun" ? "play" : "cutout"} tone="textMuted" />
                </View>
              );
            })}
          </View>
        } />
      {/* Under the texts and grips, so a gesture on them never reaches it. */}
      {onTapPicture ? <Pressable onPress={onTapPicture} accessibilityRole="button" accessibilityLabel={fr.tracks.playPause} style={StyleSheet.absoluteFill} /> : null}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {shown.map(x => (writing === x.n ? null : <TextOverlay key={x.n} x={draw(x)} timeline={timeline} time={time} k={k} editing={editable} />))}
      </View>
      {/* Touch a text to choose it. */}
      {editable ? shown.filter(x => x.n !== selectedText).map(x => (
        <Pressable key={`hit${x.n}`} onPress={() => { haptic("tap"); onTextSelect!(x.n); }} accessibilityRole="button" accessibilityLabel={fr.textEdit.grip(x.texte)} accessibilityHint={fr.textEdit.hint}
          style={[styles.hit, { left: x.box.x * k, top: x.box.y * k, width: x.box.w * k, height: x.box.h * k, transform: [{ rotate: `${x.rotation}deg` }] }]} />
      )) : null}
      {chosen && writing === null && onTextPlace ? (
        <TextGrip text={chosen} place={placeOf(timeline.textes[chosen.n])} k={k} onLive={setLive} onDragging={onDragging}
          onPlace={p => onTextPlace(chosen.n, p)} onTap={() => setWriting(chosen.n)} />
      ) : null}
      {chosen && writing === chosen.n && onTextWrite ? <InlineWrite x={chosen} timeline={timeline} k={k} onDone={v => { setWriting(null); if (v.trim() && v !== chosen.texte) onTextWrite(chosen.n, v); }} /> : null}
      {crop && timeline.plans[crop.index] ? <CropGrip plan={timeline.plans[crop.index]} sources={sources} width={width} height={height} onCadre={crop.onCadre} onDragging={onDragging} /> : null}
      {grip ? <LayerGrip layer={grip} time={time} width={width} height={height} onMove={m => onLayerMove!(grip.id, m)} onDragging={onDragging} /> : null}
    </View>
  );
});

// Writing in the text, on the picture, at its size and in its font.
function InlineWrite({ x, timeline, k, onDone }: { x: PlacedText; timeline: TimelineV1; k: number; onDone: (v: string) => void }) {
  const { c } = useTheme();
  const [v, setV] = useState(x.texte);
  const size = x.taille * k, color = x.rendu.couleur ?? timeline.charte.couleurs.texte ?? RENDER.ink;
  return (
    <TextInput value={v} onChangeText={setV} autoFocus multiline submitBehavior="blurAndSubmit" returnKeyType="done" maxLength={140}
      onBlur={() => onDone(v)} accessibilityLabel={fr.textEdit.write} selectionColor={c.action}
      style={[styles.write, { left: x.box.x * k, top: x.box.y * k, width: x.box.w * k, minHeight: x.box.h * k, borderColor: c.action, color, fontFamily: fontOf(timeline, x.rendu.role), fontSize: size, lineHeight: size * RENDER.lineHeight, textAlign: x.rendu.align === "gauche" ? "left" : x.rendu.align === "droite" ? "right" : "center" }]} />
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: tokens.radius.card, overflow: "hidden" },
  center: { alignItems: "center", justifyContent: "center" },
  layer: { position: "absolute", borderWidth: tokens.size.border },
  hit: { position: "absolute" },
  write: { position: "absolute", borderWidth: tokens.size.selection, borderStyle: "dashed", padding: 0 },
});
