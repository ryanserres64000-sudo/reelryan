import { fetch } from "expo/fetch";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { POSTER_PX, sanitizeAffiche, type Affiche } from "../../../core/poster";
import type { Charte } from "../../../core/timeline";
import { aiUrl, serverHeaders } from "./server";

// The event poster (core/poster.ts): picked from the gallery, reduced on the phone to 1024 px, read by
// the server (lib/affiche.js). `null` when the person cancels; throws when it cannot be read, so the
// screen says so and the fields stay empty to fill by hand.
export async function pickPoster(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: false });
  return res.canceled || !res.assets[0] ? null : res.assets[0].uri;
}

export async function readPoster(uri: string, signal?: AbortSignal): Promise<Affiche> {
  const url = aiUrl();
  if (!url) throw new Error("ia_coupee");
  const small = await (await ImageManipulator.manipulate(uri).resize({ width: POSTER_PX }).renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  const res = await fetch(`${url}/api/affiche`, { method: "POST", signal, headers: serverHeaders.get(), body: JSON.stringify({ image: small.base64, annee: new Date().getFullYear() }) });
  if (!res.ok) throw new Error(`affiche ${res.status}`);
  return sanitizeAffiche((await res.json()).affiche);
}

// The edit takes the poster's main colour when the person keeps « Prendre ses couleurs ».
export const withPoster = <C extends { couleurs: Pick<Charte["couleurs"], "principale"> }>(c: C, a: Affiche | undefined, couleurs: boolean | undefined): C =>
  a && couleurs !== false && a.couleurs[0] ? { ...c, couleurs: { ...c.couleurs, principale: a.couleurs[0] } } : c;
