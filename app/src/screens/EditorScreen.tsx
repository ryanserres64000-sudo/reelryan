import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { applyCorrection, learn, type Memory } from "../../../core/corrections";
import { addCalque, addTexte, addVoiceOver, changedPlans, deleteAudio, deleteCalque, deleteCle, deleteEffet, deletePlan, deleteTexte, duplicatePlan, duplicateTexte, isLocked, movePlan, planTimes, push, redo, replaceSource, setAudio, setCalque, setDuo, setLogo, setPlan, setSubtitles, setTexte, splitPlan, startHistory, toDoc, trimPlan, undo, type EditDoc, type History } from "../../../core/edit";
import { exportPlan, placeOf } from "../../../core/export";
import { MIN_SIZE, PLACE_LIMITS, SWATCHES, TEXT_ALIGNS, TEXT_ANIMS, TEXT_FONDS, TEXT_ROLES, defaultLook, sizeOf, type TextLook } from "../../../core/textlook";
import { PRESETS, addKey, isOn, moveLayer, newLayer, placeAt, presetOf, type Preset } from "../../../core/layers";
import { clock } from "../../../core/playback";
import { ZOOM, clampZoom, lanes as laneList, type Mode } from "../../../core/tracks";
import { Timeline, type Selection } from "../editor/Timeline";
import { loadMode, saveMode } from "../editor/mode";
import { Frame } from "../video/Frame";
import type { PlayerHandle } from "../video/Player";
import type { Sources } from "../video/sources";
import { COURBES, DETOURAGES, ETALONNAGES, FUSIONS, LOGO_POSITIONS, TEXT_POSITIONS, TRANSITIONS, type Calque, type Clips, type Texte, type TimelineV1 } from "../../../core/timeline";
import { DUOS, duoById } from "../../../core/typo";
import { fr } from "../copy/fr";
import { Button, Card, Chip, Icon, MadaSays, Screen, Sheet, Text, haptic, tokens, typeStyle, useTheme, useToast, type IconName } from "../design";
import { aiRetouche } from "../flow/retouche";
import { DuoTitle } from "../video/DuoTitle";
import { VoiceSheet } from "../voice/VoiceSheet";

type Props = {
  timeline: TimelineV1; clips: Clips; bad: string[]; brief: string; style: object; memory: Memory;
  onMemory: (m: Memory) => void; onSave: (t: TimelineV1) => void; onBack: () => void;
  // Every change, for the draft: nothing is lost if the app closes before « Enregistrer ».
  onChange?: (t: TimelineV1) => void;
  // The full-screen player, and the shot it was paused on when « Retoucher ce moment » brought us here.
  onPlay?: (t: TimelineV1) => void; initialShot?: number;
  sources?: () => Promise<Sources>;
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
export function EditorScreen({ timeline, clips, bad, brief, style, memory, onMemory, onSave, onBack, onChange, onPlay, initialShot = 0, sources }: Props) {
  const { c } = useTheme();
  const [h, setH] = useState<History>(() => startHistory(toDoc(timeline)));
  const [sel, setSel] = useState(initialShot);
  const [tool, setTool] = useState<Tool>("plan");
  const [ask, setAsk] = useState("");
  const [say, setSay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState<string[]>([]);
  const ctl = useRef<AbortController | null>(null);
  const d = h.present, tl = d.timeline;
  const apply = (next: EditDoc) => { setChanged(changedPlans(d, next)); setH(push(h, next)); };
  const toast = useToast();
  // Removals say what happened and can be undone for five seconds (« Annuler partout »).
  const remove = (next: EditDoc, message: string) => { haptic("warning"); apply(next); toast({ message, action: fr.nav.undo, onAction: () => setH(x => undo(x)) }); };
  useEffect(() => { onChange?.(tl); }, [tl]);
  const i = Math.min(sel, tl.plans.length - 1), p = tl.plans[i];
  // The preview and the strip (étape 4 de la refonte): one play head for both, the strip in Simple or
  // Complet, a selection that opens its own actions.
  const { height: wh } = useWindowDimensions();
  const player = useRef<PlayerHandle>(null);
  const [time, setTime] = useState(() => planTimes(timeline)[initialShot]?.start ?? 0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState<number>(ZOOM.start);
  const [mode, setMode] = useState<Mode>("simple");
  useEffect(() => { loadMode().then(setMode); }, []);
  const [selection, setSelection] = useState<Selection>(null);
  const [dragging, setDragging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [voicing, setVoicing] = useState(false);
  const [layering, setLayering] = useState<null | "pip" | "detoure">(null);
  const file = useMemo(() => exportPlan(tl)[0], [tl]);
  const src = useMemo(() => sources?.() ?? null, []);
  const ids = { plans: d.planIds, textes: d.texteIds };
  const { shown, hidden } = laneList(tl, ids, mode);
  const seek = (s: number) => { setTime(s); player.current?.seek(s); };
  const select = (s: Selection) => {
    setSelection(s);
    if (s?.lane === "plans") { setSel(s.index); if (tool === "texte" || tool === "marque") setTool("plan"); }
    if (s?.lane === "textes") setTool("texte");
    // A layer is moved on the picture: show it.
    if (s?.lane === "calques") { const l = (tl.calques ?? [])[s.index]; if (l && !isOn(l, time)) { setPlaying(false); seek(l.t + 0.05); } }
  };
  const trim = (s: NonNullable<Selection>, start: number, end: number) => {
    if (s.lane === "plans") {
      const q = tl.plans[s.index], at = planTimes(tl)[s.index];
      apply(trimPlan(d, s.index, q.debut + (start - at.start) * q.vitesse, q.fin + (end - at.end) * q.vitesse, clips));
    } else if (s.lane === "textes") apply(setTexte(d, s.index, { debut: start, fin: end }));
    else if (s.lane === "voix") { const a = (tl.audios ?? [])[s.index]; apply(setAudio(d, s.id, { t: start, debut: a.debut + start - a.t, fin: a.fin + end - (a.t + a.fin - a.debut) })); }
    else if (s.lane === "calques") { const l = (tl.calques ?? [])[s.index]; apply(setCalque(d, s.id, { t: start, debut: l.debut + start - l.t, fin: l.fin + end - (l.t + l.fin - l.debut) }, clips)); }
  };
  const move = (s: NonNullable<Selection>, start: number) => {
    if (s.lane === "textes") { const x = tl.textes[s.index]; apply(setTexte(d, s.index, { debut: start, fin: start + x.fin - x.debut })); }
    else if (s.lane === "voix") apply(setAudio(d, s.id, { t: start }));
    else if (s.lane === "calques") apply(setCalque(d, s.id, { t: start }, clips));
  };
  const removeSelected = () => {
    if (!selection) return;
    const s = selection; setSelection(null);
    if (s.lane === "plans") remove(deletePlan(d, s.index), fr.toast.planRemoved);
    else if (s.lane === "textes") remove(deleteTexte(d, s.index), fr.toast.textRemoved);
    else if (s.lane === "voix") remove(deleteAudio(d, s.id), fr.toast.soundRemoved);
    else if (s.lane === "calques") remove(deleteCalque(d, s.id, clips), fr.toast.layerRemoved);
    else if (s.lane === "effets") remove(deleteEffet(d, s.index), fr.toast.effetRemoved);
  };
  // Texts: chosen on the picture or in the list, added under the play head and chosen at once.
  const chooseText = (n: number) => { setPlaying(false); setSelection({ lane: "textes", index: n, id: d.texteIds[n] } as Selection); setTool("texte"); };
  const newText = () => {
    const next = addTexte(d, t.newText, time);
    apply(next); setPlaying(false);
    const n = next.timeline.textes.length - 1;
    if (n >= 0) setSelection({ lane: "textes", index: n, id: next.texteIds[n] } as Selection);
    setTool("texte");
  };
  const textSel = selection?.lane === "textes" && tl.textes[selection.index] ? selection.index : null;
  // Bigger while a text is chosen: it is moved and pinched on the picture itself.
  const fw = Math.min(wh * (textSel !== null ? 0.46 : 0.3), tokens.layout.largePhoneWidth) * 9 / 16;
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

  const times = planTimes(tl);
  const planTools = tool === "plan" || tool === "vitesse" || tool === "son" || tool === "couleur";
  return (
    <Screen title={t.title} onBack={onBack} scrollEnabled={!dragging}
      footer={<Button label={t.save} disabled={busy} onPress={() => onSave(tl)} haptic />}>
      <View style={styles.preview}>
        <Frame ref={player} timeline={tl} file={file} sources={src} time={time} playing={playing} onTime={setTime} width={fw}
          onTapPicture={() => { haptic("tap"); setPlaying(x => !x); }}
          selectedLayer={selection?.lane === "calques" ? selection.id : null} onLayerMove={(id, m) => apply(moveLayer(d, id, time, m, clips))} onDragging={setDragging}
          selectedText={textSel} onTextSelect={chooseText} onTextPlace={(n, pl) => apply(setTexte(d, n, { place: pl }))} onTextWrite={(n, v) => apply(setTexte(d, n, { texte: v }))} />
        {onPlay ? <IconButton icon="expand" label={fr.player.open} onPress={() => { setPlaying(false); onPlay(tl); }} /> : null}
      </View>
      <View style={styles.between}>
        <View style={styles.row}>
          <IconButton icon="undo" label={t.undo} disabled={!h.past.length} onPress={() => setH(undo(h))} />
          <IconButton icon="redo" label={t.redo} disabled={!h.future.length} onPress={() => setH(redo(h))} />
        </View>
        <IconButton icon={playing ? "pause" : "play"} label={playing ? fr.player.pause : fr.player.play} onPress={() => setPlaying(x => !x)} />
        <Text variant="mono" tone="textMuted">{fr.player.time(clock(time), clock(tl.duree))}</Text>
      </View>
      <View style={styles.between}>
        <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={fr.tracks.mode}>
          {(["simple", "complet"] as const).map(m => <Chip key={m} label={fr.tracks.modes[m]} selected={mode === m} onPress={() => { setMode(m); saveMode(m); }} />)}
        </View>
        <View style={styles.row}>
          <IconButton icon="minus" label={fr.tracks.zoomOut} onPress={() => setZoom(z => clampZoom(z / 1.5))} />
          <IconButton icon="plus" label={fr.tracks.zoomIn} onPress={() => setZoom(z => clampZoom(z * 1.5))} />
        </View>
      </View>
      <Timeline timeline={tl} lanes={shown} time={time} zoom={zoom} selection={selection}
        onSeek={s => { setPlaying(false); setTime(s); player.current?.seek(s); }} onZoom={setZoom} onSelect={select}
        onTrim={trim} onMove={move} onDragging={setDragging}
        onReorder={(from, to) => { apply(movePlan(d, from, to)); setSel(to); setSelection(null); toast({ message: fr.tracks.moved, action: fr.nav.undo, onAction: () => setH(x => undo(x)) }); }} />
      {hidden.length ? <Chip label={fr.tracks.hidden(hidden.length)} onPress={() => { setMode("complet"); saveMode("complet"); }} style={styles.start} /> : null}
      <View style={styles.row}>
        {selection?.lane === "plans" ? (
          <>
            <Chip label={fr.tracks.split} onPress={() => { const n = splitPlan(d, time); if (n !== d) { apply(n); setSelection(null); toast({ message: fr.tracks.split_done, action: fr.nav.undo, onAction: () => setH(x => undo(x)) }); } }} />
            <Chip label={fr.tracks.duplicate} onPress={() => { apply(duplicatePlan(d, selection.index)); setSelection(null); toast({ message: fr.tracks.duplicated }); }} />
            {tl.plans.length > 1 ? <Chip label={fr.tracks.remove} onPress={removeSelected} /> : null}
          </>
        ) : selection ? (
          <>
            {selection.lane === "textes" ? <Chip label={fr.tracks.edit} onPress={() => setTool("texte")} /> : null}
            <Chip label={fr.tracks.remove} onPress={removeSelected} />
          </>
        ) : (
          <>
            <Chip label={fr.tracks.split} onPress={() => { const n = splitPlan(d, time); if (n !== d) { apply(n); toast({ message: fr.tracks.split_done, action: fr.nav.undo, onAction: () => setH(x => undo(x)) }); } }} />
            <Chip label={`+ ${fr.tracks.add}`} onPress={() => setAdding(true)} />
          </>
        )}
      </View>
      <Sheet visible={adding} onClose={() => setAdding(false)} title={fr.tracks.addTitle}>
        <AddChoice icon="text" title={fr.tracks.addText} why={fr.tracks.addTextWhy} onPress={() => { setAdding(false); newText(); }} />
        <AddChoice icon="layers" title={fr.tracks.addLayer} why={fr.tracks.addLayerWhy} onPress={() => { setAdding(false); setPlaying(false); setLayering("pip"); }} />
        <AddChoice icon="cutout" title={fr.tracks.addCutout} why={fr.tracks.addCutoutWhy} onPress={() => { setAdding(false); setPlaying(false); setLayering("detoure"); }} />
        <AddChoice icon="voice" title={fr.tracks.addVoice} why={fr.tracks.addVoiceWhy} onPress={() => { setAdding(false); setPlaying(false); setVoicing(true); }} />
      </Sheet>
      <LayerAdd kind={layering} onClose={() => setLayering(null)} clips={clips} at={time} duree={tl.duree}
        onAdd={l => {
          const next = addCalque(d, l, clips);
          if (next === d) { haptic("warning"); toast({ message: fr.layers.full }); return; }
          setLayering(null); apply(next);
          const added = next.timeline.calques!.findIndex(c => !(tl.calques ?? []).some(x => x.id === c.id));
          if (mode === "simple") { setMode("complet"); saveMode("complet"); }
          if (added >= 0) setSelection({ lane: "calques", index: added, id: next.timeline.calques![added].id } as Selection);
          toast({ message: fr.layers.added, action: fr.nav.undo, onAction: () => setH(x => undo(x)) });
        }} />
      <VoiceSheet visible={voicing} onClose={() => setVoicing(false)} at={time} duree={tl.duree} brief={brief} ducking={tl.musique.ducking_voix}
        onPlace={(a, lines, ducking) => {
          const next = addVoiceOver(d, a, lines, ducking);
          setVoicing(false);
          if (next === d) return;
          apply(next); if (mode === "simple" && !laneList(next.timeline, { plans: next.planIds, textes: next.texteIds }, "simple").shown.some(l => l.key === "voix")) { setMode("complet"); saveMode("complet"); }
          toast({ message: fr.voice.placed, action: fr.nav.undo, onAction: () => setH(x => undo(x)) });
        }} />

      {selection?.lane === "calques" && (tl.calques ?? [])[selection.index] ? (
        <LayerPanel layer={(tl.calques ?? [])[selection.index]} n={selection.index + 1} time={time}
          set={patch => apply(setCalque(d, selection.id, patch, clips))}
          place={p => apply(placeAt(d, selection.id, p, clips))}
          move={m => apply(moveLayer(d, selection.id, time, m, clips))}
          key_={() => apply(addKey(d, selection.id, time, clips))}
          dropKey={k => remove(deleteCle(d, selection.id, k, clips), fr.layers.keyRemoved)}
          seek={s => { setPlaying(false); seek(s); }} />
      ) : null}

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
          <Text variant="headline">{t.planTitle(i + 1, t.seconds(times[i].end - times[i].start))}</Text>
          {isLocked(d, d.planIds[i]) ? <Text variant="caption" tone="actionStrong">{t.locked}</Text> : null}
        </View>
      ) : null}

      {tool === "plan" && p ? (
        <Card>
          <View style={styles.row}>
            <Chip label={t.moveBefore} disabled={i === 0} onPress={() => { apply(movePlan(d, i, i - 1)); setSel(i - 1); }} />
            <Chip label={t.moveAfter} disabled={i === tl.plans.length - 1} onPress={() => { apply(movePlan(d, i, i + 1)); setSel(i + 1); }} />
          </View>
          <Group label={t.source}>{rushIds.map((id, k) => <Chip key={id} label={t.sourceName(k + 1)} selected={p.source === id} onPress={() => apply(replaceSource(d, i, id, clips))} />)}</Group>
          {i > 0 ? <Group label={t.transition}>{TRANSITIONS.map(x => <Chip key={x} label={t.transitions[x]} selected={p.transition === x} onPress={() => apply(setPlan(d, i, { transition: x }))} />)}</Group> : null}
          {tl.plans.length > 1
            ? <Button variant="secondary" label={t.deletePlan} onPress={() => { remove(deletePlan(d, i), fr.toast.planRemoved); setSel(Math.max(0, i - 1)); }} />
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
            {(tl.effets ?? []).map((e, k) => <Chip key={`${e.type}${e.t}`} label={t.effet(t.effetNames[e.type], t.seconds(e.t))} onPress={() => remove(deleteEffet(d, k), fr.toast.effetRemoved)} />)}
          </Group>
          <Text variant="caption" tone="textMuted">{(tl.effets ?? []).length ? t.effetsWhy : t.effetsNone}</Text>
        </Card>
      ) : null}

      {tool === "texte" && textSel !== null ? (
        <TextPanel x={tl.textes[textSel]} n={textSel + 1} timeline={tl} locked={isLocked(d, d.texteIds[textSel])}
          set={patch => apply(setTexte(d, textSel, patch))}
          duplicate={() => { const next = duplicateTexte(d, textSel); apply(next); setSelection({ lane: "textes", index: textSel + 1, id: next.texteIds[textSel + 1] } as Selection); toast({ message: fr.tracks.duplicated }); }}
          remove={() => { setSelection(null); remove(deleteTexte(d, textSel), fr.toast.textRemoved); }}
          done={() => setSelection(null)} />
      ) : tool === "texte" ? (
        <View style={styles.field}>
          <Card>
            <Group label={t.subtitles}>
              <Chip label={t.on} selected={tl.sous_titres.actifs} onPress={() => apply(setSubtitles(d, true))} />
              <Chip label={t.off} selected={!tl.sous_titres.actifs} onPress={() => apply(setSubtitles(d, false))} />
            </Group>
          </Card>
          <Text variant="caption" tone="textMuted">{fr.textEdit.hint}</Text>
          {tl.textes.map((x, j) => (
            <Pressable key={d.texteIds[j]} accessibilityRole="button" accessibilityLabel={fr.textEdit.grip(x.texte)} accessibilityHint={fr.textEdit.choose}
              onPress={() => { haptic("tap"); seek(x.debut + 0.05); chooseText(j); }}
              style={({ pressed }) => [styles.choice, { backgroundColor: pressed ? c.surfaceRaised : c.surface }]}>
              <Icon name="text" tone="textMuted" />
              <View style={[styles.flex, styles.shrink]}>
                <Text variant="bodyStrong" numberOfLines={1}>{x.texte}</Text>
                <Text variant="caption" tone="textMuted">{[t.text(j + 1), fr.textEdit.at(clock(x.debut)), x.impose ? t.imposed : isLocked(d, d.texteIds[j]) ? t.locked : ""].filter(Boolean).join(" · ")}</Text>
              </View>
            </Pressable>
          ))}
          <Button variant="secondary" label={fr.textEdit.add} onPress={newText} />
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

// The chosen text: what it says, its font, colour, background, alignment, entrance and size. Moving,
// pinching and turning happen on the picture (TextGrip); everything here is one tap, and undoable.
function TextPanel({ x, n, timeline, locked, set, duplicate, remove, done }: {
  x: Texte; n: number; timeline: TimelineV1; locked: boolean;
  set: (p: Partial<Pick<Texte, "texte" | "accent" | "position" | "place" | "look">>) => void; duplicate: () => void; remove: () => void; done: () => void;
}) {
  const e = fr.textEdit, look = x.look ?? defaultLook(x.style), place = x.place;
  const setLook = (patch: Partial<TextLook>) => set({ look: { ...look, ...patch } });
  const scale = (f: number) => { const q = placeOf(x); set({ place: { ...q, s: Math.min(PLACE_LIMITS.s[1], Math.max(PLACE_LIMITS.s[0], Math.round(q.s * f * 100) / 100)) } }); };
  const brand = timeline.charte.couleurs;
  const colors: [string, string | null][] = [
    [e.textColor, null],
    ...(brand.principale ? [[e.brandColor, brand.principale] as [string, string]] : []),
    [e.white, SWATCHES.blanc], [e.black, SWATCHES.noir],
  ];
  const title = x.style === "accroche" || x.style === "titre";
  return (
    <Card>
      <View style={styles.between}>
        <Text variant="headline">{t.text(n)}</Text>
        {x.impose || locked ? <Text variant="caption" tone="actionStrong">{x.impose ? t.imposed : t.locked}</Text> : null}
      </View>
      <Text variant="caption" tone="textMuted">{e.gesture}</Text>
      <TextField value={x.texte} label={t.text(n)} onDone={v => set({ texte: v })} />
      {title ? (
        <View style={styles.group}>
          <Text variant="caption" tone="textMuted">{t.accent}</Text>
          <TextField value={x.accent} label={t.accent} placeholder={t.accentPlaceholder} max={30} onDone={v => set({ accent: v })} />
        </View>
      ) : null}
      <Group label={e.font}>{TEXT_ROLES.map(r => <Chip key={r} label={e.roles[r]} selected={look.role === r} onPress={() => setLook({ role: r })} />)}</Group>
      <Group label={e.color}>{colors.map(([label, v]) => <Chip key={label} label={label} selected={look.couleur === v} onPress={() => setLook({ couleur: v })} />)}</Group>
      <Group label={e.background}>{TEXT_FONDS.map(f => <Chip key={f} label={e.fonds[f]} selected={look.fond === f} onPress={() => setLook({ fond: f })} />)}</Group>
      <Group label={e.align}>{TEXT_ALIGNS.map(a => <Chip key={a} label={e.aligns[a]} selected={look.align === a} onPress={() => setLook({ align: a })} />)}</Group>
      <Group label={e.anim}>{TEXT_ANIMS.map(a => <Chip key={a} label={e.anims[a]} selected={look.anim === a} onPress={() => setLook({ anim: a })} />)}</Group>
      <Group label={e.size}>
        <Chip label={e.smaller} onPress={() => scale(1 / 1.12)} />
        <Chip label={e.bigger} onPress={() => scale(1.12)} />
        {place && place.r !== 0 ? <Chip label={e.straight} onPress={() => set({ place: { ...place, r: 0 } })} /> : null}
      </Group>
      {sizeOf(x.style, place) < MIN_SIZE ? <Text variant="caption" tone="actionStrong">{e.tooSmall}</Text> : null}
      <Group label={t.position}>{TEXT_POSITIONS.map(pos => <Chip key={pos} label={t.positions[pos]} selected={!place && x.position === pos} onPress={() => set({ position: pos, place: undefined })} />)}</Group>
      <View style={styles.row}>
        <Chip label={e.duplicate} onPress={duplicate} />
        <Chip label={t.deleteText} onPress={remove} />
        <Chip label={e.done} onPress={done} />
      </View>
    </Card>
  );
}

// Adding a video over the frame: which rush, and where (or how to cut it out).
function LayerAdd({ kind, onClose, clips, at, duree, onAdd }: { kind: null | "pip" | "detoure"; onClose: () => void; clips: Clips; at: number; duree: number; onAdd: (l: Partial<Calque> & { source: string }) => void }) {
  const ids = Object.keys(clips);
  const [source, setSource] = useState(ids[0]);
  const [preset, setPreset] = useState<Preset>("coin");
  const [cut, setCut] = useState<Calque["detourage"]>("personne");
  const l = fr.layers;
  return (
    <Sheet visible={!!kind} onClose={onClose} title={kind === "detoure" ? l.cutoutTitle : l.title}>
      <Group label={l.which}>{ids.map((id, k) => <Chip key={id} label={l.rush(k + 1)} selected={source === id} onPress={() => setSource(id)} />)}</Group>
      {kind === "detoure" ? (
        <>
          <Group label={l.cutoutHow}>{(["personne", "fond-vert"] as const).map(x => <Chip key={x} label={l.cutouts[x]} selected={cut === x} onPress={() => setCut(x)} />)}</Group>
          <Text variant="caption" tone="textMuted">{l.cutoutWhy}</Text>
        </>
      ) : (
        <Group label={l.place}>{(Object.keys(PRESETS) as Preset[]).map(p => <Chip key={p} label={l.presets[p]} selected={preset === p} onPress={() => setPreset(p)} />)}</Group>
      )}
      <Button label={l.add(clock(at))} disabled={!source} haptic
        onPress={() => source && onAdd(newLayer(source, at, clips[source], kind === "detoure" ? "detoure" : preset, duree, kind === "detoure" ? cut : "aucun"))} />
    </Sheet>
  );
}

// The selected layer's settings, under the frise.
function LayerPanel({ layer, n, time, set, place, move, key_, dropKey, seek }: {
  layer: Calque; n: number; time: number; set: (p: Partial<Calque>) => void; place: (p: Preset) => void;
  move: (m: { echelle: number }) => void; key_: () => void; dropKey: (t: number) => void; seek: (s: number) => void;
}) {
  const l = fr.layers, preset = presetOf(layer), on = isOn(layer, time);
  const corner = layer.arrondi === 0 ? "droits" : layer.arrondi >= 0.5 ? "ronds" : "arrondis";
  return (
    <Card>
      <Text variant="headline">{l.panel(n)}</Text>
      <Text variant="caption" tone="textMuted">{l.gesture}</Text>
      <Group label={l.place}>{(Object.keys(PRESETS) as Preset[]).map(p => <Chip key={p} label={l.presets[p]} selected={preset === p} onPress={() => place(p)} />)}</Group>
      <Group label={l.size}>
        <Chip label={l.smaller} onPress={() => move({ echelle: 0.87 })} />
        <Chip label={l.bigger} onPress={() => move({ echelle: 1.15 })} />
      </Group>
      <Group label={l.opacity}>{[1, 0.75, 0.5].map(v => <Chip key={v} label={l.opacityValue(v)} selected={layer.opacite === v} onPress={() => set({ opacite: v })} />)}</Group>
      <Group label={l.fusion}>{FUSIONS.map(f => <Chip key={f} label={l.fusions[f]} selected={layer.fusion === f} onPress={() => set({ fusion: f })} />)}</Group>
      <Group label={l.corners}>
        {(["droits", "arrondis", "ronds"] as const).map(k => <Chip key={k} label={l.cornerNames[k]} selected={corner === k} onPress={() => set({ arrondi: k === "droits" ? 0 : k === "ronds" ? 0.5 : 0.08 })} />)}
      </Group>
      <Group label={l.cutout}>{DETOURAGES.map(x => <Chip key={x} label={l.cutoutNames[x]} selected={layer.detourage === x} onPress={() => set({ detourage: x })} />)}</Group>
      {!layer.photo ? (
        <Group label={l.sound}>
          <Chip label={l.soundOff} selected={layer.volume === 0} onPress={() => set({ volume: 0 })} />
          <Chip label={l.soundOn} selected={layer.volume > 0} onPress={() => set({ volume: 1 })} />
        </Group>
      ) : null}
      <Group label={l.motion}>
        {layer.cles.map(k => <Chip key={k.t} label={l.keyAt(clock(layer.t + k.t))} onPress={() => seek(layer.t + k.t)} onLongPress={() => dropKey(k.t)} accessibilityActions={[{ name: "longpress", label: fr.tracks.remove }]} onAccessibilityAction={() => dropKey(k.t)} />)}
        <Chip label={`+ ${l.addKey}`} disabled={!on} onPress={key_} />
      </Group>
      {layer.cles.length ? <Text variant="caption" tone="textMuted">{l.keyHint}</Text> : null}
      {layer.cles.length > 1 ? (
        <View style={styles.row}>{COURBES.map(cb => <Chip key={cb} label={l.curves[cb]} selected={layer.cles.every(k => k.courbe === cb)} onPress={() => set({ cles: layer.cles.map(k => ({ ...k, courbe: cb })) })} />)}</View>
      ) : <Text variant="caption" tone="textMuted">{l.motionWhy}</Text>}
    </Card>
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

function AddChoice({ icon, title, why, onPress }: { icon: IconName; title: string; why: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={() => { haptic("tap"); onPress(); }} style={({ pressed }) => [styles.choice, { backgroundColor: pressed ? c.surfaceRaised : c.surface }]}>
      <Icon name={icon} tone="actionStrong" />
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="textMuted">{why}</Text>
      </View>
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
  preview: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: tokens.space.sm },
  choice: { flexDirection: "row", alignItems: "center", gap: tokens.space.sm, padding: tokens.space.sm, borderRadius: tokens.radius.card, minHeight: tokens.size.button },
  sample: { borderRadius: tokens.radius.card, paddingVertical: tokens.space.lg, paddingHorizontal: tokens.space.md, alignItems: "center" },
});
