// Vercel serverless function: POST /api/retouche (an AI correction of an edit, see lib/retouche.js)
import { readJson } from "../lib/claude.js";
import { handleRetouche } from "../lib/retouche.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  let body;
  try { body = await readJson(req, 200_000); } catch {
    res.statusCode = 413; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "prompt_too_large", message: "Montage trop lourd." }));
  }
  return handleRetouche(req, res, body);
}
