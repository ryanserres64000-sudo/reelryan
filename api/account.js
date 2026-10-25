// Vercel serverless function: POST /api/account (delete the signed-in account)
import { handleAccountDelete } from "../lib/account.js";
import { cors } from "../lib/cors.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  return handleAccountDelete(req, res);
}
