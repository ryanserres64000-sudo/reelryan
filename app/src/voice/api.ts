import { fetch } from "expo/fetch";
import type { Mot, VoixId } from "../../../core/voice";
import { SERVER, aiUrl, serverHeaders } from "../flow/server";
import { saveVoice } from "./files";

// POST /api/voix (lib/voix.js). « ecrire »: Ma DA writes the text from a sentence (small model);
// « lire »: a French voice reads it (ElevenLabs, the key stays on the server) and the time of each
// word comes back for the subtitles. Both send the person's text to an AI: only with their consent.
export class VoiceError extends Error { constructor(public kind: "offline" | "quota" | "server", public detail?: string) { super(kind); } }

async function call(body: object, signal?: AbortSignal) {
  if (!aiUrl()) throw new VoiceError("offline");
  const res = await fetch(`${SERVER.url}/api/voix`, { method: "POST", signal, headers: serverHeaders.get(), body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (res.status === 402 || res.status === 429) throw new VoiceError("quota", out?.message);
  if (!res.ok) throw new VoiceError("server", out?.message);
  return out;
}

export async function writeScript(o: { consigne: string; duree: number; brief?: string; marque?: string; ton?: string }, signal?: AbortSignal): Promise<string> {
  const out = await call({ action: "ecrire", ...o }, signal);
  return String(out.texte ?? "");
}

export type Spoken = { uri: string; source: string; mots: Mot[]; duree: number };
export async function speak(texte: string, voix: VoixId, vitesse: number, name: string, signal?: AbortSignal): Promise<Spoken> {
  const out = await call({ action: "lire", texte, voix, vitesse }, signal);
  if (!out.audio) throw new VoiceError("server");
  const mots: Mot[] = Array.isArray(out.mots) ? out.mots : [];
  return { uri: saveVoice(name, out.audio), source: name, mots, duree: Number(out.duree) || (mots.length ? mots[mots.length - 1].fin : 0) };
}
