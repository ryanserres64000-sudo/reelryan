import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { imposedTexts } from "../../../core/timeline";
import { AFFICHE_CHAMPS, EMPTY_AFFICHE, countdown, type Affiche } from "../../../core/poster";
import { pickPoster, readPoster } from "../flow/affiche";
import { aiUrl } from "../flow/server";
import { noteError } from "../diag";
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
  const [more, setMore] = useState(brief.tone !== null);
  const set = (p: Partial<Brief>) => onChange({ ...brief, ...p });
  const toggle = (k: "goal" | "tone", i: number) => set({ [k]: brief[k] === i ? null : i });
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
      {/* The call to action at the end: a ready one, or the person's own words (Ryan's test of build 20). */}
      <Group label={fr.brief.cta}>{fr.brief.ctas.map((g, i) => <Chip key={g} label={g} selected={brief.cta === i && !brief.ctaText?.trim()} onPress={() => set({ cta: brief.cta === i ? null : i, ctaText: "" })} />)}</Group>
      <TextInput value={brief.ctaText ?? ""} onChangeText={ctaText => set({ ctaText })} placeholder={fr.brief.ctaOwn} placeholderTextColor={c.textMuted}
        accessibilityLabel={fr.brief.ctaOwn} maxLength={80} returnKeyType="done"
        style={[typeStyle("body"), styles.line, { color: c.text, borderColor: c.line, backgroundColor: c.surface }]} />
      <PosterCard brief={brief} set={set} />
      {more ? <Group label={fr.brief.tone}>{fr.brief.tones.map((g, i) => <Chip key={g} label={g} selected={brief.tone === i} onPress={() => toggle("tone", i)} />)}</Group>
        : <Button variant="secondary" label={fr.brief.more} onPress={() => setMore(true)} />}
    </Screen>
  );
}

// The event poster (core/poster.ts): read by the AI, then every line checked or written by hand.
function PosterCard({ brief, set }: { brief: Brief; set: (p: Partial<Brief>) => void }) {
  const { c } = useTheme();
  const p = fr.brief.poster, a = brief.affiche;
  const [state, setState] = useState<"idle" | "reading" | "failed" | "off">("idle");
  const [uri, setUri] = useState<string | null>(null);
  // Typed as a line, so a comma being typed is not swallowed; the list follows it.
  const [partners, setPartners] = useState(a?.partenaires.join(", ") ?? "");
  const read = async (from: string) => {
    if (!aiUrl()) { setState("off"); set({ affiche: brief.affiche ?? EMPTY_AFFICHE }); return; }
    setState("reading");
    try { const got = await readPoster(from); setPartners(got.partenaires.join(", ")); set({ affiche: got, afficheCouleurs: brief.afficheCouleurs ?? true }); setState("idle"); }
    catch (e) { noteError("affiche", e instanceof Error ? e.message : String(e)); setState("failed"); set({ affiche: brief.affiche ?? EMPTY_AFFICHE }); }
  };
  const add = async () => {
    try { const picked = await pickPoster(); if (picked) { setUri(picked); await read(picked); } }
    catch (e) { noteError("affiche", e instanceof Error ? e.message : String(e)); setState("failed"); }
  };
  const edit = (patch: Partial<Affiche>) => a && set({ affiche: { ...a, ...patch } });
  const j = a ? countdown(a.date_iso, new Date()) : null;
  if (!a && state !== "reading") return (
    <View style={styles.group}>
      <Button variant="secondary" label={p.add} onPress={add} />
      <Text variant="caption" tone="textMuted">{p.why}</Text>
    </View>
  );
  return (
    <View style={[styles.poster, { borderColor: c.line, backgroundColor: c.surface }]}>
      {state === "reading" ? <Text variant="callout" tone="ai">{p.reading}</Text> : null}
      {state === "failed" ? <Text variant="callout" tone="danger">{p.failed}</Text> : null}
      {state === "off" ? <Text variant="callout" tone="textMuted">{p.aiOff}</Text> : null}
      {a ? (
        <>
          <Text variant="caption" tone="textMuted">{p.check}</Text>
          {AFFICHE_CHAMPS.map(k => (
            <View key={k} style={styles.posterField}>
              <Text variant="caption" tone="textMuted">{p.fields[k]}</Text>
              <TextInput value={a[k]} onChangeText={v => edit({ [k]: v })} accessibilityLabel={p.fields[k]} maxLength={120} returnKeyType="done"
                style={[typeStyle("body"), styles.line, { color: c.text, borderColor: c.line, backgroundColor: c.bg }]} />
            </View>
          ))}
          <View style={styles.posterField}>
            <Text variant="caption" tone="textMuted">{p.partners}</Text>
            <TextInput value={partners} onChangeText={v => { setPartners(v); edit({ partenaires: v.split(",").map(x => x.trim()).filter(Boolean).slice(0, 4) }); }} accessibilityLabel={p.partners} maxLength={160}
              style={[typeStyle("body"), styles.line, { color: c.text, borderColor: c.line, backgroundColor: c.bg }]} />
          </View>
          {j ? <Text variant="callout" tone="actionStrong">{p.countdown(j)}</Text> : null}
          {a.couleurs.length ? (
            <Group label={p.colors}>
              {a.couleurs.map(x => <View key={x} style={[styles.swatch, { backgroundColor: x, borderColor: c.line }]} accessibilityLabel={x} />)}
              <Chip label={p.useColors} selected={brief.afficheCouleurs !== false} onPress={() => set({ afficheCouleurs: true })} />
              <Chip label={p.ownColors} selected={brief.afficheCouleurs === false} onPress={() => set({ afficheCouleurs: false })} />
            </Group>
          ) : null}
          <View style={styles.row}>
            {uri && state !== "reading" && state !== "off" ? <Chip label={p.retry} onPress={() => read(uri)} /> : null}
            <Chip label={p.remove} onPress={() => { setUri(null); setState("idle"); setPartners(""); set({ affiche: undefined, afficheCouleurs: undefined }); }} />
          </View>
        </>
      ) : null}
    </View>
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
  line: { borderWidth: tokens.size.border, borderRadius: tokens.radius.button, paddingHorizontal: tokens.space.sm, minHeight: tokens.size.button },
  input: { minHeight: tokens.size.button * 2.5, borderWidth: tokens.size.border, borderRadius: tokens.radius.button, padding: tokens.space.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs, alignItems: "center" },
  kept: { borderWidth: tokens.size.border, borderRadius: tokens.radius.chip, paddingHorizontal: tokens.space.xs },
  group: { gap: tokens.space.xs },
  poster: { gap: tokens.space.sm, borderWidth: tokens.size.border, borderRadius: tokens.radius.card, padding: tokens.space.md },
  posterField: { gap: tokens.space.xxs },
  swatch: { width: tokens.size.touch, height: tokens.size.touch, borderRadius: tokens.radius.full, borderWidth: tokens.size.border },
});
