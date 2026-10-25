// Vercel serverless function: /api/social/<action> (rewritten to ?action=<action>)
// actions: accounts, start, callback, disconnect, creator, publish, stats
import { handleSocial } from "../lib/social.js";
import { readJson } from "../lib/claude.js";
import { cors } from "../lib/cors.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const url = new URL(req.url, "http://x");
  const action = url.searchParams.get("action") || url.pathname.split("/").filter(Boolean).pop();
  return handleSocial(req, res, action, readJson);
}
