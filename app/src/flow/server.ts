import { deviceId } from "../plans/device";

// The MaDa server (Vercel or server.js). Unset, the app runs offline with sample answers:
// EXPO_PUBLIC_MADA_API=https://… and EXPO_PUBLIC_MADA_ACCESS=<APP_PASSWORD> in app/.env turn it on.
export const SERVER = { url: process.env.EXPO_PUBLIC_MADA_API || null, access: process.env.EXPO_PUBLIC_MADA_ACCESS || undefined };

// Every call to the server: the access code, the anonymous device id that counts the free creations,
// and whether the person is Pro (lib/quota.js).
let pro = false;
export const serverHeaders = {
  setPro: (p: boolean) => { pro = p; },
  get: (): Record<string, string> => {
    const id = deviceId();
    return { "content-type": "application/json", ...(SERVER.access ? { "x-rr-access": SERVER.access } : {}), ...(id ? { "x-mada-device": id } : {}), ...(pro ? { "x-mada-pro": "1" } : {}) };
  },
};
