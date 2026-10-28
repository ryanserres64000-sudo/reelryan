import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { fr } from "../copy/fr";
import { Button, GenerationView, Screen, Text, tokens, haptic } from "../design";
import type { MontageResult, Runner } from "../flow/types";

type Props = {
  rushes: number; kept: number[]; variants: number;
  run: Runner;
  onDone: (r: MontageResult, seconds: number) => void; onCancel: () => void;
};

// Step 4 (étude, ch. 5 §4): the steps are said in the present tense while they happen; « Arrêter » stays
// available, and a failure keeps the brief and the rushes.
export function GenerationScreen({ rushes, kept, variants, run, onDone, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const done = useRef(onDone); done.current = onDone;

  useEffect(() => {
    const ctrl = new AbortController(), started = Date.now();
    setStep(0); setFailed(null);
    run(setStep, ctrl.signal).then(
      r => { const s = (Date.now() - started) / 1000; haptic("success"); setTimeout(() => !ctrl.signal.aborted && done.current(r, s), tokens.motion.slow * 3); },
      (e: { code?: string; message?: string }) => {
        if (ctrl.signal.aborted) return;
        haptic("warning");
        // What went wrong, in words: the server's own message when it sent one.
        const known = fr.generationScreen.errors[(e?.code ?? "") as keyof typeof fr.generationScreen.errors];
        setFailed(known ?? (e?.message && e.code && e.code !== "network" ? e.message : fr.generationScreen.error));
      },
    );
    return () => ctrl.abort();
  }, [attempt]);

  return (
    <Screen title={fr.generationScreen.title} footer={failed
      ? <><Button label={fr.nav.retry} onPress={() => setAttempt(a => a + 1)} /><Button variant="secondary" label={fr.nav.back} onPress={onCancel} /></>
      : <Button variant="secondary" label={fr.generation.cancel} onPress={onCancel} disabled={step >= 4} />}>
      <View style={styles.body}>
        <GenerationView rushes={rushes} kept={kept} variants={variants} step={step} />
        {failed ? <Text tone="danger" accessibilityLiveRegion="assertive">{failed}</Text> : null}
        <Text variant="caption" tone="textMuted">{fr.consent.lead}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { gap: tokens.space.lg } });
