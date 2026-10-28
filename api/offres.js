// Vercel serverless function: GET /api/offres (offers and quotas the app shows, see lib/quota.js)
import { handleOffres } from "../lib/quota.js";

export default function handler(req, res) {
  if (req.method !== "GET") { res.statusCode = 405; return res.end(); }
  return handleOffres(req, res);
}
