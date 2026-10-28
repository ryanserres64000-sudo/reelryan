import * as Linking from "expo-linking";
import { SERVER } from "./flow/server";

// The legal pages (lot 9) are served by the website next to the API: public/conditions.html and
// public/confidentialite.html and public/mentions-legales.html. EXPO_PUBLIC_MADA_SITE points elsewhere if they move.
const SITE = process.env.EXPO_PUBLIC_MADA_SITE || SERVER.url;
export const LEGAL = { terms: SITE && `${SITE}/conditions.html`, privacy: SITE && `${SITE}/confidentialite.html`, notices: SITE && `${SITE}/mentions-legales.html`, support: SITE && `${SITE}/aide.html`, rights: SITE && `${SITE}/aide.html#droits` };
// Apple's own page to change or cancel a subscription (no account of ours involved).
export const SUBSCRIPTIONS = "https://apps.apple.com/account/subscriptions";
export const open = (url: string | null) => { if (url) Linking.openURL(url).catch(() => {}); };
