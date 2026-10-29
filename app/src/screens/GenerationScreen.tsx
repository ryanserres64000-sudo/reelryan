import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { LIMITS, percent, Timeout, withTimeout } from "../../../core/progress";
import { fr } from "../copy/fr";
import { Button, GenerationView, Screen, Text, tokens, haptic } from "../design";
import type { MontageResult, Runner } from "../flow/types";

type Props = {
  rushes: number; kept: number[]; variants: number;
  run: Runner;
  onDone: (r: MontageResult, seconds: number) => void; onCancel: () => void;
};

// Step 4 (étude, ch. 5 §4): the steps are said in the present tense while they happen; « Arrêter » stays
// available, and a failure keeps the brief and the rushes. A percentage and the time spent show that
// it moves (Ryan, 29 octobre 2026), and the whole edit has a time limit (core/progress.ts).
export function GenerationScreen({ rushes, kept, variants, run, onDone, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [read, setRead] = useState({ read: 0, total: rushes });
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const since = useRef({ start: Date.now(), step: Date.now() });
  const done = useRef(onDone); done.current = onDone;

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
      ? <><Button label={fr.nav.retry} onPress={() => setAttempt(a => a + 1)} /><Button variant="secondary" label={fr.nav.back} onPress={onCancel} /></>
      : <Button variant="secondary" label={fr.generation.cancel} onPress={onCancel} disabled={step >= 4} />}>
      <View style={styles.body}>
        <GenerationView rushes={rushes} kept={kept} variants={variants} step={step} percent={failed ? undefined : pct} detail={detail} />
        {failed ? <Text tone="danger" accessibilityLiveRegion="assertive">{failed}</Text> : null}
        <Text variant="caption" tone="textMuted">{fr.consent.lead}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { gap: tokens.space.lg } });
