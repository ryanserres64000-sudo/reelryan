import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { fr } from "../../copy/fr";
import { tokens } from "../tokens";
import { Text } from "../Text";
import { useTheme } from "../theme";

export type TriageBadge = keyof typeof fr.rush.badge;
type Props = { duration: number; thumbnail?: ImageSourcePropType; badges?: TriageBadge[]; order?: number; width: number; onPress?: () => void };

// 9:16 thumbnail, duration in DM Mono, triage badges in lavender, selected = 2 pt gold border + order number (étude, ch. 6 §4).
export function RushCard({ duration, thumbnail, badges = [], order, width, onPress }: Props) {
  const { c } = useTheme();
  const selected = order !== undefined;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${selected ? fr.rush.selected(order) : fr.rush.notSelected}, ${fr.rush.duration(duration)}${badges.length ? ", " + badges.map(b => fr.rush.badge[b]).join(", ") : ""}`}
      style={[styles.card, { width, backgroundColor: c.surfaceRaised, borderColor: selected ? c.actionStrong : c.line, borderWidth: selected ? tokens.size.selection : tokens.size.border }]}
    >
      {thumbnail ? <Image source={thumbnail} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <View style={styles.badges}>
        {badges.map(b => (
          <View key={b} style={[styles.badge, { backgroundColor: c.aiFill }]}><Text variant="caption" tone="onAi">{fr.rush.badge[b]}</Text></View>
        ))}
      </View>
      {selected ? (
        <View style={[styles.order, { backgroundColor: c.action }]}><Text variant="mono" tone="onAction">{order}</Text></View>
      ) : null}
      <View style={[styles.duration, { backgroundColor: c.scrim }]}><Text variant="mono">{fr.rush.duration(duration)}</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { aspectRatio: 9 / 16, borderRadius: tokens.radius.button, overflow: "hidden" },
  badges: { position: "absolute", top: tokens.space.xs, left: tokens.space.xs, gap: tokens.space.xxs, alignItems: "flex-start" },
  badge: { borderRadius: tokens.radius.chip, paddingHorizontal: tokens.space.xs },
  order: { position: "absolute", top: tokens.space.xs, right: tokens.space.xs, minWidth: tokens.size.pill, height: tokens.size.pill, borderRadius: tokens.radius.full, alignItems: "center", justifyContent: "center" },
  duration: { position: "absolute", bottom: tokens.space.xs, left: tokens.space.xs, borderRadius: tokens.radius.chip, paddingHorizontal: tokens.space.xs },
});
