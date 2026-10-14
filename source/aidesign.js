/* ================= AI ART DIRECTOR ================= */
const KINDS = {
  story: { label: "Story", fmt: "story", desc: "story Instagram verticale" },
  post: { label: "Post", fmt: "post", desc: "publication Instagram" },
  event: { label: "Soirée / événement", fmt: "story", desc: "visuel de promotion d'une soirée ou d'un événement" },
  flyer: { label: "Flyer", fmt: "a4", desc: "flyer promotionnel, à imprimer et à partager" },
  poster: { label: "Affiche", fmt: "a4", desc: "affiche promotionnelle grand format" },
  collage: { label: "Collage", fmt: "post", desc: "collage créatif de plusieurs photos (récap, moodboard, souvenirs)" },
  ad: { label: "Publicité", fmt: "square", desc: "visuel publicitaire pour les réseaux sociaux, objectif conversion" },
  quote: { label: "Annonce / citation", fmt: "square", desc: "annonce ou citation typographique" },
  menu: { label: "Menu / carte", fmt: "a4", desc: "menu ou carte (restaurant, bar, événement), lisible et élégant" },
  banner: { label: "Bannière", fmt: "banner", desc: "bannière web ou couverture" },
  thumb: { label: "Miniature vidéo", fmt: "wide", desc: "miniature de vidéo accrocheuse" }
};
const STYLES = [
  ["auto", "L'IA choisit", "linear-gradient(120deg,#5B47A8,#E8C27A)", "Syne", ""],
  ["luxe", "Luxe éditorial", "linear-gradient(120deg,#14110c,#6b5530,#e8c27a)", "Cormorant Garamond", "luxe éditorial : sérif fine, beaucoup d'espace, noir / ivoire / or, finitions délicates, filets fins"],
  ["mode", "Magazine mode", "linear-gradient(120deg,#f2ede6,#c9b8a8,#1a1a1a)", "Playfair Display", "couverture de magazine de mode : photo forte plein cadre, titre sérif géant, petites mentions en capitales espacées"],
  ["suisse", "Minimal suisse", "linear-gradient(120deg,#f4f4f2,#f4f4f2 60%,#e4002b)", "Manrope", "style suisse : grille stricte, grotesque, alignement à gauche, une seule couleur vive, filets, numéros"],
  ["brutal", "Brutaliste", "linear-gradient(120deg,#e9ff3b,#111)", "Archivo Black", "brutalisme graphique : typographie énorme qui sort du cadre, contrastes durs, blocs, contours, aucun arrondi"],
  ["neon", "Néon nuit", "linear-gradient(120deg,#07021a,#5d00ff,#ff2bd6)", "Monoton", "nuit et néon : fond très sombre, halos lumineux (ellipses floues en screen), couleurs électriques, lueurs"],
  ["y2k", "Y2K chrome", "linear-gradient(120deg,#c9d6ff,#e2e2e2,#ff9df5)", "Unbounded", "Y2K : dégradés irisés, étoiles, pastilles, typographie large et ronde, effet chromé par dégradés"],
  ["retro", "Rétro 70s", "linear-gradient(120deg,#3b1d0e,#d9732b,#f2c14e)", "Fraunces", "années 70 : sérif ronde et grasse, bandes de couleur arrondies concentriques, orange / brun / moutarde, grain"],
  ["organic", "Organique doux", "linear-gradient(120deg,#e9e4d8,#b7c4a1,#7a8f6a)", "Instrument Serif", "organique : formes blob, tons naturels, beaucoup d'air, sérif fine italique"],
  ["street", "Street / collage", "linear-gradient(120deg,#111,#ff3d2e,#f2f2f2)", "Permanent Marker", "street / collage punk : photos découpées et tournées, polaroïds, scotch, feutre, étiquettes, énergie brute"],
  ["pastel", "Pastel tendre", "linear-gradient(120deg,#ffd6e0,#d6e4ff,#fff4c2)", "Syne", "pastel tendre : couleurs douces, formes arrondies, typographie géométrique, légèreté"],
  ["deco", "Art déco", "linear-gradient(120deg,#0e1a17,#1f4037,#d4af37)", "DM Serif Display", "art déco : symétrie, motifs concentriques, or sur vert profond ou noir, capitales élégantes"],
  ["cinema", "Cinéma", "linear-gradient(120deg,#000,#2b2b2b,#b38b59)", "Bebas Neue", "affiche de cinéma : photo plein cadre, dégradé sombre en bas, titre condensé immense, générique en petit"]
];
const SHAPES = ["rect", "rounded", "ellipse", "circle", "pill", "arch", "star", "blob", "triangle", "line"];
const MASKS = ["rect", "rounded", "circle", "ellipse", "arch", "blob", "star", "pill"];

const SCHEMA_TXT = `SCHÉMA (coordonnées en px, x/y = coin haut-gauche de la boîte, rotation en degrés, couleurs "#RRGGBB", "#RRGGBBAA" ou "rgba(r,g,b,a)") :
background : {"type":"solid","color"} | {"type":"linear","colors":[2 à 4],"angle":0-360 (180 = de haut en bas)} | {"type":"radial","colors":[2-3],"cx":0-1,"cy":0-1} | {"type":"mesh","colors":[4]} | {"type":"image","asset":"img1","filter":"none|warm|cool|bw|vintage|vivid|dream|duotone","duotone":["#sombre","#clair"],"focusX":0-1,"focusY":0-1,"overlay":couleur ou dégradé}
Champs communs : "type","name","x","y","w","h","rotation","opacity"(0-1),"blend"(normal|multiply|screen|overlay|soft-light|difference),"shadow":{"color","blur","x","y"}
"text" : "text","font","weight","italic","size"(px),"color"(couleur ou {"type":"linear","colors":[..],"angle"}),"align"(left|center|right),"vAlign"(top|middle|bottom),"lineHeight"(0.8-1.6),"letterSpacing"(em, -0.06 à 0.4),"transform"(none|upper),"stroke":{"color","width"},"strokeOnly":bool,"bg":{"color","padX","padY","radius"} (surlignage par ligne),"repeat":bool (une ligne répétée en boucle sur toute la largeur, pour un bandeau),"fit":bool (réduit la taille si le texte dépasse la boîte ; par défaut true)
"shape" : "shape"(rect|rounded|ellipse|pill|arch|star|blob|triangle|line),"fill"(couleur, dégradé {"type":"linear"|"radial","colors":[..],"angle"} ou null),"stroke":{"color","width","dash":[a,b]},"radius","points"(star, 5-30),"inner"(star 0.3-0.95),"seed"(blob, entier),"blur"(px ; une ellipse avec blur devient un halo lumineux doux)
"image" : "asset","fit"(cover|contain),"focusX","focusY","zoom"(1-2),"mask"(rect|rounded|circle|arch|blob|star|pill),"radius","filter","duotone":[2 couleurs],"border":{"color","width"},"frame"(none|polaroid),"tape":bool
"pattern" : "kind"(dots|grid|stripes|halftone|waves|concentric),"color","size","spacing","angle"
fx (global) : {"grain":0-0.25,"vignette":0-0.6}`;
const FONTS_TXT = FONTS.map(f => `${f[0]} (${f[1]} ; graisses ${f[2].join("/")})`).join(" · ");

const CRAFT_TXT = `EXIGENCES DE DIRECTION ARTISTIQUE (niveau agence, jamais générique)
1. Un concept visuel fort et spécifique à ce brief : une idée, pas une mise en page par défaut. Évite le « titre centré sur dégradé violet ».
2. Hiérarchie nette : un élément héros, un message principal, des infos secondaires regroupées. Le regard suit un parcours évident.
3. Typographie : 2 familles maximum ; contraste d'échelle fort (titre ≥ 3 × le texte courant) ; titres avec lineHeight 0.85-1.0 et letterSpacing légèrement négatif pour les grandes tailles ; petites étiquettes en capitales espacées (0.12-0.3 em) ; jamais de texte courant sous 26 px sur un format 1080.
4. Couleurs : palette de 2 à 4 couleurs, cohérente avec la marque ; contraste de lecture irréprochable (sur photo : dégradé de lisibilité, bandeau ou surlignage).
5. Grille et marges : marges ≥ 6 % du plus petit côté ; éléments alignés sur des axes communs ; espaces réguliers.
6. Profondeur et matière, avec retenue : superpositions, ombres douces, grain léger, halos, formes organiques, rotations de 2 à 8° sur des éléments secondaires.
7. Rien ne déborde du format par accident ; un débordement est un choix assumé (titre géant coupé, forme qui sort du cadre).
TECHNIQUES À DISPOSITION : titre géant pleine largeur (éventuellement coupé par le bord) ; texte en contour (strokeOnly) superposé ou décalé sur le texte plein ; mise en page éditoriale (filets "line", numéros, mentions) ; photo masquée (arch, circle, blob, rounded) ; duotone ; polaroïds tournés avec scotch pour les collages ; bandeau défilant (texte repeat sur une bande tournée de -4°) ; badge étoilé (star) pour un prix, une date, « NEW » ; halos lumineux (ellipse + blur, blend screen) ; dégradé maillé (mesh) ; motifs (halftone, dots, grid, waves, concentric) ; photo plein cadre + dégradé sombre de lisibilité ; blocs de couleur francs ; cadre fin intérieur.`;

/* --- asset aliasing --- */
function aliasFor(ids) {
  const map = {}, rev = {}; let n = 0;
  for (const id of ids) { if (!id || rev[id] || !Assets.get(id)) continue; const al = WS.cur.logo === id ? "logo" : "img" + (++n); map[al] = id; rev[id] = al; }
  return { map, rev };
}
function assetLines(map) {
  const out = [];
  for (const [al, id] of Object.entries(map)) { const a = Assets.get(id); out.push(al === "logo" ? `logo : logo de la marque (${a.w || a.img.naturalWidth}×${a.h || a.img.naturalHeight}) — à placer petit, proprement` : `${al} : photo ${Assets.orientation(a)} ${a.w || a.img.naturalWidth}×${a.h || a.img.naturalHeight} « ${a.name} »`); }
  return out.join("\n");
}
async function assetImages(map, budget) {
  const blobs = [], labels = [];
  for (const [al, id] of Object.entries(map)) { if (blobs.length >= budget) break; const b = await Assets.thumbBlob(id, 512); if (b) { blobs.push(b); labels.push(al); } }
  return { blobs, labels };
}
function toAIDesign(d, rev) {
  const c = JSON.parse(JSON.stringify(d));
  if (c.background && c.background.type === "image") c.background.asset = rev[c.background.asset] || c.background.asset;
  (c.layers || []).forEach(l => { delete l.id; delete l.locked; if (l.type === "image") l.asset = rev[l.asset] || l.asset; for (const k of ["x", "y", "w", "h", "size"]) if (typeof l[k] === "number") l[k] = Math.round(l[k]); });
  return c;
}

/* --- sanitizer --- */
const sColor = (c, d) => typeof c === "string" && /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|transparent|white|black)$/i.test(c.trim()) ? c.trim() : d;
function sFill(f, d) {
  if (f === null) return null; if (typeof f === "string") return sColor(f, d);
  if (f && typeof f === "object" && Array.isArray(f.colors)) { const cols = f.colors.map(c => sColor(typeof c === "object" && c ? c.color : c, null)).filter(Boolean).slice(0, 5); if (!cols.length) return d; return { type: f.type === "radial" ? "radial" : "linear", colors: cols, angle: num(f.angle, 180), cx: num(f.cx, .5), cy: num(f.cy, .5) }; }
  return d;
}
function sFont(f) { if (typeof f !== "string") return "DM Sans"; const hit = FONT_NAMES.find(n => n.toLowerCase() === f.trim().toLowerCase()) || FONT_NAMES.find(n => f.toLowerCase().includes(n.toLowerCase())); return hit || "DM Sans"; }
function sanitizeDesign(raw, W, H, map = {}) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.layers)) throw { code: "invalid_json" };
  const sx = W / num(raw.w, W) || 1, sy = H / num(raw.h, H) || 1, sm = Math.min(sx, sy);
  const resolve = a => map[a] || (Assets.get(a) ? a : null);
  let bg = raw.background || {};
  if (bg.type === "image") { const id = resolve(bg.asset); bg = id ? { type: "image", asset: id, filter: IMG_FILTERS[bg.filter] !== undefined ? bg.filter : "none", duotone: Array.isArray(bg.duotone) ? bg.duotone.map(c => sColor(c, "#000000")).slice(0, 2) : undefined, focusX: num(bg.focusX, .5), focusY: num(bg.focusY, .5), overlay: sFill(bg.overlay, undefined) } : { type: "solid", color: "#111111" }; }
  else if (["linear", "radial", "mesh"].includes(bg.type)) bg = { type: bg.type, colors: (Array.isArray(bg.colors) ? bg.colors : []).map(c => sColor(c, null)).filter(Boolean).slice(0, 5), angle: num(bg.angle, 180), cx: num(bg.cx, .5), cy: num(bg.cy, .5) };
  else bg = { type: "solid", color: sColor(bg.color, "#111111") };
  if (bg.colors && !bg.colors.length) bg = { type: "solid", color: "#111111" };
  const out = { w: W, h: H, background: bg, fx: { grain: clamp(num(raw.fx && raw.fx.grain, 0), 0, .4), vignette: clamp(num(raw.fx && raw.fx.vignette, 0), 0, .8) }, layers: [] };
  for (const r of raw.layers.slice(0, 48)) {
    if (!r || !["text", "shape", "image", "pattern"].includes(r.type)) continue;
    const l = { id: uid("l"), type: r.type, name: String(r.name || "").slice(0, 40), x: Math.round(num(r.x, 0) * sx), y: Math.round(num(r.y, 0) * sy), w: Math.max(4, Math.round(num(r.w, 200) * sx)), h: Math.max(2, Math.round(num(r.h, 100) * sy)), rotation: clamp(num(r.rotation, 0), -360, 360), opacity: clamp(num(r.opacity, 1), 0, 1), blend: BLENDS[r.blend] ? r.blend : "normal" };
    if (r.shadow && typeof r.shadow === "object" && sColor(r.shadow.color, null)) l.shadow = { color: sColor(r.shadow.color), blur: clamp(num(r.shadow.blur, 20), 0, 200), x: num(r.shadow.x, 0), y: num(r.shadow.y, 8) };
    if (r.type === "text") {
      Object.assign(l, { text: String(r.text ?? "").slice(0, 800), font: sFont(r.font), weight: clamp(Math.round(num(r.weight, 400) / 100) * 100, 100, 900), italic: !!r.italic, size: clamp(num(r.size, 60) * sm, 6, 1600), color: sFill(r.color, "#ffffff"), align: ["left", "center", "right"].includes(r.align) ? r.align : "left", vAlign: ["top", "middle", "bottom"].includes(r.vAlign) ? r.vAlign : "top", lineHeight: clamp(num(r.lineHeight, 1.1), .7, 2.4), letterSpacing: clamp(num(r.letterSpacing, 0), -.2, 1), transform: r.transform === "upper" ? "upper" : "none", strokeOnly: !!r.strokeOnly, repeat: !!r.repeat, fit: r.fit !== false });
      if (r.stroke && num(r.stroke.width, 0) > 0) l.stroke = { color: sColor(r.stroke.color, "#000000"), width: clamp(num(r.stroke.width, 2) * sm, .5, 60) };
      if (r.bg && sFill(r.bg.color, null)) l.bg = { color: sFill(r.bg.color, "#000000"), padX: num(r.bg.padX, l.size * .3), padY: num(r.bg.padY, l.size * .1), radius: num(r.bg.radius, 0) };
      if (!l.text.trim()) continue;
    } else if (r.type === "shape") {
      Object.assign(l, { shape: SHAPES.includes(r.shape) ? r.shape : "rect", fill: sFill(r.fill === undefined ? "#ffffff" : r.fill, null), radius: Math.max(0, num(r.radius, 0)), points: num(r.points, 12), inner: num(r.inner, .78), seed: Math.round(num(r.seed, 3)), blur: clamp(num(r.blur, 0), 0, 600) });
      if (r.stroke && num(r.stroke.width, 0) > 0) l.stroke = { color: sFill(r.stroke.color, "#ffffff"), width: clamp(num(r.stroke.width, 2), .5, 80), dash: Array.isArray(r.stroke.dash) ? r.stroke.dash.slice(0, 2).map(n => num(n, 6)) : undefined };
    } else if (r.type === "image") {
      const id = resolve(r.asset); if (!id) continue;
      Object.assign(l, { asset: id, fit: r.fit === "contain" ? "contain" : "cover", focusX: clamp(num(r.focusX, .5), 0, 1), focusY: clamp(num(r.focusY, .5), 0, 1), zoom: clamp(num(r.zoom, 1), 1, 3), mask: MASKS.includes(r.mask) ? r.mask : "rect", radius: Math.max(0, num(r.radius, 0)), filter: IMG_FILTERS[r.filter] !== undefined ? r.filter : "none", frame: r.frame === "polaroid" ? "polaroid" : "none", tape: !!r.tape });
      if (Array.isArray(r.duotone)) l.duotone = r.duotone.map(c => sColor(c, "#000000")).slice(0, 2);
      if (r.border && num(r.border.width, 0) > 0) l.border = { color: sColor(r.border.color, "#ffffff"), width: clamp(num(r.border.width, 4), .5, 80) };
    } else {
      Object.assign(l, { kind: ["dots", "grid", "stripes", "halftone", "waves", "concentric"].includes(r.kind) ? r.kind : "dots", color: sColor(r.color, "rgba(255,255,255,.2)"), size: clamp(num(r.size, 6), .5, 200), spacing: clamp(num(r.spacing, 28), 4, 600), angle: num(r.angle, 0) });
    }
    out.layers.push(l);
  }
  if (!out.layers.length) throw { code: "invalid_json" };
  return out;
}

/* --- prompts --- */
function fmtOf(doc) { return FORMATS[doc.format] || { w: doc.design ? doc.design.w : 1080, h: doc.design ? doc.design.h : 1350, label: "" }; }
function safeZone(fmtKey) { return fmtKey === "story" ? "Format story : garde le titre, les infos et le logo hors des 220 px du haut et des 320 px du bas (interface Instagram)." : ""; }
function briefTxt(b) {
  const k = KINDS[b.kind] || KINDS.post, st = STYLES.find(s => s[0] === b.style);
  const infos = Object.entries(b.infos || {}).filter(([, v]) => v && String(v).trim()).map(([k2, v]) => `${({ title: "Titre / nom", date: "Date et heure", place: "Lieu", price: "Prix / offre", cta: "Contact / appel à l'action", extra: "Autres infos" })[k2] || k2} : ${v}`).join("\n");
  return `TYPE : ${k.label} — ${k.desc}
DEMANDE : ${b.idea || "(non précisée : propose la création la plus forte pour cette marque)"}
TEXTES ET INFOS À AFFICHER (exactement, sans rien inventer de factuel) :
${infos || "Aucune info imposée : rédige toi-même des textes courts et percutants en français, sans inventer de date, de prix, d'adresse ni de chiffre."}
DIRECTION DE STYLE : ${st && st[4] ? st[4] : "à toi de choisir la direction la plus forte et la plus originale pour ce brief et cette marque"}`;
}
async function aiCreate(b, o = {}) {
  const F = FORMATS[b.format] || FORMATS.post;
  const ids = [...(b.assets || [])]; if (WS.cur.logo && b.useLogo !== false && Assets.get(WS.cur.logo)) ids.push(WS.cur.logo);
  const { map } = aliasFor(ids);
  const imgs = AI.imgMax ? await assetImages(map, AI.imgMax) : { blobs: [], labels: [] };
  const prompt = `Tu es MaDA, directrice artistique et graphiste senior. Tu conçois des visuels de niveau agence : modernes, originaux, maîtrisés.
${briefTxt(b)}
FORMAT : ${F.w} × ${F.h} px (${F.label}). ${safeZone(b.format)}
${o.variant ? `CONSIGNE DE VARIANTE : ${o.variant}` : ""}

${brandContext()}

IMAGES DISPONIBLES (référence-les par leur identifiant) :
${assetLines(map) || "Aucune : compose avec la typographie, les formes, les dégradés, les motifs et la matière."}
${imgs.labels.length ? `Les vignettes jointes correspondent, dans l'ordre, à : ${imgs.labels.join(", ")}. Regarde-les pour choisir le cadrage (focusX/focusY), les couleurs et la place du texte (évite de couvrir les visages et le sujet).` : ""}

${CRAFT_TXT}

${SCHEMA_TXT}
POLICES DISPONIBLES (aucune autre) : ${FONTS_TXT}

Réponds uniquement avec ce JSON :
{"concept":"une phrase en français qui décrit l'idée visuelle","design":{"w":${F.w},"h":${F.h},"background":{...},"fx":{...},"layers":[...]}}
Règles : 6 à 26 calques, du fond vers l'avant ; nombres entiers pour x, y, w, h ; textes en français sans faute et sans emoji ; chaque photo fournie et pertinente est utilisée au moins une fois (sauf concept purement typographique) ; le logo, s'il est fourni, apparaît discrètement.`;
  const r = await AI.json(prompt, { images: imgs.blobs, signal: o.signal, onText: o.onText });
  return { design: sanitizeDesign(r && r.design, F.w, F.h, map), concept: String((r && r.concept) || "").slice(0, 300) };
}
async function aiCritique(doc, o = {}) {
  const d = doc.design, ids = designAssetIds(d); if (WS.cur.logo) ids.push(WS.cur.logo);
  const { map, rev } = aliasFor(ids);
  const shot = await renderBlob(d, 1000);
  const prompt = `Tu es directeur artistique exigeant, en relecture finale. L'image jointe est le RENDU RÉEL du visuel ci-dessous, conçu pour ce brief.
${briefTxt(doc.brief || {})}
FORMAT : ${d.w} × ${d.h} px. ${safeZone(doc.format)}
${brandContext()}
IMAGES DISPONIBLES : ${assetLines(map) || "aucune"}

Examine le rendu sans complaisance : lisibilité et contraste, hiérarchie, alignements et marges, textes coupés ou trop serrés, chevauchements maladroits, vides mal gérés, équilibre, qualité typographique, originalité, cohérence avec la marque${doc.format === "story" ? ", zones sûres de la story" : ""}.
Corrige tout ce qui n'est pas au niveau d'une agence et pousse le visuel d'un cran (finitions, détails, matière). Garde le concept.

${CRAFT_TXT}
${SCHEMA_TXT}
POLICES DISPONIBLES : ${FONTS_TXT}
VISUEL ACTUEL (JSON) :
${JSON.stringify(toAIDesign(d, rev))}

Réponds uniquement avec ce JSON :
{"fixes":["3 à 6 corrections apportées, phrases courtes en français"],"design":{... le visuel complet corrigé, même schéma ...}}`;
  const r = await AI.json(prompt, { images: shot ? [shot] : [], signal: o.signal, onText: o.onText });
  return { design: sanitizeDesign(r && r.design, d.w, d.h, map), fixes: (Array.isArray(r && r.fixes) ? r.fixes : []).map(String).slice(0, 8) };
}
async function aiEdit(doc, request, o = {}) {
  const d = doc.design, ids = [...new Set([...designAssetIds(d), ...Assets.list.filter(a => a.tag !== "screenshot").slice(0, 12).map(a => a.id)])]; if (WS.cur.logo) ids.push(WS.cur.logo);
  const { map, rev } = aliasFor(ids);
  const shot = await renderBlob(d, 1000);
  const extra = AI.imgMax > 1 ? await assetImages(map, Math.min(6, AI.imgMax - 1)) : { blobs: [], labels: [] };
  const W = o.fmt ? FORMATS[o.fmt].w : d.w, H = o.fmt ? FORMATS[o.fmt].h : d.h;
  const hist = (doc.chat || []).filter(m => m.role === "user").slice(-5).map(m => "- " + m.text).join("\n");
  const prompt = `Tu es MaDA, directrice artistique. L'image jointe n°1 est le rendu actuel du visuel.${extra.labels.length ? ` Les images suivantes sont les photos disponibles : ${extra.labels.join(", ")}.` : ""}
${briefTxt(doc.brief || {})}
${brandContext()}
IMAGES DISPONIBLES : ${assetLines(map) || "aucune"}
DEMANDES PRÉCÉDENTES :
${hist || "(aucune)"}
NOUVELLE DEMANDE : ${request}
${o.fmt ? `Le visuel doit être recomposé pour le format ${W} × ${H} px (${FORMATS[o.fmt].label}) : réorganise intelligemment la mise en page, ne te contente pas d'étirer. ${safeZone(o.fmt)}` : `Format inchangé : ${W} × ${H} px. ${safeZone(doc.format)}`}
Applique précisément la demande, garde ce qu'elle ne touche pas, et reste au niveau agence.

${CRAFT_TXT}
${SCHEMA_TXT}
POLICES DISPONIBLES : ${FONTS_TXT}
VISUEL ACTUEL (JSON) :
${JSON.stringify(toAIDesign(d, rev))}

Réponds uniquement avec ce JSON :
{"summary":"1 à 2 phrases en français : ce que tu as changé","design":{... le visuel complet, w=${W}, h=${H} ...}}`;
  const r = await AI.json(prompt, { images: [shot, ...extra.blobs].filter(Boolean), signal: o.signal, onText: o.onText });
  return { design: sanitizeDesign(r && r.design, W, H, map), summary: String((r && r.summary) || "C'est fait.").slice(0, 400) };
}
function blankDesign(fmtKey) {
  const F = FORMATS[fmtKey] || FORMATS.post, b = WS.cur, c = b.colors || [];
  return { w: F.w, h: F.h, background: { type: "solid", color: c[0] || "#141218" }, fx: { grain: .04, vignette: 0 }, layers: [
    { id: uid("l"), type: "text", name: "Titre", text: "Ton titre", font: b.fonts.display || "Syne", weight: 800, italic: false, size: Math.round(F.w * .12), color: c[1] || "#F4EFE6", align: "left", vAlign: "top", lineHeight: .95, letterSpacing: -.02, transform: "none", x: Math.round(F.w * .08), y: Math.round(F.h * .12), w: Math.round(F.w * .84), h: Math.round(F.w * .3), rotation: 0, opacity: 1, blend: "normal", fit: true }
  ] };
}
