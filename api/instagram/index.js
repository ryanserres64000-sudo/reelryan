// Vercel serverless function: /api/instagram (connect, read the Reels and their views, disconnect,
// read a screenshot of the statistics; see lib/instagram.js)
import { readJson } from "../../lib/claude.js";
import { handleInstagram } from "../../lib/instagram.js";

export default async function handler(req, res) {
  let body = null;
  if (req.method === "POST") {
    try { body = await readJson(req, 6_000_000); } catch {
      res.statusCode = 413; res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ error: "prompt_too_large", message: "Image trop lourde." }));
    }
  }
  return handleInstagram(req, res, body);
}
