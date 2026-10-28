import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Mode } from "../../../core/tracks";

// Simple or Complet, remembered from one edit to the next (étude de la refonte, « Ne pas noyer les débutants »).
const KEY = "mada.editeur.mode";
export async function loadMode(): Promise<Mode> {
  try { return (await AsyncStorage.getItem(KEY)) === "complet" ? "complet" : "simple"; } catch { return "simple"; }
}
export const saveMode = (m: Mode) => { AsyncStorage.setItem(KEY, m).catch(() => {}); };
