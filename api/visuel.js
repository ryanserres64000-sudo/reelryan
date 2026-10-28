// Vercel serverless function: POST /api/visuel (posters, posts, stories, flyers, menus, see lib/visuel.js)
import { readJson } from "../lib/claude.js";
import { handleVisuel } from "../lib/visuel.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  let body;
  try { body = await readJson(req, 1_000_000); } catch {
    res.statusCode = 413; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "prompt_too_large", message: "Images trop lourdes." }));
  }
  return handleVisuel(req, res, body);
}
