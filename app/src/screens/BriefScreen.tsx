import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { imposedTexts } from "../../../core/timeline";
import { fr } from "../copy/fr";
import { Button, Chip, Screen, Text, tokens, typeStyle, useTheme } from "../design";
import type { Brief } from "../flow/types";

type Props = { brief: Brief; onChange: (b: Brief) => void; onBack: () => void; onNext: () => void };
// Step 2 (étude, ch. 5 §2): one sentence with an example for the person's trade, dictation, and chips
// for what a sentence forgets. Texts between quotes are shown as kept word for word. The trade comes
// from sign-up and the video is the same vertical file for every platform, so neither is asked here
// (Ryan's first test, 28 octobre 2026); tone and call to action wait behind « Préciser ».
export function BriefScreen({ brief, onChange, onBack, onNext }: Props) {
  const { c } = useTheme();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [hint, setHint] = useState(false);
  const [more, setMore] = useState(brief.tone !== null || brief.cta !== null);
  const set = (p: Partial<Brief>) => onChange({ ...brief, ...p });
  const toggle = (k: "goal" | "tone" | "cta", i: number) => set({ [k]: brief[k] === i ? null : i });
  const example = fr.brief.trades[brief.trade].example;
  const imposed = imposedTexts(brief.text);
  const empty = brief.text.trim().length < 3;

  return (
    <Screen title={fr.brief.title} detail={fr.brief.detail} onBack={onBack}
      footer={<>
        {empty ? <Text variant="caption" tone="textMuted">{fr.brief.empty}</Text> : null}
        <Button label={fr.nav.next} disabled={empty} onPress={onNext} haptic />
      </>}>
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
      <Group label={fr.brief.duration}>
        {fr.brief.durations.map(d => <Chip key={d} label={fr.brief.durationValue(d)} selected={brief.duration === d} onPress={() => set({ duration: d })} />)}
      </Group>
      {/* Any length from 5 to 90 s, second by second (Ryan's test of build 19). */}
      <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel={fr.brief.durationOwn(brief.duration)}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={e => set({ duration: step(brief.duration, e.nativeEvent.actionName === "increment" ? 1 : -1) })}>
        <Chip label={fr.brief.durationLess} onPress={() => set({ duration: step(brief.duration, -5) })} />
        <Chip label={fr.brief.durationMinus} onPress={() => set({ duration: step(brief.duration, -1) })} />
        <Text variant="bodyStrong">{fr.brief.durationOwn(brief.duration)}</Text>
        <Chip label={fr.brief.durationPlus} onPress={() => set({ duration: step(brief.duration, 1) })} />
        <Chip label={fr.brief.durationMore} onPress={() => set({ duration: step(brief.duration, 5) })} />
      </View>
      {more ? <>
        <Group label={fr.brief.tone}>{fr.brief.tones.map((g, i) => <Chip key={g} label={g} selected={brief.tone === i} onPress={() => toggle("tone", i)} />)}</Group>
        <Group label={fr.brief.cta}>{fr.brief.ctas.map((g, i) => <Chip key={g} label={g} selected={brief.cta === i} onPress={() => toggle("cta", i)} />)}</Group>
      </> : <Button variant="secondary" label={fr.brief.more} onPress={() => setMore(true)} />}
    </Screen>
  );
}

// The server takes 5 to 90 s (lib/montage.js).
const step = (d: number, by: number) => Math.min(90, Math.max(5, Math.round(d) + by));

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
