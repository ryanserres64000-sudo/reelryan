import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { FONT_PAIRS, type Kit } from "../../../core/brand";
import { pickLogo, type Logo } from "../brand/logo";
import { fr } from "../copy/fr";
import { Button, Chip, MadaSays, Screen, Swatch, Text, tokens, useTheme } from "../design";

type Props = { kit: Kit; logo: Logo | null; onChange: (kit: Kit, logo: Logo | null) => void; onBack: () => void; onNext: () => void };

// The brand kit (étude, ch. 7 « Kit de marque », « Remplir depuis mon logo » ; ch. 4 top 5 n°3) :
// the colours are read from the logo on the iPhone, without AI; two fonts at most.
export function LogoScreen({ kit, logo, onChange, onBack, onNext }: Props) {
  const { c } = useTheme();
  const t = fr.dna.logo;
  const [state, setState] = useState<"idle" | "reading" | "error">("idle");
  const pick = async () => {
    setState("reading");
    try {
      const l = await pickLogo();
      if (l) onChange({ ...kit, couleurs: l.colors, logo: true }, l);
      setState("idle");
    } catch {
      setState("error");
    }
  };
  const auto = !kit.polices.titres;
  return (
    <Screen title={t.title} detail={t.detail} onBack={onBack}
      footer={<Button label={t.write} disabled={state === "reading"} onPress={onNext} haptic />}>
      <View style={styles.logoRow}>
        {logo ? <Image source={{ uri: logo.uri }} accessibilityLabel={t.logoAlt} style={[styles.logo, { borderColor: c.line, backgroundColor: c.surface }]} resizeMode="contain" /> : null}
        <View style={styles.flex}><Button variant="secondary" label={logo ? t.change : t.pick} disabled={state === "reading"} onPress={pick} /></View>
      </View>
      {state === "reading" ? <MadaSays text={t.reading} /> : null}
      {state === "error" ? <Text tone="danger">{t.error}</Text> : null}
      {logo && !kit.couleurs.length && state === "idle" ? <Text tone="textMuted">{t.noColor}</Text> : null}

      {kit.couleurs.length ? (
        <View style={styles.group}>
          <Text variant="callout" tone="textMuted">{t.colors}</Text>
          <View style={styles.row}>
            {kit.couleurs.map(col => <Swatch key={col} color={col} label={t.color(col)} onPress={() => onChange({ ...kit, couleurs: kit.couleurs.filter(x => x !== col) }, logo)} />)}
          </View>
          <Text variant="caption" tone="textMuted">{t.colorsHint}</Text>
        </View>
      ) : null}

      <View style={styles.group}>
        <Text variant="callout" tone="textMuted">{t.fonts}</Text>
        <View style={styles.row}>
          <Chip kind="ai" label={t.fontsAuto} selected={auto} onPress={() => onChange({ ...kit, polices: { titres: "", texte: "" } }, logo)} />
          {FONT_PAIRS.map(p => {
            const on = kit.polices.titres === p.titres && kit.polices.texte === p.texte;
            return <Chip key={p.titres + p.texte} label={t.fontPair(p.titres, p.texte)} selected={on} onPress={() => onChange({ ...kit, polices: on ? { titres: "", texte: "" } : { ...p } }, logo)} />;
          })}
        </View>
        <Text variant="caption" tone="textMuted">{t.fontsHint}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logoRow: { flexDirection: "row", alignItems: "center", gap: tokens.space.md },
  logo: { width: tokens.size.button * 2, height: tokens.size.button * 2, borderRadius: tokens.radius.card, borderWidth: tokens.size.border },
  flex: { flex: 1 },
  group: { gap: tokens.space.xs },
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs },
});
