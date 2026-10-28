import { Asset } from "expo-asset";
import type { EFFETS, TimelineV1 } from "../../../core/timeline";
import { duoById } from "../../../core/typo";
import type { Brand } from "../brand/types";
import type { Music, Rush } from "../flow/types";
import { fontModule } from "../visual/fonts";
import { voiceUri } from "../voice/files";

// Where the native render finds each file (app/modules/mada-video, Sources in Model.swift): the rushes
// by id, the logo, the music passage (mode « fichier » only), the fonts as files (the brand's two, or
// the title duo's: core/typo.ts) and the house sound effects the edit uses.
export type Sources = {
  rushes: Record<string, string>; logo: string | null;
  music: { uri: string; debut: number; fin: number } | null;
  fonts: { titre: string | null; texte: string | null; accent: string | null };
  effets: Record<string, string>;
  // The voice-overs and recordings (étape 5), by clip id.
  audios: Record<string, string>;
};

// Synthesised in app/assets/sfx/make.sh: no licence needed.
const SFX: Record<(typeof EFFETS)[number], number> = {
  whoosh: require("../../assets/sfx/whoosh.m4a"), pop: require("../../assets/sfx/pop.m4a"), clic: require("../../assets/sfx/clic.m4a"),
  ding: require("../../assets/sfx/ding.m4a"), impact: require("../../assets/sfx/impact.m4a"),
};

const file = async (m: number) => { try { const a = await Asset.fromModule(m).downloadAsync(); return a.localUri ?? null; } catch { return null; } };

export async function videoSources(t: TimelineV1, rushes: Rush[], brand: Brand | null, music: Music): Promise<Sources> {
  const p = t.charte.polices, duo = duoById(t.charte.duo);
  const used = [...new Set((t.effets ?? []).map(e => e.type))];
  const passage = music.passage ?? (music.analysis ? { debut: 0, fin: music.analysis.duration } : null);
  return {
    rushes: Object.fromEntries(rushes.flatMap(r => (r.uri ? [[r.id, r.uri]] : []))),
    logo: brand?.logoUri ?? null,
    music: t.musique.mode === "fichier" && music.sound && passage ? { uri: music.sound.uri, ...passage } : null,
    fonts: duo
      ? { titre: await file(fontModule(duo.titre.police, duo.titre.poids)), accent: await file(fontModule(duo.accent.police, duo.accent.poids)), texte: await file(fontModule(duo.texte.police, duo.texte.poids)) }
      : { titre: await file(fontModule(p.titre, 700)), accent: await file(fontModule(p.texte, 400)), texte: await file(fontModule(p.texte, 400)) },
    audios: Object.fromEntries((t.audios ?? []).flatMap(a => { const u = voiceUri(a.source); return u ? [[a.id, u]] : []; })),
    effets: Object.fromEntries((await Promise.all(used.map(async k => [k, await file(SFX[k])] as const))).filter((e): e is readonly [typeof used[number], string] => !!e[1])),
  };
}
