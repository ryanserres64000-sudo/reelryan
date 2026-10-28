import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { fr } from "../copy/fr";
import { Screen, Text, tokens, useTheme } from "../design";

// The one AI analysis of sign-up. The steps are shown at a calm pace while the call runs, and the
// screen never stays longer than the work: `run` decides when it is over.
export function AnalysisScreen({ run, onDone }: { run: (signal: AbortSignal) => Promise<void>; onDone: () => void }) {
  const { c, motion } = useTheme();
  const t = fr.dna.analysis;
  const [step, setStep] = useState(0);
  useEffect(() => {
    const ctl = new AbortController();
    const timer = setInterval(() => setStep(s => Math.min(s + 1, t.steps.length - 1)), motion.highlight / 2);
    run(ctl.signal).then(() => { if (!ctl.signal.aborted) onDone(); }).catch(() => {});
    return () => { ctl.abort(); clearInterval(timer); };
  }, []);
  return (
    <Screen title={t.title}>
      <View style={styles.list} accessibilityLiveRegion="polite">
        {t.steps.map((s, i) => (
          <View key={s} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: i < step ? c.ai : "transparent", borderColor: i <= step ? c.ai : c.line }]} />
            <Text tone={i <= step ? "ai" : "textMuted"}>{s}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: tokens.space.md },
  row: { flexDirection: "row", alignItems: "center", gap: tokens.space.sm },
  dot: { width: tokens.space.sm, height: tokens.space.sm, borderRadius: tokens.radius.full, borderWidth: tokens.size.selection },
});
