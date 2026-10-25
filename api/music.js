// Vercel serverless function: GET /api/music?q=…&mood=… (search) or ?file=jamendo:123 (audio)
import { handleMusic } from "../lib/music.js";
import { cors } from "../lib/cors.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "GET") { res.statusCode = 405; return res.end(); }
  return handleMusic(req, res, new URL(req.url, "http://x"));
}
