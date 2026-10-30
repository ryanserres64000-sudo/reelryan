import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import type { Draft } from "../../../core/draft";
import type { PlannedIdea } from "../../../core/week";
import { weekDays } from "../../../core/week";
import { fr } from "../copy/fr";
import type { Brand } from "../brand/types";
import { CreationTile, type Creation } from "../creations/Tile";
import { Button, Card, Icon, Text, tokens, useTheme } from "../design";
import type { FlowDraft } from "../flow/draft";

type Props = {
  brand: Brand | null; plan: PlannedIdea[]; today: PlannedIdea | null; made: string[]; recents: Creation[]; freeLeft: number | null;
  draft: Draft<FlowDraft> | null; onResume: () => void;
  onIdea: (p: PlannedIdea | null) => void; onMoreIdeas: () => void; onBrand: () => void; onSettings: () => void; onOffers: () => void;
  // Tes chiffres (étape 8): the last Reel's views when Instagram or a screenshot gave them.
  onStats?: () => void; lastViews?: number | null;
  onOpen: (c: Creation) => void; onSeeAll: () => void;
};
const t = fr.home;
const RECENTS = 6;
const VIDEO = new Set(["reel", "story"]);

// The home answers « qu'est-ce que je poste aujourd'hui ? » (étude de la refonte, décision 2): the week
// at a glance, the Reel in progress, today's idea with one blue button, then what was made lately.
export function HomeScreen({ brand, plan, today, made, recents, freeLeft, draft, onResume, onIdea, onMoreIdeas, onBrand, onSettings, onOffers, onOpen, onSeeAll, onStats, lastViews }: Props) {
  const { c, layout } = useTheme();
  const { width } = useWindowDimensions();
  const gutter = width >= layout.largePhoneWidth ? layout.gutterLarge : layout.gutter;
  const name = brand?.dna?.nom || t.title;
  const now = new Date();
  const date = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const days = weekDays(now);
  const planned = new Set(plan.map(p => p.date));
  const tile = (Math.min(width, tokens.layout.largePhoneWidth * 1.5) - gutter * 2 - tokens.space.xs * 2) / 3;
  const isToday = today && today.date === days.find(d => d.today)?.date;
  const video = !today || VIDEO.has(today.idee.format);

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
      <View style={styles.between}>
        <Text variant="callout" tone="textMuted">{date}</Text>
        <Pressable onPress={onSettings} accessibilityRole="button" accessibilityLabel={t.settings} hitSlop={tokens.space.xs}
          style={[styles.avatar, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text variant="bodyStrong">{name.charAt(0).toUpperCase()}</Text>
        </Pressable>
      </View>
      <Text variant="display" accessibilityRole="header">{name}</Text>

      <View accessibilityLabel={t.week} style={styles.week}>
        {days.map(d => {
          const did = made.includes(d.date), idea = planned.has(d.date);
          const state = [d.today && t.dayStates.today, did && t.dayStates.made, idea && !did && t.dayStates.planned].filter(Boolean).join(", ");
          return (
            <View key={d.date} accessible accessibilityLabel={t.weekDay(t.days[d.index], state)} style={styles.day}>
              <Text variant="caption" tone={d.today ? "text" : "textMuted"}>{t.dayLetters[d.index]}</Text>
              <View style={[styles.dayDot, {
                backgroundColor: did ? c.action : d.today ? c.text : "transparent",
                borderColor: did ? c.action : d.today ? c.text : idea ? c.actionStrong : c.line,
              }]}>
                {did ? <Icon name="check" tone="onAction" size={tokens.size.icon * 0.7} /> : null}
              </View>
            </View>
          );
        })}
      </View>

      {draft ? (
        <Pressable onPress={onResume} accessibilityRole="button" style={[styles.row, styles.draft, { backgroundColor: c.surface, borderColor: c.action }]}>
          <View style={[styles.draftThumb, { backgroundColor: c.media }]} />
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t.draft}</Text>
            <Text variant="caption" tone="textMuted">{t.draftAt(t.draftSteps[draft.step] ?? "", t.ago((Date.now() - Date.parse(draft.savedAt)) / 60000))}</Text>
          </View>
          <Text variant="headline" tone="actionStrong">›</Text>
        </Pressable>
      ) : null}

      <Card style={styles.idea}>
        {today ? (
          <View style={styles.ideaText}>
            <Text variant="caption" tone="actionStrong">{isToday ? t.today : t.next(t.days[today.day].toLowerCase())} · {fr.ideas.formats[today.idee.format]}</Text>
            <Text variant="headline">{today.idee.titre}</Text>
            {today.idee.pourquoi ? <Text variant="callout" tone="textMuted">{today.idee.pourquoi}</Text> : null}
          </View>
        ) : null}
        <Button label={today ? (video ? t.makeReel : t.makeVisual) : t.newReel} onPress={() => onIdea(today)} />
        <View style={styles.between}>
          {today ? (
            <Pressable onPress={onMoreIdeas} accessibilityRole="button" hitSlop={tokens.space.xs} style={styles.link}>
              <Text variant="callout" tone="actionStrong">{t.otherIdea}</Text>
            </Pressable>
          ) : <View />}
          {freeLeft !== null ? (
            <Pressable onPress={onOffers} accessibilityRole="button" accessibilityHint={t.offers} hitSlop={tokens.space.xs}>
              <Text variant="caption" tone="textMuted">{fr.status.free(freeLeft)}</Text>
              <Text variant="caption" tone="actionStrong">{t.offers}</Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      {!brand?.dna ? (
        <Pressable onPress={onBrand} accessibilityRole="button" style={[styles.row, styles.brand, { borderColor: c.line }]}>
          <Icon name="brand" tone="actionStrong" />
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t.brandCard}</Text>
            <Text variant="caption" tone="textMuted">{t.brandCardWhy}</Text>
          </View>
        </Pressable>
      ) : null}

      {onStats ? (
        <Pressable onPress={onStats} accessibilityRole="button" style={[styles.row, styles.brand, { borderColor: c.line }]}>
          <Icon name="chart" tone="actionStrong" />
          <View style={styles.flex}>
            <Text variant="bodyStrong">{lastViews != null ? fr.stats.lastViews(lastViews.toLocaleString("fr-FR")) : fr.stats.card}</Text>
            <Text variant="caption" tone="textMuted">{lastViews != null ? fr.stats.detail : fr.stats.cardWhy}</Text>
          </View>
          <Text variant="headline" tone="actionStrong">›</Text>
        </Pressable>
      ) : null}

      <View style={styles.section}>
        <View style={styles.between}>
          <Text variant="headline">{t.recent}</Text>
          {recents.length ? (
            <Pressable onPress={onSeeAll} accessibilityRole="button" hitSlop={tokens.space.xs} style={styles.link}>
              <Text variant="callout" tone="actionStrong">{t.seeAll}</Text>
            </Pressable>
          ) : null}
        </View>
        {recents.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recents}>
            {recents.slice(0, RECENTS).map(x => <CreationTile key={x.id} item={x} width={tile} brand={brand} onPress={() => onOpen(x)} />)}
          </ScrollView>
        ) : <Text variant="callout" tone="textMuted">{t.empty}</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.lg, paddingVertical: tokens.space.md, maxWidth: tokens.layout.largePhoneWidth * 1.5, width: "100%", alignSelf: "center" },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: tokens.space.sm },
  flex: { flex: 1 },
  avatar: { width: tokens.size.touch, height: tokens.size.touch, borderRadius: tokens.radius.full, borderWidth: tokens.size.border, alignItems: "center", justifyContent: "center" },
  week: { flexDirection: "row", justifyContent: "space-between" },
  day: { alignItems: "center", gap: tokens.space.xxs, minWidth: tokens.size.touch * 0.75 },
  dayDot: { width: tokens.size.pill, height: tokens.size.pill, borderRadius: tokens.radius.full, borderWidth: tokens.size.selection, alignItems: "center", justifyContent: "center" },
  draft: { padding: tokens.space.xs, borderRadius: tokens.radius.card, borderWidth: tokens.size.border },
  draftThumb: { width: tokens.size.touch, height: tokens.size.touch * 16 / 9, borderRadius: tokens.radius.chip },
  idea: { gap: tokens.space.md },
  ideaText: { gap: tokens.space.xxs },
  link: { minHeight: tokens.size.touch, justifyContent: "center" },
  brand: { padding: tokens.space.md, borderRadius: tokens.radius.card, borderWidth: tokens.size.border },
  section: { gap: tokens.space.sm },
  recents: { gap: tokens.space.xs },
});
