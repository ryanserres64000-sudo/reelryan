// Vercel serverless function: POST /api/quota (what this device has left, see lib/quota.js)
import { checkAccess } from "../lib/claude.js";
import { handleQuota } from "../lib/quota.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  if (!checkAccess(req)) { res.statusCode = 401; return res.end(); }
  return handleQuota(req, res);
}
