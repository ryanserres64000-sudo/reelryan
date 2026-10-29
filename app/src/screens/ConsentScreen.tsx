import { fr } from "../copy/fr";
import { Button, Screen, Text } from "../design";

const t = fr.consent;

// Asked once, before the first thing that goes to the AI (règle Apple 5.1.2(i), étude ch. 9). Both
// answers lead somewhere useful: no keeps the manual montage and the offline layouts.
export function ConsentScreen({ onAnswer, onBack }: { onAnswer: (ok: boolean) => void; onBack?: () => void }) {
  return (
    <Screen title={t.title} onBack={onBack}
      footer={<>
        <Button label={t.yes} haptic onPress={() => onAnswer(true)} />
        <Button variant="secondary" label={t.no} onPress={() => onAnswer(false)} />
      </>}>
      <Text variant="headline">{t.lead}</Text>
      <Text variant="caption" tone="textMuted">{t.later}</Text>
    </Screen>
  );
}
