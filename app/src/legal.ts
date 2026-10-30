import * as WebBrowser from "expo-web-browser";
import { serverUrl } from "../../core/server";
import { noteError } from "./diag";
import { SERVER } from "./flow/server";

// The legal pages (lot 9) are served by the website next to the API: public/conditions.html and
// public/confidentialite.html and public/mentions-legales.html. EXPO_PUBLIC_MADA_SITE points elsewhere if they move;
// without it, the production site, so the documents open even in a build without the API. Both go through
// serverUrl (core/server.ts): an address saved without https:// once made every link dead.
const SITE = serverUrl(process.env.EXPO_PUBLIC_MADA_SITE) || SERVER.url || "https://reelryan.vercel.app";
export const LEGAL = { terms: `${SITE}/conditions.html`, privacy: `${SITE}/confidentialite.html`, notices: `${SITE}/mentions-legales.html`, support: `${SITE}/aide.html`, rights: `${SITE}/aide.html#droits` };
// Apple's own page to change or cancel a subscription (no account of ours involved).
export const SUBSCRIPTIONS = "https://apps.apple.com/account/subscriptions";
// Opens a page inside the app (Safari's sheet, so the person stays in Ma DA). Resolves false when it
// could not open, so the screen can say so; the reason goes to the diagnostic in Réglages.
export async function open(url: string | null): Promise<boolean> {
  if (!url) return false;
  try { await WebBrowser.openBrowserAsync(url); return true; } catch (e) {
    noteError("lien", `${url} : ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}
