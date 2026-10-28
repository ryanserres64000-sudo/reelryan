// Vercel serverless function: GET /api/instagram/callback (Instagram sends the person back here after
// « Autoriser »; lib/instagram.js keeps the token and returns to the app)
import { handleCallback } from "../../lib/instagram.js";

export default async function handler(req, res) {
  if (req.method !== "GET") { res.statusCode = 405; return res.end(); }
  return handleCallback(req, res);
}
