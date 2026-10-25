// Builds www/ for the iOS / Android app (Capacitor) from public/.
// The app talks to the deployed MaDA server, set in MADA_API_BASE (.env).
import { cp, rm, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const www = path.join(root, "www");
const api = String(process.env.MADA_API_BASE || "").replace(/\/+$/, "");
if (!/^https:\/\/[^/]+/.test(api)) {
  console.error("MADA_API_BASE manquant : ajoute l'adresse de ton serveur MaDA dans .env, par exemple MADA_API_BASE=https://mada.vercel.app");
  process.exit(1);
}
const config = {
  MADA_API_BASE: api,
  MADA_RC_KEYS: { ios: process.env.MADA_RC_IOS_KEY || "", android: process.env.MADA_RC_ANDROID_KEY || "" }
};

await rm(www, { recursive: true, force: true });
await cp(path.join(root, "public"), www, { recursive: true });
await copyFile(path.join(root, "node_modules/@capacitor/core/dist/capacitor.js"), path.join(www, "capacitor.js"));

const file = path.join(www, "index.html");
const tag = '<script>window.__RR_STANDALONE=true</script><script src="/shim.js"></script>';
let html = await readFile(file, "utf8");
if (!html.includes(tag)) { console.error("public/index.html inattendu : relance cd source && python3 build.py"); process.exit(1); }
const inject = `<script>window.__RR_STANDALONE=true;${Object.entries(config).map(([k, v]) => `window.${k}=${JSON.stringify(v)};`).join("")}</script><script src="/capacitor.js"></script><script src="/shim.js"></script>`;
html = html.replace(tag, inject).replace('<link rel="manifest" href="/manifest.webmanifest">', "");
await writeFile(file, html);
console.log("www/ prêt pour", api);
