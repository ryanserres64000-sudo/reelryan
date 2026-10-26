import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { imposedTexts, type Plateforme } from "../../../core/timeline";
import { fr } from "../copy/fr";
import { Button, Chip, Screen, Text, tokens, typeStyle, useTheme } from "../design";
import type { Brief, Trade } from "../flow/types";

type Props = { brief: Brief; onChange: (b: Brief) => void; onBack: () => void; onNext: () => void };
const TRADES = Object.keys(fr.brief.trades) as Trade[];
const PLATFORMS = Object.keys(fr.brief.platformNames) as Plateforme[];

// Step 2 (étude, ch. 5 §2): one sentence with an example for the person's trade, dictation, and chips
// for what a sentence forgets. Texts between quotes are shown as kept word for word.
export function BriefScreen({ brief, onChange, onBack, onNext }: Props) {
  const { c } = useTheme();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [hint, setHint] = useState(false);
  const set = (p: Partial<Brief>) => onChange({ ...brief, ...p });
  const toggle = (k: "goal" | "tone" | "cta", i: number) => set({ [k]: brief[k] === i ? null : i });
  const example = fr.brief.trades[brief.trade].example;
  const imposed = imposedTexts(brief.text);
  const empty = brief.text.trim().length < 3;
  const noPlatform = !brief.platforms.length;

  return (
    <Screen title={fr.brief.title} detail={fr.brief.detail} onBack={onBack}
      footer={<>
        {empty || noPlatform ? <Text variant="caption" tone="textMuted">{empty ? fr.brief.empty : fr.brief.platformsMin}</Text> : null}
        <Button label={fr.nav.next} disabled={empty || noPlatform} onPress={onNext} haptic />
      </>}>
      <Group label={fr.brief.trade}>
        {TRADES.map(t => <Chip key={t} label={fr.brief.trades[t].label} selected={brief.trade === t} onPress={() => set({ trade: t })} />)}
      </Group>

      <View style={styles.field}>
        <Text variant="callout" tone="textMuted" nativeID="brief-label">{fr.brief.field}</Text>
        <TextInput ref={input} value={brief.text} onChangeText={text => set({ text })} placeholder={example} placeholderTextColor={c.textMuted}
          multiline textAlignVertical="top" accessibilityLabelledBy="brief-label" maxLength={600}
          style={[typeStyle("body"), styles.input, { color: c.text, borderColor: c.line, backgroundColor: c.surface }]} />
        <View style={styles.row}>
          <Chip label={fr.brief.useExample} kind="ai" onPress={() => set({ text: example })} />
          <Chip label={fr.brief.dictate} onPress={() => { setHint(true); input.current?.focus(); }} />
        </View>
        {hint ? <Text variant="caption" tone="textMuted">{fr.brief.dictateHint}</Text> : null}
        {imposed.length ? (
          <View style={styles.row} accessibilityLiveRegion="polite">
            <Text variant="caption" tone="textMuted">{fr.brief.imposed}</Text>
            {imposed.map(t => <View key={t} style={[styles.kept, { borderColor: c.actionStrong }]}><Text variant="caption" tone="actionStrong">{t}</Text></View>)}
          </View>
        ) : null}
      </View>

      <Group label={fr.brief.goal}>{fr.brief.goals.map((g, i) => <Chip key={g} label={g} selected={brief.goal === i} onPress={() => toggle("goal", i)} />)}</Group>
      <Group label={fr.brief.tone}>{fr.brief.tones.map((g, i) => <Chip key={g} label={g} selected={brief.tone === i} onPress={() => toggle("tone", i)} />)}</Group>
      <Group label={fr.brief.duration}>{fr.brief.durations.map(d => <Chip key={d} label={fr.brief.durationValue(d)} selected={brief.duration === d} onPress={() => set({ duration: d })} />)}</Group>
      <Group label={fr.brief.platforms}>
        {PLATFORMS.map(p => {
          const on = brief.platforms.includes(p);
          return <Chip key={p} label={fr.brief.platformNames[p]} selected={on} onPress={() => set({ platforms: on ? brief.platforms.filter(x => x !== p) : [...brief.platforms, p] })} />;
        })}
      </Group>
      <Group label={fr.brief.cta}>{fr.brief.ctas.map((g, i) => <Chip key={g} label={g} selected={brief.cta === i} onPress={() => toggle("cta", i)} />)}</Group>
    </Screen>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text variant="callout" tone="textMuted">{label}</Text>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: tokens.space.xs },
  input: { minHeight: tokens.size.button * 2.5, borderWidth: tokens.size.border, borderRadius: tokens.radius.button, padding: tokens.space.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs, alignItems: "center" },
  kept: { borderWidth: tokens.size.border, borderRadius: tokens.radius.chip, paddingHorizontal: tokens.space.xs },
  group: { gap: tokens.space.xs },
});
