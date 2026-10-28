// Vercel serverless function: DELETE /api/compte (account deletion, see lib/quota.js)
import { checkAccess } from "../lib/claude.js";
import { handleCompte } from "../lib/quota.js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") { res.statusCode = 405; return res.end(); }
  if (!checkAccess(req)) { res.statusCode = 401; return res.end(); }
  return handleCompte(req, res);
}
