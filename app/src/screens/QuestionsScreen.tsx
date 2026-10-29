import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, TextInput, View } from "react-native";
import type { Answers, Profil, Question } from "../../../core/brand";
import { interviewFor, type Wording } from "../../../core/interview";
import { aiWording, answerText, itemOf, labelOf, offlineWording } from "../brand/interview";
import { fr } from "../copy/fr";
import { Button, Chip, Gradient, MadaSays, Screen, Text, tokens, typeStyle, useTheme } from "../design";

type Props = { profil: Profil; answers: Answers; onChange: (a: Answers) => void; onBack: () => void; onDone: () => void; ai: string | null };
const q8n = fr.dna.questions;

// The questionnaire as a conversation (Ryan, 29 octobre : des questions plus travaillées, adaptées à
// chaque réponse). One card at a time: what the person just said, Ma DA's reaction to it, then the next
// question in words that pick up her name and her answers. The code chooses the question and its
// follow-ups (core/interview.ts); the small model only rewords it, and never makes sign-up wait more
// than a few seconds. Every card can be skipped. The answers are kept as labels: that is what the AI reads.
export function QuestionsScreen({ profil, answers, onChange, onBack, onDone, ai }: Props) {
  const list = interviewFor(profil, answers, labelOf);
  const [i, setI] = useState(0);
  const q = list[Math.min(i, list.length - 1)];
  const prev = i > 0 ? list[i - 1] : undefined;
  const [words, setWords] = useState<Record<string, Wording>>({});
  const [thinking, setThinking] = useState(false);
  // The person's last answer, shown as her bubble above Ma DA's reaction.
  const last = prev ? answerText(answers[prev.id]) : "";

  useEffect(() => {
    if (words[q.id]) return;
    const offline = offlineWording(q, prev, profil, answers, i);
    if (!ai) { setWords(w => ({ ...w, [q.id]: offline })); return; }
    const stop = new AbortController();
    setThinking(true);
    const history = list.slice(0, i).map(x => ({ question: words[x.id]?.titre ?? offlineWording(x, undefined, profil, answers, 0).titre, reponse: answerText(answers[x.id]) }));
    aiWording(ai, q, offline, profil, history, stop.signal).then(w => {
      if (stop.signal.aborted) return;
      setWords(all => ({ ...all, [q.id]: w ?? offline }));
      setThinking(false);
    });
    return () => { stop.abort(); setThinking(false); };
  }, [q.id]);

  const w = words[q.id];
  const go = (d: number) => {
    const n = i + d;
    if (n < 0) return onBack();
    if (n >= list.length) return onDone();
    // Going forward again rewrites the reaction to what was just said.
    if (d > 0) setWords(all => { const { [list[n].id]: _, ...rest } = all; return rest; });
    setI(n);
  };
  const set = (v: string | string[]) => onChange({ ...answers, [q.id]: v });
  const value = answers[q.id];
  const filled = Array.isArray(value) ? value.length > 0 : !!value?.trim();

  return (
    <Screen onBack={() => go(-1)}
      footer={<View style={styles.footer}>
        <View style={styles.flex}><Button variant="secondary" label={q8n.skip} onPress={() => go(1)} /></View>
        <View style={styles.flex}><Button label={fr.nav.next} disabled={!filled || !w} onPress={() => go(1)} haptic /></View>
      </View>}>
      <Progress at={i + 1} of={list.length} />
      {last ? (
        <View style={styles.mine} accessibilityLabel={`${q8n.you} : ${last}`}>
          <Gradient />
          <Text tone="onAction">{last}</Text>
        </View>
      ) : null}
      {w && !thinking ? <MadaSays text={w.reaction} /> : <Typing />}
      {w && !thinking ? <Card key={q.id} q={q} w={w} value={value} onChange={set} /> : null}
    </Screen>
  );
}

function Progress({ at, of }: { at: number; of: number }) {
  const { c, motion, reduceMotion } = useTheme();
  const v = useRef(new Animated.Value(at / of)).current;
  useEffect(() => { Animated.timing(v, { toValue: at / of, duration: reduceMotion ? 0 : motion.base, useNativeDriver: false }).start(); }, [at, of]);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={q8n.progressLabel(at, of)} accessibilityValue={{ min: 0, max: of, now: at }} style={styles.progressRow}>
      <View style={[styles.track, { backgroundColor: c.surfaceRaised }]}>
        <Animated.View style={[styles.fill, { width: v.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]}><Gradient /></Animated.View>
      </View>
      <Text variant="mono" tone="textMuted">{q8n.progress(at, of)}</Text>
    </View>
  );
}

// « Ma DA écrit… » with three dots, while the small model words the next question.
function Typing() {
  const { c, motion, reduceMotion, opacity } = useTheme();
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(reduceMotion ? 1 : opacity.pulseLow))).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.stagger(motion.stagger * 2, dots.map(d => Animated.sequence([
      Animated.timing(d, { toValue: 1, duration: motion.fast, useNativeDriver: true }),
      Animated.timing(d, { toValue: opacity.pulseLow, duration: motion.base, useNativeDriver: true }),
    ]))));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={styles.typing} accessibilityLabel={q8n.typing} accessibilityLiveRegion="polite">
      {dots.map((d, k) => <Animated.View key={k} style={[styles.dot, { backgroundColor: c.ai, opacity: d }]} />)}
      <Text variant="caption" tone="textMuted">{q8n.typing}</Text>
    </View>
  );
}

function Card({ q, w, value, onChange }: { q: Question; w: Wording; value: string | string[] | undefined; onChange: (v: string | string[]) => void }) {
  const { motion, reduceMotion } = useTheme();
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => { if (!reduceMotion) Animated.timing(enter, { toValue: 1, duration: motion.slow, useNativeDriver: true }).start(); }, []);
  const lift = enter.interpolate({ inputRange: [0, 1], outputRange: [tokens.space.md, 0] });
  return (
    <Animated.View style={[styles.card, { opacity: enter, transform: [{ translateY: lift }] }]}>
      <View style={styles.head}>
        <Text variant="title" accessibilityRole="header">{w.titre}</Text>
        <Text variant="caption" tone="textMuted">{w.pourquoi}</Text>
      </View>
      <Field q={q} w={w} value={value} onChange={onChange} />
    </Animated.View>
  );
}

function Field({ q, w, value, onChange }: { q: Question; w: Wording; value: string | string[] | undefined; onChange: (v: string | string[]) => void }) {
  const { c } = useTheme();
  const [word, setWord] = useState("");
  const item = itemOf(q.id);
  const input = { color: c.text, borderColor: c.line, backgroundColor: c.surface };
  if (q.kind === "texte") {
    const text = typeof value === "string" ? value : "";
    return (
      <View style={styles.words}>
        <TextInput value={text} onChangeText={onChange} placeholder={w.exemple} placeholderTextColor={c.textMuted}
          accessibilityLabel={w.titre} maxLength={q.max} multiline={(q.max ?? 0) > 80} autoFocus
          style={[typeStyle("body"), styles.input, (q.max ?? 0) > 80 && styles.long, input]} />
        {w.suggestions.length ? (
          <View style={styles.row} accessibilityLabel={q8n.ideas}>
            {w.suggestions.map(s => <Chip key={s} kind="ai" label={s} onPress={() => onChange(text.trim() ? `${text.trim()}, ${s}` : s)} />)}
          </View>
        ) : null}
      </View>
    );
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
  // « mots » : up to `max` words, typed or taken from Ma DA's suggestions.
  const chosen = Array.isArray(value) ? value : [];
  const full = chosen.length >= (q.max ?? 3);
  const add = (v0: string) => { const v = v0.trim(); if (v && !full && !chosen.includes(v)) onChange([...chosen, v]); setWord(""); };
  return (
    <View style={styles.words}>
      <View style={styles.row}>{chosen.map(x => <Chip key={x} label={q8n.removeWord(x)} selected onPress={() => onChange(chosen.filter(y => y !== x))} />)}</View>
      {!full ? (
        <View style={styles.addRow}>
          <TextInput value={word} onChangeText={setWord} onSubmitEditing={() => add(word)} placeholder={q8n.wordPlaceholder} placeholderTextColor={c.textMuted}
            accessibilityLabel={w.titre} maxLength={30} returnKeyType="done" style={[typeStyle("body"), styles.input, styles.flex, input]} />
          <Button variant="secondary" label={q8n.addWord} disabled={!word.trim()} onPress={() => add(word)} style={styles.addButton} />
        </View>
      ) : null}
      <View style={styles.row}>{w.suggestions.filter(s => !chosen.includes(s)).map(s => <Chip key={s} kind="ai" label={s} disabled={full} onPress={() => add(s)} />)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: "row", gap: tokens.space.xs },
  flex: { flex: 1 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: tokens.space.sm },
  track: { flex: 1, height: tokens.size.textBar, borderRadius: tokens.radius.full, overflow: "hidden" },
  fill: { height: "100%", borderRadius: tokens.radius.full, overflow: "hidden" },
  mine: { alignSelf: "flex-end", maxWidth: "85%", paddingHorizontal: tokens.space.sm, paddingVertical: tokens.space.xs, borderRadius: tokens.radius.card, overflow: "hidden" },
  typing: { flexDirection: "row", alignItems: "center", gap: tokens.space.xxs, minHeight: tokens.size.touch },
  dot: { width: tokens.space.xs, height: tokens.space.xs, borderRadius: tokens.radius.full },
  card: { gap: tokens.space.md },
  head: { gap: tokens.space.xs },
  input: { minHeight: tokens.size.button, borderWidth: tokens.size.border, borderRadius: tokens.radius.button, paddingHorizontal: tokens.space.sm, paddingVertical: tokens.space.xs },
  long: { minHeight: tokens.size.button * 2, textAlignVertical: "top" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs },
  words: { gap: tokens.space.sm },
  addRow: { flexDirection: "row", gap: tokens.space.xs, alignItems: "center" },
  addButton: { alignSelf: "auto" },
});
