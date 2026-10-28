import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { fr } from "../copy/fr";
import { Button, GenerationView, Screen, Text, tokens } from "../design";
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
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const done = useRef(onDone); done.current = onDone;

  useEffect(() => {
    const ctrl = new AbortController(), started = Date.now();
    setStep(0); setFailed(false);
    run(setStep, ctrl.signal).then(
      r => { const s = (Date.now() - started) / 1000; setTimeout(() => !ctrl.signal.aborted && done.current(r, s), tokens.motion.slow * 3); },
      () => { if (!ctrl.signal.aborted) setFailed(true); },
    );
    return () => ctrl.abort();
  }, [attempt]);

  return (
    <Screen title={fr.generationScreen.title} footer={failed
      ? <><Button label={fr.nav.retry} onPress={() => setAttempt(a => a + 1)} /><Button variant="secondary" label={fr.nav.back} onPress={onCancel} /></>
      : <Button variant="secondary" label={fr.generation.cancel} onPress={onCancel} disabled={step >= 4} />}>
      <View style={styles.body}>
        <GenerationView rushes={rushes} kept={kept} variants={variants} step={step} />
        {failed ? <Text tone="danger" accessibilityLiveRegion="assertive">{fr.generationScreen.error}</Text> : null}
        <Text variant="caption" tone="textMuted">{fr.consent.lead}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { gap: tokens.space.lg } });
