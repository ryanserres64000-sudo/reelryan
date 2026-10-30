import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Offre } from "../../../core/plans";
import { fr } from "../copy/fr";
import { Button, Paywall, tokens, useTheme } from "../design";
import { noteError } from "../diag";
import { LEGAL, open } from "../legal";
import { deviceId } from "../plans/device";
import type { Plans } from "../plans/state";
import { canBuy, products, purchase, restore } from "../plans/storekit";

type Props = {
  plans: Plans; mode: "doux" | "bloquant"; onClose: () => void; onPro: (p: Plans) => void;
  onManual?: () => void; onOffline?: () => void; manualLabel?: string;
};

// The paywall after the value (étude, ch. 8 §1 ; ch. 7) : soft and closable after the first kept
// result, blocking only a new AI creation once the free ones are used. Either way there is a free way
// on (manual montage, layout without AI), so the person is never stuck (ch. 8 §2).
export function PaywallScreen({ plans, mode, onClose, onPro, onManual, onOffline }: Props) {
  const { c, layout } = useTheme();
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // No product back from a compiled app means the subscriptions are not ready in App Store Connect:
  // said on « Continuer » and written to the diagnostic in Réglages.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const ids = plans.config.offres.map(o => o.produit);
    products(ids).then(ps => {
      setPrices(Object.fromEntries(ps.map(p => [p.id, p.displayPrice]))); setLoaded(true);
      if (canBuy() && !ps.length) noteError("abonnements", `aucun produit App Store pour ${ids.join(", ")}`);
    }).catch(e => { setLoaded(true); noteError("abonnements", e instanceof Error ? e.message : String(e)); });
  }, []);
  const used = plans.config.gratuit.montages;

  const buy = async (o: Offre) => {
    if (!canBuy()) { setStatus(fr.paywall.unavailable); return; }
    if (loaded && !prices[o.produit]) { setStatus(fr.paywall.notReady); return; }
    setBusy(true); setStatus(fr.paywall.buying);
    try {
      const r = await purchase(o.produit, deviceId() ?? "");
      if (r.status === "success") { setStatus(fr.paywall.thanks); onPro({ ...plans, pro: true }); }
      else setStatus(r.status === "pending" ? fr.paywall.pending : fr.paywall.cancelled);
    } catch (e) { noteError("achat", e instanceof Error ? e.message : String(e)); setStatus(fr.paywall.cancelled); }
    finally { setBusy(false); }
  };
  const doRestore = async () => {
    if (!canBuy()) { setStatus(fr.paywall.unavailable); return; }
    const active = await restore().catch(() => []);
    const pro = active.some(id => plans.config.offres.some(o => o.produit === id));
    setStatus(pro ? fr.paywall.restored : fr.paywall.nothingToRestore);
    if (pro) onPro({ ...plans, pro: true });
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={[styles.content, { padding: layout.gutter }]}>
        <Paywall offres={plans.config.offres} preselection={plans.config.preselection} prices={prices} launch={plans.config.lancement} title={mode === "bloquant" ? fr.paywall.titleBlocked : fr.paywall.title}
          message={mode === "bloquant" ? fr.paywall.blocked(used) : null} status={status} busy={busy}
          onBuy={buy} onRestore={doRestore} onTerms={() => open(LEGAL.terms)} onPrivacy={() => open(LEGAL.privacy)} onClose={onClose}
          extra={<View style={styles.extra}>
            {mode === "doux" ? <Button variant="secondary" label={fr.paywall.later} onPress={onClose} /> : null}
            {onManual ? <Button variant="secondary" label={fr.paywall.manual} onPress={onManual} /> : null}
            {onOffline ? <Button variant="secondary" label={fr.paywall.offline} onPress={onOffline} /> : null}
          </View>} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center" },
  extra: { gap: tokens.space.xs },
});
