import test from "node:test";
import assert from "node:assert/strict";
import { DUOS, duoFor, duoById, applyCasse, typoSonPrompt } from "../typo.ts";
import { POLICES, sanitizeTimeline, AI_TIMELINE_SCHEMA } from "../timeline.ts";
import { naturalTimeline } from "../natural.ts";
import { exportPlan, textBox } from "../export.ts";
import { toDoc, setDuo, setTexte, deleteEffet, keepLocked } from "../edit.ts";
import { charteOf } from "../brand.ts";

const clips = { clip01: { duration: 20 } };
const base = (extra: Record<string, unknown> = {}) => sanitizeTimeline({
  titre: "Brunch", plans: [{ source: "clip01", debut: 0, fin: 16 }],
  textes: [{ texte: "Le brunch", accent: "du dimanche", debut: 0, fin: 2, style: "accroche" }, { texte: "12 rue Haute", accent: "ici", debut: 5, fin: 7, style: "info" }],
  ...extra,
}, clips).timeline;

test("8 duos maison, 2 familles chacun, polices de la liste", () => {
  assert.equal(DUOS.length, 8);
  for (const d of DUOS) {
    for (const f of [d.titre, d.accent, d.texte]) assert.ok((POLICES as readonly string[]).includes(f.police), f.police);
    assert.ok(new Set([d.titre.police, d.accent.police, d.texte.police]).size <= 2, d.id);
    assert.ok(d.echelle > 0 && d.echelle <= 1 && d.chevauchement >= 0 && d.chevauchement <= 0.5);
  }
});

test("le duo vient du style maison, sinon du ton, sans IA", () => {
  assert.equal(duoFor({ style_maison: "comptoir", ton: "chic" }), "affiche");
  assert.equal(duoFor({ style_maison: "inconnu", ton: "Chic" }), "couture");
  assert.equal(duoFor(null), null);
  assert.equal(charteOf({ style_maison: "coach", couleurs: [], polices: { titres: "Anton", texte: "Inter" } } as never, false).duo, "club");
  assert.equal(applyCasse("Été", "majuscules"), "ÉTÉ");
});

test("l'accent ne reste que sur les titres, le duo inconnu est ignoré", () => {
  const t = base({ charte: { duo: "petale" } });
  assert.equal(t.textes[0].accent, "du dimanche");
  assert.equal(t.textes[1].accent, "");
  assert.equal(t.charte.duo, "petale");
  assert.equal(base({ charte: { duo: "neon" } }).charte.duo, null);
  assert.ok("accent" in (AI_TIMELINE_SCHEMA as any).properties.textes.items.properties);
});

test("bruitages : 4 au plus, 3 s d'écart, dans le montage", () => {
  const r = sanitizeTimeline({ plans: [{ source: "clip01", debut: 0, fin: 20 }], effets: [
    { t: 1, type: "pop" }, { t: 2, type: "ding" }, { t: 5, type: "whoosh" }, { t: 9, type: "clic" }, { t: 13, type: "impact" }, { t: 17, type: "pop" }, { t: 30, type: "pop" }, { t: 4, type: "klaxon" },
  ] }, clips);
  assert.deepEqual(r.timeline.effets.map(e => e.t), [1, 5, 9, 13]);
  assert.ok(r.warnings.some(w => w.startsWith("Effets sonores réduits")));
  assert.deepEqual(base().effets, []);
});

test("la vérification « naturel » garde 2 accents au plus et retire l'écho", () => {
  const t = base();
  const many = { ...t, textes: [0, 3, 6, 9].map(d => ({ ...t.textes[0], debut: d, fin: d + 2, texte: `Titre ${d}`, accent: d === 3 ? "titre 3" : "mot" })) };
  const out = naturalTimeline(many);
  assert.deepEqual(out.timeline.textes.map(x => x.accent), ["mot", "", "mot", ""]);
  assert.ok(out.fixes.some(f => f.includes("duo")));
});

test("export : boîte plus haute pour un duo, duo résolu, bruitages coupés à la durée", () => {
  const t = base({ charte: { duo: "couture" }, effets: [{ t: 1, type: "pop" }, { t: 15, type: "ding" }], exports: [{ plateforme: "reels" }] });
  const f = exportPlan({ ...t, exports: [{ plateforme: "reels", duree_max: 10 }] })[0];
  assert.equal(f.duo?.id, "couture");
  assert.deepEqual(f.effets.map(e => e.t), [1]);
  assert.ok(textBox({ position: "haut", style: "accroche", accent: "x" }, "reels").h > textBox({ position: "haut", style: "accroche" }, "reels").h);
});

test("retouches : duo, accent et bruitages restent après une retouche IA", () => {
  let d = toDoc(base({ charte: { duo: "petale" }, effets: [{ t: 1, type: "pop" }, { t: 6, type: "ding" }] }));
  d = setDuo(d, "brut");
  d = deleteEffet(d, 0);
  d = setTexte(d, 0, { accent: "  au soleil " });
  assert.equal(d.timeline.textes[0].accent, "au soleil");
  assert.equal(setTexte(d, 0, { style: "info" }).timeline.textes[0].accent, "");
  const ai = base({ charte: { duo: "petale" }, effets: [{ t: 2, type: "clic" }] });
  const merged = keepLocked(d, ai).timeline;
  assert.equal(merged.charte.duo, "brut");
  assert.deepEqual(merged.effets, [{ t: 6, type: "ding" }]);
  assert.equal(duoById("brut")?.titre.casse, "majuscules");
});

test("consignes : duo de la marque et règle des bruitages", () => {
  assert.match(typoSonPrompt("affiche"), /TITRE EN DUO.*Affiche/s);
  assert.match(typoSonPrompt(null), /laisse « accent » vide/);
  assert.match(typoSonPrompt(null), /BRUITAGES/);
});
