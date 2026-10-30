import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, check, consume, emptyUsage, paywallFor, perMonth, sanitizeConfig } from "../plans.ts";

const now = new Date("2026-11-03T10:00:00Z");

test("the launch offers: weekly, monthly, yearly preselected; the month stays the better deal than the week", () => {
  assert.deepEqual(DEFAULT_CONFIG.offres.map(o => [o.id, o.prix]), [["an", "69,99 €"], ["mois", "9,99 €"], ["semaine", "4,99 €"]]);
  assert.equal(DEFAULT_CONFIG.preselection, "an");
  assert.equal(perMonth("3,99 €", "semaine"), 17.29);
  assert.equal(perMonth("49,99 €", "an"), 4.17);
  assert.ok(perMonth("6,99 €", "mois")! < perMonth("3,99 €", "semaine")!);
});

test("a remote config is checked: bad offers dropped, quotas bounded", () => {
  const c = sanitizeConfig({ offres: [{ id: "mois", produit: "mada.pro.mois", prix: "8,99 €" }, { id: "vie", produit: "x" }, { id: "an", produit: "../hack" }], gratuit: { montages: 999 }, preselection: "semaine" });
  assert.deepEqual(c.offres.map(o => o.id), ["mois"]);
  assert.equal(c.preselection, "mois");
  assert.equal(c.gratuit.montages, 10);
  assert.equal(sanitizeConfig({ gratuit: { montages: 1 } }).gratuit.montages, 1, "on peut passer à 1 montage offert");
  assert.deepEqual(sanitizeConfig(null).offres, DEFAULT_CONFIG.offres);
});

test("1 free montage for life, retouches included on them; Pro counts per month", () => {
  let u = emptyUsage("2026-11");
  assert.equal(check("retouche", false, u, DEFAULT_CONFIG, now).ok, false, "rien créé : pas de retouche offerte");
  assert.equal(DEFAULT_CONFIG.gratuit.montages, 1, "Ryan, 30 octobre : 1 seul montage gratuit");
  assert.ok(check("montage", false, u, DEFAULT_CONFIG, now).ok); u = consume("montage", false, u, now);
  assert.deepEqual(check("montage", false, u, DEFAULT_CONFIG, now), { ok: false, restant: 0, raison: "gratuit_epuise" });
  assert.ok(check("retouche", false, u, DEFAULT_CONFIG, now).ok);
  assert.ok(check("visuel", false, u, DEFAULT_CONFIG, now).ok, "les visuels ont leur propre compteur");
  let p = emptyUsage("2026-10");
  for (let i = 0; i < 20; i++) p = consume("montage", true, p, now);
  assert.equal(check("montage", true, p, DEFAULT_CONFIG, now).raison, "plafond_pro");
  assert.ok(check("montage", true, p, DEFAULT_CONFIG, new Date("2026-12-01T00:00:00Z")).ok, "le compteur Pro repart chaque mois");
});

test("the paywall comes after the value: soft once after a kept version, blocking only for a new AI creation", () => {
  assert.equal(paywallFor("version_gardee", { pro: false, seen: false }), "doux");
  assert.equal(paywallFor("version_gardee", { pro: false, seen: true }), null);
  assert.equal(paywallFor("nouvelle_creation", { pro: false, seen: true, verdict: { ok: true, restant: 2, raison: null } }), null);
  assert.equal(paywallFor("nouvelle_creation", { pro: false, seen: true, verdict: { ok: false, restant: 0, raison: "gratuit_epuise" } }), "bloquant");
  assert.equal(paywallFor("version_gardee", { pro: true, seen: false }), null);
});
