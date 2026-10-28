import { requireOptionalNativeModule } from "expo";

// StoreKit 2 through a small native module (CLAUDE.md : achats StoreKit dès la v1). It is written
// with the native part on a Mac; until then the app shows the offers from the config and says that
// buying works on the iPhone build only. Apple shows its own confirmation sheet and charges the price
// set in App Store Connect, so launch prices change there without an app update.
export type Product = { id: string; displayPrice: string };
type Native = {
  products(ids: string[]): Promise<Product[]>;
  purchase(id: string, appAccountToken: string): Promise<{ status: "success" | "cancelled" | "pending" }>;
  restore(): Promise<{ active: string[] }>;
  entitlements(): Promise<{ active: string[] }>;
};
const native = () => requireOptionalNativeModule<Native>("MadaStore");
export const canBuy = () => !!native();

export async function products(ids: string[]): Promise<Product[]> { return (await native()?.products(ids)) ?? []; }
export async function purchase(id: string, device: string) { const m = native(); return m ? m.purchase(id, device) : { status: "unavailable" as const }; }
export async function restore(): Promise<string[]> { return (await native()?.restore())?.active ?? []; }
export async function activeProducts(): Promise<string[]> { return (await native()?.entitlements())?.active ?? []; }
