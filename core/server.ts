// The server address the app is built with (EXPO_PUBLIC_MADA_API, from the GitHub secret MADA_API_URL).
// Build 12 (29 octobre) : the secret could not be read as an address, so every call to the server failed
// and the montage said « Pas de connexion ». Spaces, quotes, a missing https:// or a path such as /api
// are forgiven; anything that is still not a web address gives null (the app then says the server is missing).
export function serverUrl(raw: string | undefined | null): string | null {
  let s = (raw ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s.replace(/^\/+/, "")}`;
  try {
    const u = new URL(s);
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}
