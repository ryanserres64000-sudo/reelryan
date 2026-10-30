import { useKeepAwake } from "expo-keep-awake";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, type ImageSourcePropType } from "react-native";
import { LIMITS, percent, Timeout, withTimeout } from "../../../core/progress";
import { fr } from "../copy/fr";
import { noteError } from "../diag";
import { Button, GenerationView, LogoWorking, Screen, Text, tokens, haptic } from "../design";
import type { MontageResult, Runner } from "../flow/types";

type Props = {
  rushes: number; kept: number[]; variants: number;
  // The chosen rushes' card pictures, in order (Ryan, 29 octobre : « Affiche les photos aussi »).
  thumbnails?: (ImageSourcePropType | undefined)[];
  run: Runner;
  onDone: (r: MontageResult, seconds: number) => void; onCancel: () => void;
  // When the AI edit fails: the rushes in order, then everything by hand (no AI, nothing lost).
  onManual?: () => void;
};

// Step 4 (étude, ch. 5 §4): the steps are said in the present tense while they happen; « Arrêter » stays
// available, and a failure keeps the brief and the rushes. A percentage and the time spent show that
// it moves (Ryan, 29 octobre 2026), and the whole edit has a time limit (core/progress.ts).
export function GenerationScreen({ rushes, kept, variants, thumbnails, run, onDone, onCancel, onManual }: Props) {
  const [step, setStep] = useState(0);
  const [read, setRead] = useState({ read: 0, total: rushes });
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const since = useRef({ start: Date.now(), step: Date.now() });
  const done = useRef(onDone); done.current = onDone;
  // iOS pauses the app when the screen locks or another app opens: the edit then waits where it was
  // (build 11, Ryan, 29 octobre : 2 % after 40 minutes). The screen stays on while it works.
  useKeepAwake();

  useEffect(() => {
    const ctrl = new AbortController(), started = Date.now();
    since.current = { start: started, step: started };
    setStep(0); setRead({ read: 0, total: rushes }); setFailed(null);
    const onStep = (s: number) => { since.current.step = Date.now(); setStep(s); };
    const tick = setInterval(() => setNow(Date.now()), 500);
    withTimeout(run(onStep, ctrl.signal, (r, total) => setRead({ read: r, total })), LIMITS.totalMs).then(
      r => { const s = (Date.now() - started) / 1000; haptic("success"); setTimeout(() => !ctrl.signal.aborted && done.current(r, s), tokens.motion.slow * 3); },
      (e: { code?: string; message?: string }) => {
        if (ctrl.signal.aborted) return;
        if (e instanceof Timeout) ctrl.abort();
        // The real cause, kept for Réglages: « network » alone hid an HTTP status (build 12).
        noteError("montage", `${e?.code ?? "?"} : ${e?.message ?? String(e)}`);
        haptic("warning");
        // What went wrong, in words: the server's own message when it sent one.
        const known = fr.generationScreen.errors[(e?.code ?? "") as keyof typeof fr.generationScreen.errors];
        setFailed(known ?? (e?.message && e.code && e.code !== "network" ? e.message : fr.generationScreen.error));
      },
    ).finally(() => clearInterval(tick));
    return () => { clearInterval(tick); ctrl.abort(); };
  }, [attempt]);

  const pct = percent(step, { ...read, elapsed: (now - since.current.step) / 1000 });
  const spent = fr.generation.elapsed((now - since.current.start) / 1000);
  const detail = step === 0 ? (read.read < read.total ? `${fr.generation.reading(read.read, read.total)} · ${spent}` : fr.generation.sending) : spent;

  return (
    <Screen title={fr.generationScreen.title} footer={failed
      ? <><Button label={fr.nav.retry} onPress={() => setAttempt(a => a + 1)} />{onManual ? <Button variant="secondary" label={fr.generationScreen.manual} onPress={onManual} /> : null}<Button variant="secondary" label={fr.nav.back} onPress={onCancel} /></>
      : <Button variant="secondary" label={fr.generation.cancel} onPress={onCancel} disabled={step >= 4} />}>
      <View style={styles.body}>
        {failed ? null : <LogoWorking step={step} />}
        <GenerationView rushes={rushes} kept={kept} variants={variants} thumbnails={thumbnails} step={step} percent={failed ? undefined : pct} detail={detail} />
        {failed ? <Text tone="danger" accessibilityLiveRegion="assertive">{failed}</Text> : null}
        {failed ? null : <Text variant="bodyStrong">{fr.generation.keepOpen}</Text>}
        <Text variant="caption" tone="textMuted">{fr.consent.lead}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { gap: tokens.space.lg } });
