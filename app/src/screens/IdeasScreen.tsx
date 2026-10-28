import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import type { Idee, Pilier } from "../../../core/brand";
import { ideaOfTheDay, weekDays, type PlannedIdea } from "../../../core/week";
import { fr } from "../copy/fr";
import { Button, Card, Chip, EmptyState, Text, tokens, useTheme } from "../design";

type Props = { plan: PlannedIdea[]; ideas: Idee[]; pillars: Pilier[]; hasBrand: boolean; onMake: (i: Idee) => void; onRefuse: (i: Idee) => void; onBrand: () => void };
const t = fr.ideas;
const VIDEO = new Set(["reel", "story"]);

// The week as a plan (étude de la refonte, onglet Idées): three days, one idea each from the carnet,
// what to film and why, « Faire ce Reel » or « Pas pour moi ». Below, every idea and the brand's subjects.
export function IdeasScreen({ plan, ideas, pillars, hasBrand, onMake, onRefuse, onBrand }: Props) {
  const { layout } = useTheme();
  const { width } = useWindowDimensions();
  const gutter = width >= layout.largePhoneWidth ? layout.gutterLarge : layout.gutter;
  const days = weekDays(new Date());
  const inPlan = new Set(plan.map(p => p.key));
  // One blue button per screen: today's idea (or the next one); the others are outlined.
  const first = ideaOfTheDay(plan, new Date())?.key;
  const make = (i: Idee) => (VIDEO.has(i.format) ? fr.home.makeReel : fr.home.makeVisual);

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
      <View style={styles.head}>
        <Text variant="title" accessibilityRole="header">{t.title}</Text>
        <Text tone="textMuted">{t.detail}</Text>
      </View>
      {!plan.length ? <EmptyState icon="idea" title={t.empty} detail={t.emptyWhy} action={fr.home.brandCard} onAction={hasBrand ? undefined : onBrand} /> : null}
      {plan.map(p => {
        const d = days[p.day];
        return (
          <Card key={p.key} style={[styles.card, d.past ? styles.past : null]}>
            <Text variant="caption" tone={d.today ? "actionStrong" : "textMuted"}>{`${fr.home.days[p.day]}${d.today ? ` · ${fr.home.today}` : ""} · ${t.formats[p.idee.format]}`}</Text>
            <Text variant="headline">{p.idee.titre}</Text>
            {p.idee.pourquoi ? <Text variant="callout" tone="textMuted">{p.idee.pourquoi}</Text> : null}
            <View style={styles.row}>
              <Button label={make(p.idee)} variant={p.key === first ? "primary" : "secondary"} onPress={() => onMake(p.idee)} style={styles.flex} />
              <Chip label={t.refuse} onPress={() => onRefuse(p.idee)} />
            </View>
          </Card>
        );
      })}
      {ideas.filter(i => !inPlan.has(i.titre.trim().toLowerCase())).length ? (
        <View style={styles.section}>
          <Text variant="headline">{t.more}</Text>
          {ideas.filter(i => !inPlan.has(i.titre.trim().toLowerCase())).map(i => (
            <Card key={i.titre} style={styles.small}>
              <View style={styles.flex}>
                <Text variant="bodyStrong">{i.titre}</Text>
                <Text variant="caption" tone="textMuted">{t.formats[i.format]}</Text>
              </View>
              <Chip label={make(i)} onPress={() => onMake(i)} />
            </Card>
          ))}
        </View>
      ) : null}
      {pillars.length ? (
        <View style={styles.section}>
          <Text variant="headline">{t.pillars}</Text>
          {pillars.map(p => (
            <View key={p.titre} style={styles.pillar}>
              <Text variant="bodyStrong">{p.titre}</Text>
              <Text variant="callout" tone="textMuted">{p.idee}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.lg, paddingVertical: tokens.space.md, maxWidth: tokens.layout.largePhoneWidth * 1.5, width: "100%", alignSelf: "center" },
  head: { gap: tokens.space.xs },
  card: { gap: tokens.space.xs },
  past: { opacity: tokens.opacity.pressed },
  row: { flexDirection: "row", alignItems: "center", gap: tokens.space.xs, marginTop: tokens.space.xs },
  flex: { flex: 1 },
  section: { gap: tokens.space.sm },
  small: { flexDirection: "row", alignItems: "center", gap: tokens.space.sm },
  pillar: { gap: tokens.space.xxs },
});
