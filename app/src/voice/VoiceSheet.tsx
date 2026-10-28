import { useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import type { AudioClip, Texte } from "../../../core/timeline";
import { clock } from "../../../core/playback";
import { MAX_TEXTE, VITESSES, VOIX, charsFor, estimate, subtitles, type VoixId } from "../../../core/voice";
import { fr } from "../copy/fr";
import { Button, Chip, MadaSays, Sheet, Text, haptic, tokens, typeStyle, useTheme } from "../design";
import { VoiceError, speak, writeScript, type Spoken } from "./api";
import { keepRecording } from "./files";

type Mode = keyof typeof fr.voice.modes;
type Props = {
  visible: boolean; onClose: () => void;
  // Where it goes (the play head) and how long the video is, to size the text.
  at: number; duree: number; brief: string; ducking: boolean;
  onPlace: (a: AudioClip, lines: Texte[], ducking: boolean) => void;
};
const t = fr.voice;
const newId = () => `v${Date.now().toString(36)}`;

// The voice-over (étape 5, demande de Ryan du 28 octobre): type a text or let Ma DA write it from a
// sentence, pick one of four French voices and a pace, listen, then lay it at the play head on its
// own track with subtitles timed on its words. Or record one's own voice, which never leaves the phone.
export function VoiceSheet({ visible, onClose, at, duree, brief, ducking: duckingNow, onPlace }: Props) {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>("ecrire");
  const [texte, setTexte] = useState("");
  const [consigne, setConsigne] = useState("");
  const [voix, setVoix] = useState<VoixId>("camille");
  const [vitesse, setVitesse] = useState<number>(1);
  const [subs, setSubs] = useState(true);
  const [ducking, setDucking] = useState(duckingNow);
  const [busy, setBusy] = useState<string | null>(null);
  const [say, setSay] = useState<string | null>(null);
  const [spoken, setSpoken] = useState<(Spoken & { id: string; texte: string; voix: VoixId; vitesse: number }) | null>(null);
  const [mine, setMine] = useState<{ id: string; uri: string; source: string; duree: number } | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const room = Math.max(1, duree - at);

  // Listening before laying it down.
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const listen = (uri: string) => {
    if (status.playing) { player.pause(); return; }
    player.replace({ uri }); player.seekTo(0); player.play();
  };

  // Recording one's own voice (expo-audio; the microphone permission is asked only here).
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder, 250);
  const startRecording = async () => {
    const p = await requestRecordingPermissionsAsync().catch(() => ({ granted: false }));
    if (!p.granted) { setSay(t.micDenied); return; }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record(); haptic("tap"); setSay(null); setMine(null);
  };
  const stopRecording = async () => {
    const seconds = rec.durationMillis / 1000;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (!recorder.uri) { setSay(t.error); return; }
    const id = newId(), source = `${id}.m4a`;
    try { setMine({ id, source, uri: keepRecording(source, recorder.uri), duree: Math.round(seconds * 100) / 100 }); haptic("success"); }
    catch { setSay(t.error); }
  };

  useEffect(() => { if (!visible) { ctl.current?.abort(); player.pause(); if (rec.isRecording) recorder.stop().catch(() => {}); } else setDucking(duckingNow); }, [visible]);

  const fail = (e: unknown) => setSay(e instanceof VoiceError ? (e.kind === "offline" ? t.offline : e.kind === "quota" ? t.quota : t.error) : t.error);
  const write = async () => {
    setBusy(t.writing); setSay(null); ctl.current = new AbortController();
    try {
      const out = await writeScript({ consigne: consigne.trim(), duree: room, brief }, ctl.current.signal);
      setTexte(out.slice(0, MAX_TEXTE)); setMode("ecrire"); setSay(t.written); haptic("success");
    } catch (e) { fail(e); } finally { setBusy(null); }
  };
  const make = async () => {
    const id = newId(); setBusy(t.making); setSay(null); ctl.current = new AbortController();
    try {
      const s = await speak(texte.trim(), voix, vitesse, `${id}.mp3`, ctl.current.signal);
      setSpoken({ ...s, id, texte: texte.trim(), voix, vitesse }); haptic("success");
    } catch (e) { fail(e); } finally { setBusy(null); }
  };

  const fresh = spoken && spoken.texte === texte.trim() && spoken.voix === voix && spoken.vitesse === vitesse;
  const place = () => {
    if (mode === "enregistrer" && mine) {
      onPlace({ id: mine.id, type: "enregistrement", source: mine.source, nom: t.myVoice, t: at, debut: 0, fin: mine.duree, volume: 1, fondu_entree: 0, fondu_sortie: 0, texte: "", voix: null, ia: false }, [], ducking);
    } else if (spoken) {
      const v = VOIX.find(x => x.id === spoken.voix)!;
      onPlace({ id: spoken.id, type: "voix-off", source: spoken.source, nom: v.nom, t: at, debut: 0, fin: spoken.duree, volume: 1, fondu_entree: 0, fondu_sortie: 0, texte: spoken.texte, voix: spoken.voix, ia: true },
        subs ? subtitles(spoken.mots, at, spoken.id) : [], ducking);
    } else return;
    haptic("success"); setSpoken(null); setMine(null); setTexte(""); setSay(null);
  };

  const seconds = estimate(texte, vitesse);
  const input = [typeStyle("body"), styles.input, { color: c.text, borderColor: c.line, backgroundColor: c.surface }];
  return (
    <Sheet visible={visible} onClose={onClose} title={t.title}>
      <ScrollView style={{ maxHeight: height * 0.7 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t.modesLabel}>
          {(Object.keys(t.modes) as Mode[]).map(m => <Chip key={m} label={t.modes[m]} kind={m === "demander" ? "ai" : undefined} selected={mode === m} onPress={() => { setMode(m); setSay(null); }} />)}
        </View>

        {mode === "demander" ? (
          <Field label={t.ask}>
            <TextInput value={consigne} onChangeText={setConsigne} placeholder={t.askPlaceholder} placeholderTextColor={c.textMuted} accessibilityLabel={t.ask} maxLength={300} style={input} />
            <Button label={busy === t.writing ? t.writing : t.write} disabled={!consigne.trim() || !!busy} onPress={write} />
          </Field>
        ) : null}

        {mode === "ecrire" ? (
          <>
            <Field label={t.text}>
              <TextInput value={texte} onChangeText={setTexte} placeholder={t.textPlaceholder} placeholderTextColor={c.textMuted} accessibilityLabel={t.text}
                multiline maxLength={Math.min(MAX_TEXTE, charsFor(room, vitesse) * 2)} style={[input, styles.multiline]} />
              {texte.trim() ? <Text variant="caption" tone={seconds > room ? "danger" : "textMuted"}>{seconds > room ? t.tooLong : t.length(Math.max(1, Math.round(seconds)), Math.round(room))}</Text> : null}
            </Field>
            <Group label={t.voices}>{VOIX.map(v => <Chip key={v.id} label={t.voiceName(v.nom, v.ton)} selected={voix === v.id} onPress={() => setVoix(v.id)} />)}</Group>
            <Group label={t.speed}>{VITESSES.map(v => <Chip key={v} label={t.speeds[String(v)]} selected={vitesse === v} onPress={() => setVitesse(v)} />)}</Group>
            <Group label={t.subtitles}>
              <Chip label={t.on} selected={subs} onPress={() => setSubs(true)} />
              <Chip label={t.off} selected={!subs} onPress={() => setSubs(false)} />
            </Group>
          </>
        ) : null}

        {mode === "enregistrer" ? (
          <Field label={t.recordWhy}>
            {rec.isRecording
              ? <Button label={t.stopRecord} onPress={stopRecording} />
              : <Button variant={mine ? "secondary" : "primary"} label={mine ? t.recordAgain : t.record} onPress={startRecording} />}
            {rec.isRecording ? <Text variant="mono" tone="danger" accessibilityLiveRegion="polite">{t.recording(clock(rec.durationMillis / 1000))}</Text> : null}
            {mine ? (
              <View style={styles.between}>
                <Text variant="body">{t.recorded(clock(mine.duree))}</Text>
                <Chip label={status.playing ? t.stop : t.listen} onPress={() => listen(mine.uri)} />
              </View>
            ) : null}
          </Field>
        ) : null}

        {mode !== "demander" ? (
          <Group label={t.ducking}>
            <Chip label={t.on} selected={ducking} onPress={() => setDucking(true)} />
            <Chip label={t.off} selected={!ducking} onPress={() => setDucking(false)} />
          </Group>
        ) : null}

        {say ? <MadaSays text={say} /> : null}

        {mode === "ecrire" ? (
          <>
            <Button variant={fresh ? "secondary" : "primary"} label={busy === t.making ? t.making : spoken ? t.remake : t.make} disabled={!texte.trim() || !!busy || !!fresh} onPress={make} />
            {spoken ? (
              <View style={styles.between}>
                <Text variant="caption" tone="textMuted">{clock(spoken.duree)}</Text>
                <Chip label={status.playing ? t.stop : t.listen} onPress={() => listen(spoken.uri)} />
              </View>
            ) : null}
            {spoken ? <Text variant="caption" tone="textMuted">{t.aiMark}</Text> : null}
          </>
        ) : null}

        {(mode === "ecrire" && fresh) || (mode === "enregistrer" && mine && !rec.isRecording)
          ? <Button label={t.place(clock(at))} onPress={place} haptic />
          : null}
      </ScrollView>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <View style={styles.group}><Text variant="caption" tone="textMuted">{label}</Text>{children}</View>;
}
function Group({ label, children }: { label: string; children: ReactNode }) {
  return <View style={styles.group}><Text variant="caption" tone="textMuted">{label}</Text><View style={styles.row}>{children}</View></View>;
}

const styles = StyleSheet.create({
  body: { gap: tokens.space.md, paddingBottom: tokens.space.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs, alignItems: "center" },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: tokens.space.xs },
  group: { gap: tokens.space.xs },
  input: { minHeight: tokens.size.button, borderWidth: tokens.size.border, borderRadius: tokens.radius.button, paddingHorizontal: tokens.space.sm, paddingVertical: tokens.space.xs },
  multiline: { minHeight: tokens.size.button * 2.2, textAlignVertical: "top" },
});
