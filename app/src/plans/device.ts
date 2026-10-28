import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// An anonymous id for this iPhone, in the keychain so it survives a reinstall (étude, ch. 8 §5). It
// counts the free creations on the server; it is not linked to any account or to the person's name.
const KEY = "mada.device.v1";
let cached: string | null = null;
export const deviceId = () => cached;

export async function initDevice(): Promise<string> {
  if (cached) return cached;
  const web = Platform.OS === "web";
  try {
    const got = web ? await AsyncStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    if (got) return (cached = got);
  } catch { /* unreadable keychain: a new id */ }
  const id = randomUUID();
  try { if (web) await AsyncStorage.setItem(KEY, id); else await SecureStore.setItemAsync(KEY, id, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }); } catch { /* kept in memory */ }
  return (cached = id);
}
