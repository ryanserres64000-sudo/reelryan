import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { fetch } from "expo/fetch";
import { Platform } from "react-native";
import { SERVER, serverHeaders } from "../flow/server";

// The Ma DA account (Ryan, 28 et 29 octobre : inscription au début, avec Apple, Google ou un e-mail).
// The server (lib/auth.js) checks who the person is and signs a session; the iPhone keeps it in the
// keychain. The account only ties the brand and the purchases to a person: the creations stay on the iPhone.
export type Methode = "apple" | "google" | "email";
export type Methodes = Record<Methode, boolean>;
export type Compte = { id: string; methode: Methode; email: string | null; nom: string | null; cree: string };
export type Session = { jeton: string; compte: Compte | null };
type Fail = { ok: false; error: "config" | "reseau" | "refus" | "lien" | "code" | "email" | "autre"; message?: string };
export type Result<T> = { ok: true; value: T } | Fail;

const KEY = "mada.session.v1";
const web = Platform.OS === "web";
const RETURN = "madastudio://compte";
let current: Session | null = null;

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = web ? await AsyncStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    const s = raw ? JSON.parse(raw) : null;
    current = s && typeof s.jeton === "string" ? s : null;
  } catch { current = null; }
  return current;
}
export const session = () => current;
async function keep(s: Session | null) {
  current = s;
  try {
    if (!s) { if (web) await AsyncStorage.removeItem(KEY); else await SecureStore.deleteItemAsync(KEY); return; }
    const raw = JSON.stringify(s);
    if (web) await AsyncStorage.setItem(KEY, raw); else await SecureStore.setItemAsync(KEY, raw, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  } catch { /* kept for this launch */ }
}
const headers = () => ({ ...serverHeaders.get(), ...(current ? { authorization: `Bearer ${current.jeton}` } : {}) });

async function call(method: "GET" | "POST" | "DELETE", body?: object, query = ""): Promise<{ status: number; out: any } | null> {
  if (!SERVER.url) return null;
  try {
    const res = await fetch(`${SERVER.url}/api/auth${query}`, { method, headers: headers(), ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, out: await res.json().catch(() => ({})) };
  } catch { return null; }
}
const fail = (r: { status: number; out: any } | null): Fail =>
  !r ? { ok: false, error: "reseau" } : r.status === 503 ? { ok: false, error: "config" } : { ok: false, error: r.out?.error === "code" || r.out?.error === "expire" ? "code" : r.out?.error === "email" ? "email" : "autre", message: r.out?.message };
async function signedIn(r: { status: number; out: any } | null): Promise<Result<Session>> {
  if (r?.status !== 200 || typeof r.out?.session !== "string") return fail(r);
  const s = { jeton: r.out.session, compte: r.out.compte ?? null };
  await keep(s);
  return { ok: true, value: s };
}

// Which ways in the server offers; none without a server (the web preview, a build without one).
export async function methods(): Promise<Methodes> {
  const r = await call("GET");
  const m = r?.status === 200 ? r.out?.methodes : null;
  return { apple: !!m?.apple, google: !!m?.google, email: !!m?.email };
}

// Apple: the identity token from the native sheet (expo-apple-authentication), checked by the server.
export const signInApple = async (jeton: string, nom: string | null) => signedIn(await call("POST", { action: "apple", jeton, nom }));

// Google: the server's sign-in page in Safari, then back to the app with the session.
export async function signInGoogle(): Promise<Result<Session>> {
  const r = await call("POST", { action: "google" });
  if (r?.status !== 200 || !r.out?.url) return fail(r);
  const done = await WebBrowser.openAuthSessionAsync(r.out.url, RETURN);
  if (done.type !== "success") return { ok: false, error: "refus" };
  const q = new URL(done.url.replace(/^madastudio:\/\//, "https://app/")).searchParams;
  const jeton = q.get("session");
  if (!jeton) return { ok: false, error: q.get("erreur") === "refus" ? "refus" : q.get("erreur") === "lien" ? "lien" : "autre" };
  await keep({ jeton, compte: null });
  const me = await call("GET", undefined, "?moi=1");
  const s = { jeton, compte: me?.status === 200 ? me.out.compte : null };
  await keep(s);
  return { ok: true, value: s };
}

// E-mail: a 6-digit code sent by the server, then the code. `dev` is the code itself when the server
// runs in test mode (MADA_AUTH_DEV=1), so it can be tried without a mailbox.
export async function sendEmailCode(email: string): Promise<Result<{ dev: string | null }>> {
  const r = await call("POST", { action: "email", email });
  return r?.status === 200 ? { ok: true, value: { dev: typeof r.out.code === "string" ? r.out.code : null } } : fail(r);
}
export const checkEmailCode = async (email: string, code: string) => signedIn(await call("POST", { action: "code", email, code }));

// « Supprimer mon compte » (Réglages) and « Me déconnecter ».
export async function deleteSession(): Promise<boolean> {
  const r = current ? await call("DELETE") : null;
  await keep(null);
  return !r || r.status === 200 || r.status === 401;
}
export const signOut = () => keep(null);
