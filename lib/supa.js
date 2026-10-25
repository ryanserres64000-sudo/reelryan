// Minimal Supabase access for the server: check a user's session token,
// read and write server-only tables with the service key, storage, and
// deleting an account. No SDK: plain REST calls.
const env = () => ({ url: String(process.env.SUPABASE_URL || "").replace(/\/+$/, ""), anon: process.env.SUPABASE_ANON_KEY || "", service: process.env.SUPABASE_SERVICE_ROLE_KEY || "" });

export const supaReady = () => { const e = env(); return !!(e.url && e.anon); };
export const supaAdminReady = () => { const e = env(); return !!(e.url && e.service); };
export const supaPublic = () => { const e = env(); return supaReady() ? { url: e.url, anonKey: e.anon } : null; };

// The signed-in user behind "Authorization: Bearer <access token>", or null.
export async function authUser(req) {
  const h = String(req.headers.authorization || "");
  if (!h.startsWith("Bearer ") || !supaReady()) return null;
  const e = env();
  try {
    const r = await fetch(e.url + "/auth/v1/user", { headers: { apikey: e.anon, authorization: h } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch { return null; }
}

function admin(extra = {}) { const e = env(); return { apikey: e.service, authorization: "Bearer " + e.service, ...extra }; }

export async function rest(path, { method = "GET", body, prefer } = {}) {
  const e = env();
  const r = await fetch(e.url + "/rest/v1/" + path, { method, headers: admin({ "content-type": "application/json", ...(prefer ? { prefer } : {}) }), body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new Error("supabase " + r.status + " " + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

export async function storageSignedUrl(bucket, path, expiresIn = 3600) {
  const e = env();
  const r = await fetch(`${e.url}/storage/v1/object/sign/${bucket}/${path}`, { method: "POST", headers: admin({ "content-type": "application/json" }), body: JSON.stringify({ expiresIn }) });
  if (!r.ok) throw new Error("sign " + r.status);
  const j = await r.json();
  return e.url + "/storage/v1" + (j.signedURL || j.signedUrl);
}

export async function storageDownload(bucket, path) {
  const e = env();
  const r = await fetch(`${e.url}/storage/v1/object/${bucket}/${path}`, { headers: admin() });
  if (!r.ok) throw new Error("download " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

export async function storageRemove(bucket, paths) {
  const e = env();
  try { await fetch(`${e.url}/storage/v1/object/${bucket}`, { method: "DELETE", headers: admin({ "content-type": "application/json" }), body: JSON.stringify({ prefixes: paths }) }); } catch { }
}

export async function storageList(bucket, prefix) {
  const e = env();
  const r = await fetch(`${e.url}/storage/v1/object/list/${bucket}`, { method: "POST", headers: admin({ "content-type": "application/json" }), body: JSON.stringify({ prefix, limit: 1000 }) });
  return r.ok ? r.json() : [];
}

export async function deleteUser(id) {
  const e = env();
  const r = await fetch(`${e.url}/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: "DELETE", headers: admin() });
  if (!r.ok && r.status !== 404) throw new Error("delete user " + r.status);
}
