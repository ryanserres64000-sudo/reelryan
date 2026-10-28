import { useRef, useState, type ComponentRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { TRANSITION_SECONDS } from "../../../core/timeline";
import { fr } from "../copy/fr";
import { Button, Card, Chip, Frise, SavedPill, Screen, Text, tokens, useTheme } from "../design";
import type { MontageResult, Variant } from "../flow/types";

type Props = { result: MontageResult; seconds: number; onBack: () => void; onRestart: () => void; onEdit?: (i: number) => void; onExport?: (i: number) => void; kept?: number | null; onKeep?: (i: number) => void };
const LABELS = { "accroche-forte": fr.result.variants.hook, posee: fr.result.variants.calm, rythmee: fr.result.variants.rhythm } as const;

// Step 5 (étude, ch. 5 §5 ; ch. 4 « relecture visible »): 2 or 3 versions to swipe, what MaDa corrected
// before showing them, why this edit, and the shots to film next time.
export function ResultScreen({ result, seconds, onBack, onRestart, onEdit, onExport, kept, onKeep }: Props) {
  const [index, setIndex] = useState(0);
  const [page, setPage] = useState(0);
  // The kept version can live in the flow (the paywall shows in between, lot 8).
  const [own, setOwn] = useState<number | null>(null);
  const chosen = kept !== undefined ? kept : own;
  const setChosen = (i: number) => { setOwn(i); onKeep?.(i); };
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const go = (i: number) => { setIndex(i); pager.current?.scrollTo({ x: i * page, animated: true }); };

  return (
    <Screen title={fr.resultScreen.title} detail={fr.resultScreen.swipe} onBack={onBack}
      footer={<>
        {chosen === index ? <View style={styles.saved}><SavedPill visible /><Text variant="caption" tone="textMuted">{fr.resultScreen.chosen}</Text></View> : null}
        {chosen === index && onExport
          ? <Button label={fr.export.cta} onPress={() => onExport(index)} haptic />
          : <Button label={fr.result.choose} onPress={() => setChosen(index)} haptic />}
      </>}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {result.variantes.map((v, i) => (
          <Chip key={i} label={v.timeline.variante ? LABELS[v.timeline.variante] : v.timeline.titre} selected={index === i} onPress={() => go(i)} />
        ))}
      </View>
      <View onLayout={e => setPage(e.nativeEvent.layout.width)}>
        <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={e => page && setIndex(Math.round(e.nativeEvent.contentOffset.x / page))}>
          {page ? result.variantes.map((v, i) => <Page key={i} variant={v} width={page} seconds={seconds} />) : null}
        </ScrollView>
      </View>
      {onEdit ? <Button variant="secondary" label={fr.editor.open} onPress={() => onEdit(index)} /> : null}
      <Button variant="secondary" label={fr.nav.restart} onPress={onRestart} />
    </Screen>
  );
}

function Page({ variant, width, seconds }: { variant: Variant; width: number; seconds: number }) {
  const { c } = useTheme();
  const t = variant.timeline;
  const corrections = t.relecture.corrections;
  const missing = variant.warnings.filter(w => w.startsWith("Texte demandé absent"));
  // Shot lengths as seen in the edit (speed, and the overlap a transition eats).
  const shots = t.plans.map((p, i) => ({ id: `${i}`, duration: (p.fin - p.debut) / p.vitesse - (i && p.transition !== "coupe" ? TRANSITION_SECONDS : 0) }));
  const first = t.textes[0];
  return (
    <View style={[styles.page, { width }]}>
      <View style={styles.previewRow}>
        <View style={[styles.preview, { backgroundColor: c.media }]} accessibilityLabel={`${fr.resultScreen.preview}, ${t.titre}`}>
          <Text variant="headline" tone="onMedia" style={styles.previewTitle}>{t.titre}</Text>
          {first ? <Text variant="callout" tone="onMedia" style={styles.previewText} numberOfLines={2}>{first.texte}</Text> : null}
        </View>
        <View style={styles.previewSide}>
          <Text variant="mono" tone="textMuted">{fr.rush.duration(variant.duration)}</Text>
          <Text variant="caption" tone="ai">{fr.generation.madeIn(seconds)}</Text>
        </View>
      </View>

      <Card style={{ borderColor: c.ai }}>
        <Text variant="bodyStrong" tone="ai">{fr.result.review(corrections.length)}</Text>
        {corrections.map(x => <Text key={x} variant="callout">{`· ${x}`}</Text>)}
      </Card>

      {missing.length ? (
        <Card style={{ borderColor: c.danger }}>
          <Text variant="bodyStrong" tone="danger">{fr.resultScreen.missing}</Text>
          {missing.map(x => <Text key={x} variant="callout">{x}</Text>)}
        </Card>
      ) : null}

      <Frise shots={shots} texts={t.textes.map(x => ({ start: x.debut, end: x.fin, label: x.texte }))} beats={editBeats(t.musique)} />

      <Card>
        <Text variant="bodyStrong">{fr.result.why}</Text>
        <Text variant="callout">{t.intention}</Text>
        {t.plans.map((p, i) => [p.raison, i] as const).filter(([raison]) => raison).map(([raison, i]) => <Text key={i} variant="caption" tone="textMuted">{fr.resultScreen.shot(i + 1, raison)}</Text>)}
      </Card>

      {t.relecture.plans_a_tourner.length ? (
        <Card>
          <Text variant="bodyStrong">{fr.result.nextShots}</Text>
          {t.relecture.plans_a_tourner.map(x => <Text key={x} variant="callout">{`· ${x}`}</Text>)}
        </Card>
      ) : null}
    </View>
  );
}

// The music's beats in edit time: the chosen passage starts with the edit.
function editBeats(m: Variant["timeline"]["musique"]) {
  const from = m.passage?.debut ?? 0, to = m.passage?.fin ?? Infinity;
  return m.temps_forts.filter(b => b >= from && b <= to).map(b => b - from);
}

const styles = StyleSheet.create({
  saved: { flexDirection: "row", alignItems: "center", gap: tokens.space.xs, flexWrap: "wrap" },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs },
  page: { gap: tokens.space.md },
  previewRow: { flexDirection: "row", gap: tokens.space.md, alignItems: "flex-end" },
  preview: { width: "48%", aspectRatio: 9 / 16, borderRadius: tokens.radius.card, padding: tokens.space.md, justifyContent: "space-between", overflow: "hidden" },
  previewTitle: { marginTop: tokens.space.xl },
  previewText: { marginBottom: tokens.space.xxl },
  previewSide: { flex: 1, gap: tokens.space.xs },
});
