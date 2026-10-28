// Vercel serverless function: POST /api/voix (voice-over: write the text, or read it, see lib/voix.js)
import { readJson } from "../lib/claude.js";
import { handleVoix } from "../lib/voix.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  let body;
  try { body = await readJson(req, 20_000); } catch {
    res.statusCode = 413; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "prompt_too_large", message: "Texte trop long." }));
  }
  return handleVoix(req, res, body);
}
