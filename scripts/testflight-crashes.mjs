// Prints the crash reports that testers sent from TestFlight (App Store Connect API,
// betaFeedbackCrashSubmissions), with their crash logs. Run by .github/workflows/crashes.yml with the
// App Store Connect key already used to send builds to TestFlight. Usage: node scripts/testflight-crashes.mjs
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const { ASC_KEY_PATH, ASC_KEY_ID, ASC_ISSUER_ID, ASC_APP_ID = "6827990828" } = process.env;
const b64 = v => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: ASC_KEY_ID, typ: "JWT" });
  const body = b64({ iss: ASC_ISSUER_ID, iat: now, exp: now + 900, aud: "appstoreconnect-v1" });
  const sig = createSign("SHA256").update(`${head}.${body}`).sign({ key: readFileSync(ASC_KEY_PATH, "utf8"), dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${sig.toString("base64url")}`;
}
const auth = { authorization: `Bearer ${token()}` };
async function get(path) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, { headers: auth });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${path}\n${text.slice(0, 2000)}`);
  return JSON.parse(text);
}

const list = await get(`/v1/apps/${ASC_APP_ID}/betaFeedbackCrashSubmissions?limit=10&sort=-createdDate`);
console.log(`${list.data.length} rapport(s) de plantage`);
for (const s of list.data) {
  const a = s.attributes ?? {};
  console.log(`\n===== ${a.createdDate} · ${a.deviceModel ?? ""} iOS ${a.osVersion ?? ""} · ${a.comment ?? ""}`);
  try {
    const log = await get(`/v1/betaFeedbackCrashSubmissions/${s.id}/crashLog`);
    console.log(log.data?.attributes?.logText ?? JSON.stringify(log).slice(0, 20000));
  } catch (e) { console.log(String(e)); }
}
