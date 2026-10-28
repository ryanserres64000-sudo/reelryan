import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { applyCorrection, learn, type Memory } from "../../../core/corrections";
import { addTexte, changedPlans, deleteEffet, deletePlan, deleteTexte, isLocked, movePlan, push, redo, replaceSource, setDuo, setLogo, setPlan, setSubtitles, setTexte, startHistory, toDoc, trimPlan, undo, type EditDoc, type History } from "../../../core/edit";
import { ETALONNAGES, LOGO_POSITIONS, TEXT_POSITIONS, TRANSITIONS, TRANSITION_SECONDS, type Clips, type TimelineV1 } from "../../../core/timeline";
import { DUOS, duoById } from "../../../core/typo";
import { fr } from "../copy/fr";
import { Button, Card, Chip, Frise, Icon, MadaSays, Screen, Text, tokens, typeStyle, useTheme, type IconName } from "../design";
import { aiRetouche } from "../flow/retouche";
import { DuoTitle } from "../video/DuoTitle";

type Props = {
  timeline: TimelineV1; clips: Clips; bad: string[]; brief: string; style: object; memory: Memory;
  onMemory: (m: Memory) => void; onSave: (t: TimelineV1) => void; onBack: () => void;
};
type Tool = keyof typeof fr.editor.tools;
const TOOLS: [Tool, IconName][] = [["plan", "plan"], ["vitesse", "speed"], ["texte", "text"], ["son", "sound"], ["couleur", "color"], ["marque", "brand"]];
const t = fr.editor;
const SPEEDS = [0.5, 1, 1.5, 2];
const LOGO_KEYS = LOGO_POSITIONS;

// Full control over the chosen version (étude, ch. 5 §6 ; Ryan, 28 octobre). Every change by hand is
// instant and free (no AI), locks what it touches, and can be undone without limit. A sentence goes
// first through plain rules on the phone; only what they cannot do goes to the AI. « Atelier clair »:
// six named tools under the frise instead of rows of tabs, one « Demander à Ma DA » field, on a dark
// ground (Flow nests a dark theme) so the footage is judged as it will be seen.
export function EditorScreen({ timeline, clips, bad, brief, style, memory, onMemory, onSave, onBack }: Props) {
  const { c } = useTheme();
  const [h, setH] = useState<History>(() => startHistory(toDoc(timeline)));
  const [sel, setSel] = useState(0);
  const [tool, setTool] = useState<Tool>("plan");
  const [ask, setAsk] = useState("");
  const [say, setSay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState<string[]>([]);
  const ctl = useRef<AbortController | null>(null);
  const d = h.present, tl = d.timeline;
  const apply = (next: EditDoc) => { setChanged(changedPlans(d, next)); setH(push(h, next)); };
  const i = Math.min(sel, tl.plans.length - 1), p = tl.plans[i];
  const rushIds = Object.keys(clips);
  const fmt = fr.rush.duration;

  const correct = async (sentence: string) => {
    const s = sentence.trim();
    if (!s || busy) return;
    const r = applyCorrection(d, s, clips, bad);
    let next = r.doc, lines = r.understood.map(u => u.done);
    const { memory: m, learned } = learn(memory, r.understood.map(u => u.key));
    if (m !== memory) onMemory(m);
    if (r.rest) {
      setBusy(true); setSay(t.askingAi);
      ctl.current = new AbortController();
      try {
        const out = await aiRetouche(next, r.rest, clips, style, brief, ctl.current.signal);
        if (out) { next = out.doc; lines = [...lines, ...out.corrections]; }
        else lines.push(t.needAi(r.rest));
      } catch {
        lines.push(t.aiError);
      } finally { setBusy(false); }
    }
    if (next !== d) apply(next);
    setSay([lines.length ? t.understood(lines) : t.nothing, ...learned.map(fr.corrections.learned)].join(" "));
    setAsk("");
  };

  const shots = tl.plans.map((x, j) => ({ id: d.planIds[j], duration: (x.fin - x.debut) / x.vitesse - (j && x.transition !== "coupe" ? TRANSITION_SECONDS : 0), changed: changed.includes(d.planIds[j]) }));
  const planTools = tool === "plan" || tool === "vitesse" || tool === "son" || tool === "couleur";
  return (
    <Screen title={t.title} detail={t.detail} onBack={onBack}
      footer={<Button label={t.save} disabled={busy} onPress={() => onSave(tl)} haptic />}>
      <Frise shots={shots} texts={tl.textes.map(x => ({ start: x.debut, end: x.fin, label: x.texte }))} selected={planTools ? i : undefined} onSelect={j => { setSel(j); if (!planTools) setTool("plan"); }} />
      <View style={styles.between}>
        <View style={styles.row}>
          <IconButton icon="undo" label={t.undo} disabled={!h.past.length} onPress={() => setH(undo(h))} />
          <IconButton icon="redo" label={t.redo} disabled={!h.future.length} onPress={() => setH(redo(h))} />
        </View>
        <Text variant="mono" tone="textMuted">{t.duration(fmt(tl.duree))}</Text>
      </View>

      <View style={styles.field}>
        <View style={styles.row}>
          <Icon name="spark" tone="ai" />
          <Text variant="bodyStrong" tone="ai" nativeID="ask-label">{t.ask}</Text>
        </View>
        <View style={styles.askRow}>
          <TextInput value={ask} onChangeText={setAsk} onSubmitEditing={() => correct(ask)} placeholder={t.correctionPlaceholder} placeholderTextColor={c.textMuted}
            accessibilityLabelledBy="ask-label" maxLength={300} returnKeyType="send" editable={!busy}
            style={[typeStyle("body"), styles.input, styles.flex, styles.shrink, { color: c.text, borderColor: c.line, backgroundColor: c.surface }]} />
          <Button variant="secondary" label={fr.corrections.send} disabled={!ask.trim() || busy} onPress={() => correct(ask)} style={styles.auto} />
        </View>
        {!say ? <View style={styles.row}>{fr.corrections.suggestions.map(x => <Chip key={x} kind="ai" label={x} disabled={busy} onPress={() => correct(x)} />)}</View> : null}
        {say ? <MadaSays text={say} /> : null}
      </View>

      <View style={[styles.tools, { borderColor: c.line }]} accessibilityRole="tablist" accessibilityLabel={t.toolsLabel}>
        {TOOLS.map(([k, icon]) => (
          <Pressable key={k} onPress={() => setTool(k)} accessibilityRole="tab" accessibilityState={{ selected: tool === k }} style={styles.tool}>
            <Icon name={icon} tone={tool === k ? "text" : "textMuted"} />
            <Text variant="caption" tone={tool === k ? "text" : "textMuted"}>{t.tools[k]}</Text>
            <View style={[styles.toolMark, { backgroundColor: tool === k ? c.text : "transparent" }]} />
          </Pressable>
        ))}
      </View>

      {planTools && p ? (
        <View style={styles.between}>
          <Text variant="headline">{t.planTitle(i + 1, t.seconds(shots[i].duration))}</Text>
          {isLocked(d, d.planIds[i]) ? <Text variant="caption" tone="actionStrong">{t.locked}</Text> : null}
        </View>
      ) : null}

      {tool === "plan" && p ? (
        <Card>
          <Group label={`${t.start} ${t.seconds(p.debut)}`}>
            <Chip label={t.earlier} onPress={() => apply(trimPlan(d, i, p.debut - 0.5, p.fin, clips))} />
            <Chip label={t.later} onPress={() => apply(trimPlan(d, i, p.debut + 0.5, p.fin, clips))} />
          </Group>
          <Group label={`${t.end} ${t.seconds(p.fin)}`}>
            <Chip label={t.earlier} onPress={() => apply(trimPlan(d, i, p.debut, p.fin - 0.5, clips))} />
            <Chip label={t.later} onPress={() => apply(trimPlan(d, i, p.debut, p.fin + 0.5, clips))} />
          </Group>
          <View style={styles.row}>
            <Chip label={t.moveBefore} disabled={i === 0} onPress={() => { apply(movePlan(d, i, i - 1)); setSel(i - 1); }} />
            <Chip label={t.moveAfter} disabled={i === tl.plans.length - 1} onPress={() => { apply(movePlan(d, i, i + 1)); setSel(i + 1); }} />
          </View>
          <Group label={t.source}>{rushIds.map((id, k) => <Chip key={id} label={t.sourceName(k + 1)} selected={p.source === id} onPress={() => apply(replaceSource(d, i, id, clips))} />)}</Group>
          {i > 0 ? <Group label={t.transition}>{TRANSITIONS.map(x => <Chip key={x} label={t.transitions[x]} selected={p.transition === x} onPress={() => apply(setPlan(d, i, { transition: x }))} />)}</Group> : null}
          {tl.plans.length > 1
            ? <Button variant="secondary" label={t.deletePlan} onPress={() => { apply(deletePlan(d, i)); setSel(Math.max(0, i - 1)); }} />
            : <Text variant="caption" tone="textMuted">{t.lastPlan}</Text>}
        </Card>
      ) : null}

      {tool === "vitesse" && p ? (
        <Card><Group label={t.speed}>{SPEEDS.map(v => <Chip key={v} label={t.speedValue(v)} selected={p.vitesse === v} onPress={() => apply(setPlan(d, i, { vitesse: v }))} />)}</Group></Card>
      ) : null}

      {tool === "couleur" && p ? (
        <Card><Group label={t.grade}>{ETALONNAGES.map(x => <Chip key={x} label={t.grades[x]} selected={p.etalonnage === x} onPress={() => apply(setPlan(d, i, { etalonnage: x }))} />)}</Group></Card>
      ) : null}

      {tool === "son" && p ? (
        <Card>
          <Group label={t.sound}>
            <Chip label={t.on} selected={p.garder_son} onPress={() => apply(setPlan(d, i, { garder_son: true }))} />
            <Chip label={t.off} selected={!p.garder_son} onPress={() => apply(setPlan(d, i, { garder_son: false }))} />
          </Group>
          <Group label={t.effets}>
            {(tl.effets ?? []).map((e, k) => <Chip key={`${e.type}${e.t}`} label={t.effet(t.effetNames[e.type], t.seconds(e.t))} onPress={() => apply(deleteEffet(d, k))} />)}
          </Group>
          <Text variant="caption" tone="textMuted">{(tl.effets ?? []).length ? t.effetsWhy : t.effetsNone}</Text>
        </Card>
      ) : null}

      {tool === "texte" ? (
        <View style={styles.field}>
          <Card>
            <Group label={t.subtitles}>
              <Chip label={t.on} selected={tl.sous_titres.actifs} onPress={() => apply(setSubtitles(d, true))} />
              <Chip label={t.off} selected={!tl.sous_titres.actifs} onPress={() => apply(setSubtitles(d, false))} />
            </Group>
          </Card>
          {tl.textes.map((x, j) => (
            <Card key={d.texteIds[j]}>
              <View style={styles.between}>
                <Text variant="callout" tone="textMuted">{t.text(j + 1)}</Text>
                {x.impose || isLocked(d, d.texteIds[j]) ? <Text variant="caption" tone="actionStrong">{x.impose ? t.imposed : t.locked}</Text> : null}
              </View>
              <TextField value={x.texte} label={t.text(j + 1)} onDone={v => apply(setTexte(d, j, { texte: v }))} />
              {x.style === "accroche" || x.style === "titre" ? (
                <View style={styles.group}>
                  <Text variant="caption" tone="textMuted">{t.accent}</Text>
                  <TextField value={x.accent} label={t.accent} placeholder={t.accentPlaceholder} max={30} onDone={v => apply(setTexte(d, j, { accent: v }))} />
                </View>
              ) : null}
              <Group label={t.position}>{TEXT_POSITIONS.map(pos => <Chip key={pos} label={t.positions[pos]} selected={x.position === pos} onPress={() => apply(setTexte(d, j, { position: pos }))} />)}</Group>
              <Chip label={t.deleteText} onPress={() => apply(deleteTexte(d, j))} style={styles.start} />
            </Card>
          ))}
          <Button variant="secondary" label={t.addText} onPress={() => apply(addTexte(d, t.newText, tl.duree / 2))} />
        </View>
      ) : null}

      {tool === "marque" ? (
        <Card>
          <Group label={t.logo}>{LOGO_KEYS.map(k => <Chip key={k} label={t.logoPositions[k]} selected={(tl.charte.logo?.position ?? "aucun") === k} onPress={() => apply(setLogo(d, k))} />)}</Group>
          <Group label={t.duo}>
            {DUOS.map(x => <Chip key={x.id} label={x.nom} selected={tl.charte.duo === x.id} onPress={() => apply(setDuo(d, x.id))} />)}
            <Chip label={t.noDuo} selected={!tl.charte.duo} onPress={() => apply(setDuo(d, null))} />
          </Group>
          {tl.charte.duo ? <View style={[styles.sample, { backgroundColor: c.media }]}><DuoTitle duo={duoById(tl.charte.duo)} texte={t.duoSample.titre} accent={t.duoSample.accent} /></View> : null}
          <Text variant="caption" tone="textMuted">{t.duoWhy}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

function IconButton({ icon, label, disabled, onPress }: { icon: IconName; label: string; disabled?: boolean; onPress: () => void }) {
  const { c, opacity } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.iconButton, { borderColor: c.line, opacity: disabled ? opacity.disabled : pressed ? opacity.pressed : 1 }]}>
      <Icon name={icon} />
    </Pressable>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text variant="caption" tone="textMuted">{label}</Text>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

function TextField({ value, label, onDone, placeholder, max = 140 }: { value: string; label: string; onDone: (v: string) => void; placeholder?: string; max?: number }) {
  const { c } = useTheme();
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <TextInput value={v} onChangeText={setV} onBlur={() => v !== value && onDone(v)} onSubmitEditing={() => v !== value && onDone(v)} accessibilityLabel={label} maxLength={max}
    placeholder={placeholder} placeholderTextColor={c.textMuted}
    style={[typeStyle("body"), styles.input, { color: c.text, borderColor: c.line, backgroundColor: c.surface }]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs, alignItems: "center" },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: tokens.space.xs },
  field: { gap: tokens.space.sm },
  group: { gap: tokens.space.xxs },
  askRow: { flexDirection: "row", gap: tokens.space.xs, alignItems: "center" },
  input: { minHeight: tokens.size.button, borderWidth: tokens.size.border, borderRadius: tokens.radius.button, paddingHorizontal: tokens.space.sm },
  flex: { flex: 1 },
  // Lets the field give way so « Changer » always fits on a small iPhone.
  shrink: { minWidth: 0 },
  auto: { alignSelf: "auto" },
  start: { alignSelf: "flex-start" },
  tools: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: tokens.size.border, borderBottomWidth: tokens.size.border, paddingTop: tokens.space.xs },
  tool: { flex: 1, alignItems: "center", gap: tokens.space.xxs, minHeight: tokens.size.touch },
  toolMark: { height: tokens.size.selection, alignSelf: "stretch", marginHorizontal: tokens.space.xs, borderRadius: tokens.radius.full },
  iconButton: { width: tokens.size.touch, height: tokens.size.touch, borderRadius: tokens.radius.full, borderWidth: tokens.size.border, alignItems: "center", justifyContent: "center" },
  sample: { borderRadius: tokens.radius.card, paddingVertical: tokens.space.lg, paddingHorizontal: tokens.space.md, alignItems: "center" },
});
