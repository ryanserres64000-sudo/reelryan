import * as Clipboard from "expo-clipboard";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { HASHTAGS_MAX, captionFor, exportPlan, trendTip, type ExportFile } from "../../../core/export";
import type { TimelineV1 } from "../../../core/timeline";
import type { Brand } from "../brand/types";
import { fr } from "../copy/fr";
import { Button, Card, Chip, MadaSays, Screen, Text, tokens, typeStyle, useTheme } from "../design";
import { aiCaption } from "../flow/legende";
import { aiUrl } from "../flow/server";
import { VideoPreview } from "../video/Preview";
import { ShotStill } from "../video/Still";
import { canExportVideo, exportVideos, type Exported } from "../export/video";
import { exportDone } from "../publish/notify";
import { afterExport } from "../publish/review";
import { shareTo } from "../publish/share";
import type { Sources } from "../video/sources";

type Props = { timeline: TimelineV1; brief: string; brand: Brand | null; style: object; sources: () => Promise<Sources>; onBack: () => void; byAi?: boolean; onNext?: () => void; onHome?: () => void };
const t = fr.exportScreen;

// Step 6 (étude, ch. 5 §7) : one vertical file for every platform (Ryan's first test), the caption
// written by the AI from the edit and the brand (never the brief copied in), the trending-sound
// reminder, then Photos and one button per app.
export function ExportScreen({ timeline, brief, brand, style, sources, onBack, byAi = true, onNext, onHome }: Props) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const given = timeline.legende.texte ? timeline.legende : null;
  const [texte, setTexte] = useState(given?.texte ?? "");
  const [tags, setTags] = useState<string[]>(given?.hashtags ?? []);
  const [kept, setKept] = useState<string[]>((given?.hashtags ?? []).slice(0, HASHTAGS_MAX.reels));
  const [writing, setWriting] = useState(false);
  const write = async (previous?: string) => {
    setWriting(true);
    const l = await aiCaption(timeline, brief, style, previous).catch(() => null);
    setWriting(false);
    if (!l) { if (previous !== undefined) setSay(t.captionError); return; }
    setTexte(l.texte); setTags(l.hashtags); setKept(l.hashtags.slice(0, HASHTAGS_MAX.reels));
  };
  useEffect(() => { if (!given) write(); }, []);
  const src = useMemo(() => sources(), [timeline]);
  const [say, setSay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<Exported[]>([]);
  // One file: the Reels one, whose texts sit in the zone no app's buttons cover.
  const plan = useMemo(() => exportPlan(timeline, byAi).slice(0, 1), [timeline, byAi]);
  const all = useMemo(() => exportPlan(timeline, byAi), [timeline, byAi]);
  const tip = trendTip(timeline);
  const legende = { texte, hashtags: kept };
  const frame = (Math.min(width, tokens.layout.largePhoneWidth) - tokens.layout.gutter * 2) * 0.45;
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
      const uris = await exportVideos(timeline, plan, await src, i => setSay(t.saving(i + 1, plan.length)));
      setFiles(uris); setSay(null);
      exportDone(); afterExport(true);
    } catch { setSay(t.error); afterExport(false); }
    finally { setBusy(false); }
  };

  // The end screen (étape 7): the files are in Photos, one tap per platform copies its caption and
  // opens the app on the video.
  if (files.length) {
    const p = fr.publish;
    const send = async (i: number) => {
      const f = all[i];
      await Clipboard.setStringAsync(captionFor(timeline, f.plateforme, legende));
      const how = await shareTo(f.plateforme, files[0]);
      setSay(how === "none" ? p.noApp : p.copiedFor(t.names[f.plateforme]));
    };
    return (
      <Screen title={p.title} detail={p.detail} onBack={onBack}
        footer={<>
          {say ? <MadaSays text={say} /> : null}
          {onNext ? <Button variant="secondary" label={p.next} onPress={onNext} /> : null}
          {onHome ? <Button variant="secondary" label={p.home} onPress={onHome} /> : null}
        </>}>
        <View style={styles.field}>
          {all.map((f, i) => <Button key={f.plateforme} variant={i === 0 ? "primary" : "secondary"} label={p.open[f.plateforme]} onPress={() => send(i)} haptic={i === 0} />)}
        </View>
        <Card>
          <Text variant="headline">{p.steps}</Text>
          {[p.step1, p.step2, tip ? p.step3(tip.bpm) : p.stepNoTrend].map((x, i) => (
            <View key={i} style={styles.step}>
              <Text variant="mono" tone="actionStrong">{i + 1}</Text>
              <Text style={styles.flex}>{x}</Text>
            </View>
          ))}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title={t.title} detail={t.detail} onBack={onBack}
      footer={<>
        {say ? <MadaSays text={say} /> : null}
        <Button label={t.save} disabled={busy} onPress={save} haptic />
      </>}>
      <View style={styles.previewRow}>
        <VideoPreview timeline={timeline} file={plan[0]} sources={src} style={[styles.preview, { width: frame, height: frame * 16 / 9, backgroundColor: c.media }]}
          fallback={<View style={[styles.preview, { width: frame, height: frame * 16 / 9, backgroundColor: c.media }]}><ShotStill timeline={timeline} index={0} sources={src} /></View>} />
        <View style={styles.flex}>
          <Text variant="callout">{t.one}</Text>
          <Text variant="caption" tone="textMuted">{t.file(fmt(plan[0].duree))}</Text>
        </View>
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
        <TextInput value={texte} onChangeText={setTexte} multiline maxLength={2200} accessibilityLabelledBy="caption-label" placeholder={writing ? t.captionWriting : t.captionEmpty} placeholderTextColor={c.textMuted} editable={!writing}
          style={[typeStyle("body"), styles.input, { color: c.text, borderColor: c.line, backgroundColor: c.surface }]} />
        {tags.length ? <>
          <Text variant="callout" tone="textMuted">{t.hashtags}</Text>
          <View style={styles.row}>
            {tags.map(h => <Chip key={h} label={h} selected={kept.includes(h)} onPress={() => setKept(k => (k.includes(h) ? k.filter(x => x !== h) : [...k, h]))} />)}
          </View>
          <Text variant="caption" tone="textMuted">{t.hashtagsWhy(HASHTAGS_MAX.reels)}</Text>
        </> : null}
        {aiUrl() ? <Button variant="secondary" label={writing ? t.captionWriting : t.captionAgain} disabled={writing} onPress={() => write(texte)} /> : null}
        <Button variant="secondary" label={t.copyOne} disabled={!texte.trim()} onPress={() => copy(plan[0])} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  previewRow: { flexDirection: "row", gap: tokens.space.md, alignItems: "flex-end" },
  preview: { borderRadius: tokens.radius.card, overflow: "hidden" },
  field: { gap: tokens.space.xs },
  step: { flexDirection: "row", gap: tokens.space.sm, alignItems: "flex-start" },
  flex: { flex: 1 },
  input: { borderWidth: tokens.size.border, borderRadius: tokens.radius.button, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm, minHeight: tokens.size.button * 2, textAlignVertical: "top" },
});
