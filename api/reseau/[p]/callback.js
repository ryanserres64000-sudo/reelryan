// Vercel serverless function: GET /api/reseau/<p>/callback (the platform sends the person back here
// after « Autoriser »; lib/reseaux.js keeps the tokens and returns to the app)
import { handleReseauCallback } from "../../../lib/reseaux.js";

export default async function handler(req, res) {
  if (req.method !== "GET") { res.statusCode = 405; return res.end(); }
  return handleReseauCallback(req, res, String(req.query?.p || ""));
}
