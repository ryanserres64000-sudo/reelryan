// Music gallery: search a licensed catalogue and stream tracks through this
// server, so the app never holds provider keys and audio is same-origin
// (needed for tempo detection). Provider: Jamendo (JAMENDO_CLIENT_ID).
// Another licensed provider (Epidemic Sound, Soundstripe) plugs in by adding
// a search/file pair to PROVIDERS with the same track shape.
import { checkAccess } from "./claude.js";

const MOODS = {
  tendance: { order: "popularity_week" },
  chill: { tags: "chillout lounge" },
  energie: { tags: "energetic" },
  luxe: { tags: "jazz lounge" },
  soiree: { tags: "dance house" },
  rap: { tags: "hiphop" },
  electro: { tags: "electronic" },
  pop: { tags: "pop" },
  cinematique: { tags: "cinematic soundtrack" },
  acoustique: { tags: "acoustic" }
};

const jamendo = {
  ready: () => !!process.env.JAMENDO_CLIENT_ID,
  async search({ q, mood, offset }) {
    const p = new URLSearchParams({ client_id: process.env.JAMENDO_CLIENT_ID, format: "json", limit: "30", offset: String(offset || 0), include: "musicinfo licenses", audioformat: "mp32", imagesize: "200", order: "popularity_week" });
    const m = MOODS[mood];
    if (q) { p.set("search", q); p.set("order", "relevance"); }
    if (m && m.tags) p.set("fuzzytags", m.tags);
    if (m && m.order && !q) p.set("order", m.order);
    const r = await fetch("https://api.jamendo.com/v3.0/tracks/?" + p);
    if (!r.ok) throw new Error("jamendo " + r.status);
    const data = await r.json();
    return (data.results || []).map(t => ({
      id: "jamendo:" + t.id,
      title: t.name,
      artist: t.artist_name,
      duration: Number(t.duration) || 0,
      cover: t.image || t.album_image || "",
      tags: [...((t.musicinfo && t.musicinfo.tags && t.musicinfo.tags.genres) || []), ...((t.musicinfo && t.musicinfo.tags && t.musicinfo.tags.vartags) || [])].slice(0, 4),
      license: licenseName(t.license_ccurl),
      licenseUrl: t.license_ccurl || "",
      downloadable: t.audiodownload_allowed !== false,
      provider: "Jamendo"
    }));
  },
  async file(id) {
    const p = new URLSearchParams({ client_id: process.env.JAMENDO_CLIENT_ID, format: "json", id, audioformat: "mp32" });
    const r = await fetch("https://api.jamendo.com/v3.0/tracks/?" + p);
    if (!r.ok) throw new Error("jamendo " + r.status);
    const t = ((await r.json()).results || [])[0];
    return t && (t.audiodownload_allowed !== false && t.audiodownload ? t.audiodownload : t.audio);
  }
};

const PROVIDERS = { jamendo };

function licenseName(url) {
  const m = /licenses\/([a-z-]+)\//i.exec(url || "");
  return m ? "CC " + m[1].toUpperCase() : "Licence du fournisseur";
}

function json(res, status, o) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(o));
}

export async function handleMusic(req, res, url) {
  // <audio> elements cannot send headers, so the access code may come as ?k=.
  const k = url.searchParams.get("k");
  if (!checkAccess(req) && !(process.env.APP_PASSWORD && k === process.env.APP_PASSWORD)) return json(res, 401, { error: "unauthorized" });
  const provider = Object.values(PROVIDERS).find(p => p.ready());
  if (!provider) return json(res, 503, { error: "music_not_configured", message: "Aucun catalogue de musique n'est configuré sur le serveur (JAMENDO_CLIENT_ID)." });
  const fileId = url.searchParams.get("file");
  try {
    if (fileId) {
      const [name, id] = fileId.split(":");
      const p = PROVIDERS[name];
      if (!p || !/^\d+$/.test(id || "")) return json(res, 400, { error: "bad_request" });
      const src = await p.file(id);
      if (!src) return json(res, 404, { error: "not_found" });
      const r = await fetch(src);
      if (!r.ok || !r.body) return json(res, 502, { error: "provider_error" });
      res.statusCode = 200;
      res.setHeader("content-type", r.headers.get("content-type") || "audio/mpeg");
      const len = r.headers.get("content-length"); if (len) res.setHeader("content-length", len);
      res.setHeader("cache-control", "private, max-age=86400");
      for await (const chunk of r.body) res.write(chunk);
      return res.end();
    }
    const q = String(url.searchParams.get("q") || "").slice(0, 80).trim();
    const mood = String(url.searchParams.get("mood") || "");
    const offset = Math.max(0, Math.min(500, Number(url.searchParams.get("offset")) || 0));
    const tracks = await provider.search({ q, mood, offset });
    res.setHeader("cache-control", "public, max-age=600");
    return json(res, 200, { tracks, moods: Object.keys(MOODS) });
  } catch (e) {
    console.error("music failed:", e.message);
    if (!res.headersSent) return json(res, 502, { error: "provider_error" });
    res.end();
  }
}
