// Vercel serverless function: GET /api/status (Pro status, enabled services)
import { handleStatus } from "../lib/pro.js";
import { cors } from "../lib/cors.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  return handleStatus(req, res);
}
