import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { fr } from "../../copy/fr";
import { tokens } from "../tokens";
import { Button } from "./Button";
import { Text, typeStyle } from "../Text";
import { useTheme } from "../theme";

export type MusicChoice = keyof typeof fr.music.cards;
const ORDER: MusicChoice[] = ["mine", "catalog", "trending", "none"];

type Props = { value?: MusicChoice; recommended?: MusicChoice; catalogAvailable?: boolean; onChange?: (v: MusicChoice) => void; onLink?: (url: string) => void };

// 4 cards in a 2 × 2 grid, the recommended one badged, the MP3 link field unfolding in « Mon son »
// (étude, ch. 6 §4 ; ch. 5 §3). The licensed catalogue stays « Bientôt » until a contract exists (ch. 9).
export function MusicPicker({ value, recommended, catalogAvailable = false, onChange, onLink }: Props) {
  const { c } = useTheme();
  const [link, setLink] = useState("");
  return (
    <View style={styles.grid}>
      {ORDER.map(k => {
        const card = fr.music.cards[k], selected = value === k, off = k === "catalog" && !catalogAvailable;
        return (
          <Pressable key={k} disabled={off} onPress={() => onChange?.(k)} accessibilityRole="button" accessibilityState={{ selected, disabled: off }}
            style={[styles.card, value === "mine" && k === "mine" ? styles.wide : null, { backgroundColor: c.surface, borderColor: selected ? c.actionStrong : c.line, borderWidth: selected ? tokens.size.selection : tokens.size.border }]}>
            {recommended === k && !off ? <View style={[styles.badge, { borderColor: c.ai }]}><Text variant="caption" tone="ai">{fr.music.recommended}</Text></View> : null}
            {off ? <View style={[styles.badge, { borderColor: c.line }]}><Text variant="caption" tone="textMuted">{fr.music.soon}</Text></View> : null}
            <Text variant="bodyStrong" tone={off ? "textMuted" : "text"}>{card.title}</Text>
            <Text variant="caption" tone="textMuted">{card.detail}</Text>
            {selected && k === "mine" ? (
              <View style={styles.link}>
                <TextInput value={link} onChangeText={setLink} placeholder={fr.music.linkPlaceholder} placeholderTextColor={c.textMuted}
                  autoCapitalize="none" autoCorrect={false} keyboardType="url" inputMode="url"
                  style={[typeStyle("callout"), styles.input, { color: c.text, borderColor: c.line, backgroundColor: c.surfaceRaised }]} />
                <Button variant="secondary" label={fr.music.linkAdd} disabled={!link.trim()} onPress={() => onLink?.(link.trim())} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  card: { flexBasis: "47%", flexGrow: 1, minHeight: tokens.size.button * 2, borderRadius: tokens.radius.card, padding: tokens.space.md, gap: tokens.space.xxs },
  wide: { flexBasis: "100%" },
  badge: { alignSelf: "flex-start", borderWidth: tokens.size.border, borderRadius: tokens.radius.chip, paddingHorizontal: tokens.space.xs, marginBottom: tokens.space.xxs },
  link: { gap: tokens.space.xs, marginTop: tokens.space.xs },
  input: { minHeight: tokens.size.touch, borderWidth: tokens.size.border, borderRadius: tokens.radius.button, paddingHorizontal: tokens.space.sm },
});
