// Vercel serverless function: POST /api/entretien (one sign-up question, worded for the person, see lib/entretien.js)
import { readJson } from "../lib/claude.js";
import { handleEntretien } from "../lib/entretien.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  let body;
  try { body = await readJson(req, 40_000); } catch {
    res.statusCode = 413; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "prompt_too_large", message: "Réponses trop longues." }));
  }
  return handleEntretien(req, res, body);
}
