// The MaDa server (Vercel or server.js). Unset, the app runs offline with sample answers:
// EXPO_PUBLIC_MADA_API=https://… and EXPO_PUBLIC_MADA_ACCESS=<APP_PASSWORD> in app/.env turn it on.
export const SERVER = { url: process.env.EXPO_PUBLIC_MADA_API || null, access: process.env.EXPO_PUBLIC_MADA_ACCESS || undefined };
