import { test } from "node:test";
import assert from "node:assert/strict";
import { captionFor, exportPlan, inside, offlineCaption, safeZone, trendTip } from "../export.ts";
import { sanitizeTimeline } from "../timeline.ts";

const clips = { a: { duration: 100 }, b: { duration: 100 } };
const shot = (source: string, fin: number) => ({ source, debut: 0, fin, transition: "coupe" });
const tl = (extra = {}) => sanitizeTimeline({
  titre: "Menu du jeudi", plans: [shot("a", 3), shot("b", 3)],
  textes: [
    { texte: "Menu du midi 14 €", debut: 0, fin: 2, position: "bas", style: "accroche" },
    { texte: "12 rue Thiers", debut: 1, fin: 3, position: "bas", style: "info" },
  ],
  sous_titres: { actifs: true, position: "bas" }, charte: { logo: { asset: "logo", position: "partout" } },
  musique: { mode: "tendance", bpm: 110.4 }, exports: [{ plateforme: "reels" }, { plateforme: "tiktok" }, { plateforme: "shorts" }],
  legende: { texte: "Jeudi, c'est blanquette. Réserve au 05 59 00 00 00", hashtags: ["bayonne", "menudumidi", "restaurant", "faitmaison", "blanquette", "midi"] },
  ...extra,
}, clips, { maxDuration: 300 }).timeline;

test("three files, every text, subtitle and logo inside the platform's safe zone", () => {
  const files = exportPlan(tl());
  assert.deepEqual(files.map(f => f.plateforme), ["reels", "tiktok", "shorts"]);
  for (const f of files) {
    assert.equal(f.nom, `MaDa-menu-du-jeudi-${f.plateforme}.mp4`);
    assert.deepEqual([f.w, f.h, f.fps], [1080, 1920, 30]);
    for (const x of f.textes) assert.ok(inside(x.box, f.zone), `${f.plateforme} ${x.texte}`);
    assert.ok(inside(f.sous_titres!, f.zone) && inside(f.logo!, f.zone));
    // The bottom text sits above the subtitles; the second one at the same time goes up.
    assert.ok(f.textes[0].box.y + f.textes[0].box.h <= f.sous_titres!.y);
    assert.ok(f.textes[1].box.y < f.zone.y + f.zone.h / 2, "deux textes en même temps ne se chevauchent pas");
  }
  // TikTok's side buttons take more room than Instagram's; a top text clears the logo.
  assert.ok(safeZone("tiktok").w < safeZone("reels").w);
  for (const f of files) assert.ok(f.textes[1].box.y >= f.logo!.y + f.logo!.h);
});

test("an edit longer than a platform allows is cut for that platform only", () => {
  const long = tl({ plans: [shot("a", 100), shot("b", 100)], exports: [{ plateforme: "reels" }, { plateforme: "tiktok" }] });
  const [reels, tiktok] = exportPlan(long);
  assert.equal(reels.duree, 180); assert.ok(reels.coupe);
  assert.equal(tiktok.duree, 200); assert.ok(!tiktok.coupe);
});

test("captions follow each platform: hashtags counted, Shorts gets a title", () => {
  const t = tl();
  const ig = captionFor(t, "reels");
  assert.match(ig, /^Jeudi, c'est blanquette/);
  assert.equal(ig.match(/#\w+/g)!.length, 5);
  const yt = captionFor(t, "shorts").split("\n");
  assert.equal(yt[0], "Jeudi, c'est blanquette.");
  assert.ok(yt[0].length <= 100);
  assert.equal(yt[1], "#bayonne #menudumidi #Shorts");
  assert.deepEqual(trendTip(t), { bpm: 110 });
  assert.equal(trendTip(tl({ musique: { mode: "aucune" } })), null);
});

test("offline caption from the brief and the brand, honest and short", () => {
  const c = offlineCaption("menu du midi de jeudi, ambiance chaleureuse 🔥. Finir sur « Ouvert dès 11h »", { nom: "Chez Lou", profil: "restaurant" }, { adresse: "12 rue Thiers, Bayonne" });
  assert.equal(c.texte, "Menu du midi de jeudi, ambiance chaleureuse.\n12 rue Thiers, Bayonne");
  assert.deepEqual(c.hashtags, ["#chezlou", "#bayonne", "#restaurant", "#faitmaison"]);
  assert.deepEqual(offlineCaption("", null), { texte: "", hashtags: [] });
});
