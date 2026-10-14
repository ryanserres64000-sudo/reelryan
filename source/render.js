/* ================= DESIGN ENGINE ================= */
const FONTS = [
  ["Anton", "condensée ultra-grasse, affiches", [400]],
  ["Bebas Neue", "condensée en capitales", [400]],
  ["Archivo Black", "grotesque massive", [400]],
  ["Syne", "géométrique expressive", [400, 600, 800]],
  ["Unbounded", "large, ronde, futuriste", [400, 600, 900]],
  ["Space Grotesk", "grotesque technique", [400, 500, 700]],
  ["Manrope", "sans moderne neutre", [400, 600, 800]],
  ["DM Sans", "sans neutre lisible", [400, 500, 700]],
  ["Playfair Display", "sérif très contrastée, italique superbe", [400, 700, 900]],
  ["DM Serif Display", "sérif élégante de titrage", [400]],
  ["Cormorant Garamond", "sérif luxe et fine", [400, 600, 700]],
  ["Fraunces", "sérif expressive et chaleureuse", [400, 700, 900]],
  ["Instrument Serif", "sérif éditoriale fine", [400]],
  ["Caveat", "manuscrite naturelle", [700]],
  ["Permanent Marker", "feutre, street", [400]],
  ["Space Mono", "machine à écrire technique", [400, 700]],
  ["Monoton", "néon art déco, titres de 1 à 2 mots", [400]]
];
const FONT_NAMES = FONTS.map(f => f[0]);
const FORMATS = {
  story: { w: 1080, h: 1920, label: "Story 9:16" },
  post: { w: 1080, h: 1350, label: "Post 4:5" },
  square: { w: 1080, h: 1080, label: "Carré 1:1" },
  a4: { w: 1240, h: 1754, label: "A4 portrait" },
  a4l: { w: 1754, h: 1240, label: "A4 paysage" },
  banner: { w: 1200, h: 628, label: "Bannière web" },
  wide: { w: 1280, h: 720, label: "Paysage 16:9" }
};
const IMG_FILTERS = { none: "none", warm: "saturate(1.12) sepia(.16) brightness(1.03)", cool: "saturate(.95) hue-rotate(-10deg) brightness(1.02)", bw: "grayscale(1) contrast(1.15)", vintage: "sepia(.35) contrast(.92) brightness(1.05) saturate(.8)", vivid: "saturate(1.45) contrast(1.1)", dream: "brightness(1.08) contrast(.9) saturate(1.1)", duotone: "none" };
const BLENDS = { normal: "source-over", multiply: "multiply", screen: "screen", overlay: "overlay", "soft-light": "soft-light", difference: "difference", lighten: "lighten", darken: "darken" };
const CANVAS_FILTER = "filter" in document.createElement("canvas").getContext("2d");

async function ensureFonts(d) {
  const set = new Set();
  for (const l of d.layers || []) if (l.type === "text") set.add(`${l.italic ? "italic " : ""}${l.weight || 400} 60px "${l.font}"`);
  if (!set.size) return;
  await Promise.race([Promise.all([...set].map(f => document.fonts.load(f).catch(() => { }))), sleep(4000)]);
}
function designAssetIds(d) { const ids = []; if (d.background && d.background.type === "image") ids.push(d.background.asset); for (const l of d.layers || []) if (l.type === "image") ids.push(l.asset); return ids.filter(Boolean); }
async function prepareDesign(d) { await Assets.ensure(designAssetIds(d)); await ensureFonts(d); }

/* --- paint helpers --- */
function makeGrad(ctx, f, x, y, w, h) {
  const cols = (f.colors || []).filter(Boolean); if (!cols.length) return "transparent"; if (cols.length === 1) return cols[0];
  let g;
  if (f.type === "radial") { const cx = x + num(f.cx, .5) * w, cy = y + num(f.cy, .5) * h; g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * num(f.r, .75)); }
  else { const a = num(f.angle, 180) * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), L2 = (Math.abs(w * dx) + Math.abs(h * dy)) / 2, cx = x + w / 2, cy = y + h / 2; g = ctx.createLinearGradient(cx - dx * L2, cy - dy * L2, cx + dx * L2, cy + dy * L2); }
  cols.forEach((c, i) => { try { g.addColorStop(i / (cols.length - 1), typeof c === "object" ? c.color : c); } catch (e) { } });
  return g;
}
function paint(ctx, f, x, y, w, h) { if (!f) return null; if (typeof f === "string") return f; if (typeof f === "object") return makeGrad(ctx, f, x, y, w, h); return null; }
function rngFrom(seed) { let s = (seed | 0) || 7; return () => { s = (s * 16807) % 2147483647; return (s & 0xffff) / 0xffff; }; }

function shapePath(ctx, kind, x, y, w, h, l = {}) {
  ctx.beginPath();
  const r = Math.min(num(l.radius, 0), w / 2, h / 2);
  switch (kind) {
    case "ellipse": case "circle": ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2); break;
    case "pill": { const rr = Math.min(w, h) / 2; ctx.roundRect ? ctx.roundRect(x, y, w, h, rr) : rrPath(ctx, x, y, w, h, rr); break; }
    case "arch": { const rr = Math.min(w / 2, h); ctx.moveTo(x, y + h); ctx.lineTo(x, y + rr); ctx.arc(x + w / 2, y + rr, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); break; }
    case "triangle": ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); break;
    case "star": { const n = clamp(Math.round(num(l.points, 12)), 3, 40), inner = clamp(num(l.inner, .78), .2, .98), cx = x + w / 2, cy = y + h / 2; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rad = i % 2 ? inner : 1; const px = cx + Math.cos(a) * w / 2 * rad, py = cy + Math.sin(a) * h / 2 * rad; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); break; }
    case "blob": {
      const rnd = rngFrom(num(l.seed, 3) * 9973 + 11), n = 7, cx = x + w / 2, cy = y + h / 2, pts = [];
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, k = .72 + rnd() * .28; pts.push([cx + Math.cos(a) * w / 2 * k, cy + Math.sin(a) * h / 2 * k]); }
      for (let i = 0; i < n; i++) { const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]; if (!i) ctx.moveTo(p1[0], p1[1]); ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]); }
      ctx.closePath(); break;
    }
    case "rounded": { const rr = r || Math.min(w, h) * .08; ctx.roundRect ? ctx.roundRect(x, y, w, h, rr) : rrPath(ctx, x, y, w, h, rr); break; }
    default: if (r > 0) { ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : rrPath(ctx, x, y, w, h, r); } else ctx.rect(x, y, w, h);
  }
}
function rrPath(ctx, x, y, w, h, r) { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

/* --- background --- */
function drawBackground(ctx, bg, W, H) {
  bg = bg || { type: "solid", color: "#111111" };
  if (bg.type === "image") {
    ctx.fillStyle = "#111"; ctx.fillRect(0, 0, W, H);
    drawImageBox(ctx, { asset: bg.asset, fit: "cover", focusX: bg.focusX, focusY: bg.focusY, zoom: bg.zoom, filter: bg.filter, duotone: bg.duotone }, 0, 0, W, H);
    if (bg.overlay) { ctx.fillStyle = paint(ctx, bg.overlay, 0, 0, W, H); ctx.fillRect(0, 0, W, H); }
    return;
  }
  if (bg.type === "linear" || bg.type === "radial") { ctx.fillStyle = makeGrad(ctx, bg, 0, 0, W, H); ctx.fillRect(0, 0, W, H); return; }
  if (bg.type === "mesh") {
    const c = (bg.colors || ["#1b1030", "#5b47a8", "#e8c27a", "#ff6a7a"]).filter(Boolean);
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, W, H);
    const spots = [[.15, .18], [.85, .3], [.3, .85], [.82, .82], [.5, .5]];
    c.slice(1).forEach((col, i) => { const [sx, sy] = spots[i % spots.length], R = Math.max(W, H) * .7, g = ctx.createRadialGradient(sx * W, sy * H, 0, sx * W, sy * H, R); g.addColorStop(0, col); g.addColorStop(1, hexToRgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); });
    return;
  }
  ctx.fillStyle = bg.color || "#111111"; ctx.fillRect(0, 0, W, H);
}
function hexToRgba(c, a) { const m = /^#([0-9a-f]{6})/i.exec(c || ""); if (!m) return `rgba(0,0,0,${a})`; const n = parseInt(m[1], 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }

/* --- images --- */
const duoCache = new Map();
function duotoneCanvas(img, dark, light) {
  const key = img.src + dark + light; if (duoCache.has(key)) return duoCache.get(key);
  const s = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
  const x = c.getContext("2d"); x.drawImage(img, 0, 0, c.width, c.height);
  const id = x.getImageData(0, 0, c.width, c.height), d = id.data, A = hexRgb(dark), B = hexRgb(light);
  for (let i = 0; i < d.length; i += 4) { const g = (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) / 255, t = Math.pow(g, .95); d[i] = A[0] + (B[0] - A[0]) * t; d[i + 1] = A[1] + (B[1] - A[1]) * t; d[i + 2] = A[2] + (B[2] - A[2]) * t; }
  x.putImageData(id, 0, 0); if (duoCache.size > 30) duoCache.clear(); duoCache.set(key, c); return c;
}
function hexRgb(h) { const m = /^#?([0-9a-f]{6})/i.exec(h || ""); const n = m ? parseInt(m[1], 16) : 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function drawImageBox(ctx, l, x, y, w, h) {
  const a = Assets.get(l.asset);
  if (!a || !a.img.naturalWidth) { ctx.fillStyle = "#2A2531"; ctx.fillRect(x, y, w, h); ctx.fillStyle = "#9C93A8"; ctx.font = `600 ${Math.max(14, Math.min(w, h) / 12)}px "DM Sans",sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Image absente", x + w / 2, y + h / 2); return; }
  let src = a.img; const iw = src.naturalWidth, ih = src.naturalHeight;
  if (l.filter === "duotone") src = duotoneCanvas(a.img, (l.duotone && l.duotone[0]) || "#1b1030", (l.duotone && l.duotone[1]) || "#f4c27c");
  const z = clamp(num(l.zoom, 1), 1, 3);
  let s = l.fit === "contain" ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih) * z;
  const dw = iw * s, dh = ih * s, fx = clamp(num(l.focusX, .5), 0, 1), fy = clamp(num(l.focusY, .5), 0, 1);
  const dx = x + (w - dw) * fx, dy = y + (h - dh) * fy;
  if (CANVAS_FILTER && l.filter && l.filter !== "duotone") ctx.filter = IMG_FILTERS[l.filter] || "none";
  ctx.drawImage(src, dx, dy, dw, dh);
  if (CANVAS_FILTER) ctx.filter = "none";
  if (l.filter === "warm") { ctx.fillStyle = "rgba(255,170,90,.07)"; ctx.fillRect(x, y, w, h); }
  if (l.filter === "cool") { ctx.fillStyle = "rgba(90,150,255,.07)"; ctx.fillRect(x, y, w, h); }
}

/* --- text --- */
function textFont(l, size) { return `${l.italic ? "italic " : ""}${l.weight || 400} ${size}px "${l.font || "DM Sans"}", system-ui, sans-serif`; }
function measureSp(ctx, s, sp) { return ctx.measureText(s).width + sp * Math.max(0, [...s].length - 1); }
function layoutText(ctx, l, size) {
  ctx.font = textFont(l, size);
  const sp = num(l.letterSpacing, 0) * size;
  let txt = String(l.text ?? ""); if (l.transform === "upper") txt = txt.toUpperCase();
  if (l.repeat) return { lines: [txt], sp, size, lh: size * num(l.lineHeight, 1.1) };
  const lines = [];
  for (const para of txt.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean); if (!words.length) { lines.push(""); continue; }
    let cur = words[0];
    for (let i = 1; i < words.length; i++) { const t = cur + " " + words[i]; if (measureSp(ctx, t, sp) > l.w) { lines.push(cur); cur = words[i]; } else cur = t; }
    lines.push(cur);
  }
  return { lines, sp, size, lh: size * num(l.lineHeight, 1.1) };
}
function fitText(ctx, l) {
  let size = num(l.size, 60), lay = layoutText(ctx, l, size);
  const tooBig = L2 => L2.lines.length * L2.lh > l.h * 1.02 || L2.lines.some(s => measureSp(ctx, s, L2.sp) > l.w * 1.01);
  if (l.fit !== false) { let guard = 0; while (tooBig(lay) && size > num(l.size, 60) * .3 && guard++ < 40) { size *= .94; lay = layoutText(ctx, l, size); } }
  return lay;
}
function drawSpaced(ctx, s, x, y, sp, mode) {
  if (!sp) { mode === "stroke" ? ctx.strokeText(s, x, y) : ctx.fillText(s, x, y); return; }
  let cx = x; for (const ch of s) { mode === "stroke" ? ctx.strokeText(ch, cx, y) : ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; }
}
function drawText(ctx, l, x, y, w, h) {
  const lay = fitText(ctx, l), { lines, sp, size, lh } = lay;
  ctx.font = textFont(l, size); ctx.textBaseline = "middle"; ctx.textAlign = "left";
  const fill = paint(ctx, l.color || "#ffffff", x, y, w, h);
  if (l.repeat) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const unit = lines[0] + "   ", uw = measureSp(ctx, unit, sp) + sp; const cy = y + h / 2;
    if (l.bg && l.bg.color) { ctx.fillStyle = paint(ctx, l.bg.color, x, y, w, h); ctx.fillRect(x, y, w, h); }
    for (let px = x - uw * .37; px < x + w; px += uw) { if (l.stroke && l.stroke.width) { ctx.lineWidth = l.stroke.width; ctx.strokeStyle = l.stroke.color || "#000"; ctx.lineJoin = "round"; drawSpaced(ctx, unit, px, cy, sp, "stroke"); } if (!l.strokeOnly) { ctx.fillStyle = fill; drawSpaced(ctx, unit, px, cy, sp, "fill"); } }
    ctx.restore(); return;
  }
  const total = lines.length * lh, va = l.vAlign || "top";
  const top = va === "middle" ? y + (h - total) / 2 : va === "bottom" ? y + h - total : y;
  lines.forEach((ln, i) => {
    const lw = measureSp(ctx, ln, sp), al = l.align || "left";
    const lx = al === "center" ? x + (w - lw) / 2 : al === "right" ? x + w - lw : x, ly = top + lh * (i + .5);
    if (l.bg && l.bg.color && ln) { const px = num(l.bg.padX, size * .3), py = num(l.bg.padY, size * .12); ctx.fillStyle = paint(ctx, l.bg.color, lx - px, ly - lh / 2, lw + px * 2, lh); ctx.beginPath(); const rr = num(l.bg.radius, 0); rr ? (ctx.roundRect ? ctx.roundRect(lx - px, ly - size * .55 - py, lw + px * 2, size * 1.1 + py * 2, rr) : rrPath(ctx, lx - px, ly - size * .55 - py, lw + px * 2, size * 1.1 + py * 2, rr)) : ctx.rect(lx - px, ly - size * .55 - py, lw + px * 2, size * 1.1 + py * 2); ctx.fill(); }
    if (l.stroke && num(l.stroke.width, 0) > 0) { ctx.save(); ctx.shadowColor = "transparent"; ctx.lineWidth = l.stroke.width; ctx.strokeStyle = l.stroke.color || "#000"; ctx.lineJoin = "round"; drawSpaced(ctx, ln, lx, ly, sp, "stroke"); ctx.restore(); }
    if (!l.strokeOnly) { ctx.fillStyle = fill; drawSpaced(ctx, ln, lx, ly, sp, "fill"); }
  });
}

/* --- pattern --- */
function drawPattern(ctx, l, x, y, w, h) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const col = l.color || "rgba(255,255,255,.25)", size = Math.max(1, num(l.size, 6)), gap = Math.max(4, num(l.spacing, 28)), ang = num(l.angle, 0) * Math.PI / 180;
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = size;
  const cx = x + w / 2, cy = y + h / 2, R = Math.hypot(w, h) / 2 + gap;
  const k = l.kind || "dots";
  if (k === "dots" || k === "halftone") {
    for (let py = y + gap / 2; py < y + h; py += gap) for (let px = x + gap / 2; px < x + w; px += gap) { const r = k === "halftone" ? size / 2 * (1 - (py - y) / h) * 1.6 + .3 : size / 2; ctx.beginPath(); ctx.arc(px, py, Math.max(.3, r), 0, Math.PI * 2); ctx.fill(); }
  } else if (k === "grid" || k === "stripes") {
    ctx.translate(cx, cy); ctx.rotate(ang);
    for (let p = -R; p < R; p += gap) { ctx.beginPath(); ctx.moveTo(p, -R); ctx.lineTo(p, R); ctx.stroke(); if (k === "grid") { ctx.beginPath(); ctx.moveTo(-R, p); ctx.lineTo(R, p); ctx.stroke(); } }
  } else if (k === "waves") {
    ctx.translate(cx, cy); ctx.rotate(ang);
    for (let p = -R; p < R; p += gap) { ctx.beginPath(); for (let q = -R; q <= R; q += 8) { const yy = p + Math.sin(q / (gap * .9)) * gap * .28; q === -R ? ctx.moveTo(q, yy) : ctx.lineTo(q, yy); } ctx.stroke(); }
  } else if (k === "concentric") {
    for (let r = gap; r < R * 1.2; r += gap) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
  }
  ctx.restore();
}

/* --- layer --- */
function drawLayer(ctx, l) {
  const w = num(l.w, 100), h = num(l.h, 100), x = num(l.x, 0), y = num(l.y, 0);
  ctx.save();
  ctx.globalAlpha = clamp(num(l.opacity, 1), 0, 1);
  ctx.globalCompositeOperation = BLENDS[l.blend] || "source-over";
  ctx.translate(x + w / 2, y + h / 2); if (l.rotation) ctx.rotate(l.rotation * Math.PI / 180); if (l.flipX) ctx.scale(-1, 1);
  const bx = -w / 2, by = -h / 2;
  if (l.shadow && l.shadow.color) { ctx.shadowColor = l.shadow.color; ctx.shadowBlur = num(l.shadow.blur, 20); ctx.shadowOffsetX = num(l.shadow.x, 0); ctx.shadowOffsetY = num(l.shadow.y, 8); }
  if (l.type === "shape") {
    const kind = l.shape || "rect";
    if (kind === "line") { ctx.strokeStyle = paint(ctx, l.fill || (l.stroke && l.stroke.color) || "#fff", bx, by, w, h); ctx.lineWidth = Math.max(1, (l.stroke && l.stroke.width) || h || 2); if (l.stroke && l.stroke.dash) ctx.setLineDash(l.stroke.dash); ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + w, 0); ctx.stroke(); }
    else if ((kind === "ellipse" || kind === "circle") && num(l.blur, 0) > 0) {
      const col = typeof l.fill === "string" ? l.fill : (l.fill && l.fill.colors && l.fill.colors[0]) || "#fff";
      ctx.save(); ctx.scale(1, h / Math.max(1, w)); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2); g.addColorStop(0, col); g.addColorStop(.45, col.startsWith("#") ? hexToRgba(col, .55) : col); g.addColorStop(1, col.startsWith("#") ? hexToRgba(col, 0) : "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, w / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    } else {
      if (CANVAS_FILTER && num(l.blur, 0) > 0) ctx.filter = `blur(${l.blur}px)`;
      shapePath(ctx, kind, bx, by, w, h, l);
      const f = paint(ctx, l.fill, bx, by, w, h); if (f) { ctx.fillStyle = f; ctx.fill(); }
      if (l.stroke && num(l.stroke.width, 0) > 0) { ctx.shadowColor = "transparent"; ctx.lineWidth = l.stroke.width; ctx.strokeStyle = paint(ctx, l.stroke.color || "#fff", bx, by, w, h); if (l.stroke.dash) ctx.setLineDash(l.stroke.dash); ctx.stroke(); }
      if (CANVAS_FILTER) ctx.filter = "none";
    }
  } else if (l.type === "image") {
    let ix = bx, iy = by, iw = w, ih = h;
    if (l.frame === "polaroid") { const p = w * .05; ctx.fillStyle = "#FBF8F2"; ctx.fillRect(bx, by, w, h); ctx.shadowColor = "transparent"; ix = bx + p; iy = by + p; iw = w - p * 2; ih = h - p - w * .2; }
    ctx.save(); if (l.frame !== "polaroid") { ctx.save(); shapePath(ctx, l.mask || "rect", ix, iy, iw, ih, l); if (ctx.shadowColor !== "transparent" && l.shadow) { ctx.fillStyle = "#000"; ctx.fill(); } ctx.restore(); ctx.shadowColor = "transparent"; }
    shapePath(ctx, l.frame === "polaroid" ? "rect" : (l.mask || "rect"), ix, iy, iw, ih, l); ctx.clip();
    drawImageBox(ctx, l, ix, iy, iw, ih); ctx.restore();
    if (l.border && num(l.border.width, 0) > 0) { ctx.shadowColor = "transparent"; shapePath(ctx, l.frame === "polaroid" ? "rect" : (l.mask || "rect"), ix, iy, iw, ih, l); ctx.lineWidth = l.border.width; ctx.strokeStyle = l.border.color || "#fff"; ctx.stroke(); }
    if (l.tape) { ctx.shadowColor = "transparent"; ctx.save(); ctx.translate(0, by + 4); ctx.rotate(-.05); ctx.fillStyle = "rgba(240,228,200,.78)"; ctx.fillRect(-w * .16, -w * .035, w * .32, w * .07); ctx.restore(); }
  } else if (l.type === "text") {
    ctx.save(); if (!(l.shadow && l.shadow.color)) ctx.shadowColor = "transparent"; drawText(ctx, l, bx, by, w, h); ctx.restore();
  } else if (l.type === "pattern") {
    ctx.shadowColor = "transparent"; drawPattern(ctx, l, bx, by, w, h);
  }
  ctx.restore();
}

/* --- fx --- */
let grainCanvas = null;
function grain() { if (grainCanvas) return grainCanvas; const c = document.createElement("canvas"); c.width = c.height = 220; const x = c.getContext("2d"), id = x.createImageData(220, 220); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); grainCanvas = c; return c; }
function drawFx(ctx, fx, W, H) {
  if (!fx) return;
  if (num(fx.vignette, 0) > 0) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) / 2); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${clamp(fx.vignette, 0, .9)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (num(fx.grain, 0) > 0) { ctx.save(); ctx.globalAlpha = clamp(fx.grain, 0, .5); ctx.globalCompositeOperation = "overlay"; ctx.fillStyle = ctx.createPattern(grain(), "repeat"); ctx.fillRect(0, 0, W, H); ctx.restore(); }
}
function renderDesign(ctx, d, scale = 1) {
  ctx.save(); ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.clearRect(0, 0, d.w, d.h);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, d.w, d.h); ctx.clip();
  drawBackground(ctx, d.background, d.w, d.h);
  for (const l of d.layers || []) if (!l.hidden) { try { drawLayer(ctx, l); } catch (e) { console.warn("calque", e); } }
  drawFx(ctx, d.fx, d.w, d.h);
  ctx.restore(); ctx.restore();
}
async function renderToCanvas(d, maxSide) {
  await prepareDesign(d);
  const s = maxSide ? Math.min(1, maxSide / Math.max(d.w, d.h)) : 1, c = document.createElement("canvas");
  c.width = Math.round(d.w * s); c.height = Math.round(d.h * s); renderDesign(c.getContext("2d"), d, s); return c;
}
async function renderBlob(d, maxSide, type = "image/jpeg", q = .88) { const c = await renderToCanvas(d, maxSide); return new Promise(r => c.toBlob(r, type, q)); }
async function renderThumb(d) { const c = await renderToCanvas(d, 360); return c.toDataURL("image/jpeg", .74); }
function hitLayer(d, px, py, includeLocked) {
  const ls = d.layers || [];
  for (let i = ls.length - 1; i >= 0; i--) {
    const l = ls[i]; if (l.hidden || (l.locked && !includeLocked)) continue;
    const cx = l.x + l.w / 2, cy = l.y + l.h / 2, a = -(l.rotation || 0) * Math.PI / 180;
    const dx = px - cx, dy = py - cy, rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
    const pad = l.type === "shape" && l.shape === "line" ? 14 : 0;
    if (Math.abs(rx) <= l.w / 2 + pad && Math.abs(ry) <= l.h / 2 + pad) return l;
  }
  return null;
}
