import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetch } from "expo/fetch";
import { emptyUsage, monthOf } from "../../core/plans";
import { clearConsent } from "./consent";
import { SERVER, serverHeaders } from "./flow/server";
import type { Plans } from "./plans/state";

// « Supprimer mon compte et mes données » (règle Apple 5.1.1(v), RGPD ; étude, ch. 9). On the iPhone:
// the brand carnet, the visuals and the consent go. Kept: the anonymous device id and the count of
// free creations used, so that deleting never gives new free AI uses (lib/quota.js says the same).
const WIPED = ["mada.marque.v1", "mada.visuels.v1"];

export async function deleteAccount(p: Plans): Promise<{ server: boolean; plans: Plans }> {
  let server = !SERVER.url;
  if (SERVER.url) {
    try { server = (await fetch(`${SERVER.url}/api/compte`, { method: "DELETE", headers: serverHeaders.get() })).ok; } catch { server = false; }
  }
  try { await AsyncStorage.multiRemove(WIPED); } catch { /* nothing left to read them */ }
  await clearConsent();
  return { server, plans: { ...p, usage: { ...emptyUsage(monthOf(new Date())), gratuit: p.usage.gratuit } } };
}
