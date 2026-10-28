import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Design, VisualBrief } from "../../../core/design";
import type { Photo } from "./api";

// The person's last visuals, on the iPhone only (étude, ch. 9 : rien n'est gardé sur le serveur).
export type SavedVisual = { id: string; brief: VisualBrief; design: Design; photos: Photo[]; at: string };
const KEY = "mada.visuels.v1", MAX = 20;

export async function loadVisuals(): Promise<SavedVisual[]> {
  try { const raw = await AsyncStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
export async function saveVisual(v: SavedVisual): Promise<SavedVisual[]> {
  const list = [v, ...(await loadVisuals()).filter(x => x.id !== v.id)].slice(0, MAX);
  try { await AsyncStorage.setItem(KEY, JSON.stringify(list)); } catch { /* full storage: the visual stays on screen */ }
  return list;
}
