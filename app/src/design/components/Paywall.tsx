import { BlurView } from "expo-blur";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { DEFAULT_CONFIG, perMonth, type Offre, type Periode } from "../../../../core/plans";
import { fr } from "../../copy/fr";
import { tokens } from "../tokens";
import { Button } from "./Button";
import { Text } from "../Text";
import { useTheme } from "../theme";

type Props = {
  background?: ReactNode; title?: string; offres?: Offre[]; preselection?: Periode; prices?: Record<string, string>; launch?: boolean;
  message?: string | null; status?: string | null; busy?: boolean; extra?: ReactNode;
  onClose?: () => void; onBuy?: (o: Offre) => void; onRestore?: () => void; onTerms?: () => void; onPrivacy?: () => void;
};
const euro = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

// The person's own work blurred behind, title, 3 benefits, the offers with the yearly one preselected,
// one blue button, Restore, terms, privacy, a visible close cross (étude, ch. 6 §4 ; ch. 8 §2). The offers
// come from the server config, the prices from StoreKit when the app is compiled (lot 8). Apple's
// renewal terms are written under the button (App Store, règle 3.1.2).
export function Paywall({ background, title = fr.paywall.title, offres = DEFAULT_CONFIG.offres, preselection = DEFAULT_CONFIG.preselection, prices = {}, launch = true, message, status, busy, extra, onClose, onBuy, onRestore, onTerms, onPrivacy }: Props) {
  const { c, scheme } = useTheme();
  const [plan, setPlan] = useState<Periode>(preselection);
  const picked = offres.find(o => o.id === plan) ?? offres[0];
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      {background ? <View style={StyleSheet.absoluteFill}>{background}</View> : null}
      <BlurView intensity={60} tint={scheme} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} />
      <View style={styles.body}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={fr.paywall.close} style={[styles.close, { backgroundColor: c.surface }]}>
          <Text variant="headline">×</Text>
        </Pressable>
        <Text variant="title" accessibilityRole="header">{title}</Text>
        {message ? <Text tone="textMuted">{message}</Text> : null}
        <View style={styles.benefits}>
          {fr.paywall.benefits.map(b => (
            <View key={b} style={styles.benefit}>
              <Text variant="bodyStrong" tone="actionStrong">✓</Text>
              <Text variant="body" style={styles.flex}>{b}</Text>
            </View>
          ))}
        </View>
        {launch ? <Text variant="caption" tone="actionStrong">{fr.paywall.launch}</Text> : null}
        <View accessibilityRole="radiogroup" style={styles.plans}>
          {offres.map(o => {
            const on = plan === o.id, p = fr.paywall.periods[o.periode], price = prices[o.produit] ?? o.prix, month = o.periode === "semaine" ? perMonth(price, o.periode) : null;
            return (
              <Pressable key={o.id} onPress={() => setPlan(o.id)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                style={[styles.plan, { backgroundColor: c.surface, borderColor: on ? c.actionStrong : c.line, borderWidth: on ? tokens.size.selection : tokens.size.border }]}>
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{p.label}</Text>
                  {o.badge ? <Text variant="caption" tone="actionStrong">{o.badge}</Text> : null}
                  {month ? <Text variant="caption" tone="textMuted">{fr.paywall.perMonth(euro(month))}</Text> : null}
                </View>
                <Text variant="headline">{price}</Text>
                <Text variant="caption" tone="textMuted">{` ${p.per}`}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text variant="caption" tone="textMuted">{fr.paywall.priceLock}</Text>
        {status ? <Text variant="callout" tone="ai" accessibilityLiveRegion="polite">{status}</Text> : null}
        <Button label={fr.paywall.cta} haptic disabled={busy || !picked} onPress={() => picked && onBuy?.(picked)} />
        {picked ? <Text variant="caption">{fr.paywall.summary(fr.paywall.periods[picked.periode].label, prices[picked.produit] ?? picked.prix, fr.paywall.periods[picked.periode].per)}</Text> : null}
        {extra}
        <Text variant="caption" tone="textMuted">{fr.paywall.autoRenew}</Text>
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
  // The cross sits in its own row, above the title, so a long title never runs under it.
  close: { alignSelf: "flex-start", width: tokens.size.touch, height: tokens.size.touch, borderRadius: tokens.radius.full, alignItems: "center", justifyContent: "center", marginBottom: tokens.space.xs },
  body: { flex: 1, justifyContent: "flex-end", padding: tokens.layout.gutter, gap: tokens.space.sm },
  benefits: { gap: tokens.space.xs, marginBottom: tokens.space.xs },
  benefit: { flexDirection: "row", gap: tokens.space.xs },
  plans: { gap: tokens.space.xs },
  flex: { flex: 1 },
  plan: { flexDirection: "row", alignItems: "center", minHeight: tokens.size.button + tokens.space.md, borderRadius: tokens.radius.card, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.xs },
  links: { flexDirection: "row", justifyContent: "center", gap: tokens.space.xs, flexWrap: "wrap" },
  linkHit: { minHeight: tokens.size.touch, justifyContent: "center", paddingHorizontal: tokens.space.xs },
});
