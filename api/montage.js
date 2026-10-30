// Vercel serverless function: POST /api/montage (the iPhone app's AI edit, see lib/montage.js)
import { readJson } from "../lib/claude.js";
import { handleMontage, handleTravail } from "../lib/montage.js";

export default async function handler(req, res) {
  // GET ?travail=<id>: the result of an edit the phone left before it finished.
  if (req.method === "GET") return handleTravail(req, res, new URL(req.url, "http://x").searchParams.get("travail"));
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
  let body;
  try { body = await readJson(req, 4_500_000); } catch {
    res.statusCode = 413; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "prompt_too_large", message: "Images trop lourdes." }));
  }
  return handleMontage(req, res, body);
}
