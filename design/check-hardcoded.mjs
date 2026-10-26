// Refuses hard-coded design values in the app: every colour comes from the tokens, every size from the
// tokens in screens and components, every text of a screen from app/src/copy (étude, ch. 6 ; lot 1).
// Usage: node design/check-hardcoded.mjs  (exit code 1 when something is found)
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "app");
const GENERATED = path.join("src", "design", "tokens.ts");
const STYLE_KEYS = "fontSize|lineHeight|letterSpacing|fontWeight|padding\\w*|margin\\w*|gap|rowGap|columnGap|borderRadius|border\\w*Width|width|height|minWidth|minHeight|maxWidth|maxHeight|top|left|right|bottom|opacity";

const rules = [
  { name: "couleur en dur", where: () => true, re: /(["'`])#[0-9a-fA-F]{3,8}\1|\b(?:rgba?|hsla?)\(/g },
  { name: "taille en dur", where: f => f.startsWith("src") || f === "App.tsx", re: new RegExp(`\\b(?:${STYLE_KEYS})\\s*:\\s*-?(?!0\\b)\\d`, "g") },
  { name: "texte en dur dans un écran", where: isScreen, re: />\s*[^<>{}\s][^<>{}]*[A-Za-zÀ-ÿ][^<>{}]*</g },
  { name: "texte en dur dans un écran", where: isScreen, re: /\b(?:label|title|placeholder|accessibilityLabel)=["'][^"']*[A-Za-zÀ-ÿ]/g },
];
function isScreen(f) { return f === "App.tsx" || f.startsWith(path.join("src", "screens")) || f.startsWith(path.join("src", "app")); }

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) yield p;
  }
}

const found = [];
for (const f of [path.join(root, "App.tsx"), ...await (async () => { const a = []; for await (const p of walk(path.join(root, "src"))) a.push(p); return a; })()]) {
  const rel = path.relative(root, f);
  if (rel === GENERATED) continue;
  const lines = (await readFile(f, "utf8")).split("\n");
  lines.forEach((line, i) => {
    if (/^\s*\/\//.test(line)) return;
    for (const r of rules) if (r.where(rel)) for (const m of line.matchAll(r.re)) found.push(`${rel}:${i + 1}  ${r.name} : ${m[0].trim()}`);
  });
}
if (found.length) { console.error(found.join("\n") + `\n\n${found.length} valeur(s) en dur : passe par app/src/design/tokens.ts ou app/src/copy/fr.ts.`); process.exitCode = 1; }
else console.log("Aucune valeur en dur dans l'app.");
