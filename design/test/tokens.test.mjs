import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tokens = JSON.parse(await readFile(new URL("../tokens.json", import.meta.url), "utf8"));

// WCAG 2.1 relative luminance and contrast ratio.
const lum = hex => {
  const n = parseInt(hex.slice(1, 7), 16);
  const [r, g, b] = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

for (const scheme of ["dark", "light"]) {
  test(`contrastes AA en mode ${scheme === "dark" ? "sombre" : "clair"}`, () => {
    const c = tokens.color[scheme], fails = [];
    for (const [fg, bg, min] of tokens.contrast) {
      const r = ratio(c[fg], c[bg]);
      if (r < min) fails.push(`${fg} sur ${bg} : ${r.toFixed(2)}:1 < ${min}:1`);
    }
    // White text stays legible along the whole gradient, not only on its first colour.
    for (const stop of tokens.gradient[scheme]) if (ratio(c.onAction, stop) < 4.5) fails.push(`onAction sur le dégradé ${stop}`);
    assert.equal(tokens.gradient[scheme][0], c.action, "le dégradé commence par la couleur d'action");
    assert.deepEqual(fails, []);
  });
}

test("les deux modes ont les mêmes rôles de couleur", () => {
  assert.deepEqual(Object.keys(tokens.color.light).sort(), Object.keys(tokens.color.dark).sort());
});

test("les valeurs « Atelier clair » choisies par Ryan sont respectées (28 octobre 2026)", () => {
  const d = tokens.color.dark, l = tokens.color.light;
  assert.equal(l.bg, "#FFFFFF"); assert.equal(l.text, "#121212"); assert.equal(l.action, "#1F3BD6");
  // Une seule couleur d'action : l'IA n'a plus sa propre couleur.
  assert.equal(l.ai, l.action); assert.equal(d.ai, d.actionStrong);
  assert.equal(d.bg, "#0E0E0F");
  assert.ok(ratio(l.onAction, l.action) >= 7);
  assert.deepEqual(tokens.radius.chip + "/" + tokens.radius.button + "/" + tokens.radius.card + "/" + tokens.radius.sheet, "8/12/16/24");
  for (const v of Object.values(tokens.space)) assert.equal(v % tokens.layout.grid, 0, `${v} hors grille de 4`);
  assert.ok(tokens.size.touch >= 44);
  assert.ok(tokens.motion.fast >= 200 && tokens.motion.slow <= 350);
});

test("tokens.ts est à jour (sinon : node design/build.mjs)", async () => {
  const ts = await readFile(new URL("../../app/src/design/tokens.ts", import.meta.url), "utf8");
  const { $doc, contrast, ...rest } = tokens;
  assert.ok(ts.includes(JSON.stringify(rest, null, 2)));
});
