// CORS for the mobile app: the iOS / Android shell loads MaDA from
// capacitor://localhost or https://localhost and calls this server.
const APP_ORIGINS = ["capacitor://localhost", "ionic://localhost", "https://localhost", "http://localhost"];

export function cors(req, res) {
  const origin = req.headers.origin;
  const extra = String(process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (origin && (APP_ORIGINS.includes(origin) || extra.includes(origin))) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
    res.setHeader("access-control-allow-headers", "content-type, x-rr-access, x-mada-user");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    res.setHeader("access-control-max-age", "86400");
  }
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return true; }
  return false;
}
