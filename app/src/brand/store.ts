import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Brand } from "./types";

// One brand per device for now; the brand spaces of the web prototype (several accounts) come with the
// server accounts (lot 8). AsyncStorage is localStorage on the web preview.
const KEY = "mada.marque.v1";

export async function loadBrand(): Promise<Brand | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const b = raw ? JSON.parse(raw) : null;
    return b && b.profil ? b : null;
  } catch {
    return null;
  }
}

export async function saveBrand(b: Brand) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(b)); return true; } catch { return false; }
}
