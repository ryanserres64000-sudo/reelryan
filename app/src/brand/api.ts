import { fetch } from "expo/fetch";
import { serverHeaders } from "../flow/server";
import { offlineDna, sanitizeDna, type Dna } from "../../../core/brand";
import { fr } from "../copy/fr";
import type { Brand } from "./types";

// The one AI call of sign-up (lib/adn.js). Without a server, or if it fails, the carnet is written
// from the answers alone, and the app says so: sign-up never blocks on the AI.
export async function writeDna(b: Brand, logo: string, url: string | null, signal?: AbortSignal, access?: string): Promise<{ dna: Dna; byAi: boolean }> {
  const offline = { dna: offlineDna(b.profil, b.answers, b.kit), byAi: false };
  if (!url) return offline;
  try {
    const res = await fetch(`${url}/api/adn`, {
      method: "POST", signal,
      headers: serverHeaders.get(),
      body: JSON.stringify({ profil: b.profil, libelle_profil: fr.dna.profile.names[b.profil], reponses: b.answers, kit: b.kit, logo: logo || undefined }),
    });
    if (!res.ok) return offline;
    const out = await res.json();
    return { dna: sanitizeDna(out.adn, b.profil, b.answers, b.kit), byAi: true };
  } catch (e) {
    if (signal?.aborted) throw e;
    return offline;
  }
}
