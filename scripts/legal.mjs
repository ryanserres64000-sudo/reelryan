// Fills the legal pages (public/*.html) from docs/legal/editeur.json: every
// <span … data-champ="key">…</span> takes the value of `key`. A null value leaves the orange
// [À COMPLÉTER] mark; "" removes the span (an optional field such as the share capital).
// Run again after any change: filled spans keep their data-champ. `--strict` fails while a field is
// missing (to run before the App Store submission).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PAGES = ["mentions-legales.html", "conditions.html", "confidentialite.html", "aide.html"];
const SPAN = /<span(?: class="todo")? data-champ="([a-z_]+)">[\s\S]*?<\/span>/g;
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function fill(html, values) {
  const missing = new Set();
  const out = html.replace(SPAN, (whole, key) => {
    const v = values[key];
    if (v === null || v === undefined) { missing.add(key); return whole.includes('class="todo"') ? whole : `<span class="todo" data-champ="${key}">[À COMPLÉTER : ${key}]</span>`; }
    if (key === "editeur_capital" && v) return `<span data-champ="${key}">, au capital de ${esc(v)}</span>`;
    return `<span data-champ="${key}">${esc(String(v))}</span>`;
  });
  return { html: out, missing: [...missing] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const values = JSON.parse(readFileSync(path.join(root, "docs/legal/editeur.json"), "utf8"));
  const missing = new Set();
  for (const page of PAGES) {
    const file = path.join(root, "public", page);
    const r = fill(readFileSync(file, "utf8"), values);
    writeFileSync(file, r.html);
    r.missing.forEach(m => missing.add(m));
  }
  if (missing.size) console.log(`Encore à compléter : ${[...missing].join(", ")}`);
  else console.log("Pages légales complètes.");
  if (missing.size && process.argv.includes("--strict")) process.exit(1);
}
