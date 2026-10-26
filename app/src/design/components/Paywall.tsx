import { BlurView } from "expo-blur";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { fr } from "../../copy/fr";
import { tokens } from "../tokens";
import { Button } from "./Button";
import { Text } from "../Text";
import { useTheme } from "../theme";

type Plan = "yearly" | "monthly";
type Props = { background?: ReactNode; onClose?: () => void; onBuy?: (p: Plan) => void; onRestore?: () => void; onTerms?: () => void; onPrivacy?: () => void };

// The person's own video blurred behind, title, 3 benefits, 2 prices with the yearly one preselected,
// gold button, Restore, terms, privacy, a visible close cross (étude, ch. 6 §4 ; ch. 8 §2). Purchase comes with lot 6.
export function Paywall({ background, onClose, onBuy, onRestore, onTerms, onPrivacy }: Props) {
  const { c, scheme } = useTheme();
  const [plan, setPlan] = useState<Plan>("yearly");
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      {background ? <View style={StyleSheet.absoluteFill}>{background}</View> : null}
      <BlurView intensity={60} tint={scheme} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} />
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={fr.paywall.close} style={styles.close}>
        <Text variant="headline">×</Text>
      </Pressable>
      <View style={styles.body}>
        <Text variant="title" accessibilityRole="header">{fr.paywall.title}</Text>
        <View style={styles.benefits}>
          {fr.paywall.benefits.map(b => (
            <View key={b} style={styles.benefit}>
              <Text variant="bodyStrong" tone="actionStrong">✓</Text>
              <Text variant="body" style={styles.flex}>{b}</Text>
            </View>
          ))}
        </View>
        {(["yearly", "monthly"] as const).map(p => {
          const o = fr.paywall[p], on = plan === p;
          return (
            <Pressable key={p} onPress={() => setPlan(p)} accessibilityRole="radio" accessibilityState={{ checked: on }}
              style={[styles.plan, { backgroundColor: c.surface, borderColor: on ? c.actionStrong : c.line, borderWidth: on ? tokens.size.selection : tokens.size.border }]}>
              <View style={styles.flex}>
                <Text variant="bodyStrong">{o.label}</Text>
                {o.saving ? <Text variant="caption" tone="actionStrong">{o.saving}</Text> : null}
              </View>
              <Text variant="headline">{o.price}</Text>
              <Text variant="caption" tone="textMuted"> {o.per}</Text>
            </Pressable>
          );
        })}
        <Text variant="caption" tone="textMuted">{fr.paywall.priceLock}</Text>
        <Button label={fr.paywall.cta} haptic onPress={() => onBuy?.(plan)} />
        <View style={styles.links}>
          {[[fr.paywall.restore, onRestore], [fr.paywall.terms, onTerms], [fr.paywall.privacy, onPrivacy]].map(([label, fn]) => (
            <Pressable key={label as string} onPress={fn as () => void} accessibilityRole="link" style={styles.linkHit}>
              <Text variant="caption" tone="textMuted">{label as string}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: tokens.radius.sheet, overflow: "hidden", minHeight: tokens.size.button * 12 },
  close: { position: "absolute", top: tokens.space.xs, right: tokens.space.xs, width: tokens.size.touch, height: tokens.size.touch, alignItems: "center", justifyContent: "center", zIndex: 1 },
  body: { flex: 1, justifyContent: "flex-end", padding: tokens.layout.gutter, gap: tokens.space.sm },
  benefits: { gap: tokens.space.xs, marginBottom: tokens.space.xs },
  benefit: { flexDirection: "row", gap: tokens.space.xs },
  flex: { flex: 1 },
  plan: { flexDirection: "row", alignItems: "center", minHeight: tokens.size.button + tokens.space.md, borderRadius: tokens.radius.card, paddingHorizontal: tokens.space.md },
  links: { flexDirection: "row", justifyContent: "center", gap: tokens.space.xs },
  linkHit: { minHeight: tokens.size.touch, justifyContent: "center", paddingHorizontal: tokens.space.xs },
});
