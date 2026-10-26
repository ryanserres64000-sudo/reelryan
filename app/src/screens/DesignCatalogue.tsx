import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { fr } from "../copy/fr";
import { Button, Card, Chip, Frise, GenerationView, MusicPicker, Paywall, RushCard, SavedPill, Text, Waveform, tokens, useTheme, type MusicChoice } from "../design";

// Every component of the design system on one screen, in both modes: the visual check of lot 1.
const SAMPLE = {
  rushes: [
    { duration: 12, badges: ["speech", "face"] as const, order: 1 },
    { duration: 4, badges: ["blur"] as const },
    { duration: 7, badges: [] as const, order: 2 },
  ],
  shots: [
    { id: "a", duration: 1.5 }, { id: "b", duration: 2, changed: true }, { id: "c", duration: 1 }, { id: "d", duration: 2.5 }, { id: "e", duration: 1 },
  ],
  beats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5],
  texts: [{ start: 0, end: 1.5, label: "Menu du jeudi" }, { start: 5.5, end: 8, label: "12 rue Thiers" }],
  peaks: Array.from({ length: 160 }, (_, i) => 0.25 + 0.6 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11))),
  kept: [0, 2, 3, 5, 7],
};

export function DesignCatalogue() {
  const { c, layout, preference, setPreference } = useTheme();
  const { width } = useWindowDimensions();
  const gutter = width >= layout.largePhoneWidth ? layout.gutterLarge : layout.gutter;
  const [music, setMusic] = useState<MusicChoice>("trending");
  const [length, setLength] = useState<number>(fr.music.lengths[1]);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(true);
  useEffect(() => { if (step >= 4) return; const id = setTimeout(() => setStep(s => s + 1), 2200); return () => clearTimeout(id); }, [step]);
  const cardWidth = (Math.min(width, tokens.layout.largePhoneWidth) - gutter * 2 - tokens.space.sm * 2) / 3;

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={[styles.page, { paddingHorizontal: gutter }]}>
      <Text variant="display" accessibilityRole="header">{fr.catalogue.title}</Text>
      <Text tone="textMuted">{fr.catalogue.intro}</Text>
      <View style={styles.row}>
        <Chip label={fr.catalogue.themeDark} selected={preference === "dark"} onPress={() => setPreference("dark")} />
        <Chip label={fr.catalogue.themeLight} selected={preference === "light"} onPress={() => setPreference("light")} />
      </View>

      <Section title={fr.catalogue.sections.colors}>
        <View style={styles.swatches}>
          {(Object.keys(c) as (keyof typeof c)[]).map(k => (
            <View key={k} style={styles.swatch}>
              <View style={[styles.swatchColor, { backgroundColor: c[k], borderColor: c.line }]} />
              <Text variant="caption" tone="textMuted">{k}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title={fr.catalogue.sections.type}>
        <Text variant="display">{fr.app.tagline}</Text>
        <Text variant="title">{fr.paywall.title}</Text>
        <Text variant="headline">{fr.music.title}</Text>
        <Text>{fr.catalogue.sample.body}</Text>
        <Text variant="caption" tone="textMuted">{fr.catalogue.sample.caption}</Text>
        <Text variant="mono">{fr.catalogue.sample.mono}</Text>
      </Section>

      <Section title={fr.catalogue.sections.buttons}>
        <Button label={fr.export.cta} haptic />
        <Button variant="secondary" label={fr.corrections.undo} />
        <View style={styles.row}>
          {fr.corrections.suggestions.map(s => <Chip key={s} kind="ai" label={s} />)}
        </View>
      </Section>

      <Section title={fr.catalogue.sections.rushes}>
        <View style={styles.row}>
          {SAMPLE.rushes.map((r, i) => <RushCard key={i} width={cardWidth} duration={r.duration} badges={[...r.badges]} order={r.order} />)}
        </View>
      </Section>

      <Section title={fr.catalogue.sections.frise}>
        <Frise shots={SAMPLE.shots} beats={SAMPLE.beats} texts={SAMPLE.texts} />
        <Text variant="caption" tone="ai">{fr.corrections.changed}</Text>
      </Section>

      <Section title={fr.catalogue.sections.music}>
        <MusicPicker value={music} recommended="trending" onChange={setMusic} />
        <Card raised><Text variant="caption" tone="textMuted">{fr.music.warning}</Text></Card>
      </Section>

      <Section title={fr.catalogue.sections.wave}>
        <Waveform peaks={SAMPLE.peaks} duration={90} start={41} length={length} downbeats={SAMPLE.beats.map(b => b * 12)} onLengthChange={setLength} />
      </Section>

      <Section title={fr.catalogue.sections.generation}>
        <GenerationView rushes={9} kept={SAMPLE.kept} step={step} beat={0.5} />
        <Button variant="secondary" label={fr.catalogue.replay} onPress={() => setStep(0)} />
      </Section>

      <Section title={fr.catalogue.sections.saved}>
        <SavedPill visible={saved} />
        <Button variant="secondary" label={fr.catalogue.replay} onPress={() => { setSaved(false); setTimeout(() => setSaved(true), tokens.motion.slow); }} />
      </Section>

      <Section title={fr.catalogue.sections.paywall}>
        <Paywall background={<View style={[StyleSheet.absoluteFill, { backgroundColor: c.surfaceRaised }]} />} />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="headline" accessibilityRole="header">{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingVertical: tokens.space.xxl, gap: tokens.space.md, maxWidth: tokens.layout.largePhoneWidth * 1.5, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  section: { gap: tokens.space.sm, marginTop: tokens.space.lg },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  swatch: { width: tokens.size.button * 1.5, gap: tokens.space.xxs },
  swatchColor: { height: tokens.size.touch, borderRadius: tokens.radius.chip, borderWidth: tokens.size.border },
});
