import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { applyCorrection, learn, type Memory } from "../../../core/corrections";
import { addCalque, addPassage, addTexte, addVoiceOver, changedPlans, deleteAudio, deleteCalque, deleteCle, deleteEffet, deletePlan, deleteTexte, duplicatePlan, setMusicFade, setVolume, duplicateTexte, isLocked, movePlan, planTimes, push, redo, replaceSource, setAudio, setCalque, setDuo, setLogo, setPlan, setSubtitles, setTexte, splitPlan, startHistory, toDoc, trimPlan, undo, type EditDoc, type History } from "../../../core/edit";
import { exportPlan, placeOf } from "../../../core/export";
import { FONT_FAMILIES, MIN_SIZE, PLACE_LIMITS, SPACINGS, SWATCHES, TEXT_ALIGNS, TEXT_ANIMS, TEXT_FONDS, TEXT_FONTS, TEXT_ROLES, defaultLook, sizeOf, type FontFamily, type TextFont, type TextLook } from "../../../core/textlook";
import { PRESETS, addKey, isOn, moveLayer, newLayer, placeAt, presetOf, type Preset } from "../../../core/layers";
import { clock } from "../../../core/playback";
import { ZOOM, clampZoom, lanes as laneList, type Mode } from "../../../core/tracks";
import { PassageSheet } from "../editor/PassageSheet";
import { Timeline, type Selection } from "../editor/Timeline";
import { loadMode, saveMode } from "../editor/mode";
import { Frame } from "../video/Frame";
import type { PlayerHandle } from "../video/Player";
import type { Sources } from "../video/sources";
import { COURBES, DETOURAGES, ETALONNAGES, FUSIONS, LOGO_POSITIONS, REGLAGES, TEXT_POSITIONS, TRANSITIONS, type Calque, type Reglages, type Clips, type Texte, type TimelineV1 } from "../../../core/timeline";
import { DUOS, duoById } from "../../../core/typo";
import { fr } from "../copy/fr";
import { Button, Card, Chip, Icon, MadaSays, Screen, Sheet, Text, haptic, tokens, typeStyle, useTheme, useToast, type IconName } from "../design";
import { aiRetouche } from "../flow/retouche";
import { DuoTitle } from "../video/DuoTitle";
import { face, useVisualFonts } from "../visual/fonts";
import { VoiceSheet } from "../voice/VoiceSheet";

type Props = {
  timeline: TimelineV1; clips: Clips; bad: string[]; brief: string; style: object; memory: Memory;
  onMemory: (m: Memory) => void; onSave: (t: TimelineV1) => void; onBack: () => void;
  // Every change, for the draft: nothing is lost if the app closes before « Enregistrer ».
  onChange?: (t: TimelineV1) => void;
  // The full-screen player, and the shot it was paused on when « Retoucher ce moment » brought us here.
  onPlay?: (t: TimelineV1) => void; initialShot?: number;
  sources?: () => Promise<Sources>;
  // Videos and photos picked in the gallery from the editor (Ryan, 30 octobre : « ajouter d'autres
  // vidéos et photos »): Flow adds them to the Reel's rushes and gives back their ids and lengths.
  onAddMedia?: () => Promise<Clips>;
};
type Panel = keyof typeof fr.editor.panels;
type BarItem = { icon: IconName; label: string; onPress: () => void };
const t = fr.editor;
const SPEEDS = [0.5, 1, 1.5, 2];
const LOGO_KEYS = LOGO_POSITIONS;

// Full control over the chosen version (étude, ch. 5 §6 ; Ryan, 28 octobre). Every change by hand is
// instant and free (no AI), locks what it touches, and can be undone without limit. A sentence goes
// first through plain rules on the phone; only what they cannot do goes to the AI. « Atelier clair »:
// six named tools under the frise instead of rows of tabs, one « Demander à Ma DA » field, on a dark
// ground (Flow nests a dark theme) so the footage is judged as it will be seen.
export function EditorScreen({ timeline, clips, bad, brief, style, memory, onMemory, onSave, onBack, onChange, onPlay, initialShot = 0, sources, onAddMedia }: Props) {
  const { c, layout } = useTheme();
  // The strip runs edge to edge, like in Edits: it cancels the screen's side margins.
  const { width: ww } = useWindowDimensions();
  const gutter = ww >= layout.largePhoneWidth ? layout.gutterLarge : layout.gutter;
  const [h, setH] = useState<History>(() => startHistory(toDoc(timeline)));
  const [sel, setSel] = useState(initialShot);
  const [panel, setPanel] = useState<Panel | null>(null);
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
  // The shot the tools act on: the one touched, else the one under the play head.
  const under = planTimes(tl).findIndex(x => time >= x.start && time < x.end);
  const i = Math.min(selection?.lane === "plans" ? selection.index : under >= 0 ? under : sel, tl.plans.length - 1), p = tl.plans[i];
  const [dragging, setDragging] = useState(false);
  const [voicing, setVoicing] = useState(false);
  const [layering, setLayering] = useState<null | "pip" | "detoure">(null);
  const [cropping, setCropping] = useState(false);
  const [passage, setPassage] = useState(false);
  const file = useMemo(() => exportPlan(tl)[0], [tl]);
  // Read again when the gallery adds rushes, so the new ones play.
  const rushKey = Object.keys(clips).join(",");
  const src = useMemo(() => sources?.() ?? null, [rushKey]);
  const ids = { plans: d.planIds, textes: d.texteIds };
  const { shown, hidden } = laneList(tl, ids, mode);
  const seek = (s: number) => { setTime(s); player.current?.seek(s); };
  const select = (s: Selection) => {
    setSelection(s);
    setPanel(null);
    if (s?.lane === "plans") setSel(s.index);
    if (s?.lane === "textes") setPanel("texte");
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
  const chooseText = (n: number) => { setPlaying(false); setSelection({ lane: "textes", index: n, id: d.texteIds[n] } as Selection); setPanel("texte"); };
  const newText = (kind: "texte" | "nom" = "texte") => {
    const next = addTexte(d, kind === "nom" ? fr.textEdit.nameRole : t.newText, time, kind);
    apply(next); setPlaying(false);
    const n = next.timeline.textes.length - 1;
    if (n >= 0) setSelection({ lane: "textes", index: n, id: next.texteIds[n] } as Selection);
    setPanel("texte");
  };
  // Reframing shows the shot being reframed: the play head goes into it.
  const startCrop = () => { setPlaying(false); setSelection(null); const at = planTimes(tl)[i]; if (at && (time < at.start || time >= at.end)) seek(at.start + 0.05); setCropping(true); };
  const ZERO: Reglages = { lumiere: 0, contraste: 0, saturation: 0, chaleur: 0 };
  const textSel = selection?.lane === "textes" && tl.textes[selection.index] ? selection.index : null;
  // The picture takes the room left by the strip and the bar, like in Edits.
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const fw = box ? Math.max(0, Math.min(box.w, box.h * 9 / 16)) : wh * 0.3 * 9 / 16;
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
  const b = t.bar;
  const undoToast = (message: string) => toast({ message, action: fr.nav.undo, onAction: () => setH(x => undo(x)) });
  const open = (k: Panel) => { setPlaying(false); setPanel(k); };
  const toggleMode = () => { const m = mode === "simple" ? "complet" : "simple"; setMode(m); saveMode(m); };
  const split = () => { const n = splitPlan(d, time); if (n !== d) { apply(n); setSelection(null); undoToast(fr.tracks.split_done); } };
  // Videos and photos from the gallery: after the shot in hand, or in place of the one touched.
  const addMedia = async (replace = false) => {
    if (!onAddMedia) return;
    setPlaying(false);
    let added: Clips;
    try { added = await onAddMedia(); } catch { haptic("warning"); toast({ message: t.mediaError }); return; }
    const ids = Object.keys(added);
    if (!ids.length) return;
    const all = { ...clips, ...added };
    if (replace) { apply(replaceSource(d, i, ids[0], all)); setPanel(null); undoToast(t.replaced); return; }
    let next = d;
    ids.forEach((id, k) => { next = addPassage(next, id, 0, all[id].duration, i + k, all); });
    if (next === d) return;
    apply(next); setSelection(null); setPanel(null);
    seek(planTimes(next.timeline)[i + 1]?.start ?? time);
    undoToast(t.mediaAdded(ids.length));
  };
  const planSel = selection?.lane === "plans" ? selection.index : null;
  // The bottom bar (Ryan, 30 octobre, d'après Edits): the main tools, or the actions of what is touched.
  const bar: BarItem[] = cropping ? [{ icon: "check", label: b.done, onPress: () => setCropping(false) }]
    : planSel !== null ? [
      { icon: "split", label: b.split, onPress: split },
      { icon: "speed", label: b.speed, onPress: () => open("vitesse") },
      { icon: "sound", label: b.volume, onPress: () => open("son") },
      { icon: "color", label: b.color, onPress: () => open("couleur") },
      { icon: "crop", label: b.crop, onPress: startCrop },
      { icon: "swap", label: b.replace, onPress: () => open("remplacer") },
      ...(planSel > 0 ? [{ icon: "transition", label: b.transition, onPress: () => open("transition") } as BarItem] : []),
      { icon: "copy", label: b.duplicate, onPress: () => { apply(duplicatePlan(d, planSel)); setSelection(null); toast({ message: fr.tracks.duplicated }); } },
      { icon: "order", label: b.move, onPress: () => open("ordre") },
      ...(tl.plans.length > 1 ? [{ icon: "trash", label: b.remove, onPress: removeSelected } as BarItem] : []),
    ]
    : textSel !== null ? [
      { icon: "text", label: b.edit, onPress: () => open("texte") },
      { icon: "copy", label: b.duplicate, onPress: () => { const next = duplicateTexte(d, textSel); apply(next); setSelection({ lane: "textes", index: textSel + 1, id: next.texteIds[textSel + 1] } as Selection); toast({ message: fr.tracks.duplicated }); } },
      { icon: "trash", label: b.remove, onPress: removeSelected },
    ]
    : selection?.lane === "calques" ? [{ icon: "layers", label: b.edit, onPress: () => open("calque") }, { icon: "trash", label: b.remove, onPress: removeSelected }]
    : selection?.lane === "voix" ? [{ icon: "sound", label: b.volume, onPress: () => open("audio") }, { icon: "trash", label: b.remove, onPress: removeSelected }]
    : selection?.lane === "musique" ? [{ icon: "sound", label: b.volume, onPress: () => open("musique") }]
    : selection ? [{ icon: "trash", label: b.remove, onPress: removeSelected }]
    : [
      ...(onAddMedia ? [{ icon: "addMedia", label: b.media, onPress: () => addMedia() } as BarItem] : []),
      { icon: "text", label: b.text, onPress: () => newText() },
      { icon: "text", label: b.nameRole, onPress: () => newText("nom") },
      { icon: "subtitles", label: b.subtitles, onPress: () => open("sous_titres") },
      { icon: "sound", label: b.sound, onPress: () => open("son") },
      { icon: "mic", label: b.voice, onPress: () => { setPlaying(false); setVoicing(true); } },
      { icon: "split", label: b.split, onPress: split },
      { icon: "plan", label: b.passage, onPress: () => { setPlaying(false); setPassage(true); } },
      { icon: "layers", label: b.layer, onPress: () => { setPlaying(false); setLayering("pip"); } },
      { icon: "cutout", label: b.cutout, onPress: () => { setPlaying(false); setLayering("detoure"); } },
      { icon: "color", label: b.color, onPress: () => open("couleur") },
      { icon: "brand", label: b.brand, onPress: () => open("marque") },
      { icon: "grid", label: mode === "simple" ? b.allTracks : b.fewTracks, onPress: toggleMode },
      { icon: "spark", label: b.ai, onPress: () => open("ia") },
    ];
  // A panel tied to what is touched closes with it.
  const voice = selection?.lane === "voix" ? (tl.audios ?? []).find(a => a.id === selection.id) : undefined;
  const shown_ = panel === "texte" && textSel === null ? null : panel === "calque" && selection?.lane !== "calques" ? null : panel === "audio" && !voice ? null : panel;
  const shotPanel = shown_ === "vitesse" || shown_ === "son" || shown_ === "couleur" || shown_ === "remplacer" || shown_ === "transition" || shown_ === "ordre";
  const title = shown_ ? (shotPanel ? t.panelOf(t.panels[shown_], i + 1) : t.panels[shown_]) : "";

  return (
    <Screen onBack={onBack} scroll={false}
      right={<Button label={t.saveShort} disabled={busy} onPress={() => onSave(tl)} haptic style={styles.auto} />}>
      <View style={styles.preview} onLayout={e => { const { width: w, height: hh } = e.nativeEvent.layout; setBox({ w, h: hh }); }}>
        <Frame ref={player} timeline={tl} file={file} sources={src} time={time} playing={playing} onTime={setTime} width={fw}
          onTapPicture={() => { haptic("tap"); setPlaying(x => !x); }}
          selectedLayer={selection?.lane === "calques" ? selection.id : null} onLayerMove={(id, m) => apply(moveLayer(d, id, time, m, clips))} onDragging={setDragging}
          selectedText={textSel} onTextSelect={chooseText} onTextPlace={(n, pl) => apply(setTexte(d, n, { place: pl }))} onTextWrite={(n, v) => apply(setTexte(d, n, { texte: v }))}
          crop={cropping && p ? { index: i, onCadre: cd => apply(setPlan(d, i, { cadre: cd })) } : null} />
      </View>
      <View style={styles.between}>
        <View style={styles.row}>
          <IconButton icon={playing ? "pause" : "play"} label={playing ? fr.player.pause : fr.player.play} onPress={() => setPlaying(x => !x)} />
          <Text variant="mono" tone="textMuted">{fr.player.time(clock(time), clock(tl.duree))}</Text>
        </View>
        <View style={styles.row}>
          <IconButton icon="undo" label={t.undo} disabled={!h.past.length} onPress={() => setH(undo(h))} />
          <IconButton icon="redo" label={t.redo} disabled={!h.future.length} onPress={() => setH(redo(h))} />
          {onPlay ? <IconButton icon="expand" label={fr.player.open} onPress={() => { setPlaying(false); onPlay(tl); }} /> : null}
        </View>
      </View>
      <View style={{ marginHorizontal: -gutter }}>
      <Timeline timeline={tl} lanes={shown} time={time} zoom={zoom} selection={selection} onAdd={onAddMedia ? () => addMedia() : undefined} addLabel={b.media}
        onSeek={s => { setPlaying(false); setTime(s); player.current?.seek(s); }} onZoom={setZoom} onSelect={select}
        onTrim={trim} onMove={move} onDragging={setDragging}
        onReorder={(from, to) => { apply(movePlan(d, from, to)); setSel(to); setSelection(null); undoToast(fr.tracks.moved); }} />
      </View>

      {shown_ ? (
        <View style={[styles.panel, { borderColor: c.line, maxHeight: wh * 0.42 }]}>
          <View style={styles.between}>
            <Text variant="headline">{title}</Text>
            <IconButton icon="check" label={t.close} onPress={() => setPanel(null)} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.panelBody}>
            {shown_ === "vitesse" && p ? <Group label={t.speed}>{SPEEDS.map(v => <Chip key={v} label={t.speedValue(v)} selected={p.vitesse === v} onPress={() => apply(setPlan(d, i, { vitesse: v }))} />)}</Group> : null}
            {shown_ === "transition" && p ? <Group label={t.transition}>{TRANSITIONS.map(x => <Chip key={x} label={t.transitions[x]} selected={p.transition === x} onPress={() => apply(setPlan(d, i, { transition: x }))} />)}</Group> : null}
            {shown_ === "ordre" && p ? (
              <View style={styles.row}>
                <Chip label={t.moveBefore} disabled={i === 0} onPress={() => { apply(movePlan(d, i, i - 1)); setSel(i - 1); setSelection(null); }} />
                <Chip label={t.moveAfter} disabled={i === tl.plans.length - 1} onPress={() => { apply(movePlan(d, i, i + 1)); setSel(i + 1); setSelection(null); }} />
              </View>
            ) : null}
            {shown_ === "remplacer" && p ? (
              <>
                {onAddMedia ? <Button variant="secondary" label={t.fromGallery} onPress={() => addMedia(true)} /> : null}
                <Group label={t.source}>{rushIds.map((id, k) => <Chip key={id} label={t.sourceName(k + 1)} selected={p.source === id} onPress={() => apply(replaceSource(d, i, id, clips))} />)}</Group>
              </>
            ) : null}
            {shown_ === "couleur" && p ? (
              <>
                <Group label={t.grade}>{ETALONNAGES.map(x => <Chip key={x} label={t.grades[x]} selected={p.etalonnage === x} onPress={() => apply(setPlan(d, i, { etalonnage: x }))} />)}</Group>
                <Text variant="caption" tone="textMuted">{fr.fine.title}</Text>
                {REGLAGES.map(k => {
                  const r = p.reglages ?? ZERO, v = r[k], name = fr.fine.names[k];
                  const step = (dv: number) => apply(setPlan(d, i, { reglages: { ...r, [k]: Math.max(-1, Math.min(1, v + dv)) } }));
                  return (
                    <View key={k} style={styles.between}>
                      <Text variant="body">{name}</Text>
                      <View style={styles.row}>
                        <Chip label="−" accessibilityLabel={fr.fine.less(name)} disabled={v <= -1} onPress={() => step(-0.25)} />
                        <Text variant="mono" tone={v ? "text" : "textMuted"} style={styles.value}>{fr.fine.value(v)}</Text>
                        <Chip label="+" accessibilityLabel={fr.fine.more(name)} disabled={v >= 1} onPress={() => step(0.25)} />
                      </View>
                    </View>
                  );
                })}
                <View style={styles.row}>
                  {p.reglages ? <Chip label={fr.fine.reset} onPress={() => apply(setPlan(d, i, { reglages: undefined }))} /> : null}
                  {tl.plans.length > 1 ? <Chip label={fr.fine.all} onPress={() => {
                    let next = d;
                    tl.plans.forEach((_, j) => { next = setPlan(next, j, { etalonnage: p.etalonnage, reglages: p.reglages }); });
                    apply(next); undoToast(fr.fine.applied);
                  }} /> : null}
                </View>
              </>
            ) : null}
            {shown_ === "son" && p ? (
              <>
                <Group label={t.sound}>
                  <Chip label={t.on} selected={p.garder_son} onPress={() => apply(setPlan(d, i, { garder_son: true }))} />
                  <Chip label={t.off} selected={!p.garder_son} onPress={() => apply(setPlan(d, i, { garder_son: false }))} />
                </Group>
                {p.garder_son ? <Group label={fr.volume.title}>{[0.5, 1, 1.5].map(v => <Chip key={v} label={fr.volume.value(v)} selected={(p.volume ?? 1) === v} onPress={() => apply(setPlan(d, i, { volume: v }))} />)}</Group> : null}
                <Group label={t.effets}>
                  {(tl.effets ?? []).map((e, k) => <Chip key={`${e.type}${e.t}`} label={t.effet(t.effetNames[e.type], t.seconds(e.t))} onPress={() => remove(deleteEffet(d, k), fr.toast.effetRemoved)} />)}
                </Group>
                <Text variant="caption" tone="textMuted">{(tl.effets ?? []).length ? t.effetsWhy : t.effetsNone}</Text>
              </>
            ) : null}
            {shown_ === "audio" && voice ? (
              <>
                <Group label={fr.tracks.volume}>{[0.5, 1, 1.5].map(v => <Chip key={v} label={fr.volume.value(v)} selected={voice.volume === v} onPress={() => apply(setAudio(d, voice.id, { volume: v }))} />)}</Group>
                <Group label={t.fadeIn}>{[0, 0.5, 1].map(v => <Chip key={v} label={v ? t.seconds(v) : t.noFade} selected={voice.fondu_entree === v} onPress={() => apply(setAudio(d, voice.id, { fondu_entree: v }))} />)}</Group>
                <Group label={t.fadeOut}>{[0, 0.5, 1].map(v => <Chip key={v} label={v ? t.seconds(v) : t.noFade} selected={voice.fondu_sortie === v} onPress={() => apply(setAudio(d, voice.id, { fondu_sortie: v }))} />)}</Group>
              </>
            ) : null}
            {shown_ === "musique" ? (
              <>
                <Group label={fr.tracks.volume}>{[0.3, 0.5, 0.8, 1].map(v => <Chip key={v} label={fr.volume.value(v)} selected={tl.musique.volume === v} onPress={() => apply(setVolume(d, v))} />)}</Group>
                <Group label={t.fadeOut}>{[0, 1, 2].map(v => <Chip key={v} label={v ? t.seconds(v) : t.noFade} selected={tl.musique.fondu_sortie === v} onPress={() => apply(setMusicFade(d, v))} />)}</Group>
              </>
            ) : null}
            {shown_ === "texte" && textSel !== null ? (
              <TextPanel x={tl.textes[textSel]} n={textSel + 1} timeline={tl} locked={isLocked(d, d.texteIds[textSel])}
                set={patch => apply(setTexte(d, textSel, patch))} />
            ) : null}
            {shown_ === "sous_titres" ? (
              <>
                <Group label={t.subtitles}>
                  <Chip label={t.on} selected={tl.sous_titres.actifs} onPress={() => apply(setSubtitles(d, true))} />
                  <Chip label={t.off} selected={!tl.sous_titres.actifs} onPress={() => apply(setSubtitles(d, false))} />
                </Group>
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
                <Button variant="secondary" label={fr.textEdit.add} onPress={() => newText()} />
              </>
            ) : null}
            {shown_ === "marque" ? (
              <>
                <Group label={t.logo}>{LOGO_KEYS.map(k => <Chip key={k} label={t.logoPositions[k]} selected={(tl.charte.logo?.position ?? "aucun") === k} onPress={() => apply(setLogo(d, k))} />)}</Group>
                <Group label={t.duo}>
                  {DUOS.map(x => <Chip key={x.id} label={x.nom} selected={tl.charte.duo === x.id} onPress={() => apply(setDuo(d, x.id))} />)}
                  <Chip label={t.noDuo} selected={!tl.charte.duo} onPress={() => apply(setDuo(d, null))} />
                </Group>
                {tl.charte.duo ? <View style={[styles.sample, { backgroundColor: c.media }]}><DuoTitle duo={duoById(tl.charte.duo)} texte={t.duoSample.titre} accent={t.duoSample.accent} /></View> : null}
                <Text variant="caption" tone="textMuted">{t.duoWhy}</Text>
              </>
            ) : null}
            {shown_ === "calque" && selection?.lane === "calques" && (tl.calques ?? [])[selection.index] ? (
              <LayerPanel layer={(tl.calques ?? [])[selection.index]} n={selection.index + 1} time={time}
                set={patch => apply(setCalque(d, selection.id, patch, clips))}
                place={pl => apply(placeAt(d, selection.id, pl, clips))}
                move={m => apply(moveLayer(d, selection.id, time, m, clips))}
                key_={() => apply(addKey(d, selection.id, time, clips))}
                dropKey={k => remove(deleteCle(d, selection.id, k, clips), fr.layers.keyRemoved)}
                seek={s => { setPlaying(false); seek(s); }} />
            ) : null}
            {shown_ === "ia" ? (
              <View style={styles.field}>
                <View style={styles.askRow}>
                  <TextInput value={ask} onChangeText={setAsk} onSubmitEditing={() => correct(ask)} placeholder={t.correctionPlaceholder} placeholderTextColor={c.textMuted}
                    accessibilityLabel={t.ask} maxLength={300} returnKeyType="send" editable={!busy} autoFocus
                    style={[typeStyle("body"), styles.input, styles.flex, styles.shrink, { color: c.text, borderColor: c.line, backgroundColor: c.surface }]} />
                  <Button variant="secondary" label={fr.corrections.send} disabled={!ask.trim() || busy} onPress={() => correct(ask)} style={styles.auto} />
                </View>
                {!say ? <View style={styles.row}>{fr.corrections.suggestions.map(x => <Chip key={x} kind="ai" label={x} disabled={busy} onPress={() => correct(x)} />)}</View> : null}
                {say ? <MadaSays text={say} /> : null}
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="toolbar" accessibilityLabel={t.toolsLabel} style={styles.fixed}
          contentContainerStyle={[styles.tools, { borderColor: c.line }]}>
          {selection || cropping ? <BarButton icon="back" label={b.deselect} onPress={() => { setSelection(null); setCropping(false); }} /> : null}
          {bar.map(x => <BarButton key={x.label} {...x} />)}
        </ScrollView>
      )}

      <PassageSheet visible={passage} onClose={() => setPassage(false)} timeline={tl} clips={clips} sources={src} after={i} source={p?.source}
        onAdd={(source, debut, length) => {
          const next = addPassage(d, source, debut, length, i, clips);
          setPassage(false);
          if (next === d) return;
          apply(next); setSel(i + 1); setSelection(null);
          seek(planTimes(next.timeline)[i + 1]?.start ?? time);
          undoToast(fr.passage.added);
        }} />
      <LayerAdd kind={layering} onClose={() => setLayering(null)} clips={clips} at={time} duree={tl.duree}
        onAdd={l => {
          const next = addCalque(d, l, clips);
          if (next === d) { haptic("warning"); toast({ message: fr.layers.full }); return; }
          setLayering(null); apply(next);
          const added = next.timeline.calques!.findIndex(x => !(tl.calques ?? []).some(y => y.id === x.id));
          if (mode === "simple") { setMode("complet"); saveMode("complet"); }
          if (added >= 0) setSelection({ lane: "calques", index: added, id: next.timeline.calques![added].id } as Selection);
          undoToast(fr.layers.added);
        }} />
      <VoiceSheet visible={voicing} onClose={() => setVoicing(false)} at={time} duree={tl.duree} brief={brief} ducking={tl.musique.ducking_voix}
        onPlace={(a, lines, ducking) => {
          const next = addVoiceOver(d, a, lines, ducking);
          setVoicing(false);
          if (next === d) return;
          apply(next); if (mode === "simple" && !laneList(next.timeline, { plans: next.planIds, textes: next.texteIds }, "simple").shown.some(l => l.key === "voix")) { setMode("complet"); saveMode("complet"); }
          undoToast(fr.voice.placed);
        }} />
    </Screen>
  );
}

// One tool of the bottom bar: its picture and its name, like Edits and CapCut.
function BarButton({ icon, label, onPress }: BarItem) {
  const { opacity } = useTheme();
  return (
    <Pressable onPress={() => { haptic("tap"); onPress(); }} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [styles.tool, { opacity: pressed ? opacity.pressed : 1 }]}>
      <Icon name={icon} />
      <Text variant="caption" tone="textMuted" numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// The chosen text: what it says, its font, colour, background, alignment, entrance and size. Moving,
// pinching and turning happen on the picture (TextGrip); everything here is one tap, and undoable.
type TextTab = "ecrire" | "police" | "style" | "apparition" | "place";
const TEXT_TABS: TextTab[] = ["ecrire", "police", "style", "apparition", "place"];
// The words of a text a person can put in colour: each once, without punctuation.
const wordsOf = (s: string) => [...new Set(s.split(/\s+/).map(w => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter(w => w.length > 1))].slice(0, 16);

// The chosen text's settings, in tabs like Edits' text tools (Ryan, 30 octobre).
function TextPanel({ x, n, timeline, locked, set }: {
  x: Texte; n: number; timeline: TimelineV1; locked: boolean;
  set: (p: Partial<Pick<Texte, "texte" | "accent" | "position" | "place" | "look">>) => void;
}) {
  const e = fr.textEdit, look = x.look ?? defaultLook(x.style), place = x.place;
  const [tab, setTab] = useState<TextTab>("ecrire");
  const [family, setFamily] = useState<FontFamily | "tous">("tous");
  const setLook = (patch: Partial<TextLook>) => set({ look: { ...look, ...patch } });
  const scale = (f: number) => { const q = placeOf(x); set({ place: { ...q, s: Math.min(PLACE_LIMITS.s[1], Math.max(PLACE_LIMITS.s[0], Math.round(q.s * f * 100) / 100)) } }); };
  const brand = timeline.charte.couleurs;
  const colors: [string, string | null][] = [
    [e.textColor, null],
    ...(brand.principale ? [[e.brandColor, brand.principale] as [string, string]] : []),
    [e.white, SWATCHES.blanc], [e.black, SWATCHES.noir],
  ];
  const wordColors: [string, string | undefined][] = [
    [brand.principale ? e.brandColor : e.yellow, undefined],
    ...(brand.principale ? [[e.yellow, SWATCHES.jaune] as [string, string]] : []),
    [e.orange, SWATCHES.orange], [e.white, SWATCHES.blanc],
  ];
  const fonts: readonly TextFont[] = family === "tous" ? TEXT_FONTS : FONT_FAMILIES[family];
  const title = x.style === "accroche" || x.style === "titre";
  const words = wordsOf(x.texte);
  return (
    <View style={styles.field}>
      {x.impose || locked ? <Text variant="caption" tone="actionStrong">{t.text(n)} · {x.impose ? t.imposed : t.locked}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fixed} contentContainerStyle={styles.row}>
        {TEXT_TABS.map(k => <Chip key={k} label={e.tabs[k]} selected={tab === k} onPress={() => setTab(k)} />)}
      </ScrollView>
      {tab === "ecrire" ? (
        <>
          <Text variant="caption" tone="textMuted">{e.gesture}</Text>
          <TextField value={x.texte} label={t.text(n)} onDone={v => set({ texte: v })} />
          {title ? (
            <View style={styles.group}>
              <Text variant="caption" tone="textMuted">{t.accent}</Text>
              <TextField value={x.accent} label={t.accent} placeholder={t.accentPlaceholder} max={30} onDone={v => set({ accent: v })} />
            </View>
          ) : null}
        </>
      ) : null}
      {tab === "police" ? (
        <>
          <Group label={e.font}>{TEXT_ROLES.map(r => <Chip key={r} label={e.roles[r]} selected={!look.police && look.role === r} onPress={() => setLook({ role: r, police: undefined })} />)}</Group>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fixed} contentContainerStyle={styles.row}>
            {(["tous", ...Object.keys(FONT_FAMILIES)] as (FontFamily | "tous")[]).map(f => <Chip key={f} label={e.families[f]} selected={family === f} onPress={() => setFamily(f)} />)}
          </ScrollView>
          <View style={styles.row}>{fonts.map(f => <FontChip key={f} font={f} bold={look.role === "titre"} selected={look.police === f} onPress={() => setLook({ police: look.police === f ? undefined : f })} />)}</View>
          <Group label={e.caps}>
            <Chip label={e.capsOff} selected={!look.majuscules} onPress={() => setLook({ majuscules: undefined })} />
            <Chip label={e.capsOn} selected={!!look.majuscules} onPress={() => setLook({ majuscules: true })} />
          </Group>
          <Group label={e.spacing}>{SPACINGS.map((v, k) => <Chip key={v} label={e.spacings[k]} selected={(look.espace ?? 0) === v} onPress={() => setLook({ espace: v || undefined })} />)}</Group>
        </>
      ) : null}
      {tab === "style" ? (
        <>
          <Group label={e.color}>{colors.map(([label, v]) => <Chip key={label} label={label} selected={look.couleur === v} onPress={() => setLook({ couleur: v })} />)}</Group>
          <Group label={e.word}>
            <Chip label={e.wordNone} selected={!look.mot} onPress={() => setLook({ mot: undefined, motCouleur: undefined })} />
            {words.map(w => <Chip key={w} label={w} selected={look.mot?.toLocaleLowerCase("fr-FR") === w.toLocaleLowerCase("fr-FR")} onPress={() => setLook({ mot: w })} />)}
          </Group>
          {look.mot ? <Group label={e.wordColor}>{wordColors.map(([label, v]) => <Chip key={label} label={label} selected={look.motCouleur === v} onPress={() => setLook({ motCouleur: v })} />)}</Group>
            : <Text variant="caption" tone="textMuted">{e.wordWhy}</Text>}
          <Group label={e.background}>{TEXT_FONDS.map(f => <Chip key={f} label={e.fonds[f]} selected={look.fond === f} onPress={() => setLook({ fond: f })} />)}</Group>
          <Group label={e.align}>{TEXT_ALIGNS.map(a => <Chip key={a} label={e.aligns[a]} selected={look.align === a} onPress={() => setLook({ align: a })} />)}</Group>
        </>
      ) : null}
      {tab === "apparition" ? <Group label={e.anim}>{TEXT_ANIMS.map(a => <Chip key={a} label={e.anims[a]} selected={look.anim === a} onPress={() => setLook({ anim: a })} />)}</Group> : null}
      {tab === "place" ? (
        <>
          <Group label={e.size}>
            <Chip label={e.smaller} onPress={() => scale(1 / 1.12)} />
            <Chip label={e.bigger} onPress={() => scale(1.12)} />
            {place && place.r !== 0 ? <Chip label={e.straight} onPress={() => set({ place: { ...place, r: 0 } })} /> : null}
          </Group>
          <Group label={t.position}>{TEXT_POSITIONS.map(pos => <Chip key={pos} label={t.positions[pos]} selected={!place && x.position === pos} onPress={() => set({ position: pos, place: undefined })} />)}</Group>
        </>
      ) : null}
      {sizeOf(x.style, place) < MIN_SIZE ? <Text variant="caption" tone="actionStrong">{e.tooSmall}</Text> : null}
    </View>
  );
}

// A font shown in itself, like Edits' font list.
function FontChip({ font, bold, selected, onPress }: { font: TextFont; bold: boolean; selected: boolean; onPress: () => void }) {
  const { c, opacity } = useTheme();
  const loaded = useVisualFonts();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={fr.textEdit.fontOf(font)} accessibilityState={{ selected }}
      onPress={() => { haptic("tick"); onPress(); }}
      style={({ pressed }) => [styles.font, { borderColor: selected ? c.action : c.line, borderWidth: selected ? tokens.size.selection : tokens.size.border, opacity: pressed ? opacity.pressed : 1 }]}>
      <Text variant="callout" style={loaded ? { fontFamily: face(font, bold ? 700 : 400) } : undefined}>{font}</Text>
    </Pressable>
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
  tools: { flexDirection: "row", gap: tokens.space.xxs, borderTopWidth: tokens.size.border, paddingTop: tokens.space.xs },
  tool: { alignItems: "center", justifyContent: "center", gap: tokens.space.xxs, minWidth: tokens.size.touch * 1.4, minHeight: tokens.size.button, paddingHorizontal: tokens.space.xxs },
  font: { minHeight: tokens.size.touch, paddingHorizontal: tokens.space.sm, borderRadius: tokens.radius.chip, alignItems: "center", justifyContent: "center" },
  panel: { borderTopWidth: tokens.size.border, paddingTop: tokens.space.xs, gap: tokens.space.xs },
  fixed: { flexGrow: 0 },
  panelBody: { gap: tokens.space.sm, paddingBottom: tokens.space.sm },
  iconButton: { width: tokens.size.touch, height: tokens.size.touch, borderRadius: tokens.radius.full, borderWidth: tokens.size.border, alignItems: "center", justifyContent: "center" },
  preview: { flex: 1, minHeight: tokens.size.button * 3, alignItems: "center", justifyContent: "center" },
  choice: { flexDirection: "row", alignItems: "center", gap: tokens.space.sm, padding: tokens.space.sm, borderRadius: tokens.radius.card, minHeight: tokens.size.button },
  value: { minWidth: tokens.size.touch, textAlign: "center" },
  sample: { borderRadius: tokens.radius.card, paddingVertical: tokens.space.lg, paddingHorizontal: tokens.space.md, alignItems: "center" },
});
