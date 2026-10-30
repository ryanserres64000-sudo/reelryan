import { diagnostic, lastErrors } from "../diag";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { fr } from "../copy/fr";
import { Button, Card, Chip, MadaSays, Screen, Text, tokens } from "../design";
import { canNotify, loadNotify, saveNotify, type NotifySettings } from "../publish/notify";
import { deleteAccount } from "../account";
import { aiAllowed, consent, setConsent } from "../consent";
import { LEGAL, SUBSCRIPTIONS, open } from "../legal";
import { verdict, type Plans } from "../plans/state";
import { canBuy, restore } from "../plans/storekit";

type Props = { plans: Plans | null; onPlans: (p: Plans) => void; onDeleted: () => void; onBack: () => void; onOffers: () => void };
const t = fr.settings;
const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

// Réglages (lot 9 ; étude, ch. 9) : the AI permission, changeable at any time; the subscription,
// managed by Apple; the legal pages; and deleting the account from inside the app (règle 5.1.1(v)).
export function SettingsScreen({ plans, onPlans, onDeleted, onBack, onOffers }: Props) {
  const [ai, setAi] = useState(consent());
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [say, setSay] = useState<string | null>(null);
  const [notify, setNotify] = useState<NotifySettings | null>(null);
  useEffect(() => { loadNotify().then(setNotify); }, []);
  const toggle = async (k: keyof NotifySettings, on: boolean) => {
    if (!notify) return;
    const next = await saveNotify({ ...notify, [k]: on });
    setNotify(next);
    if (on && !next[k]) setSay(fr.notifications.denied);
  };

  const doRestore = async () => {
    if (!plans) return;
    if (!canBuy()) { setSay(fr.paywall.unavailable); return; }
    const active = await restore().catch(() => []);
    const pro = active.some(id => plans.config.offres.some(o => o.produit === id));
    setSay(pro ? fr.paywall.restored : fr.paywall.nothingToRestore);
    if (pro) onPlans({ ...plans, pro: true });
  };
  const doDelete = async () => {
    if (!plans) return;
    setBusy(true); setSay(t.deleting);
    const r = await deleteAccount(plans);
    onPlans(r.plans); setBusy(false); setConfirm(false); setAi(null);
    setSay(r.server ? t.deleted : t.deleteServerError);
    onDeleted();
  };
  const link = (label: string, url: string) => <Button key={label} variant="secondary" label={label} onPress={() => open(url).then(ok => { if (!ok) setSay(t.linkFailed); })} />;

  return (
    <Screen title={t.title} detail={t.detail} onBack={onBack} footer={say ? <MadaSays text={say} /> : undefined}>
      <Card>
        <View style={styles.block}>
          <Text variant="headline">{t.ai}</Text>
          <Text>{ai ? (ai.ok ? t.aiOn(day(ai.at)) : t.aiOff) : t.aiAsk}</Text>
          <Text variant="caption" tone="textMuted">{fr.consent.lead}</Text>
          <Button variant="secondary" label={aiAllowed() ? t.aiWithdraw : t.aiGive} onPress={() => setConsent(!aiAllowed()).then(setAi)} />
          <Text variant="caption" tone="textMuted">{t.aiMark}</Text>
        </View>
      </Card>

      <Card>
        <View style={styles.block}>
          <Text variant="headline">{t.plan}</Text>
          {plans ? <Text>{plans.pro ? t.planPro : t.planFree(verdict(plans, "montage").restant)}</Text> : null}
          {plans && !plans.pro ? <Button label={t.offers} onPress={onOffers} /> : null}
          <Button variant="secondary" label={t.manage} onPress={() => open(SUBSCRIPTIONS).then(ok => { if (!ok) setSay(t.linkFailed); })} />
          <Button variant="secondary" label={t.restore} onPress={doRestore} />
        </View>
      </Card>

      {canNotify() && notify ? (
        <Card>
          <View style={styles.block}>
            <Text variant="headline">{fr.notifications.title}</Text>
            <Text variant="caption" tone="textMuted">{fr.notifications.detail}</Text>
            {(["weekly", "exportDone"] as const).map(k => (
              <View key={k} style={styles.block}>
                <Text variant="bodyStrong">{fr.notifications[k]}</Text>
                <Text variant="caption" tone="textMuted">{fr.notifications[k === "weekly" ? "weeklyWhy" : "exportDoneWhy"]}</Text>
                <View style={styles.row}>
                  <Chip label={fr.notifications.on} selected={notify[k]} onPress={() => toggle(k, true)} />
                  <Chip label={fr.notifications.off} selected={!notify[k]} onPress={() => toggle(k, false)} />
                </View>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={styles.block}>
          <Text variant="headline">{t.docs}</Text>
          {[link(t.terms, LEGAL.terms), link(t.privacy, LEGAL.privacy), link(t.notices, LEGAL.notices), link(t.help, LEGAL.support), link(t.rights, LEGAL.rights)]}
        </View>
      </Card>

      <Card>
        <View style={styles.block}>
          <Text variant="headline">{fr.diag.title}</Text>
          <Text variant="caption" tone="textMuted">{fr.diag.detail}</Text>
          {diagnostic().map(d => <Text key={d.key} tone={d.ok ? "text" : "danger"}>{fr.diag.line(fr.diag.labels[d.key], d.ok)}</Text>)}
          {lastErrors().map(e => <Text key={e} variant="caption" tone="danger">{e}</Text>)}
        </View>
      </Card>

      <View style={styles.block}>
        {confirm ? <>
          <Text variant="bodyStrong" tone="danger">{t.delete}</Text>
          <Text>{t.deleteWhat}</Text>
          <Text variant="caption" tone="textMuted">{t.deleteKept}</Text>
          <Text variant="caption" tone="textMuted">{t.deleteSub}</Text>
          <Button label={t.deleteConfirm} disabled={busy} onPress={doDelete} />
          <Button variant="secondary" label={t.deleteCancel} onPress={() => setConfirm(false)} />
        </> : <Button variant="secondary" label={t.delete} onPress={() => setConfirm(true)} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ block: { gap: tokens.space.sm }, row: { flexDirection: "row", gap: tokens.space.xs } });
