import { requireOptionalNativeModule } from "expo";
import { fetch } from "expo/fetch";
import { SERVER, serverHeaders } from "../flow/server";

// StoreKit 2 through a small native module (CLAUDE.md : achats StoreKit dès la v1). It is written
// with the native part on a Mac; until then the app shows the offers from the config and says that
// buying works on the iPhone build only. Apple shows its own confirmation sheet and charges the price
// set in App Store Connect, so launch prices change there without an app update.
export type Product = { id: string; displayPrice: string };
type Native = {
  products(ids: string[]): Promise<Product[]>;
  purchase(id: string, appAccountToken: string): Promise<{ status: "success" | "cancelled" | "pending"; jws?: string }>;
  restore(): Promise<{ active: string[]; jws?: string[] }>;
  entitlements(): Promise<{ active: string[]; jws?: string[] }>;
};
const native = () => requireOptionalNativeModule<Native>("MadaStore");
export const canBuy = () => !!native();

export async function products(ids: string[]): Promise<Product[]> { return (await native()?.products(ids)) ?? []; }
// The signed transactions go to the server, which checks them with Apple's certificates and alone
// decides Pro for the AI quotas (lib/apple.js). A failed call keeps Pro on the phone; the next launch
// sends them again.
async function confirm(jws: string[] | undefined) {
  if (!SERVER.url || !jws?.length) return;
  try { await fetch(`${SERVER.url}/api/achat`, { method: "POST", headers: serverHeaders.get(), body: JSON.stringify({ jws }) }); } catch { /* next launch */ }
}
export async function purchase(id: string, device: string) {
  const m = native();
  if (!m) return { status: "unavailable" as const };
  const r = await m.purchase(id, device);
  if (r.status === "success") await confirm(r.jws ? [r.jws] : undefined);
  return r;
}
export async function restore(): Promise<string[]> { const r = await native()?.restore(); await confirm(r?.jws); return r?.active ?? []; }
export async function activeProducts(): Promise<string[]> { const r = await native()?.entitlements(); await confirm(r?.jws); return r?.active ?? []; }
