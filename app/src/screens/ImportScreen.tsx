import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { fr } from "../copy/fr";
import { Button, RushCard, Screen, Text, tokens, useTheme } from "../design";
import { LIMITS, type Rush } from "../flow/types";

type Props = { rushes: Rush[]; selected: string[]; pro: boolean; onRushes: (r: Rush[]) => void; onSelect: (ids: string[]) => void; onNext: () => void; demo: boolean };
const COLUMNS = 3;

// Step 1 (étude, ch. 5 §1): 3 to 25 rushes in the order they are tapped, 90 s of rushes on the free plan.
// The system picker gives access to the chosen items only, so no photo library permission is asked.
export function ImportScreen({ rushes, selected, pro, onRushes, onSelect, onNext, demo }: Props) {
  const { layout } = useTheme();
  const { width } = useWindowDimensions();
  const [pickError, setPickError] = useState(false);
  const gutter = width >= layout.largePhoneWidth ? layout.gutterLarge : layout.gutter;
  const cardWidth = (Math.min(width, tokens.layout.largePhoneWidth * 1.5) - gutter * 2 - tokens.space.xs * (COLUMNS - 1)) / COLUMNS;

  const total = selected.reduce((s, id) => s + (rushes.find(r => r.id === id)?.duration ?? 0), 0);
  const tooLong = !pro && total > LIMITS.freeSeconds;
  const missing = LIMITS.minRushes - selected.length;
  const full = selected.length >= LIMITS.maxRushes;

  const toggle = (id: string) => {
    if (selected.includes(id)) onSelect(selected.filter(x => x !== id));
    else if (!full) onSelect([...selected, id]);
  };

  const pick = async () => {
    setPickError(false);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos", "images"], allowsMultipleSelection: true, selectionLimit: LIMITS.maxRushes - selected.length, orderedSelection: true });
      if (res.canceled) return;
      const added: Rush[] = res.assets.map((a, i) => ({
        id: `p${Date.now().toString(36)}${i}`, uri: a.uri, photo: a.type !== "video", sound: a.type === "video", badges: [],
        duration: a.type === "video" && a.duration ? a.duration / 1000 : 4,
      }));
      onRushes(demo ? added : [...rushes, ...added]);
      onSelect([...(demo ? [] : selected), ...added.map(a => a.id)].slice(0, LIMITS.maxRushes));
    } catch {
      setPickError(true);
    }
  };

  const fmt = fr.rush.duration;
  const status = missing > 0 ? fr.import.tooFew(missing) : tooLong ? fr.import.tooLong : full ? fr.import.tooMany : null;
  return (
    <Screen title={fr.import.title} detail={fr.import.detail}
      footer={<>
        <Text variant="mono" tone={tooLong ? "danger" : "textMuted"}>{pro ? fr.import.countPro(selected.length, fmt(total)) : fr.import.count(selected.length, fmt(total), fmt(LIMITS.freeSeconds))}</Text>
        {status ? <Text variant="caption" tone={tooLong ? "danger" : "textMuted"} accessibilityLiveRegion="polite">{status}</Text> : null}
        <Button label={fr.nav.next} disabled={missing > 0 || tooLong} onPress={onNext} haptic />
      </>}>
      <Button variant="secondary" label={fr.import.pick} onPress={pick} />
      {pickError ? <Text tone="danger">{fr.import.pickError}</Text> : null}
      {demo ? <Text variant="caption" tone="ai">{fr.import.sample}</Text> : null}
      <View style={styles.grid}>
        {rushes.map(r => {
          const i = selected.indexOf(r.id);
          return <RushCard key={r.id} width={cardWidth} duration={r.duration} badges={r.badges} order={i >= 0 ? i + 1 : undefined} thumbnail={r.uri && r.photo ? { uri: r.uri } : undefined} onPress={() => toggle(r.id)} />;
        })}
      </View>
      <Text variant="caption" tone="textMuted">{fr.onboarding.privacy}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs },
});
