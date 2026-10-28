// Vercel serverless function: /api/reseau/tiktok and /api/reseau/youtube (connect, read, disconnect;
// see lib/reseaux.js)
import { readJson } from "../../lib/claude.js";
import { handleReseau } from "../../lib/reseaux.js";

export default async function handler(req, res) {
  let body = null;
  if (req.method === "POST") { try { body = await readJson(req, 10_000); } catch { res.statusCode = 413; return res.end(); } }
  return handleReseau(req, res, body, String(req.query?.p || ""));
}
