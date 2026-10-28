// Vercel serverless function: POST /api/adn (the brand DNA written at sign-up, see lib/adn.js)
import { readJson } from "../lib/claude.js";
import { handleAdn } from "../lib/adn.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  let body;
  try { body = await readJson(req, 200_000); } catch {
    res.statusCode = 413; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "prompt_too_large", message: "Logo trop lourd." }));
  }
  return handleAdn(req, res, body);
}
