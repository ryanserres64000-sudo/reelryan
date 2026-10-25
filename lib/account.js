// Account deletion (required by the App Store and Google Play): removes the
// user's files, rows (cascade) and sign-in.
import { authUser, deleteUser, supaAdminReady, storageList, storageRemove } from "./supa.js";

export async function handleAccountDelete(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (!supaAdminReady()) { res.statusCode = 503; return res.end(JSON.stringify({ error: "accounts_not_configured" })); }
  const user = await authUser(req);
  if (!user) { res.statusCode = 401; return res.end(JSON.stringify({ error: "login_required" })); }
  try {
    const files = await storageList("publish", user.id);
    if (Array.isArray(files) && files.length) await storageRemove("publish", files.map(f => `${user.id}/${f.name}`));
    await deleteUser(user.id);
    res.end(JSON.stringify({ ok: true }));
  } catch (e) {
    console.error("account delete:", e.message);
    res.statusCode = 502; res.end(JSON.stringify({ error: "server_error" }));
  }
}
