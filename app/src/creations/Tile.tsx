import { Image, Pressable, StyleSheet, View } from "react-native";
import { fr } from "../copy/fr";
import type { Brand } from "../brand/types";
import { Icon, Text, tokens, useTheme } from "../design";
import { assetsOf } from "../visual/api";
import { DesignView } from "../visual/DesignView";
import type { SavedVisual } from "../visual/store";
import type { SavedReel } from "./store";

export type Creation = { kind: "reel"; id: string; at: string; reel: SavedReel } | { kind: "visual"; id: string; at: string; visual: SavedVisual };

export const creationsOf = (reels: SavedReel[], visuals: SavedVisual[]): Creation[] => [
  ...reels.map(reel => ({ kind: "reel" as const, id: reel.id, at: reel.at, reel })),
  ...visuals.map(visual => ({ kind: "visual" as const, id: visual.id, at: visual.at, visual })),
].sort((a, b) => b.at.localeCompare(a.at));

// One creation in a grid or a row: a Reel as a 9:16 card with its title and length over the picture of
// its first shot (plain black before, Ryan, 29 octobre : « Pourquoi en noir »), a visual as itself. A tap opens it; a long press asks what to do (Créations).
export function CreationTile({ item, width, brand, onPress, onLongPress }: { item: Creation; width: number; brand: Brand | null; onPress: () => void; onLongPress?: () => void }) {
  const { c, opacity } = useTheme();
  const height = width * 16 / 9;
  if (item.kind === "visual") {
    const v = item.visual;
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="button" accessibilityLabel={fr.visual.reopen(fr.visual.kinds[v.brief.kind])}
        style={({ pressed }) => [styles.tile, { borderColor: c.line, opacity: pressed ? opacity.pressed : 1 }]}>
        <DesignView design={v.design} width={width} assets={assetsOf(v.photos, brand)} id={`c${v.id}`} />
      </Pressable>
    );
  }
  const t = item.reel.timeline, rushes = item.reel.rushes;
  const cover = rushes.find(r => r.id === t.plans[0]?.source)?.thumb ?? rushes.find(r => r.thumb)?.thumb;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="button" accessibilityLabel={fr.creations.reel(t.titre, fr.rush.duration(t.duree))}
      style={({ pressed }) => [styles.tile, styles.reel, { width, height, backgroundColor: c.media, borderColor: c.line, opacity: pressed ? opacity.pressed : 1 }]}>
      {cover ? <>
        <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.media, opacity: opacity.coverShade }]} />
      </> : null}
      <View style={styles.play}><Icon name="play" tone="onMedia" /></View>
      <View style={styles.caption}>
        <Text variant="bodyStrong" tone="onMedia" numberOfLines={2}>{t.titre}</Text>
        <Text variant="mono" tone="onMedia">{fr.rush.duration(t.duree)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderWidth: tokens.size.border, borderRadius: tokens.radius.chip, overflow: "hidden" },
  reel: { justifyContent: "space-between", padding: tokens.space.xs },
  play: { alignSelf: "flex-end" },
  caption: { gap: tokens.space.xxs },
});
