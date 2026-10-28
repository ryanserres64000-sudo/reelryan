// Vercel serverless function: POST /api/achat (Apple-signed purchases checked by the server, see lib/apple.js)
import { checkAccess, readJson } from "../lib/claude.js";
import { handleAchat } from "../lib/apple.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  if (!checkAccess(req)) { res.statusCode = 401; return res.end(); }
  let body;
  try { body = await readJson(req, 100_000); } catch { res.statusCode = 413; return res.end(); }
  return handleAchat(req, res, body);
}
