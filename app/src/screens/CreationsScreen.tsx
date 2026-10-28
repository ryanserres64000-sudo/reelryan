import { useState } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { fr } from "../copy/fr";
import type { Brand } from "../brand/types";
import { CreationTile, type Creation } from "../creations/Tile";
import { Button, Chip, EmptyState, Sheet, Text, haptic, tokens, useTheme } from "../design";

type Filter = keyof typeof fr.creations.filters;
type Props = { items: Creation[]; brand: Brand | null; onOpen: (c: Creation) => void; onDuplicate: (c: Creation) => void; onDelete: (c: Creation) => void; onNew: () => void };
const t = fr.creations;
const COLUMNS = 3;

// Everything made, newest first, in a grid (étude de la refonte, onglet Créations): filters for Reels
// and visuals, a tap to open, a long press for the rest (duplicate, delete with « Annuler »).
export function CreationsScreen({ items, brand, onOpen, onDuplicate, onDelete, onNew }: Props) {
  const { layout } = useTheme();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>("all");
  const [menu, setMenu] = useState<Creation | null>(null);
  const gutter = width >= layout.largePhoneWidth ? layout.gutterLarge : layout.gutter;
  const tile = (Math.min(width, tokens.layout.largePhoneWidth * 1.5) - gutter * 2 - tokens.space.xs * (COLUMNS - 1)) / COLUMNS;
  const shown = items.filter(x => filter === "all" || (filter === "reels" ? x.kind === "reel" : x.kind === "visual"));
  const act = (f: (c: Creation) => void) => () => { const m = menu; setMenu(null); if (m) f(m); };

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
      <Text variant="title" accessibilityRole="header">{t.title}</Text>
      <View style={styles.row} accessibilityRole="tablist">
        {(Object.keys(t.filters) as Filter[]).map(k => <Chip key={k} label={t.filters[k]} selected={filter === k} onPress={() => setFilter(k)} />)}
      </View>
      {shown.length ? (
        <>
          <View style={styles.grid}>
            {shown.map(x => <CreationTile key={x.id} item={x} width={tile} brand={brand} onPress={() => onOpen(x)} onLongPress={() => { haptic("tick"); setMenu(x); }} />)}
          </View>
          <Text variant="caption" tone="textMuted">{t.hint}</Text>
        </>
      ) : <EmptyState icon="grid" title={t.empty} detail={t.emptyWhy} action={fr.home.newReel} onAction={onNew} />}
      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={t.actions}>
        <Button label={t.open} onPress={act(onOpen)} />
        <Button variant="secondary" label={t.duplicate} onPress={act(onDuplicate)} />
        <Button variant="secondary" label={t.delete} onPress={act(onDelete)} />
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.lg, paddingVertical: tokens.space.md, maxWidth: tokens.layout.largePhoneWidth * 1.5, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", gap: tokens.space.xs, flexWrap: "wrap" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs },
});
