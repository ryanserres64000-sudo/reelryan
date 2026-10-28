import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { useMemo, useState } from "react";
import { StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { H, HASHTAGS_MAX, W, captionFor, exportPlan, offlineCaption, trendTip, type Box, type ExportFile } from "../../../core/export";
import type { TimelineV1 } from "../../../core/timeline";
import type { Brand } from "../brand/types";
import { fr } from "../copy/fr";
import { Button, Card, Chip, MadaSays, Screen, Text, tokens, typeStyle, useTheme } from "../design";
import { canExportVideo, exportVideos } from "../export/video";

type Props = { timeline: TimelineV1; brief: string; brand: Brand | null; rushes: Record<string, string>; onBack: () => void; byAi?: boolean };
const t = fr.exportScreen;

// Step 6 (étude, ch. 5 §7) : the three files with their safe zones, the caption in the brand's tone
// copied in one tap per platform, the trending-sound reminder, then Photos and the share sheet.
export function ExportScreen({ timeline, brief, brand, rushes, onBack, byAi = true }: Props) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const start = timeline.legende.texte || timeline.legende.hashtags.length ? timeline.legende : offlineCaption(brief, brand?.dna ?? null, brand?.answers);
  const [texte, setTexte] = useState(start.texte);
  const tags = start.hashtags;
  const [kept, setKept] = useState<string[]>(start.hashtags.slice(0, HASHTAGS_MAX.reels));
  const [say, setSay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const plan = useMemo(() => exportPlan(timeline, byAi), [timeline, byAi]);
  const tip = trendTip(timeline);
  const legende = { texte, hashtags: kept };
  const frame = (Math.min(width, tokens.layout.largePhoneWidth) - tokens.layout.gutter * 2 - tokens.space.sm * 2) / 3;
  const fmt = fr.rush.duration;

  const copy = async (f: ExportFile) => {
    await Clipboard.setStringAsync(captionFor(timeline, f.plateforme, legende));
    setSay(t.copied(t.names[f.plateforme]));
  };
  const save = async () => {
    setBusy(true);
    await Clipboard.setStringAsync(captionFor(timeline, plan[0].plateforme, legende));
    if (!canExportVideo()) { setSay(t.native); setBusy(false); return; }
    try {
      const uris = await exportVideos(timeline, plan, rushes, i => setSay(t.saving(i + 1, plan.length)));
      setFiles(uris); setSay(t.saved);
    } catch { setSay(t.error); }
    finally { setBusy(false); }
  };

  return (
    <Screen title={t.title} detail={t.detail} onBack={onBack}
      footer={<>
        {say ? <MadaSays text={say} /> : null}
        {files.length ? <Button variant="secondary" label={t.share} onPress={() => Sharing.shareAsync(files[0], { mimeType: "video/mp4", UTI: "public.mpeg-4" })} /> : null}
        <Button label={t.save} disabled={busy} onPress={save} haptic />
      </>}>
      <Text variant="headline">{t.files}</Text>
      <View style={styles.row}>
        {plan.map(f => (
          <View key={f.plateforme} style={[styles.file, { width: frame }]}>
            <SafeFrame f={f} width={frame} />
            <Text variant="callout">{t.names[f.plateforme]}</Text>
            <Text variant="caption" tone="textMuted">{t.file(fmt(f.duree))}</Text>
            {f.coupe ? <Text variant="caption" tone="danger">{t.cut(fmt(f.duree))}</Text> : null}
          </View>
        ))}
      </View>

      {tip ? (
        <Card style={{ borderColor: c.ai }}>
          <Text variant="bodyStrong" tone="ai">{t.trend}</Text>
          <Text variant="callout">{t.trendTip(tip.bpm)}</Text>
        </Card>
      ) : null}

      <View style={styles.field}>
        <Text variant="headline" nativeID="caption-label">{t.caption}</Text>
        <Text variant="caption" tone="textMuted">{t.captionWhy}</Text>
        <TextInput value={texte} onChangeText={setTexte} multiline maxLength={2200} accessibilityLabelledBy="caption-label"
          style={[typeStyle("body"), styles.input, { color: c.text, borderColor: c.line, backgroundColor: c.surface }]} />
        {tags.length ? <>
          <Text variant="callout" tone="textMuted">{t.hashtags}</Text>
          <View style={styles.row}>
            {tags.map(h => <Chip key={h} label={h} selected={kept.includes(h)} onPress={() => setKept(k => (k.includes(h) ? k.filter(x => x !== h) : [...k, h]))} />)}
          </View>
          <Text variant="caption" tone="textMuted">{t.hashtagsWhy(HASHTAGS_MAX.reels)}</Text>
        </> : null}
        {plan.map(f => <Button key={f.plateforme} variant="secondary" label={t.copy(t.names[f.plateforme])} onPress={() => copy(f)} />)}
      </View>
    </Screen>
  );
}

// A small 9:16 frame: what the platform's buttons cover is shaded, texts sit in the clear part.
function SafeFrame({ f, width }: { f: ExportFile; width: number }) {
  const { c } = useTheme();
  const s = width / W;
  const at = (b: Box) => ({ left: b.x * s, top: b.y * s, width: b.w * s, height: b.h * s });
  return (
    <View accessibilityLabel={t.zone(t.names[f.plateforme])} style={[styles.frame, { width, height: H * s, backgroundColor: c.media }]}>
      <View style={[styles.box, at(f.zone), { borderColor: c.onMedia }]} />
      {f.textes.map((x, i) => <View key={i} style={[styles.box, styles.fill, at(x.box), { backgroundColor: c.ai }]} />)}
      {f.sous_titres ? <View style={[styles.box, styles.fill, at(f.sous_titres), { backgroundColor: c.textMuted }]} /> : null}
      {f.logo ? <View style={[styles.box, styles.fill, at(f.logo), { backgroundColor: c.action }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  file: { gap: tokens.space.xxs },
  frame: { borderRadius: tokens.radius.chip, overflow: "hidden" },
  box: { position: "absolute", borderWidth: tokens.size.border, borderRadius: tokens.radius.chip / 2, borderStyle: "dashed" },
  fill: { borderWidth: 0, opacity: tokens.opacity.disabled },
  field: { gap: tokens.space.xs },
  input: { borderWidth: tokens.size.border, borderRadius: tokens.radius.button, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm, minHeight: tokens.size.button * 2, textAlignVertical: "top" },
});
