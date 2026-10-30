import { aiAllowed } from "../consent";
import { serverUrl } from "../../../core/server";
import { deviceId } from "../plans/device";

// The MaDa server (Vercel or server.js). Unset, the app runs offline with sample answers:
// EXPO_PUBLIC_MADA_API=https://… and EXPO_PUBLIC_MADA_ACCESS=<APP_PASSWORD> in app/.env turn it on.
export const SERVER = { url: serverUrl(process.env.EXPO_PUBLIC_MADA_API), access: process.env.EXPO_PUBLIC_MADA_ACCESS || undefined };

// The server, for calls that send the person's content to the AI: only with their permission (lot 9).
export const aiUrl = () => (aiAllowed() ? SERVER.url : null);

// Every call to the server: the access code, the anonymous device id that counts the free creations,
// and whether the person is Pro (lib/quota.js; the server reads that header only in development,
// MADA_PRO_HEADER=1, and otherwise trusts the Apple-signed purchases sent to /api/achat).
// The account session goes with every call too, so the server can ask for an account before the AI
// (MADA_COMPTE_REQUIS=1, lib/quota.js).
let pro = false, jeton: string | null = null;
export const serverHeaders = {
  setPro: (p: boolean) => { pro = p; },
  setSession: (j: string | null) => { jeton = j; },
  get: (): Record<string, string> => {
    const id = deviceId();
    return { "content-type": "application/json", ...(SERVER.access ? { "x-rr-access": SERVER.access } : {}), ...(id ? { "x-mada-device": id } : {}), ...(pro ? { "x-mada-pro": "1" } : {}), ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) };
  },
};
