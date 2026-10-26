import { fr } from "../copy/fr";
import { Button, MusicPicker, Screen, Text } from "../design";
import type { Music } from "../flow/types";

type Props = { music: Music; onChange: (m: Music) => void; onBack: () => void; onNext: () => void };

const host = (url: string) => { try { return new URL(url).host; } catch { return url; } };

// Step 3: the 4 cards right after the brief (étude, ch. 5 §3). Link checks, tempo and passage come with lot 3.
export function MusicScreen({ music, onChange, onBack, onNext }: Props) {
  return (
    <Screen title={fr.music.title} detail={fr.musicScreen.detail} onBack={onBack} footer={<Button label={fr.nav.next} onPress={onNext} haptic />}>
      <MusicPicker value={music.choice} recommended="trending" onChange={choice => onChange({ ...music, choice })} onLink={link => onChange({ choice: "mine", link })} />
      {music.choice === "mine" && music.link ? <Text variant="caption" tone="textMuted">{fr.musicScreen.linkSaved(host(music.link))}</Text> : null}
      {music.choice === "mine" ? <Text variant="caption" tone="textMuted">{fr.music.warning}</Text> : null}
    </Screen>
  );
}
