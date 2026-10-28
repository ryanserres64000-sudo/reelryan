// Vercel serverless function: POST /api/apple/notifications (App Store Server Notifications V2, see
// lib/apple.js). Apple calls it without the app's access code: the signature is the check.
import { readJson } from "../../lib/claude.js";
import { handleNotification } from "../../lib/apple.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  let body;
  try { body = await readJson(req, 100_000); } catch { res.statusCode = 413; return res.end(); }
  return handleNotification(req, res, body);
}
