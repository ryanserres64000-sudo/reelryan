import { Asset } from "expo-asset";
import type { TimelineV1 } from "../../../core/timeline";
import type { Brand } from "../brand/types";
import type { Music, Rush } from "../flow/types";
import { fontModule } from "../visual/fonts";

// Where the native render finds each file (app/modules/mada-video, Sources in Model.swift): the rushes
// by id, the logo, the music passage (mode « fichier » only) and the two brand fonts as files.
export type Sources = {
  rushes: Record<string, string>; logo: string | null;
  music: { uri: string; debut: number; fin: number } | null;
  fonts: { titre: string | null; texte: string | null };
};

const file = async (m: number) => { try { const a = await Asset.fromModule(m).downloadAsync(); return a.localUri ?? null; } catch { return null; } };

export async function videoSources(t: TimelineV1, rushes: Rush[], brand: Brand | null, music: Music): Promise<Sources> {
  const p = t.charte.polices;
  const passage = music.passage ?? (music.analysis ? { debut: 0, fin: music.analysis.duration } : null);
  return {
    rushes: Object.fromEntries(rushes.flatMap(r => (r.uri ? [[r.id, r.uri]] : []))),
    logo: brand?.logoUri ?? null,
    music: t.musique.mode === "fichier" && music.sound && passage ? { uri: music.sound.uri, ...passage } : null,
    fonts: { titre: await file(fontModule(p.titre, 700)), texte: await file(fontModule(p.texte, 400)) },
  };
}
