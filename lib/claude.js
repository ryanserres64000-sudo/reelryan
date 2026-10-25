// Shared AI handler: receives { prompt, images: [{ type, data }] } and streams
// newline-delimited JSON back: {"t":"…"} per text chunk, then {"done":true}
// or {"error":"code","message":"…"}.
import Anthropic from "@anthropic-ai/sdk";
import { allowAI } from "./pro.js";

const MODEL = process.env.RR_MODEL || "claude-opus-5-5";
const EFFORT = process.env.RR_EFFORT || "medium";
const MAX_IMAGES = 12;
const MAX_PER_HOUR = Number(process.env.MAX_PER_HOUR) || 60;
const MAX_PROMPT_CHARS = 120000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

let client;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// Best-effort per-visitor limit (memory of one server instance).
const hits = new Map();
function overLimit(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "anon").split(",")[0].trim();
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  if (list.length >= MAX_PER_HOUR) { hits.set(ip, list); return true; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

export function checkAccess(req) {
  const code = process.env.APP_PASSWORD;
  if (!code) return true;
  return req.headers["x-rr-access"] === code;
}

function validate(body) {
  if (!body || typeof body.prompt !== "string" || !body.prompt.trim()) return "Requête vide.";
  if (body.prompt.length > MAX_PROMPT_CHARS) return "Demande trop longue.";
  const imgs = Array.isArray(body.images) ? body.images : [];
  if (imgs.length > MAX_IMAGES) return "Trop d'images.";
  for (const i of imgs) if (!i || !IMAGE_TYPES.has(i.type) || typeof i.data !== "string") return "Image invalide.";
  return null;
}

function buildRequest(body, withFallback) {
  const content = [
    ...(body.images || []).map(i => ({ type: "image", source: { type: "base64", media_type: i.type, data: i.data } })),
    { type: "text", text: body.prompt + "\n\nRéponds uniquement avec le JSON demandé, sans texte autour ni bloc de code." }
  ];
  const req = {
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT },
    messages: [{ role: "user", content }]
  };
  if (withFallback) { req.betas = ["server-side-fallback-2026-07-01"]; req.fallbacks = "default"; }
  return req;
}

function errorCode(e) {
  if (e instanceof Anthropic.RateLimitError) return "rate_limited";
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return "server_config";
  if (e instanceof Anthropic.APIConnectionError) return "network";
  if (e instanceof Anthropic.APIError && e.status === 529) return "rate_limited";
  if (e instanceof Anthropic.BadRequestError && /image/i.test(e.message || "")) return "image_rejected";
  if (e instanceof Anthropic.BadRequestError && /too long|too large|prompt is too/i.test(e.message || "")) return "prompt_too_large";
  return "server_error";
}

export async function handleGenerate(req, res, body) {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.statusCode = 500; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "server_config", message: "ANTHROPIC_API_KEY manquante sur le serveur." }));
  }
  if (!checkAccess(req)) {
    res.statusCode = 401; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "unauthorized", message: "Code d'accès incorrect." }));
  }
  if (overLimit(req)) {
    res.statusCode = 429; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "rate_limited", message: "Trop de demandes." }));
  }
  const bad = validate(body);
  if (bad) {
    res.statusCode = 400; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: /image/i.test(bad) ? "image_rejected" : "prompt_too_large", message: bad }));
  }
  if (!(await allowAI(req))) {
    res.statusCode = 402; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "pro_required", message: "Limite gratuite du jour atteinte." }));
  }

  res.statusCode = 200;
  res.setHeader("content-type", "application/x-ndjson; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-accel-buffering", "no");
  const send = o => res.write(JSON.stringify(o) + "\n");

  const abort = new AbortController();
  res.on("close", () => { if (!res.writableEnded) abort.abort(); });

  const run = async withFallback => {
    let sent = false;
    const stream = getClient().beta.messages.stream(buildRequest(body, withFallback), { signal: abort.signal });
    stream.on("text", t => { sent = true; send({ t }); });
    try {
      const msg = await stream.finalMessage();
      return { msg };
    } catch (e) {
      return { e, sent };
    }
  };

  let r = await run(true);
  // Older API setups may reject the fallback beta: retry once without it.
  if (r.e && !r.sent && r.e instanceof Anthropic.BadRequestError && /fallback/i.test(r.e.message || "")) r = await run(false);

  if (r.e) {
    if (!abort.signal.aborted) { console.error("generate failed:", r.e.status, r.e.message); send({ error: errorCode(r.e) }); }
  } else if (r.msg.stop_reason === "refusal") {
    send({ error: "refused" });
  } else if (r.msg.stop_reason === "max_tokens") {
    send({ error: "invalid_json" });
  } else {
    send({ done: true });
  }
  res.end();
}

export async function readJson(req, limit = 4_000_000) {
  if (req.body && typeof req.body === "object") return req.body;
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw Object.assign(new Error("too_large"), { code: "too_large" }); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return null; }
}
