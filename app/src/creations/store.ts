import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Refusals } from "../../../core/week";
import type { TimelineV1 } from "../../../core/timeline";
import type { Rush } from "../flow/types";

// The person's Reels, on the iPhone only like the visuals (étude, ch. 9). A Reel is saved as soon as a
// version is kept, edited or exported, with the rushes it needs to open again.
export type SavedReel = { id: string; at: string; timeline: TimelineV1; byAi: boolean; rushes: Omit<Rush, "triage">[]; selected: string[] };
const REELS = "mada.reels.v1", REFUSALS = "mada.idees-refusees.v1", MAX = 40;

async function read<T>(key: string, empty: T): Promise<T> {
  try { const raw = await AsyncStorage.getItem(key); return raw ? JSON.parse(raw) : empty; } catch { return empty; }
}
async function write(key: string, v: unknown) {
  try { await AsyncStorage.setItem(key, JSON.stringify(v)); } catch { /* full storage: it stays on screen */ }
}

export const loadReels = () => read<SavedReel[]>(REELS, []);
export async function saveReel(r: Omit<SavedReel, "rushes"> & { rushes: Rush[] }): Promise<SavedReel[]> {
  const list = [{ ...r, rushes: r.rushes.map(({ triage, ...x }) => x) }, ...(await loadReels()).filter(x => x.id !== r.id)].slice(0, MAX);
  await write(REELS, list);
  return list;
}
export async function deleteReel(id: string): Promise<SavedReel[]> {
  const list = (await loadReels()).filter(x => x.id !== id);
  await write(REELS, list);
  return list;
}

export const loadRefusals = () => read<Refusals>(REFUSALS, {});
export const saveRefusals = (r: Refusals) => write(REFUSALS, r);
