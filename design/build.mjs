// Generates the design tokens for the app (TypeScript) and the web (CSS) from design/tokens.json.
// Usage: node design/build.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(await readFile(path.join(here, "tokens.json"), "utf8"));
const { $doc, contrast, ...rest } = tokens;
const head = "// Fichier généré par design/build.mjs depuis design/tokens.json : ne pas modifier à la main.\n";

const ts = `${head}
export const tokens = ${JSON.stringify(rest, null, 2)} as const;

export type ColorScheme = keyof typeof tokens.color;
export type ColorName = keyof typeof tokens.color.dark;
export type TypeName = keyof typeof tokens.type;
export type SpaceName = keyof typeof tokens.space;
export type RadiusName = keyof typeof tokens.radius;
`;
await writeFile(path.join(here, "..", "app", "src", "design", "tokens.ts"), ts);

const kebab = s => s.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
const vars = scheme => Object.entries(tokens.color[scheme]).map(([k, v]) => `  --c-${kebab(k)}: ${v};`).join("\n");
const css = `/* Fichier généré par design/build.mjs depuis design/tokens.json : ne pas modifier à la main. */
:root {
${vars("dark")}
${Object.entries(tokens.radius).map(([k, v]) => `  --r-${k}: ${v}px;`).join("\n")}
${Object.entries(tokens.space).map(([k, v]) => `  --s-${k}: ${v}px;`).join("\n")}
${["fast", "base", "slow"].map(k => `  --m-${k}: ${tokens.motion[k]}ms;`).join("\n")}
  color-scheme: dark;
}
:root[data-theme="light"] {
${vars("light")}
  color-scheme: light;
}
`;
await writeFile(path.join(here, "tokens.css"), css);
console.log("tokens.ts et tokens.css générés");
