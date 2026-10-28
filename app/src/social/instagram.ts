import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetch } from "expo/fetch";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as WebBrowser from "expo-web-browser";
import { sanitizePosts, type Post } from "../../../core/insights";
import { SERVER, aiUrl, serverHeaders } from "../flow/server";

// Instagram on the phone (étape 8): the connection goes through Instagram's own page in a secure
// browser sheet; the token never reaches the iPhone, the server keeps it (lib/instagram.js). The
// screenshots read without an account are kept here, on the iPhone only.
export type Account = { nom: string; type: string; abonnes: number | null; photo: string | null };
export type Status =
  | { state: "offline" } | { state: "closed"; message: string } | { state: "out"; expired?: boolean }
  | { state: "in"; compte: Account; posts: Post[] } | { state: "error"; message: string };
const RETURN = "madastudio://instagram";
const CAPTURES = "mada.captures.v1";
// Wide enough to read the figures, small enough to send fast.
const CAPTURE_PX = 1000;

async function call(method: string, body?: object, query = "") {
  if (!SERVER.url) return null;
  const res = await fetch(`${SERVER.url}/api/instagram${query}`, { method, headers: serverHeaders.get(), ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, out: await res.json().catch(() => ({})) };
}

export async function instagramStatus(refresh = false): Promise<Status> {
  try {
    const r = await call("GET", undefined, refresh ? "?frais=1" : "");
    if (!r) return { state: "offline" };
    if (r.status === 503) return { state: "closed", message: r.out.message };
    if (r.status !== 200) return { state: "error", message: r.out.message ?? "" };
    return r.out.connecte ? { state: "in", compte: r.out.compte, posts: sanitizePosts(r.out.posts) } : { state: "out", expired: !!r.out.expire };
  } catch { return { state: "error", message: "" }; }
}

// « Autoriser » on Instagram's page, then back to the app. Returns why it stopped, if it did.
export async function connectInstagram(): Promise<"ok" | "cancel" | "refus" | "error"> {
  const r = await call("POST", { action: "connecter" });
  if (!r || r.status !== 200 || !r.out.url) return "error";
  const done = await WebBrowser.openAuthSessionAsync(r.out.url, RETURN);
  if (done.type !== "success") return "cancel";
  const q = new URL(done.url.replace(/^madastudio:\/\//, "https://app/")).searchParams;
  return q.get("ok") ? "ok" : q.get("erreur") === "refus" ? "refus" : "error";
}
export async function disconnectInstagram(): Promise<void> { await call("DELETE"); }

// A screenshot of a post's statistics → its figures, read on the server by the small model.
// It sends an image to the AI: only with the person's consent.
export async function readCapture(uri: string): Promise<Post | "unreadable" | "error" | "consent"> {
  if (!aiUrl()) return SERVER.url ? "consent" : "error";
  try {
    const img = await (await ImageManipulator.manipulate(uri).resize({ width: CAPTURE_PX }).renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
    const r = await call("POST", { action: "capture", image: { type: "image/jpeg", data: img.base64 ?? "" } });
    if (!r || r.status !== 200) return "error";
    return r.out.lisible && r.out.post ? sanitizePosts([r.out.post])[0] ?? "unreadable" : "unreadable";
  } catch { return "error"; }
}
export const loadCaptures = async (): Promise<Post[]> => { try { return sanitizePosts(JSON.parse((await AsyncStorage.getItem(CAPTURES)) ?? "[]")); } catch { return []; } };
export const saveCaptures = (p: Post[]) => AsyncStorage.setItem(CAPTURES, JSON.stringify(p)).catch(() => {});
