import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { emptyMemory, type Memory } from "../../../core/corrections";
import { addRule, insights, isInstagramLink, matchReels, referenceKey, type Learning, type Post } from "../../../core/insights";
import { fr } from "../copy/fr";
import { Button, Card, Chip, MadaSays, Screen, Skeleton, Text, haptic, tokens, typeStyle, useTheme, useToast } from "../design";
import { connectInstagram, disconnectInstagram, instagramStatus, loadCaptures, readCapture, saveCaptures, type Status } from "../social/instagram";

type Props = { memory: Memory | null; reels: { id: string; at: string; duree: number }[]; onMemory: (m: Memory) => void; onBack: () => void };
const t = fr.stats;
const n = (v: number) => v.toLocaleString("fr-FR");
const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

// Tes chiffres (étape 8 ; étude, ch. 5 « Connecter les réseaux »): Instagram connected read-only, or
// screenshots of the statistics while Meta reviews the app; what works, said in plain sentences with
// the number of posts behind them, kept in the carnet in one tap. Nothing here is needed to use Ma DA.
export function StatsScreen({ memory, reels, onMemory, onBack }: Props) {
  const { c } = useTheme();
  const toast = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [captures, setCaptures] = useState<Post[]>([]);
  const [say, setSay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const m = memory ?? emptyMemory();

  useEffect(() => { instagramStatus().then(setStatus); loadCaptures().then(setCaptures); }, []);
  const posts = useMemo(() => [...(status?.state === "in" ? status.posts : []), ...captures].sort((a, b) => b.at.localeCompare(a.at)), [status, captures]);
  const found = useMemo(() => insights(posts, matchReels(reels, posts)), [posts, reels]);

  const connect = async () => {
    setBusy(true); setSay(null);
    const r = await connectInstagram().catch(() => "error" as const);
    if (r === "ok") { haptic("success"); setStatus(await instagramStatus(true)); }
    else if (r !== "cancel") setSay(r === "refus" ? t.refused : t.error);
    setBusy(false);
  };
  const disconnect = async () => { await disconnectInstagram().catch(() => {}); setStatus({ state: "out" }); setSay(t.disconnected); };
  const capture = async () => {
    const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (pick.canceled || !pick.assets[0]) return;
    setBusy(true); setSay(t.reading);
    const r = await readCapture(pick.assets[0].uri);
    setBusy(false);
    if (typeof r === "string") { setSay(r === "unreadable" ? t.unreadable : r === "consent" ? t.consent : t.captureError); return; }
    const next = [r, ...captures]; setCaptures(next); saveCaptures(next); haptic("success");
    setSay(t.read(r.vues !== null ? n(r.vues) : t.noViews));
  };
  const removeCapture = (id: string) => { const next = captures.filter(p => p.id !== id); setCaptures(next); saveCaptures(next); };
  const keep = (l: Learning) => { onMemory(addRule(m, l.key, l.regle)); haptic("success"); toast({ message: t.keptToast }); };
  const saveBest = () => {
    if (!isInstagramLink(link)) { setSay(t.badLink); return; }
    onMemory(addRule(m, referenceKey(link), t.bestRule(note.trim())));
    setLink(""); setNote(""); haptic("success"); toast({ message: t.keptToast });
  };
  const has = (key: string) => m.rules.some(r => r.key === key);
  const input = [typeStyle("body"), styles.input, { color: c.text, borderColor: c.line, backgroundColor: c.surface }];

  return (
    <Screen title={t.title} detail={t.detail} onBack={onBack} footer={say ? <MadaSays text={say} /> : undefined}>
      <Card>
        {!status ? <Skeleton /> : status.state === "in" ? (
          <View style={styles.block}>
            <Text variant="headline">{t.connected(status.compte.nom)}</Text>
            {status.compte.abonnes !== null ? <Text variant="callout" tone="textMuted">{t.followers(n(status.compte.abonnes))}</Text> : null}
            <View style={styles.row}>
              <Chip label={t.refresh} disabled={busy} onPress={async () => { setBusy(true); setStatus(await instagramStatus(true)); setBusy(false); }} />
              <Chip label={t.disconnect} onPress={disconnect} />
            </View>
          </View>
        ) : (
          <View style={styles.block}>
            <Text variant="headline">{t.connect}</Text>
            <Text variant="callout" tone="textMuted">{status.state === "out" && status.expired ? t.expired : status.state === "closed" ? status.message : status.state === "offline" ? t.offline : t.connectWhy}</Text>
            {status.state === "out" || status.state === "error" ? <Button label={t.connect} disabled={busy} onPress={connect} haptic /> : null}
          </View>
        )}
      </Card>

      <View style={styles.block}>
        <Button variant="secondary" label={t.capture} disabled={busy} onPress={capture} />
        <Text variant="caption" tone="textMuted">{t.captureWhy}</Text>
      </View>

      <View style={styles.block}>
        <Text variant="headline">{t.works}</Text>
        {found.attente ? <Text tone="textMuted">{found.attente}</Text> : null}
        {[...found.items, ...(found.heure ? [found.heure] : [])].map(l => (
          <Card key={l.key}>
            {l.key === "stats:heure" ? <Text variant="caption" tone="actionStrong">{t.hour}</Text> : null}
            <Text>{l.phrase}</Text>
            <Chip label={has(l.key) ? t.kept : t.keep} selected={has(l.key)} disabled={has(l.key)} onPress={() => keep(l)} style={styles.start} />
          </Card>
        ))}
      </View>

      {posts.length ? (
        <View style={styles.block}>
          <Text variant="headline">{t.reels}</Text>
          {posts.filter(p => p.type === "reel").slice(0, 10).map(p => (
            <View key={p.id} style={[styles.line, { borderColor: c.line }]}>
              <Text style={styles.flex}>{t.reelLine(day(p.at), p.vues !== null ? n(p.vues) : t.noViews)}</Text>
              {p.source === "capture" ? <Chip label={t.remove} onPress={() => removeCapture(p.id)} accessibilityHint={t.fromCapture} /> : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.block}>
        <Text variant="headline">{t.best}</Text>
        <Text variant="caption" tone="textMuted">{t.bestWhy}</Text>
        <TextInput value={link} onChangeText={setLink} placeholder={t.bestLinkPlaceholder} placeholderTextColor={c.textMuted} accessibilityLabel={t.bestLink}
          autoCapitalize="none" autoCorrect={false} keyboardType="url" style={input} />
        <TextInput value={note} onChangeText={setNote} placeholder={t.bestNotePlaceholder} placeholderTextColor={c.textMuted} accessibilityLabel={t.bestNote} maxLength={160} style={input} />
        <Button variant="secondary" label={t.bestSave} disabled={!link.trim() || !note.trim()} onPress={saveBest} />
      </View>

      <Text variant="caption" tone="textMuted">{t.privacy}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: tokens.space.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs },
  line: { flexDirection: "row", alignItems: "center", gap: tokens.space.sm, minHeight: tokens.size.touch, borderBottomWidth: tokens.size.border },
  flex: { flex: 1 },
  start: { alignSelf: "flex-start" },
  input: { minHeight: tokens.size.button, borderWidth: tokens.size.border, borderRadius: tokens.radius.button, paddingHorizontal: tokens.space.sm },
});
