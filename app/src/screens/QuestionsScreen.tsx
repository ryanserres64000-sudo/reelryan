import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { questionsFor, type Answers, type Profil, type Question } from "../../../core/brand";
import { fr } from "../copy/fr";
import { Button, Chip, MadaSays, Screen, Text, tokens, typeStyle, useTheme } from "../design";

type Props = { profil: Profil; answers: Answers; onChange: (a: Answers) => void; onBack: () => void; onDone: () => void };
type ByProfil = Record<Profil, string>;
type Labels = Record<string, string>;
type Item = { title: string; why: string; placeholder?: string | ByProfil; options?: Labels; suggestions?: readonly string[] };

// The questionnaire, one card at a time (Ryan, 28 octobre : questions poussées sur la marque, ses
// valeurs, ses besoins). Every card can be skipped (étude, ch. 7 : le premier Reel reste à 2 minutes),
// and MaDa says why she asks. The answers are kept as labels: that is what the AI reads.
export function QuestionsScreen({ profil, answers, onChange, onBack, onDone }: Props) {
  const list = questionsFor(profil);
  const [i, setI] = useState(0);
  const q = list[i];
  const item = fr.dna.questions.items[q.id as keyof typeof fr.dna.questions.items] as Item;
  const next = () => (i + 1 < list.length ? setI(i + 1) : onDone());
  const back = () => (i > 0 ? setI(i - 1) : onBack());
  const set = (v: string | string[]) => onChange({ ...answers, [q.id]: v });
  const value = answers[q.id];
  const filled = Array.isArray(value) ? value.length > 0 : !!value?.trim();

  return (
    <Screen title={item.title} detail={fr.dna.questions.progress(i + 1, list.length)} onBack={back}
      footer={<View style={styles.footer}>
        <View style={styles.flex}><Button variant="secondary" label={fr.dna.questions.skip} onPress={next} /></View>
        <View style={styles.flex}><Button label={fr.nav.next} disabled={!filled} onPress={next} haptic /></View>
      </View>}>
      <Field key={q.id} q={q} item={item} profil={profil} value={value} onChange={set} />
      <MadaSays text={item.why} />
    </Screen>
  );
}

function Field({ q, item, profil, value, onChange }: { q: Question; item: Item; profil: Profil; value: string | string[] | undefined; onChange: (v: string | string[]) => void }) {
  const { c } = useTheme();
  const [word, setWord] = useState("");
  const input = { color: c.text, borderColor: c.line, backgroundColor: c.surface };
  if (q.kind === "texte") {
    const ph = typeof item.placeholder === "string" ? item.placeholder : item.placeholder?.[profil];
    return <TextInput value={typeof value === "string" ? value : ""} onChangeText={onChange} placeholder={ph} placeholderTextColor={c.textMuted}
      accessibilityLabel={item.title} maxLength={q.max} multiline={(q.max ?? 0) > 80} autoFocus
      style={[typeStyle("body"), styles.input, (q.max ?? 0) > 80 && styles.long, input]} />;
  }
  if (q.kind === "choix" || q.kind === "multi") {
    const picked = Array.isArray(value) ? value : value ? [value] : [];
    return (
      <View style={styles.row} accessibilityRole={q.kind === "choix" ? "radiogroup" : undefined}>
        {(q.options ?? []).map(o => {
          const label = item.options?.[o] ?? o, on = picked.includes(label);
          return <Chip key={o} label={label} selected={on} onPress={() => q.kind === "choix" ? onChange(on ? "" : label) : onChange(on ? picked.filter(x => x !== label) : [...picked, label])} />;
        })}
      </View>
    );
  }
  // « mots » : up to `max` words, typed or taken from MaDa's suggestions.
  const words = Array.isArray(value) ? value : [];
  const full = words.length >= (q.max ?? 3);
  const add = (w: string) => { const v = w.trim(); if (v && !full && !words.includes(v)) onChange([...words, v]); setWord(""); };
  return (
    <View style={styles.words}>
      <View style={styles.row}>{words.map(w => <Chip key={w} label={fr.dna.questions.removeWord(w)} selected onPress={() => onChange(words.filter(x => x !== w))} />)}</View>
      {!full ? (
        <View style={styles.addRow}>
          <TextInput value={word} onChangeText={setWord} onSubmitEditing={() => add(word)} placeholder={fr.dna.questions.wordPlaceholder} placeholderTextColor={c.textMuted}
            accessibilityLabel={item.title} maxLength={30} returnKeyType="done" style={[typeStyle("body"), styles.input, styles.flex, input]} />
          <Button variant="secondary" label={fr.dna.questions.addWord} disabled={!word.trim()} onPress={() => add(word)} style={styles.addButton} />
        </View>
      ) : null}
      <View style={styles.row}>{(item.suggestions ?? []).filter(s => !words.includes(s)).map(s => <Chip key={s} kind="ai" label={s} disabled={full} onPress={() => add(s)} />)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: "row", gap: tokens.space.xs },
  flex: { flex: 1 },
  input: { minHeight: tokens.size.button, borderWidth: tokens.size.border, borderRadius: tokens.radius.button, paddingHorizontal: tokens.space.sm, paddingVertical: tokens.space.xs },
  long: { minHeight: tokens.size.button * 2, textAlignVertical: "top" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs },
  words: { gap: tokens.space.sm },
  addRow: { flexDirection: "row", gap: tokens.space.xs, alignItems: "center" },
  addButton: { alignSelf: "auto" },
});
