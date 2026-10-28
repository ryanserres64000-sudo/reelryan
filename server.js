// Standalone Node server (local dev, Render, Railway, VPS…): serves public/ and /api/generate.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleGenerate, readJson } from "./lib/claude.js";
import { handleMontage } from "./lib/montage.js";
import { handleAdn } from "./lib/adn.js";
import { handleRetouche } from "./lib/retouche.js";
import { handleVisuel } from "./lib/visuel.js";
import { handleVoix } from "./lib/voix.js";
import { handleCallback, handleInstagram } from "./lib/instagram.js";
import { handleReseau, handleReseauCallback } from "./lib/reseaux.js";
import { handleCompte, handleOffres, handleQuota } from "./lib/quota.js";
import { checkAccess } from "./lib/claude.js";
import { handleAchat, handleNotification } from "./lib/apple.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "public");
const PORT = Number(process.env.PORT) || 3000;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/offres") return req.method === "GET" ? handleOffres(req, res) : ((res.statusCode = 405), res.end());
  if (url.pathname === "/api/compte") {
    if (req.method !== "DELETE") { res.statusCode = 405; return res.end(); }
    if (!checkAccess(req)) { res.statusCode = 401; return res.end(); }
    return handleCompte(req, res);
  }
  if (url.pathname === "/api/quota") {
    if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
    if (!checkAccess(req)) { res.statusCode = 401; return res.end(); }
    return handleQuota(req, res);
  }
  if (url.pathname === "/api/achat" || url.pathname === "/api/apple/notifications") {
    if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
    if (url.pathname === "/api/achat" && !checkAccess(req)) { res.statusCode = 401; return res.end(); }
    let body;
    try { body = await readJson(req, 100_000); } catch { res.statusCode = 413; return res.end(); }
    return url.pathname === "/api/achat" ? handleAchat(req, res, body) : handleNotification(req, res, body);
  }
  if (url.pathname === "/api/instagram/callback") return handleCallback(req, res);
  const reseau = /^\/api\/reseau\/(tiktok|youtube)(\/callback)?$/.exec(url.pathname);
  if (reseau) {
    if (reseau[2]) return handleReseauCallback(req, res, reseau[1]);
    let body = null;
    if (req.method === "POST") { try { body = await readJson(req, 10_000); } catch { res.statusCode = 413; return res.end(); } }
    return handleReseau(req, res, body, reseau[1]);
  }
  if (url.pathname === "/api/instagram") {
    let body = null;
    if (req.method === "POST") { try { body = await readJson(req, 6_000_000); } catch { res.statusCode = 413; return res.end(); } }
    return handleInstagram(req, res, body);
  }
  if (url.pathname === "/api/generate" || url.pathname === "/api/montage" || url.pathname === "/api/adn" || url.pathname === "/api/retouche" || url.pathname === "/api/visuel" || url.pathname === "/api/voix") {
    if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
    let body;
    try { body = await readJson(req, url.pathname === "/api/montage" ? 4_500_000 : url.pathname === "/api/adn" || url.pathname === "/api/retouche" ? 200_000 : url.pathname === "/api/visuel" ? 1_000_000 : undefined); } catch {
      res.statusCode = 413; res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ error: "prompt_too_large", message: "Images trop lourdes." }));
    }
    if (url.pathname === "/api/adn") return handleAdn(req, res, body);
    if (url.pathname === "/api/retouche") return handleRetouche(req, res, body);
    if (url.pathname === "/api/visuel") return handleVisuel(req, res, body);
    if (url.pathname === "/api/voix") return handleVoix(req, res, body);
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
