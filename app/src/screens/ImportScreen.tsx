import { useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { pickMedia } from "../media/pick";
import { fr } from "../copy/fr";
import { Button, RushCard, Screen, Text, tokens, useTheme } from "../design";
import { LIMITS, type Rush } from "../flow/types";

type Props = { rushes: Rush[]; selected: string[]; pro: boolean; onRushes: (r: Rush[]) => void; onSelect: (ids: string[]) => void; onNext: () => void; demo: boolean; onBack?: () => void };
const COLUMNS = 3;

// Step 1 (étude, ch. 5 §1): 3 to 25 rushes in the order they are tapped, 90 s of rushes on the free plan.
// The system picker gives access to the chosen items only, so no photo library permission is asked.
// The brand, visuals and settings links moved to the home screen (« Atelier clair »).
export function ImportScreen({ rushes, selected, pro, onRushes, onSelect, onNext, demo, onBack }: Props) {
  const { layout } = useTheme();
  const { width } = useWindowDimensions();
  const [pickError, setPickError] = useState(false);
  const gutter = width >= layout.largePhoneWidth ? layout.gutterLarge : layout.gutter;
  const cardWidth = (Math.min(width, tokens.layout.largePhoneWidth * 1.5) - gutter * 2 - tokens.space.xs * (COLUMNS - 1)) / COLUMNS;

  const total = selected.reduce((s, id) => s + (rushes.find(r => r.id === id)?.duration ?? 0), 0);
  const missing = LIMITS.minRushes - selected.length;
  const full = selected.length >= LIMITS.maxRushes;

  const toggle = (id: string) => {
    if (selected.includes(id)) onSelect(selected.filter(x => x !== id));
    else if (!full) onSelect([...selected, id]);
  };

  const pick = async () => {
    setPickError(false);
    try {
      const added = await pickMedia(LIMITS.maxRushes - selected.length);
      if (!added.length) return;
      onRushes(demo ? added : [...rushes, ...added]);
      onSelect([...(demo ? [] : selected), ...added.map(a => a.id)].slice(0, LIMITS.maxRushes));
    } catch {
      setPickError(true);
    }
  };

  const fmt = fr.rush.duration;
  const status = missing > 0 ? fr.import.tooFew(missing) : full ? fr.import.tooMany : null;
  return (
    <Screen title={fr.import.title} detail={fr.import.detail} onBack={onBack}
      footer={<>
        <Text variant="mono" tone="textMuted">{fr.import.countPro(selected.length, fmt(total))}</Text>
        {status ? <Text variant="caption" tone="textMuted" accessibilityLiveRegion="polite">{status}</Text> : null}
        <Button label={fr.nav.next} disabled={missing > 0} onPress={onNext} haptic />
      </>}>
      <Button variant="secondary" label={fr.import.pick} onPress={pick} />
      {pickError ? <Text tone="danger">{fr.import.pickError}</Text> : null}
      {demo ? <Text variant="caption" tone="textMuted">{fr.import.sample}</Text> : null}
      {!demo && !rushes.length ? <Text tone="textMuted">{fr.import.empty}</Text> : null}
      <View style={styles.grid}>
        {rushes.map(r => {
          const i = selected.indexOf(r.id);
          return <RushCard key={r.id} width={cardWidth} photo={r.photo} duration={r.duration} badges={r.badges} order={i >= 0 ? i + 1 : undefined} thumbnail={r.thumb ? { uri: r.thumb } : undefined} onPress={() => toggle(r.id)} />;
        })}
      </View>
      <Text variant="caption" tone="textMuted">{fr.onboarding.privacy}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs },
});
