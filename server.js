// Standalone Node server (local dev, Render, Railway, VPS…): serves public/ and /api/generate.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleGenerate, readJson } from "./lib/claude.js";
import { handleMontage } from "./lib/montage.js";
import { handleAdn } from "./lib/adn.js";
import { handleRetouche } from "./lib/retouche.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "public");
const PORT = Number(process.env.PORT) || 3000;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/generate" || url.pathname === "/api/montage" || url.pathname === "/api/adn" || url.pathname === "/api/retouche") {
    if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
    let body;
    try { body = await readJson(req, url.pathname === "/api/montage" ? 4_500_000 : url.pathname === "/api/adn" || url.pathname === "/api/retouche" ? 200_000 : undefined); } catch {
      res.statusCode = 413; res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ error: "prompt_too_large", message: "Images trop lourdes." }));
    }
    if (url.pathname === "/api/adn") return handleAdn(req, res, body);
    if (url.pathname === "/api/retouche") return handleRetouche(req, res, body);
    return url.pathname === "/api/montage" ? handleMontage(req, res, body) : handleGenerate(req, res, body);
  }
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  let file = path.join(root, p || "index.html");
  if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
  try { if ((await stat(file)).isDirectory()) file = path.join(file, "index.html"); } catch { file = path.join(root, "index.html"); }
  try {
    const data = await readFile(file);
    res.setHeader("content-type", TYPES[path.extname(file)] || "application/octet-stream");
    res.end(data);
  } catch { res.statusCode = 404; res.end("Introuvable"); }
}).listen(PORT, () => console.log(`MaDA sur http://localhost:${PORT}`));
