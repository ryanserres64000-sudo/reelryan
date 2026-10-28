import { StyleSheet, View } from "react-native";
import { applyCasse, type Duo } from "../../../core/typo";
import { Text, typeStyle } from "../design";
import type { TypeName } from "../design/tokens";
import { face, useVisualFonts } from "../visual/fonts";

// A title in its typographic duo (core/typo.ts), as the native render draws it: the title word, and
// the accent word under it in the fine face, climbing over it. Without a duo or an accent, nothing.
export function DuoTitle({ duo, texte, accent, variant = "display" }: { duo: Duo | null; texte: string; accent: string; variant?: TypeName }) {
  const loaded = useVisualFonts();
  if (!duo || !accent || !loaded) return null;
  const size = typeStyle(variant).fontSize ?? 0, small = size * duo.echelle;
  return (
    <View style={styles.box}>
      <Text tone="onMedia" numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: face(duo.titre.police, duo.titre.poids), fontSize: size, lineHeight: size * 1.15, textAlign: "center" }}>{applyCasse(texte, duo.titre.casse)}</Text>
      <Text tone="onMedia" numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: face(duo.accent.police, duo.accent.poids), fontSize: small, lineHeight: small * 1.25, marginTop: -small * 1.25 * duo.chevauchement, textAlign: "center" }}>{applyCasse(accent, duo.accent.casse)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ box: { alignSelf: "stretch", alignItems: "center" } });
