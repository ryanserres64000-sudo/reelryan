import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { STYLES_MAISON, type Dna } from "../../../core/brand";
import { emptyMemory, forget, type Memory } from "../../../core/corrections";
import { SOUS_TITRES_STYLES } from "../../../core/timeline";
import { fr } from "../copy/fr";
import { Button, Card, Chip, MadaSays, Screen, Swatch, Text, tokens, typeStyle, useTheme } from "../design";

type Props = { dna: Dna; byAi: boolean; saveError: boolean; memory: Memory; onMemory: (m: Memory) => void; onChange: (d: Dna) => void; onRedo: () => void; onDone: () => void };
const t = fr.dna.carnet;

// The carnet ADN (étude, ch. 5 §8 « carnet de style » ; ch. 12 idée signature n°2) : what MaDa
// understood, in sentences the person reads and corrects. Every edit wins over the AI.
export function CarnetScreen({ dna, byAi, saveError, memory, onMemory, onChange, onRedo, onDone }: Props) {
  const [styles_, setStyles] = useState(false);
  const set = (p: Partial<Dna>) => onChange({ ...dna, ...p });
  const setAt = <K extends "regles" | "a_eviter" | "valeurs">(k: K, i: number, v: string) =>
    set({ [k]: v.trim() ? dna[k].map((x, j) => (j === i ? v.trim() : x)) : dna[k].filter((_, j) => j !== i) } as Partial<Dna>);
  const style = t.styles[dna.style_maison];

  return (
    <Screen title={dna.nom ? t.titleNamed(dna.nom) : t.title} detail={t.detail}
      footer={<>
        {saveError ? <Text variant="caption" tone="danger">{t.saveError}</Text> : null}
        <Button label={t.ok} onPress={onDone} haptic />
      </>}>
      {!byAi ? <MadaSays text={fr.dna.analysis.offline} /> : null}

      <Section title={t.sections.resume}><Editable value={dna.resume} label={t.sections.resume} variant="headline" onChange={resume => set({ resume })} /></Section>
      <Section title={t.sections.ton}><Editable value={dna.ton} label={t.sections.ton} onChange={ton => set({ ton })} /></Section>
      <Section title={t.sections.valeurs}>
        {dna.valeurs.length ? dna.valeurs.map((v, i) => <Editable key={i} value={v} label={t.sections.valeurs} onChange={x => setAt("valeurs", i, x)} />) : <Text tone="textMuted">{t.empty}</Text>}
      </Section>
      <Section title={t.sections.public}><Editable value={dna.public} label={t.sections.public} onChange={p => set({ public: p })} /></Section>

      <Section title={t.sections.piliers}>
        {dna.piliers.length ? dna.piliers.map((p, i) => (
          <Card key={i}>
            <Editable value={p.titre} label={t.sections.piliers} variant="bodyStrong" onChange={titre => set({ piliers: dna.piliers.map((x, j) => (j === i ? { ...x, titre } : x)).filter(x => x.titre) })} />
            <Editable value={p.idee} label={t.sections.piliers} muted onChange={idee => set({ piliers: dna.piliers.map((x, j) => (j === i ? { ...x, idee } : x)) })} />
          </Card>
        )) : <Text tone="textMuted">{t.empty}</Text>}
      </Section>

      <Section title={t.sections.style}>
        <Card raised>
          <Text variant="headline" tone="actionStrong">{style.label}</Text>
          <Text>{style.detail}</Text>
          <Text variant="caption" tone="textMuted">{t.subtitles[dna.sous_titres]}</Text>
        </Card>
        <Chip label={t.changeStyle} selected={styles_} onPress={() => setStyles(!styles_)} />
        {styles_ ? (
          <View style={styles.row}>
            {STYLES_MAISON.map(s => <Chip key={s} label={t.styles[s].label} selected={dna.style_maison === s} onPress={() => set({ style_maison: s })} />)}
            {SOUS_TITRES_STYLES.map(s => <Chip key={s} label={t.subtitles[s]} selected={dna.sous_titres === s} onPress={() => set({ sous_titres: s })} />)}
          </View>
        ) : null}
      </Section>

      <Section title={t.sections.regles}>
        {dna.regles.length ? dna.regles.map((r, i) => <Editable key={r + i} value={r} label={t.sections.regles} bullet onChange={x => setAt("regles", i, x)} />) : <Text tone="textMuted">{t.empty}</Text>}
      </Section>
      <Section title={t.sections.eviter}>
        {dna.a_eviter.map((r, i) => <Editable key={r + i} value={r} label={t.sections.eviter} bullet onChange={x => setAt("a_eviter", i, x)} />)}
        <MadaSays text={t.cliches} />
      </Section>

      <Section title={t.learnt}>
        {memory.rules.length ? memory.rules.map(r => (
          <View key={r.key} style={styles.between}>
            <Text style={styles.flex}>{r.text}</Text>
            <Chip label={t.forgetShort} accessibilityLabel={t.forget(r.text)} onPress={() => onMemory(forget(memory, r.key))} />
          </View>
        )) : <Text tone="textMuted">{t.learntEmpty}</Text>}
        {memory.paused ? <Text variant="caption" tone="textMuted">{t.paused}</Text> : null}
        <View style={styles.row}>
          <Chip label={memory.paused ? t.resume : t.pause} onPress={() => onMemory({ ...memory, paused: !memory.paused })} />
          {memory.rules.length || Object.keys(memory.counts).length ? <Chip label={t.reset} onPress={() => onMemory({ ...emptyMemory(), paused: memory.paused })} /> : null}
        </View>
      </Section>

      <Section title={t.sections.idees}>
        {dna.idees.length ? dna.idees.map((d, i) => (
          <View key={d.titre + i} style={styles.idea}>
            <Text variant="mono" tone="actionStrong" style={styles.format}>{t.formats[d.format]}</Text>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{d.titre}</Text>
              {d.pourquoi ? <Text variant="callout" tone="textMuted">{d.pourquoi}</Text> : null}
            </View>
          </View>
        )) : <Text tone="textMuted">{t.empty}</Text>}
      </Section>

      <Section title={t.sections.charte}>
        {dna.couleurs.length ? <View style={styles.row}>{dna.couleurs.map(col => <Swatch key={col} color={col} label={col} />)}</View> : null}
        <Text>{fr.dna.logo.fontPair(dna.polices.titres, dna.polices.texte)}</Text>
      </Section>

      <Button variant="secondary" label={t.redo} onPress={onRedo} />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="callout" tone="textMuted" accessibilityRole="header">{title}</Text>
      {children}
    </View>
  );
}

// A sentence of the carnet: tap to correct it in place; emptied, it is removed.
function Editable({ value, label, onChange, variant = "body", muted = false, bullet = false }: { value: string; label: string; onChange: (v: string) => void; variant?: "body" | "bodyStrong" | "headline"; muted?: boolean; bullet?: boolean }) {
  const { c, opacity } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (editing) {
    const done = () => { setEditing(false); if (draft !== value) onChange(draft); };
    return (
      <View style={styles.editRow}>
        <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={done} onBlur={done} autoFocus multiline submitBehavior="blurAndSubmit" accessibilityLabel={t.edit(label)}
          style={[typeStyle(variant), styles.input, { color: c.text, borderColor: c.action, backgroundColor: c.surface }]} />
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t.edit(label)} accessibilityHint={value} onPress={() => { setDraft(value); setEditing(true); }}
      style={({ pressed }) => [styles.editRow, { opacity: pressed ? opacity.pressed : 1 }]}>
      {bullet ? <View style={[styles.bullet, { backgroundColor: c.actionStrong }]} /> : null}
      <Text variant={variant} tone={muted || !value ? "textMuted" : "text"} style={styles.flex}>{value || t.empty}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: tokens.space.xs },
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs },
  idea: { flexDirection: "row", gap: tokens.space.sm },
  between: { flexDirection: "row", alignItems: "center", gap: tokens.space.xs, flexWrap: "wrap" },
  format: { width: tokens.size.button * 1.5 },
  flex: { flex: 1 },
  editRow: { flexDirection: "row", alignItems: "center", gap: tokens.space.xs, minHeight: tokens.size.touch },
  input: { flex: 1, borderWidth: tokens.size.border, borderRadius: tokens.radius.button, padding: tokens.space.xs },
  bullet: { width: tokens.size.beatDot, height: tokens.size.beatDot, borderRadius: tokens.radius.full },
});
