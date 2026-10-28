import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyMemory } from "../corrections.ts";
import { MIN_FOR_ADVICE, addRule, bestHour, insights, isInstagramLink, matchReels, referenceKey, sanitizePosts } from "../insights.ts";

const post = (i: number, o: { vues: number; hour?: number; legende?: string; day?: number }) => ({
  id: `p${i}`, at: new Date(2026, 9, o.day ?? (1 + i), o.hour ?? 12, 0).toISOString(), type: "reel", legende: o.legende ?? "Le plat du jour", vues: o.vues,
});

test("posts are cleaned: dates, numbers written with spaces, only Instagram links", () => {
  const p = sanitizePosts([{ id: "a", at: "2026-10-01T10:00:00Z", vues: "2 400", lien: "https://evil.example/x" }, { at: "pas une date" }, { id: "b", at: "2026-10-03T10:00:00Z", vues: -3, lien: "https://www.instagram.com/reel/abc/" }]);
  assert.equal(p.length, 2);
  assert.equal(p[0].id, "b"); assert.equal(p[0].vues, null); assert.equal(p[0].lien, "https://www.instagram.com/reel/abc/");
  assert.equal(p[1].vues, 2400); assert.equal(p[1].lien, null);
});

test("no advice before five Reels, and it says how many it has", () => {
  const r = insights(sanitizePosts([post(1, { vues: 100 }), post(2, { vues: 200 })]));
  assert.equal(r.items.length, 0);
  assert.match(r.attente!, new RegExp(`${MIN_FOR_ADVICE} Reels.*J'en ai 2`));
});

test("a clear difference becomes a sentence with its basis, a small one does not", () => {
  const list = sanitizePosts([
    post(1, { vues: 3000, legende: "Court" }), post(2, { vues: 2800, legende: "Court aussi" }), post(3, { vues: 3100, legende: "Bref" }),
    post(4, { vues: 900, legende: "Une très longue légende qui raconte toute l'histoire du plat, du marché au service, avec les producteurs." }),
    post(5, { vues: 1000, legende: "Encore une longue légende qui détaille tout, la recette, les horaires, la réservation et les allergènes." }),
    post(6, { vues: 950, legende: "Une troisième légende bien longue pour expliquer la carte de la semaine et les nouveautés du chef ici." }),
  ]);
  const r = insights(list);
  const l = r.items.find(x => x.key === "stats:legende")!;
  assert.match(l.phrase, /légende courte font 3,2 fois plus de vues, sur tes 6 derniers Reels/);
  assert.equal(l.regle, "Une légende courte marche mieux chez toi.");
  assert.equal(r.heure, null);
});

test("durations come from the matched Ma DA montages", () => {
  const list = sanitizePosts([1, 2, 3, 4, 5, 6].map(i => post(i, { vues: i <= 3 ? 4000 : 1000, day: i * 4 })));
  const reels = list.map((p, k) => ({ id: `r${k}`, at: new Date(Date.parse(p.at) - 3600 * 1000).toISOString(), duree: p.vues! > 2000 ? 12 : 25 }));
  const m = matchReels(reels, list);
  assert.equal(Object.keys(m).length, 6);
  const r = insights(list, m);
  assert.match(r.items.find(x => x.key === "stats:duree")!.phrase, /courts \(15 s ou moins\) font 4 fois plus de vues/);
});

test("the best hour needs ten Reels", () => {
  const list = sanitizePosts(Array.from({ length: 12 }, (_, i) => post(i, { vues: i % 2 ? 5000 : 800, hour: i % 2 ? 19 : 9, day: 1 + i })));
  const h = bestHour(list)!;
  assert.match(h.phrase, /entre 1[789] h et 2[012] h/);
  assert.equal(bestHour(list.slice(0, 9)), null);
});

test("the carnet keeps one rule per key; Instagram links are recognised", () => {
  let m = addRule(emptyMemory(), "stats:legende", "Une légende courte marche mieux chez toi.");
  m = addRule(m, "stats:legende", "Une légende qui raconte marche mieux chez toi.");
  assert.equal(m.rules.length, 1);
  assert.ok(isInstagramLink("https://www.instagram.com/reel/C9xYz/"));
  assert.ok(!isInstagramLink("https://instagram.evil.com/reel/x"));
  assert.equal(referenceKey("https://www.instagram.com/reel/C9xYz/?igsh=1"), "ref:C9xYz");
});
