import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetch } from "expo/fetch";
import { DEFAULT_CONFIG, check, consume, emptyUsage, monthOf, sanitizeConfig, type Config, type Kind, type Usage, type Verdict } from "../../../core/plans";
import { SERVER, serverHeaders } from "../flow/server";
import { activeProducts } from "./storekit";

// What the person may still create with the AI (core/plans.ts). The server keeps the real count
// (lib/quota.js); the phone keeps a copy to show the counter and to work offline.
export type Plans = { config: Config; usage: Usage; pro: boolean; paywallSeen: boolean };
const KEY = "mada.plans.v1";

export async function loadPlans(): Promise<Plans> {
  let saved: Partial<Plans> = {};
  try { saved = JSON.parse((await AsyncStorage.getItem(KEY)) ?? "{}"); } catch { saved = {}; }
  let config = sanitizeConfig(saved.config ?? DEFAULT_CONFIG);
  if (SERVER.url) {
    try { const r = await fetch(`${SERVER.url}/api/offres`); if (r.ok) config = sanitizeConfig(await r.json()); } catch { /* the saved config */ }
  }
  let pro = !!saved.pro;
  try { const active = await activeProducts(); if (active.length) pro = active.some(id => config.offres.some(o => o.produit === id)); } catch { /* keep */ }
  return { config, usage: saved.usage ?? emptyUsage(monthOf(new Date())), pro, paywallSeen: !!saved.paywallSeen };
}
export async function savePlans(p: Plans) { try { await AsyncStorage.setItem(KEY, JSON.stringify(p)); } catch { /* the counter on the server still holds */ } }

export const verdict = (p: Plans, kind: Kind): Verdict => check(kind, p.pro, p.usage, p.config);
export const record = (p: Plans, kind: Kind): Plans => ({ ...p, usage: consume(kind, p.pro, p.usage) });
// Keeps the server headers in step with Pro (x-mada-pro, see lib/quota.js).
export const proHeader = (p: Plans) => serverHeaders.setPro(p.pro);
