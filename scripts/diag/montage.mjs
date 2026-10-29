// Checks the production /api/montage from outside, the way the iPhone calls it (build 12, 29 octobre :
// « Pas de connexion au serveur » with no log Ryan could read). Prints each answer; sends no personal media,
// only two drawn test frames. Run by .github/workflows/diag-serveur.yml with MADA_API_URL and MADA_ACCESS.
import { readFileSync } from "node:fs";

const url = (process.env.MADA_API_URL || "https://reelryan.vercel.app").replace(/\/$/, "");
const headers = { "content-type": "application/json", "x-mada-device": `diag-${Date.now().toString(36)}`, ...(process.env.MADA_ACCESS ? { "x-rr-access": process.env.MADA_ACCESS } : {}) };
const frames = JSON.parse(readFileSync(new URL("./frames.json", import.meta.url), "utf8"));

async function call(label, init) {
  const started = Date.now();
  try {
    const res = await fetch(`${url}${init.path}`, { method: init.method || "POST", headers, body: init.body });
    const text = await res.text();
    console.log(`\n== ${label} : HTTP ${res.status} (${res.headers.get("content-type")}) en ${((Date.now() - started) / 1000).toFixed(1)} s`);
    console.log(text.length > 3000 ? text.slice(0, 1500) + "\n…\n" + text.slice(-1500) : text);
  } catch (e) {
    console.log(`\n== ${label} : échec réseau en ${((Date.now() - started) / 1000).toFixed(1)} s : ${e.cause?.code || ""} ${e.message}`);
  }
}

const rushes = [{ id: "r1", duree: 4, photo: false, son: false, largeur: 1080, hauteur: 1920 }, { id: "r2", duree: 5, photo: false, son: false, largeur: 1080, hauteur: 1920 }];
const images = frames.map((data, i) => ({ id: `f${i + 1}`, rush: `r${i + 1}`, temps: 1, data }));

await call("1. Offres (le serveur répond-il ?)", { path: "/api/offres", method: "GET" });
await call("2. Montage vide (la fonction démarre-t-elle ?)", { path: "/api/montage", body: "{}" });
await call("3. Montage de 2 Mo (taille d'un vrai envoi)", { path: "/api/montage", body: JSON.stringify({ brief: "test", rushes, images: [{ ...images[0], data: "A".repeat(2_000_000) }] }) });
if (process.env.DIAG_REEL === "1") {
  await call("4. Vrai petit montage (appelle l'IA)", { path: "/api/montage", body: JSON.stringify({ brief: "Une soirée au restaurant, ambiance chic", duree: 8, variantes: 2, plateformes: ["reels"], rushes, images }) });
}
