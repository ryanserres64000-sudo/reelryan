import { useRef, useState } from "react";
import { StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { NEUTRALS, addText, deleteLayer, moveLayer, pushDesign, redoDesign, reorder, resizeText, setLayer, startDesignHistory, undoDesign, type Design, type DesignHistory, type TextLayer, type VisualBrief } from "../../../core/design";
import type { Brand } from "../brand/types";
import { fr } from "../copy/fr";
import { Button, Card, Chip, MadaSays, Screen, Swatch, Text, tokens, typeStyle, useTheme } from "../design";
import { assetsOf, lookOf, retouchVisual, type Photo, type VisualResult } from "../visual/api";
import { DesignView } from "../visual/DesignView";
import { useVisualFonts } from "../visual/fonts";

type Props = { result: VisualResult; brief: VisualBrief; photos: Photo[]; brand: Brand | null; onSave: (d: Design) => void; onBack: () => void };
const t = fr.visual;
const ALIGNS = ["left", "center", "right"] as const;
const STEP = 20;

// The layer editor (étude, ch. 5 §7 ; Ryan, 28 octobre : « donner la main »). What MaDa corrected is
// said first (ch. 4, relecture visible). Every change by hand is instant, locks the layer against a
// later AI retouch, and can be undone without limit. Arrows beside the drag, for VoiceOver users.
export function VisualEditorScreen({ result, brief, photos, brand, onSave, onBack }: Props) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const fonts = useVisualFonts();
  const [h, setH] = useState<DesignHistory>(() => startDesignHistory(result.design));
  const [sel, setSel] = useState<string | null>(null);
  const [ask, setAsk] = useState("");
  const [say, setSay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const d = h.present, look = lookOf(brand), assets = assetsOf(photos, brand);
  const l = d.layers.find(x => x.id === sel) ?? null;
  const [typing, setTyping] = useState<string | null>(null);
  const apply = (next: Design) => { setTyping(null); setH(pushDesign(h, next)); };
  // Typing in a text is one step of the history, not one per letter.
  const type = (id: string, next: Design) => { setH(typing === id ? { ...h, present: next } : pushDesign(h, next)); setTyping(id); };
  // Small enough to keep the tools in view under it while editing.
  const canvas = Math.min(width - tokens.layout.gutter * 2, tokens.layout.largePhoneWidth, (height * 0.5 * d.w) / d.h);
  const colors = [...new Set([...look.couleurs, ...NEUTRALS])];

  const retouch = async () => {
    const s = ask.trim();
    if (!s || busy) return;
    setBusy(true); setSay(t.retouching);
    ctl.current = new AbortController();
    try {
      const out = await retouchVisual(d, s, brief, brand, photos, ctl.current.signal);
      if (!out) setSay(t.retouchOffline);
      else { apply(out.design); setSay([out.summary, ...out.relecture].filter(Boolean).join(" ")); setAsk(""); }
    } catch { setSay(t.retouchError); }
    finally { setBusy(false); }
  };

  const review = result.relecture;
  return (
    <Screen title={t.editorTitle} detail={t.editorDetail} onBack={onBack}
      footer={<>
        <Text variant="caption" tone="textMuted">{t.exportSoon}</Text>
        <Button label={t.save} disabled={busy} onPress={() => onSave(d)} haptic />
      </>}>
      {!result.byAi ? <MadaSays text={t.offline} /> : null}
      {result.concept ? <MadaSays text={t.concept(result.concept)} /> : null}
      {result.byAi || review.length ? <MadaSays text={[t.review(review.length), ...review].join(" ")} /> : null}

      <View style={[styles.canvas, { borderColor: c.line }]}>
        {fonts ? <DesignView design={d} width={canvas} assets={assets} selected={sel} onSelect={setSel} onMove={(id, dx, dy) => apply(moveLayer(d, id, dx, dy))} /> : null}
      </View>
      <View style={styles.row}>
        <Chip label={fr.editor.undo} disabled={!h.past.length} onPress={() => setH(undoDesign(h))} />
        <Chip label={fr.editor.redo} disabled={!h.future.length} onPress={() => setH(redoDesign(h))} />
        <Chip label={t.addText} onPress={() => { const next = addText(d, t.newText, look); apply(next); setSel(next.layers[next.layers.length - 1].id); }} />
      </View>

      <Card>
        {!l ? <Text tone="textMuted">{t.nothingPicked}</Text> : (
          <View style={styles.tools}>
            <Text variant="headline">{l.type === "image" && l.asset === "logo" ? t.logo : t.layer[l.type]}</Text>
            {l.type === "text" ? <TextTools l={l} d={d} colors={colors} apply={apply} type={next => type(l.id, next)} /> : null}
            <View style={styles.row}>
              {(["left", "up", "down", "right"] as const).map(k => (
                <Chip key={k} label={t.nudge[k]} accessibilityLabel={t.nudgeLabel[k]}
                  onPress={() => apply(moveLayer(d, l.id, k === "left" ? -STEP : k === "right" ? STEP : 0, k === "up" ? -STEP : k === "down" ? STEP : 0))} />
              ))}
            </View>
            <View style={styles.row}>
              <Chip label={t.front} onPress={() => apply(reorder(d, l.id, 1))} />
              <Chip label={t.back} onPress={() => apply(reorder(d, l.id, -1))} />
              <Chip label={t.remove} disabled={d.layers.length <= 1} onPress={() => { apply(deleteLayer(d, l.id)); setSel(null); }} />
            </View>
          </View>
        )}
      </Card>

      <View style={styles.field}>
        <Text variant="callout" tone="textMuted" nativeID="vask-label">{t.retouch}</Text>
        <View style={styles.askRow}>
          <TextInput value={ask} onChangeText={setAsk} onSubmitEditing={retouch} placeholder={t.retouchPlaceholder} placeholderTextColor={c.textMuted}
            accessibilityLabelledBy="vask-label" maxLength={300} returnKeyType="send" editable={!busy}
            style={[typeStyle("body"), styles.input, styles.flex, { color: c.text, borderColor: c.line, backgroundColor: c.surface }]} />
          <Button variant="secondary" label={fr.corrections.send} disabled={!ask.trim() || busy} onPress={retouch} style={styles.auto} />
        </View>
        {say ? <MadaSays text={say} /> : null}
      </View>
    </Screen>
  );
}

function TextTools({ l, d, colors, apply, type }: { l: TextLayer; d: Design; colors: string[]; apply: (d: Design) => void; type: (d: Design) => void }) {
  const { c } = useTheme();
  const current = typeof l.color === "string" ? l.color.slice(0, 7).toUpperCase() : null;
  return (
    <>
      <Text variant="callout" tone="textMuted" nativeID="vtext-label">{t.editText}</Text>
      <TextInput value={l.text} onChangeText={v => type(setLayer(d, l.id, { text: v }))} accessibilityLabelledBy="vtext-label" multiline maxLength={300}
        style={[typeStyle("body"), styles.input, { color: c.text, borderColor: c.line, backgroundColor: c.surface }]} />
      <View style={styles.row}>
        <Chip label={t.smaller} onPress={() => apply(resizeText(d, l.id, 0.9))} />
        <Chip label={t.bigger} onPress={() => apply(resizeText(d, l.id, 1.1))} />
        {ALIGNS.map(a => <Chip key={a} label={t.align[a]} selected={l.align === a} onPress={() => apply(setLayer(d, l.id, { align: a }))} />)}
      </View>
      <Text variant="callout" tone="textMuted">{t.color}</Text>
      <View style={styles.row}>
        {colors.map(col => <Swatch key={col} color={col} selected={current === col.toUpperCase()} label={t.colorName(col)} onPress={() => apply(setLayer(d, l.id, { color: col }))} />)}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  canvas: { alignSelf: "center", borderWidth: tokens.size.border, borderRadius: tokens.radius.chip, overflow: "hidden" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs, alignItems: "center" },
  tools: { gap: tokens.space.sm },
  field: { gap: tokens.space.xs },
  askRow: { flexDirection: "row", gap: tokens.space.xs, alignItems: "center" },
  input: { borderWidth: tokens.size.border, borderRadius: tokens.radius.button, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm, minHeight: tokens.size.touch },
  flex: { flex: 1 },
  auto: { alignSelf: "auto" },
});
