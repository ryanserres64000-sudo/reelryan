// Offers, free quota and the paywall moment (étude, ch. 8 §1-5 ; décisions de Ryan du 28 octobre :
// 3,99 €/semaine, 6,99 €/mois, 49,99 €/an au lancement, 3 montages IA offerts à chaque inscription).
// The server sends this config (GET /api/offres), so prices, order and quotas change without an app
// update; the defaults below are used when it cannot be reached. On the iPhone, the price shown comes
// from StoreKit (localised, the one Apple charges) and `prix` here is only the fallback.

export const PERIODES = ["semaine", "mois", "an"] as const;
export type Periode = (typeof PERIODES)[number];
export type Offre = { id: Periode; produit: string; prix: string; periode: Periode; badge: string | null };
export type Config = {
  version: 1; lancement: boolean; preselection: Periode; offres: Offre[];
  gratuit: { montages: number; visuels: number; secondes: number; voix: number };
  pro: { montages: number; visuels: number; retouches: number; secondes: number; voix: number };
};

export const DEFAULT_CONFIG: Config = {
  version: 1, lancement: true, preselection: "an",
  offres: [
    { id: "an", produit: "mada.pro.an", prix: "49,99 €", periode: "an", badge: "-40 %" },
    { id: "mois", produit: "mada.pro.mois", prix: "6,99 €", periode: "mois", badge: null },
    { id: "semaine", produit: "mada.pro.semaine", prix: "3,99 €", periode: "semaine", badge: null },
  ],
  // ch. 8 §2 : 3 montages on rushes of 90 s at most. Visuals cost about half a montage, so 3 more.
  // Voice-overs (étape 5 de la refonte) cost 2 to 5 cents each with ElevenLabs: 3 offered, 30 a month in Pro.
  gratuit: { montages: 3, visuels: 3, secondes: 90, voix: 3 },
  // ch. 8 §2 et §5 : 30 montages, 150 retouches a month, rushes of 10 min.
  pro: { montages: 30, visuels: 60, retouches: 150, secondes: 600, voix: 30 },
};

const int = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : d);
const o = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {});

// The config as the server or a remote file wrote it, checked: a typo never gives away unlimited AI.
export function sanitizeConfig(raw: unknown): Config {
  const r = o(raw), g = o(r.gratuit), p = o(r.pro), d = DEFAULT_CONFIG;
  const offres = (Array.isArray(r.offres) ? r.offres : []).map(o).filter(x => (PERIODES as readonly string[]).includes(x.id) && typeof x.produit === "string" && /^[\w.]{3,100}$/.test(x.produit))
    .map(x => ({ id: x.id as Periode, produit: x.produit, prix: typeof x.prix === "string" ? x.prix.slice(0, 20) : "", periode: x.id as Periode, badge: typeof x.badge === "string" && x.badge ? x.badge.slice(0, 20) : null }));
  const list = offres.length ? [...new Map(offres.map(x => [x.id, x])).values()] : d.offres;
  return {
    version: 1, lancement: r.lancement !== false,
    preselection: list.some(x => x.id === r.preselection) ? r.preselection : list.some(x => x.id === "an") ? "an" : list[0].id,
    offres: list,
    gratuit: { montages: int(g.montages, d.gratuit.montages, 0, 10), visuels: int(g.visuels, d.gratuit.visuels, 0, 20), secondes: int(g.secondes, d.gratuit.secondes, 30, 180), voix: int(g.voix, d.gratuit.voix, 0, 20) },
    pro: { montages: int(p.montages, d.pro.montages, 1, 200), visuels: int(p.visuels, d.pro.visuels, 1, 500), retouches: int(p.retouches, d.pro.retouches, 1, 1000), secondes: int(p.secondes, d.pro.secondes, 60, 1800), voix: int(p.voix, d.pro.voix, 0, 300) },
  };
}

// What a price costs over a month, to show that the month remains the best choice (plan du 28 octobre).
export function perMonth(prix: string, periode: Periode): number | null {
  const n = Number(prix.replace(/[^\d,.]/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round((periode === "semaine" ? (n * 52) / 12 : periode === "an" ? n / 12 : n) * 100) / 100;
}

// ---------- Counting what the AI does ----------

export type Kind = "montage" | "visuel" | "retouche" | "voix";
// Free uses are counted once for the account's life (an essai sans carte, ch. 8 §1); Pro uses per month.
// `voix` came later: absent in older counters, read as 0.
export type Usage = { gratuit: { montages: number; visuels: number; voix?: number }; mois: string; pro: { montages: number; visuels: number; retouches: number; voix?: number } };
export const emptyUsage = (mois: string): Usage => ({ gratuit: { montages: 0, visuels: 0, voix: 0 }, mois, pro: { montages: 0, visuels: 0, retouches: 0, voix: 0 } });
const KEY = { montage: "montages", visuel: "visuels", retouche: "retouches", voix: "voix" } as const;
export const monthOf = (d: Date) => d.toISOString().slice(0, 7);

export type Verdict = { ok: boolean; restant: number; raison: "gratuit_epuise" | "plafond_pro" | null };
export function check(kind: Kind, pro: boolean, u: Usage, cfg: Config, now = new Date()): Verdict {
  const usage = u.mois === monthOf(now) ? u : { ...u, mois: monthOf(now), pro: emptyUsage("").pro };
  if (pro) {
    const k = KEY[kind], cap = cfg.pro[k], used = usage.pro[k] ?? 0;
    return { ok: used < cap, restant: Math.max(0, cap - used), raison: used < cap ? null : "plafond_pro" };
  }
  // A retouch of a free creation is included (ch. 8 §2 : « Incluses sur les 3 montages »).
  const made = usage.gratuit.montages + usage.gratuit.visuels > 0;
  if (kind === "retouche") return { ok: made, restant: made ? 1 : 0, raison: made ? null : "gratuit_epuise" };
  const k = kind === "montage" ? "montages" : kind === "visuel" ? "visuels" : "voix", cap = cfg.gratuit[k], used = usage.gratuit[k] ?? 0;
  return { ok: used < cap, restant: Math.max(0, cap - used), raison: used < cap ? null : "gratuit_epuise" };
}
export function consume(kind: Kind, pro: boolean, u: Usage, now = new Date()): Usage {
  const usage = u.mois === monthOf(now) ? u : { ...u, mois: monthOf(now), pro: emptyUsage("").pro };
  if (pro) { const k = KEY[kind]; return { ...usage, pro: { ...usage.pro, [k]: (usage.pro[k] ?? 0) + 1 } }; }
  if (kind === "retouche") return usage;
  const k = kind === "montage" ? "montages" : kind === "visuel" ? "visuels" : "voix";
  return { ...usage, gratuit: { ...usage.gratuit, [k]: (usage.gratuit[k] ?? 0) + 1 } };
}

// ---------- When the paywall shows ----------

// ch. 8 §1 « le paywall après la valeur » et ch. 7 : soft (it can be closed) right after the first
// result the person keeps, once; blocking only for a new AI creation when the free ones are used up.
// Manual editing, export and the brand carnet never hit a paywall (ch. 8 §2 : montage manuel illimité).
export type Moment = "version_gardee" | "nouvelle_creation";
export function paywallFor(m: Moment, s: { pro: boolean; seen: boolean; verdict?: Verdict }): "doux" | "bloquant" | null {
  if (s.pro) return null;
  if (m === "version_gardee") return s.seen ? null : "doux";
  return s.verdict && !s.verdict.ok ? "bloquant" : null;
}
