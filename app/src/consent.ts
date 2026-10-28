import AsyncStorage from "@react-native-async-storage/async-storage";

// Permission before anything leaves the iPhone for Claude (Anthropic) : règle Apple 5.1.2(i) and
// RGPD (étude, ch. 9). Asked once, at the first AI step; the answer is dated and can be changed in
// Réglages. Without it, every AI call is skipped and the app works by hand or offline (aiUrl()).
export type Consent = { ok: boolean; at: string; version: number } | null;
export const CONSENT_VERSION = 1;
const KEY = "mada.consentement.v1";
let current: Consent = null;

export async function loadConsent(): Promise<Consent> {
  try {
    const c = JSON.parse((await AsyncStorage.getItem(KEY)) ?? "null");
    // A new wording of what is sent (a higher version) asks again.
    current = c && typeof c.ok === "boolean" && c.version === CONSENT_VERSION ? c : null;
  } catch { current = null; }
  return current;
}
export const consent = () => current;
export const aiAllowed = () => !!current?.ok;
export async function setConsent(ok: boolean): Promise<Consent> {
  current = { ok, at: new Date().toISOString(), version: CONSENT_VERSION };
  try { await AsyncStorage.setItem(KEY, JSON.stringify(current)); } catch { /* kept for this session */ }
  return current;
}
export async function clearConsent() { current = null; try { await AsyncStorage.removeItem(KEY); } catch { /* nothing kept */ } }
