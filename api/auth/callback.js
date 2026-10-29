// Vercel serverless function: GET /api/auth/callback (Google sends the person back here; lib/auth.js
// opens the session and returns to the app)
import { handleAuthCallback } from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") { res.statusCode = 405; return res.end(); }
  return handleAuthCallback(req, res);
}
