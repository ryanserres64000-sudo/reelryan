import { test } from "node:test";
import assert from "node:assert/strict";
import { addPhoto, addText, nextPhotoId, color, deleteLayer, fittedSize, fromAi, keepLockedLayers, moveLayer, naturalDesign, offlineDesign, pushDesign, redoDesign, sanitizeDesign, setLayer, startDesignHistory, textLines, undoDesign, type TextLayer } from "../design.ts";
import { isNeon, naturalTimeline } from "../natural.ts";
import { sanitizeTimeline } from "../timeline.ts";
import { contrast } from "../brand.ts";

const text = (o = {}) => ({ type: "text", text: "Soirée jazz", font: "Fraunces", size: 120, color: "#ffffff", x: 80, y: 300, w: 900, h: 300, ...o });

test("a web design opens in the app: colours, fonts, assets and scale are repaired", () => {
  const d = sanitizeDesign({
    w: 540, h: 675, background: { type: "image", asset: "img1", overlay: "rgba(0,0,0,.5)" },
    layers: [text({ x: 40, size: 60, font: "Comic Sans" }), { type: "image", asset: "img9", x: 0, y: 0, w: 10, h: 10 }, { type: "image", asset: "logo", x: 1, y: 1, w: 50, h: 50 }, { type: "blob" }],
  }, 1080, 1350, ["img1", "logo"]);
  assert.equal(d.layers.length, 2, "l'image inconnue et le calque sans type sont retirés");
  const t = d.layers[0] as TextLayer;
  assert.deepEqual([t.x, t.size, t.font], [80, 120, "DM Sans"]);
  assert.equal((d.background as any).overlay, "#00000080");
  assert.equal(color("rgb(255, 0, 10)", "#000000"), "#FF000A");
  assert.throws(() => sanitizeDesign({ layers: [] }, 1080, 1350));
});

test("the AI's flat gradients are turned back into objects", () => {
  const raw = fromAi({ w: 1080, h: 1350, background: { type: "image", asset: "img1", overlay: "#00000000,#000000AA,180" }, layers: [{ type: "shape", fill: "#112233,#445566,90", x: 0, y: 0, w: 10, h: 10 }] });
  const d = sanitizeDesign(raw, 1080, 1350, ["img1"]);
  assert.deepEqual((d.background as any).overlay.colors, ["#00000000", "#000000AA"]);
  assert.equal((d.layers[0] as any).fill.angle, 90);
});

test("naturel: neon, halos, emojis, 3 fonts, tiny or hidden texts and poor contrast are fixed and said", () => {
  const d = sanitizeDesign({
    w: 1080, h: 1920, background: { type: "linear", colors: ["#7B2CFF", "#FF2BD6"] },
    layers: [
      { type: "shape", shape: "ellipse", fill: "#FF2BD6", blur: 80, blend: "screen", x: 0, y: 0, w: 500, h: 500 },
      text({ text: "Soirée 🎉🎉", y: 40 }), text({ text: "Vendredi", font: "Anton", size: 14, y: 900 }), text({ text: "Entrée libre", font: "Caveat", color: "#1F1B16", y: 1200 }),
    ],
  }, 1080, 1920);
  const { design, fixes } = naturalDesign(d, { couleurs: ["#14213D", "#D62839"] });
  assert.ok(!isNeon((design.background as any).colors[0]));
  assert.equal(design.layers.filter(l => l.type === "shape").length, 0);
  const texts = design.layers as TextLayer[];
  assert.equal(texts[0].text, "Soirée");
  assert.ok(new Set(texts.map(t => t.font)).size <= 2);
  assert.ok(texts[1].size >= 26);
  assert.ok(texts[0].y >= 220, "hors de la zone cachée par Instagram");
  assert.ok(contrast(texts[2].color as string, "#14213D") >= 3, "le texte sombre sur fond sombre change de couleur");
  assert.ok(fixes.length >= 6, fixes.join(" | "));
  // A brand colour is never treated as neon.
  assert.equal(isNeon("#7B2CFF", ["#7b2cff"]), false);
  // A clean design gets no fix.
  const clean = sanitizeDesign({ w: 1080, h: 1350, background: { type: "solid", color: "#F4EFE6" }, layers: [text({ color: "#1F1B16" })] }, 1080, 1350);
  assert.deepEqual(naturalDesign(clean).fixes, []);
});

test("a photo background without a legibility layer gets a gradient", () => {
  const d = sanitizeDesign({ w: 1080, h: 1350, background: { type: "image", asset: "img1" }, layers: [text()] }, 1080, 1350, ["img1"]);
  const r = naturalDesign(d);
  assert.ok((r.design.background as any).overlay);
  assert.match(r.fixes.join(" "), /assombri/);
});

test("offline layouts exist for every kind, stay natural and readable", () => {
  for (const kind of ["story", "post", "affiche", "flyer", "menu"] as const) {
    for (const photo of [true, false]) {
      const d = offlineDesign({ kind, idee: "Soirée jazz au bistrot", infos: { date: "Vendredi 20h", lieu: "12 rue Thiers" } }, { couleurs: ["#14213D", "#D62839", "#F4EFE6"], polices: { titres: "Fraunces", texte: "Inter" } }, { photo, logo: true });
      const again = sanitizeDesign(d, d.w, d.h, ["img1", "logo"]);
      assert.equal(again.layers.length, d.layers.length, `${kind} ${photo}`);
      const { fixes } = naturalDesign(d, { couleurs: ["#14213D", "#D62839", "#F4EFE6"] });
      assert.deepEqual(fixes, [], `${kind} photo=${photo} : ${fixes.join(" | ")}`);
    }
  }
});

test("texts wrap and shrink to their box", () => {
  const l = sanitizeDesign({ layers: [text({ text: "Un titre beaucoup trop long pour sa boîte étroite", w: 400, h: 200, size: 200 })] }, 1080, 1350).layers[0] as TextLayer;
  const s = fittedSize(l);
  assert.ok(s < 200);
  assert.ok(textLines(l, s, l.w).length * s * l.lineHeight <= l.h * 1.02);
});

test("hand edits lock the layer, undo and redo, and survive an AI retouch", () => {
  const d = offlineDesign({ kind: "post", idee: "", infos: { titre: "Brunch" } }, { couleurs: [] });
  const id = d.layers[0].id;
  let h = startDesignHistory(d);
  h = pushDesign(h, moveLayer(h.present, id, 30, -20));
  h = pushDesign(h, setLayer(h.present, id, { text: "Brunch du dimanche" } as any));
  assert.equal((h.present.layers[0] as TextLayer).text, "Brunch du dimanche");
  assert.ok(h.present.layers[0].locked);
  h = undoDesign(undoDesign(h));
  assert.equal(h.present, d);
  h = redoDesign(h);
  assert.equal(h.present.layers[0].x, d.layers[0].x + 30);
  const ai = { ...d, layers: [{ ...d.layers[0], id: "autre", text: "Autre" } as any] };
  const merged = keepLockedLayers(h.present, ai);
  assert.ok(merged.layers.some(l => l.id === id && l.x === d.layers[0].x + 30));
  assert.equal(deleteLayer({ ...d, layers: [d.layers[0]] }, id).layers.length, 1, "on garde toujours un calque");
  assert.equal(addText(d, "Nouveau", { couleurs: [] }).layers.length, d.layers.length + 1);
});

test("naturel on a Reel: one zoom, few moves, one grade, no emojis, texts that breathe", () => {
  const clips = { a: { duration: 10 }, b: { duration: 10 }, c: { duration: 10 } };
  const shot = (source: string, extra = {}) => ({ source, debut: 0, fin: 2, transition: "zoom", mouvement: "zoom-avant", etalonnage: "chaud", ...extra });
  const { timeline } = sanitizeTimeline({
    plans: [shot("a", { transition: "coupe" }), shot("b", { etalonnage: "froid" }), shot("c", { etalonnage: "contraste" }), shot("a"), shot("b"), shot("c")],
    textes: [0, 1, 2, 3, 4, 5, 6].map(i => ({ texte: i === 0 ? "Regarde 🔥🔥" : `Texte ${i}`, debut: i * 1.2, fin: i * 1.2 + 1, position: "bas", style: "titre" })),
    musique: { mode: "aucune" },
  }, clips);
  const { timeline: t, fixes } = naturalTimeline(timeline);
  assert.equal(t.plans.filter(p => p.transition === "zoom").length, 1);
  assert.ok(t.plans.filter(p => p.mouvement !== "aucun").length <= 2);
  assert.equal(new Set(t.plans.map(p => p.etalonnage)).size, 1);
  assert.equal(t.textes[0].texte, "Regarde");
  assert.ok(t.textes.length <= Math.max(3, Math.ceil(t.duree / 4)));
  assert.ok(t.duree > timeline.duree, "une coupe ne chevauche plus : le montage s'allonge un peu");
  assert.equal(t.relecture.corrections[0], fixes[0]);
  assert.deepEqual(naturalTimeline(t).fixes, [], "une deuxième passe ne trouve plus rien");
});

test("a photo added by hand: under the texts, inside the frame, locked, and kept by sanitizeDesign", () => {
  const d = offlineDesign({ kind: "affiche", idee: "Soirée jazz", infos: { titre: "Jazz au comptoir" } }, { couleurs: ["#1F3BD6"], polices: null });
  const id = nextPhotoId(["img1"])!;
  assert.equal(id, "img2");
  const next = addPhoto(d, id, 1.5);
  const at = next.layers.findIndex(l => l.type === "image" && l.asset === id), photo = next.layers[at];
  assert.ok(at >= 0 && photo.locked);
  assert.ok(next.layers.slice(at + 1).some(l => l.type === "text") || !d.layers.some(l => l.type === "text"), "les textes restent devant");
  assert.ok(photo.x >= 0 && photo.y >= 0 && photo.x + photo.w <= d.w && photo.y + photo.h <= d.h);
  assert.ok(sanitizeDesign(next, d.w, d.h, [id]).layers.some(l => l.type === "image" && l.asset === id));
  assert.equal(nextPhotoId(["img1", "img2", "img3", "img4", "img5", "img6", "img7", "img8", "img9"]), null);
});
