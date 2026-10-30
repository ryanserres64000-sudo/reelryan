import { useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { TRANSITION_SECONDS } from "../../../core/timeline";
import { fr } from "../copy/fr";
import { Button, Card, Chip, Frise, SavedPill, Screen, Text, tokens, useTheme } from "../design";
import { exportPlan } from "../../../core/export";
import type { MontageResult, Variant } from "../flow/types";
import type { Sources } from "../video/sources";
import { VideoPreview } from "../video/Preview";
import { ShotStill } from "../video/Still";
import { DuoTitle } from "../video/DuoTitle";
import { duoById } from "../../../core/typo";
import { RECETTES, type RecetteId } from "../../../core/recipes";

type Props = { result: MontageResult; seconds: number; onBack: () => void; onRestart: () => void; onEdit?: (i: number) => void; onRecipe?: (i: number, id: RecetteId | null) => void; onPlay?: (i: number) => void; onExport?: (i: number) => void; kept?: number | null; onKeep?: (i: number) => void; sources?: (i: number) => Promise<Sources> };
const LABELS = { "accroche-forte": fr.result.variants.hook, posee: fr.result.variants.calm, rythmee: fr.result.variants.rhythm } as const;

// Step 5 (étude, ch. 5 §5 ; ch. 4 « relecture visible »): 2 or 3 versions to swipe, what MaDa corrected
// before showing them, why this edit, and the shots to film next time.
export function ResultScreen({ result, seconds, onBack, onRestart, onEdit, onRecipe, onPlay, onExport, kept, onKeep, sources }: Props) {
  const [index, setIndex] = useState(0);
  const [page, setPage] = useState(0);
  // The kept version can live in the flow (the paywall shows in between, lot 8).
  const [own, setOwn] = useState<number | null>(null);
  const chosen = kept !== undefined ? kept : own;
  const setChosen = (i: number) => { setOwn(i); onKeep?.(i); };
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  // The native preview of the version on screen only, built once per version.
  const shown = useMemo(() => sources?.(index) ?? null, [index, result]);
  const go = (i: number) => { setIndex(i); pager.current?.scrollTo({ x: i * page, animated: true }); };

  return (
    <Screen title={fr.resultScreen.title} detail={fr.resultScreen.swipe} onBack={onBack}
      footer={<>
        {chosen === index ? <View style={styles.saved}><SavedPill visible /><Text variant="caption" tone="textMuted">{fr.resultScreen.chosen}</Text></View> : null}
        {/* Editing by hand sits next to the main action: Ryan's first test never found it at the bottom. */}
        {onEdit ? <Button variant="secondary" label={fr.editor.open} onPress={() => onEdit(index)} /> : null}
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
          {page ? result.variantes.map((v, i) => <Page key={i} variant={v} width={page} seconds={seconds} sources={i === index ? shown : null} onPlay={onPlay ? () => onPlay(i) : undefined} onRecipe={onRecipe ? id => onRecipe(i, id) : undefined} />) : null}
        </ScrollView>
      </View>
      <Button variant="secondary" label={fr.nav.restart} onPress={onRestart} />
    </Screen>
  );
}

function Page({ variant, width, seconds, sources, onPlay, onRecipe }: { variant: Variant; width: number; seconds: number; sources: Promise<Sources> | null; onPlay?: () => void; onRecipe?: (id: RecetteId | null) => void }) {
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
        <Pressable onPress={onPlay} disabled={!onPlay} accessibilityRole="button" accessibilityLabel={fr.player.open} style={styles.previewTap}>
        <VideoPreview timeline={t} file={exportPlan(t)[0]} sources={sources} style={[styles.preview, { backgroundColor: c.media }]}
          fallback={<View style={[styles.preview, { backgroundColor: c.media }]} accessibilityLabel={`${fr.resultScreen.preview}, ${t.titre}`}>
            <ShotStill timeline={t} index={0} sources={sources} />
            {first?.accent && t.charte.duo
              ? <View style={styles.previewText}><DuoTitle duo={duoById(t.charte.duo)} texte={first.texte} accent={first.accent} variant="title" /></View>
              : first ? <Text variant="callout" tone="onMedia" style={styles.previewText} numberOfLines={2}>{first.texte}</Text> : null}
          </View>} />
        </Pressable>
        <View style={styles.previewSide}>
          <Text variant="mono" tone="textMuted">{fr.rush.duration(variant.duration)}</Text>
          <Text variant="caption" tone="ai">{fr.generation.madeIn(seconds)}</Text>
          {onPlay ? <Button variant="secondary" label={fr.player.open} onPress={onPlay} /> : null}
        </View>
      </View>

      <Card>
        <Text variant="bodyStrong">{fr.recipes.title}</Text>
        <Text variant="callout">{t.recette ? fr.recipes.chosen(fr.recipes.names[t.recette]) : fr.recipes.noneChosen}</Text>
        {onRecipe ? (
          <>
            <View style={styles.tabs}>
              {[...RECETTES, null].map(id => <Chip key={id ?? "aucune"} label={fr.recipes.names[id ?? "aucune"]} selected={(t.recette ?? null) === id} onPress={() => onRecipe(id)} />)}
            </View>
            <Text variant="caption" tone="textMuted">{fr.recipes.why}</Text>
          </>
        ) : null}
      </Card>

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
  previewTap: { width: "48%" },
  preview: { width: "100%", aspectRatio: 9 / 16, borderRadius: tokens.radius.card, padding: tokens.space.md, justifyContent: "space-between", overflow: "hidden" },
  previewTitle: { marginTop: tokens.space.xl },
  previewText: { marginBottom: tokens.space.xxl },
  previewSide: { flex: 1, gap: tokens.space.xs },
});
