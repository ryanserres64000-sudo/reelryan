import { beatGrid } from "../../../core/music";
import type { Music } from "../flow/types";

// The « musique » block of timeline v1 (core/timeline.ts) built from the Music screen.
export function toMusique(m: Music, editLength: number) {
  if (m.choice === "trending") return { mode: "tendance", bpm: m.trendingTempo, temps_forts: beatGrid(m.trendingTempo, editLength + 2) };
  if (m.choice !== "mine" || !m.sound || !m.rightsAt) return { mode: "aucune" };
  return {
    mode: "fichier",
    source: { type: m.fromLink ? "lien" : "fichier", empreinte: m.sound.key, droits_confirmes_le: m.rightsAt },
    passage: m.passage, bpm: m.analysis?.bpm ?? null, temps_forts: m.analysis?.beats ?? [],
  };
}
