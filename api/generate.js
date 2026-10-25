// Vercel serverless function: POST /api/generate
import { handleGenerate, readJson } from "../lib/claude.js";
import { cors } from "../lib/cors.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  let body;
  try { body = await readJson(req); } catch {
    res.statusCode = 413; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "prompt_too_large", message: "Images trop lourdes." }));
  }
  return handleGenerate(req, res, body);
}
