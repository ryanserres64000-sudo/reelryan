import { StyleSheet, View } from "react-native";
import type { PlacedText } from "../../../core/export";
import { RENDER as R, animAt, wordRange } from "../../../core/textlook";
import type { TimelineV1 } from "../../../core/timeline";
import { applyCasse, duoById } from "../../../core/typo";
import { Text } from "../design";
import { face, useVisualFonts } from "../visual/fonts";

// The font of a text's role, as the native render picks it (app/src/video/sources.ts, Overlay.swift):
// the title duo when there is one, otherwise the brand's two fonts.
export function fontOf(t: TimelineV1, role: PlacedText["rendu"]["role"]): string {
  const duo = duoById(t.charte.duo), p = t.charte.polices;
  if (duo) return role === "titre" ? face(duo.titre.police, duo.titre.poids) : role === "accent" ? face(duo.accent.police, duo.accent.poids) : face(duo.texte.police, duo.texte.poids);
  return role === "titre" ? face(p.titre, 700) : face(p.texte, 400);
}

// A text's own font first (core/textlook.ts `police`), as Overlay.swift draws it.
export const familyOf = (t: TimelineV1, r: PlacedText["rendu"]) => r.police ? face(r.police, r.role === "titre" ? 700 : 400) : fontOf(t, r.role);

// One text drawn exactly where the export puts it: its box on the 1080 × 1920 frame scaled by `k`,
// its size, angle, colour, background and animation at `time` (core/textlook.ts).
export function TextOverlay({ x, timeline, time, k, editing }: { x: PlacedText; timeline: TimelineV1; time: number; k: number; editing?: boolean }) {
  const loaded = useVisualFonts();
  const r = x.rendu, duo = duoById(timeline.charte.duo);
  const words = x.texte.split(/\s+/);
  const a = editing ? { opacite: 1, dy: 0, echelle: 1, mots: words.length } : animAt(r.anim, time - x.debut, x.fin - x.debut, words.length);
  if (a.opacite <= 0) return null;
  const color = r.couleur ?? timeline.charte.couleurs.texte ?? R.ink;
  const plate = r.fond === "plein" || r.fond === "arrondi" ? timeline.charte.couleurs.principale ?? R.plate : null;
  const size = x.taille * k, title = r.role === "titre";
  const shown = a.mots < words.length ? words.slice(0, a.mots).join(" ") : x.texte;
  const family = loaded ? familyOf(timeline, r) : undefined;
  const cased = title && duo ? applyCasse(shown, duo.titre.casse) : shown;
  const written = r.majuscules ? cased.toLocaleUpperCase("fr-FR") : cased;
  const hit = wordRange(written, { mot: r.mot });
  const wordColor = r.motCouleur ?? timeline.charte.couleurs.principale ?? R.word;
  const align = r.align === "gauche" ? "left" : r.align === "droite" ? "right" : "center";
  const shadow = r.fond === "ombre" ? { textShadowColor: R.shadow, textShadowRadius: R.shadowBlur * k, textShadowOffset: { width: 0, height: R.shadowY * k } } : null;
  const accent = title && x.accent && duo ? x.accent : "";
  const small = size * (duo?.echelle ?? 0.6);
  return (
    <View pointerEvents="none" style={[styles.box, { left: x.box.x * k, top: x.box.y * k, width: x.box.w * k, height: x.box.h * k, opacity: a.opacite, transform: [{ translateY: a.dy * k }, { rotate: `${x.rotation}deg` }, { scale: a.echelle }] }]}>
      <View style={[styles.plate, { alignSelf: align === "center" ? "center" : align === "left" ? "flex-start" : "flex-end", paddingHorizontal: plate || r.fond === "contour" ? R.padX * k : 0, paddingVertical: plate || r.fond === "contour" ? R.padY * k : 0, backgroundColor: plate ?? "transparent", borderRadius: r.fond === "arrondi" ? R.radius * k : 0, borderWidth: r.fond === "contour" ? R.border * k : 0, borderColor: color }]}>
        <Text style={[{ color, fontFamily: family, fontSize: size, lineHeight: size * R.lineHeight, textAlign: align, letterSpacing: (r.espace ?? 0) * size, fontVariant: r.majuscules ? ["lining-nums"] : undefined }, shadow]}>
          {hit ? <>{written.slice(0, hit[0])}<Text style={{ color: wordColor }}>{written.slice(hit[0], hit[1])}</Text>{written.slice(hit[1])}</> : written}
        </Text>
        {accent ? <Text style={[{ color, fontFamily: loaded && duo ? face(duo.accent.police, duo.accent.poids) : undefined, fontSize: small, lineHeight: small * 1.25, marginTop: -small * 1.25 * (duo?.chevauchement ?? 0.2), textAlign: align }, shadow]}>{applyCasse(accent, duo!.accent.casse)}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute", justifyContent: "center" },
  plate: { maxWidth: "100%" },
});
