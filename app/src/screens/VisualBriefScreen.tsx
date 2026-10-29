import { useRef, useState } from "react";
import { Image, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { INFOS, KINDS, STYLE_OF, type Infos, type Kind, type VisualBrief } from "../../../core/design";
import { fr } from "../copy/fr";
import type { Brand } from "../brand/types";
import { Button, Chip, MadaSays, Screen, Text, tokens, typeStyle, useTheme } from "../design";
import { assetsOf, createVisual, type Photo, type VisualResult } from "../visual/api";
import { DesignView } from "../visual/DesignView";
import { pickPhotos } from "../visual/photos";
import { noteError } from "../diag";
import type { SavedVisual } from "../visual/store";

type Props = { brand: Brand | null; saved: SavedVisual[]; initial?: { brief: VisualBrief; photos: Photo[] } | null; onCreated: (r: VisualResult, brief: VisualBrief, photos: Photo[]) => void; onOpen: (v: SavedVisual) => void; onBack: () => void; canAi?: boolean; onBlocked?: (brief: VisualBrief, photos: Photo[]) => void };
const t = fr.visual;
const KIND_KEYS = Object.keys(KINDS) as Kind[];
const MAX_PHOTOS = 3;

// Posters, posts, stories, flyers and menus (étude, ch. 5 §7) : the kind, one idea, the exact texts,
// and the person's own photos. The house style comes from the brand carnet (ch. 6 §5).
export function VisualBriefScreen({ brand, saved, initial, onCreated, onOpen, onBack, canAi = true, onBlocked }: Props) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  // Back from the editor, the last brief is still there, to try another format.
  const [kind, setKind] = useState<Kind>(initial?.brief.kind ?? (brand?.profil === "restaurant" ? "affiche" : "post"));
  const [idee, setIdee] = useState(initial?.brief.idee ?? "");
  const [infos, setInfos] = useState<Infos>(initial?.brief.infos ?? {});
  const [photos, setPhotos] = useState<Photo[]>(initial?.photos ?? []);
  const [busy, setBusy] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const thumb = Math.min(width, tokens.layout.largePhoneWidth) / 4;

  const [photoSay, setPhotoSay] = useState<string | null>(null);
  const pick = async () => {
    setPhotoSay(null);
    try {
      const got = await pickPhotos(MAX_PHOTOS - photos.length);
      setPhotos(p => [...p, ...got.map(a => ({ id: "", uri: a.uri }))].slice(0, MAX_PHOTOS).map((x, i) => ({ ...x, id: `img${i + 1}` })));
    } catch (e) { noteError("photos", e instanceof Error ? e.message : String(e)); setPhotoSay(t.photoError); }
  };
  const create = async () => {
    setBusy(true);
    ctl.current = new AbortController();
    const brief: VisualBrief = { kind, idee, infos, style: STYLE_OF(brand?.dna) };
    // Free visuals used up: the paywall, with the layout without AI as a free way on (lot 8).
    if (!canAi && onBlocked) { setBusy(false); onBlocked(brief, photos); return; }
    try { onCreated(await createVisual(brief, brand, photos, ctl.current.signal), brief, photos); }
    finally { setBusy(false); }
  };

  return (
    <Screen title={t.title} detail={t.detail} onBack={onBack}
      footer={<>
        {busy ? <MadaSays text={t.creating} /> : null}
        <Button label={t.create} disabled={busy || (!idee.trim() && !infos.titre?.trim())} onPress={create} haptic />
      </>}>
      <View style={styles.row}>{KIND_KEYS.map(k => <Chip key={k} label={t.kinds[k]} selected={kind === k} onPress={() => setKind(k)} />)}</View>

      <View style={styles.field}>
        <Text variant="callout" tone="textMuted" nativeID="idea-label">{t.idea}</Text>
        <TextInput value={idee} onChangeText={setIdee} placeholder={t.ideaPlaceholder} placeholderTextColor={c.textMuted} accessibilityLabelledBy="idea-label" multiline maxLength={400}
          style={[typeStyle("body"), styles.input, styles.multi, { color: c.text, borderColor: c.line, backgroundColor: c.surface }]} />
      </View>

      <View style={styles.field}>
        <Text variant="headline">{t.photos}</Text>
        <Text variant="caption" tone="textMuted">{t.photosWhy}</Text>
        <View style={styles.row}>
          {photos.map((p, i) => (
            <Pressable key={p.uri} accessibilityRole="button" accessibilityLabel={t.removePhoto(i + 1)} onPress={() => setPhotos(ps => ps.filter(x => x !== p).map((x, j) => ({ ...x, id: `img${j + 1}` })))}>
              <Image source={{ uri: p.uri }} style={[styles.thumb, { width: thumb, height: thumb, borderColor: c.line }]} />
            </Pressable>
          ))}
        </View>
        {photos.length < MAX_PHOTOS ? <Button variant="secondary" label={t.addPhoto} onPress={pick} /> : null}
        {photoSay ? <MadaSays text={photoSay} /> : null}
      </View>

      <View style={styles.field}>
        <Text variant="headline">{t.infos}</Text>
        <Text variant="caption" tone="textMuted">{t.infosWhy}</Text>
        {INFOS.map(k => (
          <TextInput key={k} value={infos[k] ?? ""} onChangeText={v => setInfos(x => ({ ...x, [k]: v }))} placeholder={t.fields[k]} placeholderTextColor={c.textMuted}
            accessibilityLabel={t.fields[k]} maxLength={k === "autre" ? 200 : 80}
            style={[typeStyle("body"), styles.input, { color: c.text, borderColor: c.line, backgroundColor: c.surface }]} />
        ))}
      </View>

      {saved.length ? (
        <View style={styles.field}>
          <Text variant="headline">{t.mine}</Text>
          <View style={styles.row}>
            {saved.map(v => (
              <Pressable key={v.id} accessibilityRole="button" accessibilityLabel={t.reopen(t.kinds[v.brief.kind])} onPress={() => onOpen(v)} style={[styles.saved, { borderColor: c.line }]}>
                <DesignView design={v.design} width={thumb} assets={assetsOf(v.photos, brand)} id={`s${v.id}`} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs },
  field: { gap: tokens.space.xs },
  input: { borderWidth: tokens.size.border, borderRadius: tokens.radius.button, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm, minHeight: tokens.size.touch },
  multi: { minHeight: tokens.size.button * 2, textAlignVertical: "top" },
  thumb: { borderRadius: tokens.radius.chip, borderWidth: tokens.size.border },
  saved: { borderWidth: tokens.size.border, borderRadius: tokens.radius.chip, overflow: "hidden" },
});
