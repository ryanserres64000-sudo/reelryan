import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Idee } from "../../../core/brand";
import { fr } from "../copy/fr";
import type { Brand } from "../brand/types";
import { Button, Card, Icon, Text, tokens, useTheme, type IconName } from "../design";
import { assetsOf } from "../visual/api";
import { DesignView } from "../visual/DesignView";
import type { SavedVisual } from "../visual/store";

type Props = {
  brand: Brand | null; visuals: SavedVisual[]; lastReel: { title: string; duration: number } | null; freeLeft: number | null;
  onNewReel: (idea?: Idee) => void; onVisual: () => void; onBrand: () => void; onSettings: () => void;
  onOpenReel: () => void; onOpenVisual: (v: SavedVisual) => void;
};
const t = fr.home;
const THUMBS = 3;

// The home screen (« Atelier clair », Ryan, 28 octobre 2026): the brand's name, the idea of the week
// from the carnet, one blue button to start a Reel, and what to pick up again. Settings sit behind the
// initial at the top right; three tabs at the bottom.
export function HomeScreen({ brand, visuals, lastReel, freeLeft, onNewReel, onVisual, onBrand, onSettings, onOpenReel, onOpenVisual }: Props) {
  const { c, layout } = useTheme();
  const { width } = useWindowDimensions();
  const gutter = width >= layout.largePhoneWidth ? layout.gutterLarge : layout.gutter;
  const ideas = brand?.dna?.idees ?? [];
  // One idea per week, so the home changes without asking anything.
  const week = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  const idea = ideas.length ? ideas[week % ideas.length] : null;
  const name = brand?.dna?.nom || t.title;
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const thumb = (Math.min(width, tokens.layout.largePhoneWidth * 1.5) - gutter * 2 - tokens.space.xs * (THUMBS - 1)) / THUMBS;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
        <View style={styles.between}>
          <Text variant="callout" tone="textMuted">{today}</Text>
          <Pressable onPress={onSettings} accessibilityRole="button" accessibilityLabel={t.settings} hitSlop={tokens.space.xs}
            style={[styles.avatar, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text variant="bodyStrong">{name.charAt(0).toUpperCase()}</Text>
          </Pressable>
        </View>
        <Text variant="display" accessibilityRole="header">{name}</Text>

        <Card style={styles.idea}>
          {idea ? (
            <View style={styles.ideaText}>
              <Text variant="caption" tone="textMuted">{t.idea}</Text>
              <Text variant="headline">{idea.titre}</Text>
              {idea.pourquoi ? <Text variant="callout" tone="textMuted">{idea.pourquoi}</Text> : null}
            </View>
          ) : null}
          <Button label={t.newReel} haptic onPress={() => onNewReel(idea && idea.format === "reel" ? idea : undefined)} />
          {freeLeft !== null ? <Text variant="caption" tone="textMuted" style={styles.center}>{fr.status.free(freeLeft)}</Text> : null}
        </Card>

        <View style={styles.pair}>
          <Button variant="secondary" label={t.visual} onPress={onVisual} style={styles.flex} />
          <Button variant="secondary" label={t.brand} onPress={onBrand} style={styles.flex} />
        </View>

        <View style={styles.section}>
          <Text variant="headline">{t.resume}</Text>
          {lastReel ? (
            <Pressable onPress={onOpenReel} accessibilityRole="button" style={[styles.reel, { backgroundColor: c.surface, borderColor: c.line }]}>
              <View style={[styles.reelThumb, { backgroundColor: c.media }]} />
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>{lastReel.title}</Text>
                <Text variant="caption" tone="textMuted">{`${t.lastReel} · ${fr.rush.duration(lastReel.duration)}`}</Text>
              </View>
            </Pressable>
          ) : null}
          {visuals.length ? (
            <View style={styles.thumbs}>
              {visuals.slice(0, THUMBS).map(v => (
                <Pressable key={v.id} accessibilityRole="button" accessibilityLabel={fr.visual.reopen(fr.visual.kinds[v.brief.kind])} onPress={() => onOpenVisual(v)}
                  style={[styles.thumb, { borderColor: c.line }]}>
                  <DesignView design={v.design} width={thumb} assets={assetsOf(v.photos, brand)} id={`h${v.id}`} />
                </Pressable>
              ))}
            </View>
          ) : null}
          {!lastReel && !visuals.length ? <Text variant="callout" tone="textMuted">{t.empty}</Text> : null}
        </View>
      </ScrollView>

      <View accessibilityRole="tablist" style={[styles.tabs, { borderTopColor: c.line, backgroundColor: c.bg }]}>
        <Tab icon="home" label={t.tabs.home} active />
        <Pressable onPress={() => onNewReel()} accessibilityRole="button" accessibilityLabel={t.newReel} style={[styles.plus, { backgroundColor: c.action }]}>
          <Icon name="plus" tone="onAction" />
        </Pressable>
        <Tab icon="brand" label={t.tabs.brand} onPress={onBrand} />
      </View>
    </SafeAreaView>
  );
}

function Tab({ icon, label, active = false, onPress }: { icon: IconName; label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label} style={styles.tab}>
      <Icon name={icon} tone={active ? "text" : "textMuted"} />
      <Text variant="caption" tone={active ? "text" : "textMuted"}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: tokens.space.lg, paddingVertical: tokens.space.md, maxWidth: tokens.layout.largePhoneWidth * 1.5, width: "100%", alignSelf: "center" },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  avatar: { width: tokens.size.touch, height: tokens.size.touch, borderRadius: tokens.radius.full, borderWidth: tokens.size.border, alignItems: "center", justifyContent: "center" },
  idea: { gap: tokens.space.md },
  ideaText: { gap: tokens.space.xxs },
  center: { textAlign: "center" },
  pair: { flexDirection: "row", gap: tokens.space.xs },
  flex: { flex: 1 },
  section: { gap: tokens.space.sm },
  reel: { flexDirection: "row", alignItems: "center", gap: tokens.space.sm, padding: tokens.space.xs, borderRadius: tokens.radius.card, borderWidth: tokens.size.border },
  reelThumb: { width: tokens.size.touch, height: tokens.size.touch * 16 / 9, borderRadius: tokens.radius.chip },
  thumbs: { flexDirection: "row", gap: tokens.space.xs },
  thumb: { borderWidth: tokens.size.border, borderRadius: tokens.radius.chip, overflow: "hidden" },
  tabs: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingTop: tokens.space.xs, borderTopWidth: tokens.size.border },
  tab: { alignItems: "center", gap: tokens.space.xxs, minWidth: tokens.size.touch * 2, minHeight: tokens.size.touch },
  plus: { width: tokens.size.button, height: tokens.size.button, borderRadius: tokens.radius.full, alignItems: "center", justifyContent: "center" },
});
