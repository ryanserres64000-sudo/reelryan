// Vercel serverless function: /api/auth (sign-in with Apple, Google or an e-mail code; see lib/auth.js)
import { readJson } from "../../lib/claude.js";
import { handleAuth } from "../../lib/auth.js";

export default async function handler(req, res) {
  let body = null;
  if (req.method === "POST") {
    try { body = await readJson(req, 20_000); } catch { res.statusCode = 413; return res.end(); }
  }
  return handleAuth(req, res, body);
}
