// Vercel serverless function: POST /api/affiche (the event poster read by AI, see lib/affiche.js)
import { readJson } from "../lib/claude.js";
import { handleAffiche } from "../lib/affiche.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  let body;
  try { body = await readJson(req, 1_500_000); } catch {
    res.statusCode = 413; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "prompt_too_large", message: "Affiche trop lourde." }));
  }
  return handleAffiche(req, res, body);
}
