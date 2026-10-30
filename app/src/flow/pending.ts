import AsyncStorage from "@react-native-async-storage/async-storage";
import { noteError } from "../diag";

// The AI edit sent last (Ryan, 30 octobre : « quand je quitte l'appli pendant le montage et que je
// reviens, tout se supprime ; ça va perdre des crédits »). The server finishes an edit sent with this id
// even when the phone hangs up, and keeps the result 30 minutes (lib/montage.js). The same rushes and
// brief asked again within that time pick it up instead of paying for a new one.
export type Pending = { id: string; sig: string; at: number };
const KEY = "mada.montage.travail";
// A little under the server's 30 minutes, so a job found here is still there.
export const PENDING_MS = 25 * 60_000;

// What makes two edits the same request: the rushes chosen and what was asked.
export function signatureOf(parts: unknown[]) {
  const s = JSON.stringify(parts);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}-${(h >>> 0).toString(36)}`;
}

export const newJobId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export async function pendingFor(sig: string, now = Date.now()): Promise<Pending | null> {
  try {
    const p = JSON.parse((await AsyncStorage.getItem(KEY)) ?? "null") as Pending | null;
    return p && p.sig === sig && now - p.at < PENDING_MS ? p : null;
  } catch (e) { noteError("montage", `travail illisible : ${e instanceof Error ? e.message : String(e)}`); return null; }
}

export async function rememberJob(p: Pending) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { noteError("montage", `travail non gardé : ${e instanceof Error ? e.message : String(e)}`); }
}

export function forgetJob() {
  AsyncStorage.removeItem(KEY).catch(e => noteError("montage", `travail non effacé : ${e instanceof Error ? e.message : String(e)}`));
}
