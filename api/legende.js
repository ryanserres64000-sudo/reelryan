// Vercel serverless function: POST /api/legende (the post's caption written by the AI, see lib/legende.js)
import { readJson } from "../lib/claude.js";
import { handleLegende } from "../lib/legende.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  let body;
  try { body = await readJson(req, 100_000); } catch {
    res.statusCode = 413; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "prompt_too_large", message: "Montage trop lourd." }));
  }
  return handleLegende(req, res, body);
}
