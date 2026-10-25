/* ================= CREATIONS (designs) ================= */
const Designs = {
  list: null,
  async load(force) { if (this.list && !force) return this.list; this.list = (await Store.all("design")).filter(d => d.ws === WS.cur.id).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); return this.list; },
  async save(doc) { doc.thumb = await renderThumb(doc.design).catch(() => doc.thumb); await Store.put("design", doc); if (this.list && !this.list.includes(doc)) this.list.unshift(doc); },
  saveSoon(doc) { clearTimeout(this._t); this._t = setTimeout(() => this.save(doc), 1500); },
  async del(id) { await Store.del("design", id); if (this.list) this.list = this.list.filter(d => d.id !== id); },
  make(b, design) { return { id: uid("d"), ws: WS.cur.id, name: (b.infos && b.infos.title) || (b.idea || KINDS[b.kind]?.label || "Création").slice(0, 48), kind: b.kind, format: b.format, brief: b, design, chat: [], thumb: "", createdAt: Date.now() }; }
};

/* ================= BRIEF SCREEN ================= */
const Brief = {
  b: null,
  fresh(over = {}) { return Object.assign({ kind: "post", format: "post", idea: "", infos: { title: "", date: "", place: "", price: "", cta: "", extra: "" }, style: "auto", assets: [], useLogo: true, quality: true }, over); },
  prefill(o) { this.b = this.fresh(o); if (o.kind && KINDS[o.kind] && !o.format) this.b.format = KINDS[o.kind].fmt; },
  render() {
    if (!this.b) this.b = this.fresh();
    const b = this.b, ev = ["event", "flyer", "poster", "ad", "menu", "banner"].includes(b.kind);
    const kinds = Object.entries(KINDS).map(([k, v]) => { const F = FORMATS[v.fmt], r = F.w / F.h, hh = 40, ww = Math.round(hh * r); return `<button class="kind" data-kind="${k}" aria-pressed="${b.kind === k}"><div class="kshape"><i style="width:${Math.min(ww, 64)}px;height:${Math.round(Math.min(ww, 64) / r)}px"></i></div><b>${v.label}</b><span>${F.label}</span></button>`; }).join("");
    const styles = STYLES.map(([k, l, sw, f]) => `<button class="stylec" data-style="${k}" aria-pressed="${b.style === k}"><div class="sw" style="background:${sw};font-family:'${f}'">Aa</div><b>${l}</b></button>`).join("");
    const photos = Assets.list.filter(a => a.tag !== "screenshot");
    $("#briefScreen").innerHTML = `<div class="page">
      <div class="page-h"><div class="grow"><div class="eyebrow">Studio de création · ${esc(WS.cur.name)}</div><h1>Que veux-tu créer ?</h1><p>Décris ton idée comme à un directeur artistique. L'IA compose un visuel complet, le relit sur son rendu réel et le corrige avant de te le montrer.</p></div>
      <button class="btn" id="bBlank">Page blanche</button></div>
      <div class="card"><div class="sec-h"><h2>1. Type de création</h2></div><div class="kinds">${kinds}</div>
        <div class="row"><span class="lbl">Format</span><select class="sel" id="bFmt" style="width:auto">${Object.entries(FORMATS).map(([k, f]) => `<option value="${k}"${k === b.format ? " selected" : ""}>${f.label} · ${f.w}×${f.h}</option>`).join("")}</select></div></div>
      <div class="card"><div class="sec-h"><h2>2. Ton idée</h2></div>
        <textarea class="inp" id="bIdea" rows="3" placeholder="Ex : Soirée « Golden Hour » sur un rooftop, ambiance chic et chaude, je veux que ça respire le coucher de soleil et le champagne.">${esc(b.idea)}</textarea>
        <details ${ev || Object.values(b.infos).some(Boolean) ? "open" : ""}><summary class="lbl" style="cursor:pointer;padding:4px 0">Textes et infos à afficher (recommandé pour flyers, affiches, événements)</summary>
          <div class="g2" style="margin-top:10px">
            <div class="fld"><label class="lbl" for="bT">Titre / nom</label><input class="inp" id="bT" data-info="title" value="${esc(b.infos.title)}" placeholder="GOLDEN HOUR"></div>
            <div class="fld"><label class="lbl" for="bD">Date et heure</label><input class="inp" id="bD" data-info="date" value="${esc(b.infos.date)}" placeholder="Samedi 14 nov · 19h"></div>
            <div class="fld"><label class="lbl" for="bP">Lieu</label><input class="inp" id="bP" data-info="place" value="${esc(b.infos.place)}" placeholder="Rooftop, Paris 8e"></div>
            <div class="fld"><label class="lbl" for="bPr">Prix / offre</label><input class="inp" id="bPr" data-info="price" value="${esc(b.infos.price)}" placeholder="Entrée 15 € · 1 coupe offerte"></div>
            <div class="fld"><label class="lbl" for="bC">Contact / appel à l'action</label><input class="inp" id="bC" data-info="cta" value="${esc(b.infos.cta)}" placeholder="Réservation en DM"></div>
            <div class="fld"><label class="lbl" for="bE">Autres infos</label><input class="inp" id="bE" data-info="extra" value="${esc(b.infos.extra)}" placeholder="DJ set, dress code blanc"></div>
          </div></details></div>
      <div class="card"><div class="sec-h"><h2>3. Direction artistique</h2><span class="note">La charte de « ${esc(WS.cur.name)} » est toujours prise en compte.</span></div><div class="styles">${styles}</div></div>
      <div class="card"><div class="sec-h"><h2>4. Tes images</h2><span class="note">${b.assets.length ? `${b.assets.length} sélectionnée${b.assets.length > 1 ? "s" : ""}` : "Optionnel : sans image, l'IA compose en typographie et graphisme."}</span></div>
        <div class="assets"><button class="asset add" id="bAdd" aria-label="Importer des images">+</button>${photos.map(a => `<button class="asset" data-asset="${a.id}" aria-pressed="${b.assets.includes(a.id)}" style="background-image:url('${a.url}')" aria-label="${esc(a.name)}">${WS.cur.logo === a.id ? '<span class="tag">logo</span>' : ""}</button>`).join("")}</div>
        <label class="row" style="gap:8px"><input type="checkbox" id="bLogo" ${b.useLogo ? "checked" : ""} ${WS.cur.logo ? "" : "disabled"}><span class="note">${WS.cur.logo ? "Ajouter le logo de la marque" : "Aucun logo : ajoute-le dans Identité de marque"}</span></label></div>
      <div class="launch">
        <button class="btn ai big" id="bGo">✦ Créer le visuel</button>
        <button class="btn big" id="bVar">✦ 3 propositions</button>
        <label class="row" style="gap:8px"><input type="checkbox" id="bQ" ${b.quality ? "checked" : ""}><span class="note">Relecture critique par l'IA (plus long, meilleur résultat)</span></label>
        ${AI.ok() || !AI.ready ? "" : `<span class="err">${AI.unavailableMsg()}</span>`}
      </div>
      <div id="bRecent"></div>
    </div>`;
    this.bind(); this.renderRecent();
  },
  async renderRecent() {
    const list = (await Designs.load()).slice(0, 6); const el = $("#bRecent"); if (!el) return;
    el.innerHTML = list.length ? `<div class="sec-h" style="margin-bottom:12px"><h2>Dernières créations</h2></div><div class="thumbs">${list.map(thumbCard).join("")}</div>` : "";
  },
  bind() {
    const b = this.b, S = $("#briefScreen");
    S.onclick = async e => {
      const k = e.target.closest("[data-kind]"); if (k) { b.kind = k.dataset.kind; b.format = KINDS[b.kind].fmt; return this.keep(); }
      const st = e.target.closest("[data-style]"); if (st) { b.style = st.dataset.style; $$("[data-style]", S).forEach(x => x.setAttribute("aria-pressed", x === st)); return; }
      const a = e.target.closest("[data-asset]"); if (a) { const id = a.dataset.asset, i = b.assets.indexOf(id); i >= 0 ? b.assets.splice(i, 1) : b.assets.push(id); a.setAttribute("aria-pressed", i < 0); return; }
      const th = e.target.closest("[data-open]"); if (th) return Editor.open(th.dataset.open);
    };
    $("#bAdd").onclick = async () => { this.read(); const got = await importImages(await pickFiles()); got.forEach(a => b.assets.push(a.id)); this.render(); };
    $("#bFmt").onchange = e => b.format = e.target.value;
    $("#bBlank").onclick = () => { this.read(); const doc = Designs.make(b, blankDesign(b.format)); doc.name = "Sans titre"; Designs.save(doc).then(() => Editor.open(doc.id)); };
    $("#bGo").onclick = () => { this.read(); Editor.createFromBrief(JSON.parse(JSON.stringify(b))); };
    $("#bVar").onclick = () => { this.read(); Variants.fromBrief(JSON.parse(JSON.stringify(b))); };
  },
  read() { const b = this.b; if (!$("#bIdea")) return; b.idea = $("#bIdea").value.trim(); $$("[data-info]").forEach(i => b.infos[i.dataset.info] = i.value.trim()); b.useLogo = $("#bLogo").checked; b.quality = $("#bQ").checked; b.format = $("#bFmt").value; },
  keep() { this.read(); this.render(); }
};
function thumbCard(d) {
  return `<div class="thumb"><button style="all:unset;cursor:pointer;display:block" data-open="${d.id}" aria-label="Ouvrir ${esc(d.name)}"><div class="im" style="background-image:url('${d.thumb || ""}');aspect-ratio:${d.design ? d.design.w + "/" + d.design.h : "4/5"}"></div></button><div class="meta"><b>${esc(d.name)}</b><span>${esc((KINDS[d.kind] || {}).label || "Création")} · ${fmtDate(d.updatedAt)}</span></div></div>`;
}

/* ================= EDITOR ================= */
const Editor = {
  doc: null, sel: null, scale: 1, undo: [], redo: [], busy: null, ctl: null,
  async open(id) {
    await Designs.load(); const doc = Designs.list.find(d => d.id === id); if (!doc) return toast("Création introuvable.");
    App.go("create", { editor: true }); this.doc = doc; this.sel = null; this.undo = []; this.redo = []; this.updUndo();
    $("#briefScreen").hidden = true; $("#editor").hidden = false;
    $("#edTitle").value = doc.name; $("#edFmt").textContent = `${(FORMATS[doc.format] || {}).label || ""} · ${doc.design.w}×${doc.design.h}`;
    await prepareDesign(doc.design); this.fit(); this.draw(); this.renderAll(); this.etab("ai");
  },
  close() { if (this.doc) Designs.save(this.doc); this.doc = null; $("#editor").hidden = true; $("#briefScreen").hidden = false; },
  renderAll() { this.renderChat(); this.renderLayers(); this.renderProps(); this.renderMedia(); },
  get d() { return this.doc && this.doc.design; },
  layer(id = this.sel) { return this.d && this.d.layers.find(l => l.id === id); },
  snap() { return JSON.stringify(this.d); },
  push(s = this.snap()) { this.undo.push(s); if (this.undo.length > 80) this.undo.shift(); this.redo = []; this.updUndo(); },
  updUndo() { $("#edUndo").disabled = !this.undo.length; $("#edRedo").disabled = !this.redo.length; },
  restore(s) { this.doc.design = JSON.parse(s); if (this.sel && !this.layer()) this.sel = null; prepareDesign(this.d).then(() => { this.fit(); this.draw(); this.renderAll(); }); this.changed(); },
  doUndo() { if (!this.undo.length) return; this.redo.push(this.snap()); this.restore(this.undo.pop()); this.updUndo(); },
  doRedo() { if (!this.redo.length) return; this.undo.push(this.snap()); this.restore(this.redo.pop()); this.updUndo(); },
  changed() { Designs.saveSoon(this.doc); },
  fit() {
    if (!this.d) return; const st = $("#edStage").getBoundingClientRect(); if (!st.width) return;
    const pad = 28, s = Math.min((st.width - pad * 2) / this.d.w, (st.height - pad * 2) / this.d.h); this.scale = Math.max(.05, s);
    const cw = Math.round(this.d.w * this.scale), ch = Math.round(this.d.h * this.scale), dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [$("#edCv"), $("#edOv")]) { c.style.width = cw + "px"; c.style.height = ch + "px"; c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
    this.dpr = dpr; $("#edWrap").style.width = cw + "px"; $("#edWrap").style.height = ch + "px";
  },
  _q: false,
  draw() { if (this._q) return; this._q = true; requestAnimationFrame(() => { this._q = false; if (!this.d) return; renderDesign($("#edCv").getContext("2d"), this.d, this.scale * this.dpr); this.drawOv(); }); },
  drawOv(guides) {
    const c = $("#edOv"), x = c.getContext("2d"), s = this.scale * this.dpr; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
    const l = this.layer(); x.setTransform(s, 0, 0, s, 0, 0);
    if (guides) { x.strokeStyle = "#ff4fd8"; x.lineWidth = 1 / this.scale; for (const g of guides) { x.beginPath(); g.v ? (x.moveTo(g.v, 0), x.lineTo(g.v, this.d.h)) : (x.moveTo(0, g.h), x.lineTo(this.d.w, g.h)); x.stroke(); } }
    if (!l) return;
    x.save(); x.translate(l.x + l.w / 2, l.y + l.h / 2); x.rotate((l.rotation || 0) * Math.PI / 180);
    x.strokeStyle = l.locked ? "#9C93A8" : "#E8C27A"; x.lineWidth = 2 / this.scale; x.setLineDash(l.locked ? [6 / this.scale, 4 / this.scale] : []); x.strokeRect(-l.w / 2, -l.h / 2, l.w, l.h); x.setLineDash([]);
    if (!l.locked) { const hs = 9 / this.scale; x.fillStyle = "#fff"; x.strokeStyle = "#E8C27A"; for (const [hx, hy] of this.handles(l)) { x.beginPath(); x.rect(hx - hs / 2, hy - hs / 2, hs, hs); x.fill(); x.stroke(); } x.beginPath(); x.moveTo(0, -l.h / 2); x.lineTo(0, -l.h / 2 - 26 / this.scale); x.stroke(); x.beginPath(); x.arc(0, -l.h / 2 - 30 / this.scale, 6 / this.scale, 0, Math.PI * 2); x.fill(); x.stroke(); }
    x.restore();
  },
  handles(l) { return [[-l.w / 2, -l.h / 2], [l.w / 2, -l.h / 2], [l.w / 2, l.h / 2], [-l.w / 2, l.h / 2], [l.w / 2, 0], [0, l.h / 2], [-l.w / 2, 0], [0, -l.h / 2]]; },
  local(l, px, py) { const cx = l.x + l.w / 2, cy = l.y + l.h / 2, a = -(l.rotation || 0) * Math.PI / 180, dx = px - cx, dy = py - cy; return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]; },
  pointer(e) { const r = $("#edOv").getBoundingClientRect(); return [(e.clientX - r.left) / this.scale, (e.clientY - r.top) / this.scale]; },
  onDown(e) {
    if (!this.d || this.busy) return; const [px, py] = this.pointer(e); let l = this.layer(), mode = null, hIdx = -1;
    if (l && !l.locked) {
      const [lx, ly] = this.local(l, px, py), tol = 12 / this.scale;
      if (Math.hypot(lx, ly + l.h / 2 + 30 / this.scale) < tol * 1.3) mode = "rot";
      else this.handles(l).forEach(([hx, hy], i) => { if (mode === null && Math.abs(lx - hx) < tol && Math.abs(ly - hy) < tol) { mode = "rs"; hIdx = i; } });
    }
    if (!mode) { const hit = hitLayer(this.d, px, py); if (hit) { if (hit.id !== this.sel) { this.select(hit.id); } l = hit; mode = "mv"; } else { this.select(null); return; } }
    const before = this.snap(), o = { x: l.x, y: l.y, w: l.w, h: l.h, rot: l.rotation || 0, size: l.size }; let moved = false;
    const ov = $("#edOv"); ov.setPointerCapture(e.pointerId);
    const mv = ev => {
      const [qx, qy] = this.pointer(ev); const dx = qx - px, dy = qy - py; if (!moved && Math.hypot(dx, dy) * this.scale < 3) return; moved = true; let guides = [];
      if (mode === "mv") {
        let nx = o.x + dx, ny = o.y + dy; const sn = 8 / this.scale, W = this.d.w, H = this.d.h, m = Math.round(Math.min(W, H) * .06);
        const cxs = [[W / 2, nx + l.w / 2, v => v - l.w / 2], [m, nx, v => v], [W - m, nx + l.w, v => v - l.w]];
        for (const [t, cur, f] of cxs) if (Math.abs(cur - t) < sn) { nx = f(t); guides.push({ v: t }); break; }
        const cys = [[H / 2, ny + l.h / 2, v => v - l.h / 2], [m, ny, v => v], [H - m, ny + l.h, v => v - l.h]];
        for (const [t, cur, f] of cys) if (Math.abs(cur - t) < sn) { ny = f(t); guides.push({ h: t }); break; }
        l.x = Math.round(nx); l.y = Math.round(ny);
      } else if (mode === "rot") {
        const cx = o.x + o.w / 2, cy = o.y + o.h / 2; let a = Math.atan2(qy - cy, qx - cx) * 180 / Math.PI + 90; if (!ev.shiftKey) { const sn = Math.round(a / 45) * 45; if (Math.abs(a - sn) < 4) a = sn; } l.rotation = Math.round(a * 10) / 10;
      } else {
        const a = (o.rot) * Math.PI / 180, ldx = dx * Math.cos(-a) - dy * Math.sin(-a), ldy = dx * Math.sin(-a) + dy * Math.cos(-a);
        const [hx, hy] = this.handles({ w: o.w, h: o.h })[hIdx], sxn = Math.sign(hx), syn = Math.sign(hy);
        let nw = o.w + ldx * sxn, nh = o.h + ldy * syn; const keep = (l.type === "image" || ev.shiftKey) && sxn && syn;
        if (keep) { const k = Math.max(nw / o.w, nh / o.h); nw = o.w * k; nh = o.h * k; }
        nw = Math.max(10, nw); nh = Math.max(4, nh);
        if (l.type === "text" && sxn && syn && ev.shiftKey) l.size = Math.round(o.size * nw / o.w);
        const dwc = (nw - o.w) / 2 * sxn, dhc = (nh - o.h) / 2 * syn, ccx = o.x + o.w / 2 + dwc * Math.cos(a) - dhc * Math.sin(a), ccy = o.y + o.h / 2 + dwc * Math.sin(a) + dhc * Math.cos(a);
        l.w = Math.round(nw); l.h = Math.round(nh); l.x = Math.round(ccx - nw / 2); l.y = Math.round(ccy - nh / 2);
      }
      renderDesign($("#edCv").getContext("2d"), this.d, this.scale * this.dpr); this.drawOv(guides);
    };
    const up = () => { ov.removeEventListener("pointermove", mv); ov.removeEventListener("pointerup", up); ov.removeEventListener("pointercancel", up); if (moved) { this.push(before); this.changed(); this.renderProps(); } this.drawOv(); };
    ov.addEventListener("pointermove", mv); ov.addEventListener("pointerup", up); ov.addEventListener("pointercancel", up);
  },
  select(id) { this.sel = id; this.drawOv(); this.renderLayers(); this.renderProps(); },
  addLayer(l) { this.push(); l.id = uid("l"); this.d.layers.push(l); this.select(l.id); this.draw(); this.changed(); },
  addText() { const W = this.d.w, b = WS.cur; this.addLayer({ type: "text", name: "Texte", text: "Nouveau texte", font: b.fonts.body || "DM Sans", weight: 700, italic: false, size: Math.round(W * .06), color: (b.colors || [])[1] || "#ffffff", align: "center", vAlign: "middle", lineHeight: 1.1, letterSpacing: 0, transform: "none", fit: true, x: Math.round(W * .15), y: Math.round(this.d.h * .45), w: Math.round(W * .7), h: Math.round(W * .14), rotation: 0, opacity: 1, blend: "normal" }); loadFontFor(this.layer()); },
  addShape() { const W = this.d.w; this.addLayer({ type: "shape", name: "Forme", shape: "rounded", fill: (WS.cur.colors || [])[2] || "#E8C27A", radius: 24, x: Math.round(W * .3), y: Math.round(this.d.h * .4), w: Math.round(W * .4), h: Math.round(W * .2), rotation: 0, opacity: 1, blend: "normal" }); },
  addImage(id) { const a = Assets.get(id); if (!a) return; const W = this.d.w, r = (a.h || a.img.naturalHeight) / (a.w || a.img.naturalWidth), w = Math.round(W * .6); this.addLayer({ type: "image", name: a.name.slice(0, 30), asset: id, fit: "cover", focusX: .5, focusY: .5, zoom: 1, mask: "rect", radius: 0, filter: "none", frame: "none", x: Math.round((W - w) / 2), y: Math.round((this.d.h - w * r) / 2), w, h: Math.round(w * r), rotation: 0, opacity: 1, blend: "normal" }); },
  arrange(dir) { const ls = this.d.layers, i = ls.findIndex(l => l.id === this.sel); if (i < 0) return; const j = dir === "up" ? i + 1 : dir === "down" ? i - 1 : dir === "top" ? ls.length - 1 : 0; if (j < 0 || j >= ls.length || j === i) return; this.push(); const [l] = ls.splice(i, 1); ls.splice(j, 0, l); this.draw(); this.renderLayers(); this.changed(); },
  dup() { const l = this.layer(); if (!l) return; const c = JSON.parse(JSON.stringify(l)); c.x += 24; c.y += 24; c.name = (c.name || "") + " copie"; this.addLayer(c); },
  del() { const i = this.d.layers.findIndex(l => l.id === this.sel); if (i < 0) return; this.push(); this.d.layers.splice(i, 1); this.sel = null; this.draw(); this.renderLayers(); this.renderProps(); this.changed(); },

  /* --- panels --- */
  etab(n) { $$("[data-etab]").forEach(b => b.setAttribute("aria-selected", b.dataset.etab === n)); $$("[data-epane]").forEach(p => p.hidden = p.dataset.epane !== n); },
  renderLayers() {
    if (!this.d) return;
    const ic = l => l.type === "text" ? "T" : l.type === "image" ? "▣" : l.type === "pattern" ? "⁘" : "◆";
    $("#edLayers").innerHTML = `<button class="lay${!this.sel ? " sel" : ""}" data-lay=""><span class="ic">▤</span><span class="nm">Fond et effets</span></button>` + [...this.d.layers].reverse().map(l => `<div class="lay${l.id === this.sel ? " sel" : ""}${l.hidden ? " off" : ""}" data-lay="${l.id}" role="button" tabindex="0"><span class="ic">${ic(l)}</span><span class="nm">${esc(l.name || (l.type === "text" ? l.text : l.type))}</span><button class="tg" data-hide="${l.id}" aria-label="${l.hidden ? "Afficher" : "Masquer"}">${l.hidden ? "◌" : "◉"}</button><button class="tg" data-lock="${l.id}" aria-label="${l.locked ? "Déverrouiller" : "Verrouiller"}">${l.locked ? "🔒" : "○"}</button></div>`).join("");
  },
  renderMedia() {
    const list = Assets.list.filter(a => a.tag !== "screenshot");
    $("#edAssets").innerHTML = `<button class="asset add" data-up="1" aria-label="Importer">+</button>` + list.map(a => `<button class="asset" data-addimg="${a.id}" style="background-image:url('${a.url}')" aria-label="${esc(a.name)}"></button>`).join("");
  },
  renderChat() {
    const doc = this.doc; if (!doc) return;
    const items = (doc.chat || []).map(m => `<div class="msg ${m.role}${m.err ? " err" : ""}">${esc(m.text)}${m.list && m.list.length ? `<ul>${m.list.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${m.undo && this.undo.length ? `<div class="acts"><button class="btn sm" data-undo="1">↶ Annuler ce changement</button></div>` : ""}</div>`).join("");
    $("#edChat").innerHTML = (items || `<div class="msg ai">Je suis ton directeur artistique. Demande-moi n'importe quel changement : composition, typographie, couleurs, textes, ambiance, format… ou touche un élément du visuel pour le régler à la main.</div>`);
    const q = ["Plus premium", "Plus audacieux", "Plus épuré", "Titre plus impactant", "Change la palette", "Améliore la lisibilité", "Ajoute de la matière", "Version sombre", "Version claire", "Réécris les textes"];
    $("#edQuick").innerHTML = q.map(t => `<button class="chip" ${this.busy ? "disabled" : ""}>${t}</button>`).join("");
    $("#edSend").disabled = !!this.busy; $("#edCritique").disabled = !!this.busy;
    $("#edAdapt").innerHTML = `<option value="">Adapter au format…</option>` + Object.entries(FORMATS).filter(([k]) => k !== doc.format).map(([k, f]) => `<option value="${k}">${f.label}</option>`).join("");
    const box = $("#edChat").parentElement; box.scrollTop = box.scrollHeight;
  },
  renderProps() {
    const P = $("#edProps"); if (!this.d) return; const l = this.layer();
    const col = (k, v, lab) => `<div class="fld"><span class="lbl">${lab}</span><div class="crow"><input type="color" data-k="${k}" value="${/^#[0-9a-f]{6}/i.test(v || "") ? v.slice(0, 7) : "#ffffff"}" aria-label="${lab}"><input class="inp" data-k="${k}" data-txt value="${esc(typeof v === "string" ? v : "")}" aria-label="${lab} (code)"></div></div>`;
    const sel = (k, v, opts, lab) => `<div class="fld"><label class="lbl">${lab}</label><select class="sel" data-k="${k}">${opts.map(o => { const [val, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}"${String(val) === String(v) ? " selected" : ""}>${esc(t)}</option>`; }).join("")}</select></div>`;
    const rng = (k, v, mn, mx, st, lab) => `<div class="fld"><span class="lbl">${lab} <span style="font-family:var(--f-mono)">${Math.round(num(v, 0) * 100) / 100}</span></span><input type="range" data-k="${k}" data-num min="${mn}" max="${mx}" step="${st}" value="${num(v, 0)}" aria-label="${lab}"></div>`;
    if (!l) {
      const bg = this.d.background || {};
      P.innerHTML = `<div class="props"><div class="grp"><h3>Fond</h3>${sel("bg.type", bg.type, [["solid", "Couleur unie"], ["linear", "Dégradé linéaire"], ["radial", "Dégradé radial"], ["mesh", "Dégradé maillé"], ["image", "Photo"]], "Type")}
        ${bg.type === "solid" ? col("bg.color", bg.color, "Couleur") : bg.type === "image" ? `<p class="note">Photo de fond : choisis-en une dans l'onglet Médias en sélectionnant le fond.</p>${sel("bg.filter", bg.filter || "none", Object.keys(IMG_FILTERS), "Filtre")}` : (bg.colors || []).map((c, i) => col(`bg.colors.${i}`, c, `Couleur ${i + 1}`)).join("") + (bg.type === "linear" ? rng("bg.angle", bg.angle ?? 180, 0, 360, 5, "Angle") : "")}</div>
        <div class="grp"><h3>Effets</h3>${rng("fx.grain", this.d.fx?.grain || 0, 0, .3, .01, "Grain")}${rng("fx.vignette", this.d.fx?.vignette || 0, 0, .8, .02, "Vignettage")}</div>
        <div class="grp"><h3>Couleurs de la marque</h3><div class="row">${(WS.cur.colors || []).map(c => `<span class="swatch" style="background:${c}" title="${c}"></span>`).join("")}</div><p class="note">Touche un élément du visuel pour le modifier.</p></div></div>`;
      return;
    }
    let h = `<div class="props"><div class="grp"><h3>${l.type === "text" ? "Texte" : l.type === "image" ? "Image" : l.type === "pattern" ? "Motif" : "Forme"}</h3>
      <div class="num4">${["x", "y", "w", "h"].map(k => `<label>${k.toUpperCase()}<input type="number" data-k="${k}" data-num value="${Math.round(l[k])}"></label>`).join("")}</div>
      ${rng("rotation", l.rotation || 0, -180, 180, 1, "Rotation")}${rng("opacity", l.opacity ?? 1, 0, 1, .01, "Opacité")}
      ${sel("blend", l.blend || "normal", Object.keys(BLENDS), "Fusion")}</div>`;
    if (l.type === "text") {
      h += `<div class="grp"><div class="fld"><label class="lbl">Texte</label><textarea class="inp" data-k="text" rows="3">${esc(l.text)}</textarea></div>
        ${sel("font", l.font, FONT_NAMES, "Police")}
        <div class="g2">${sel("weight", l.weight, [100, 200, 300, 400, 500, 600, 700, 800, 900], "Graisse")}${sel("italic", l.italic ? "1" : "", [["", "Droit"], ["1", "Italique"]], "Style")}</div>
        ${rng("size", l.size, 8, Math.round(this.d.w * .5), 1, "Taille")}${rng("lineHeight", l.lineHeight ?? 1.1, .7, 2, .01, "Interligne")}${rng("letterSpacing", l.letterSpacing || 0, -.15, .6, .01, "Approche")}
        <div class="segs">${["left", "center", "right"].map(a => `<button data-set="align" data-v="${a}" aria-pressed="${(l.align || "left") === a}">${({ left: "Gauche", center: "Centre", right: "Droite" })[a]}</button>`).join("")}</div>
        <div class="segs">${[["none", "Aa"], ["upper", "AA"]].map(([a, t]) => `<button data-set="transform" data-v="${a}" aria-pressed="${(l.transform || "none") === a}">${t}</button>`).join("")}<button data-set="strokeOnly" data-v="${l.strokeOnly ? "" : "1"}" aria-pressed="${!!l.strokeOnly}">Contour</button><button data-set="repeat" data-v="${l.repeat ? "" : "1"}" aria-pressed="${!!l.repeat}">Bandeau</button></div>
        ${typeof l.color === "string" ? col("color", l.color, "Couleur") : `<p class="note">Couleur en dégradé (demande à l'IA pour la changer).</p>`}
        ${col("stroke.color", l.stroke?.color || "#000000", "Contour")}${rng("stroke.width", l.stroke?.width || 0, 0, 30, .5, "Épaisseur du contour")}
        ${col("bg.color", typeof l.bg?.color === "string" ? l.bg.color : "", "Surlignage (vide = aucun)")}</div>`;
    } else if (l.type === "shape") {
      h += `<div class="grp">${sel("shape", l.shape, SHAPES, "Forme")}${typeof l.fill === "string" || !l.fill ? col("fill", l.fill || "", "Remplissage (vide = aucun)") : (l.fill.colors || []).map((c, i) => col(`fill.colors.${i}`, c, `Dégradé ${i + 1}`)).join("")}
        ${col("stroke.color", l.stroke?.color || "#ffffff", "Contour")}${rng("stroke.width", l.stroke?.width || 0, 0, 40, .5, "Épaisseur")}
        ${rng("radius", l.radius || 0, 0, Math.round(Math.min(l.w, l.h) / 2), 1, "Arrondi")}${rng("blur", l.blur || 0, 0, 300, 1, "Flou / halo")}
        ${l.shape === "star" ? rng("points", l.points || 12, 3, 30, 1, "Branches") + rng("inner", l.inner ?? .78, .3, .95, .01, "Creux") : ""}${l.shape === "blob" ? `<button class="btn sm" data-reseed="1">Nouvelle forme</button>` : ""}</div>`;
    } else if (l.type === "image") {
      h += `<div class="grp">${sel("mask", l.mask || "rect", MASKS, "Masque")}${rng("radius", l.radius || 0, 0, Math.round(Math.min(l.w, l.h) / 2), 1, "Arrondi")}
        ${sel("filter", l.filter || "none", Object.keys(IMG_FILTERS), "Filtre")}${l.filter === "duotone" ? col("duotone.0", (l.duotone || [])[0] || "#1b1030", "Duotone sombre") + col("duotone.1", (l.duotone || [])[1] || "#f4c27c", "Duotone clair") : ""}
        ${rng("zoom", l.zoom || 1, 1, 3, .01, "Zoom")}${rng("focusX", l.focusX ?? .5, 0, 1, .01, "Cadrage horizontal")}${rng("focusY", l.focusY ?? .5, 0, 1, .01, "Cadrage vertical")}
        <div class="segs"><button data-set="frame" data-v="${l.frame === "polaroid" ? "none" : "polaroid"}" aria-pressed="${l.frame === "polaroid"}">Polaroïd</button><button data-set="tape" data-v="${l.tape ? "" : "1"}" aria-pressed="${!!l.tape}">Scotch</button><button data-set="fit" data-v="${l.fit === "contain" ? "cover" : "contain"}" aria-pressed="${l.fit === "contain"}">Image entière</button></div>
        ${col("border.color", l.border?.color || "#ffffff", "Bordure")}${rng("border.width", l.border?.width || 0, 0, 40, .5, "Épaisseur bordure")}
        <p class="note">Pour remplacer l'image, touche une photo dans l'onglet Médias.</p></div>`;
    } else {
      h += `<div class="grp">${sel("kind", l.kind, ["dots", "grid", "stripes", "halftone", "waves", "concentric"], "Motif")}${col("color", l.color, "Couleur")}${rng("size", l.size || 6, 1, 60, .5, "Épaisseur")}${rng("spacing", l.spacing || 28, 6, 200, 1, "Espacement")}${rng("angle", l.angle || 0, -90, 90, 1, "Angle")}</div>`;
    }
    h += `<div class="grp"><h3>Ombre</h3>${col("shadow.color", l.shadow?.color || "", "Couleur (vide = aucune)")}${rng("shadow.blur", l.shadow?.blur ?? 20, 0, 120, 1, "Flou")}${rng("shadow.y", l.shadow?.y ?? 8, -60, 60, 1, "Décalage")}</div>
      <div class="grp"><div class="btnrow row"><button class="btn sm" data-arr="top">Premier plan</button><button class="btn sm" data-arr="up">Avancer</button><button class="btn sm" data-arr="down">Reculer</button><button class="btn sm" data-arr="bottom">Arrière-plan</button></div>
      <div class="row"><button class="btn sm" data-act="dup">Dupliquer</button><button class="btn sm" data-act="lock">${l.locked ? "Déverrouiller" : "Verrouiller"}</button><button class="btn sm danger" data-act="del">Supprimer</button></div></div></div>`;
    P.innerHTML = h;
  },
  setPath(path, v) {
    let o = path.startsWith("bg.") && !this.layer() ? this.d : (path.startsWith("fx.") ? this.d : this.layer()); if (!o) return;
    let parts = path.split("."); if (!this.layer() && parts[0] === "bg") { parts[0] = "background"; }
    for (let i = 0; i < parts.length - 1; i++) { const k = parts[i]; if (o[k] == null || typeof o[k] !== "object") o[k] = /^\d+$/.test(parts[i + 1]) ? [] : {}; o = o[k]; }
    o[parts[parts.length - 1]] = v;
  },
  onInput(e) {
    const t = e.target, k = t.dataset.k; if (!k) return;
    if (this._pend) { this.push(this._pend); this._pend = null; }
    let v = t.value;
    if ("num" in t.dataset || t.type === "range" || t.type === "number") { v = parseFloat(v); if (!isFinite(v)) return; }
    if (k === "italic") v = !!v; if (k === "weight") v = +v;
    const l = this.layer();
    if (!l && k === "bg.type") { const bg = this.d.background, c = WS.cur.colors || []; this.d.background = v === "solid" ? { type: "solid", color: (bg.colors || [])[0] || bg.color || c[0] || "#111111" } : v === "image" ? { type: "image", asset: (Assets.list[0] || {}).id, filter: "none", focusX: .5, focusY: .5 } : { type: v, colors: bg.colors || [bg.color || c[0] || "#141218", c[2] || "#E8C27A", ...(v === "mesh" ? [c[1] || "#F4EFE6", "#5B47A8"] : [])], angle: 180 }; this.draw(); this.renderProps(); this.changed(); return; }
    if (t.type === "color" || "txt" in t.dataset) {
      if ("txt" in t.dataset && v === "") { const base = k.split(".")[0]; if (k === "fill") { this.setPath("fill", null); } else if (["bg.color", "shadow.color"].includes(k) && l) { delete l[base]; } }
      else this.setPath(k, v);
      const twin = t.parentElement.querySelector(t.type === "color" ? "[data-txt]" : "input[type=color]"); if (twin && v && /^#[0-9a-f]{6}/i.test(v)) twin.value = t.type === "color" ? v : v.slice(0, 7); else if (twin && t.type === "color") twin.value = v;
    } else this.setPath(k, v);
    if (k === "stroke.width" && l && l.stroke && !l.stroke.color) l.stroke.color = "#000000";
    if (k === "font" && l) { const F = FONTS.find(f => f[0] === v); if (F && !F[2].includes(l.weight)) l.weight = F[2][F[2].length - 1]; loadFontFor(l); }
    if (t.type === "range") { const sp = t.previousElementSibling && t.previousElementSibling.querySelector("span"); if (sp) sp.textContent = Math.round(v * 100) / 100; }
    if (k === "text" && l) { l.name = l.name || ""; }
    this.draw(); this.changed(); if (t.tagName === "SELECT" && ["shape", "filter", "kind", "bg.type"].includes(k)) this.renderProps(); if (k === "text") this.renderLayers();
  },

  /* --- AI flows --- */
  setBusy(steps, cur) {
    const B = $("#edBusy"); if (!steps) { B.hidden = true; this.busy = null; this.renderChat(); return; }
    this.busy = { steps, cur }; B.hidden = false;
    B.innerHTML = `<div class="box"><div class="row"><div class="orb work"></div><b>Le directeur artistique travaille</b></div><div class="steps">${steps.map((s, i) => `<div class="st ${i < cur ? "done" : i === cur ? "now" : ""}">${esc(s)}</div>`).join("")}</div><p class="note" id="edBusyN">Cela prend souvent 30 secondes à 2 minutes.</p><button class="btn sm ghost" id="edStop">Arrêter</button></div>`;
    $("#edStop").onclick = () => this.ctl && this.ctl.abort(); this.renderChat();
  },
  progress(n) { const el = $("#edBusyN"); if (el) el.textContent = `Rédaction de la composition… ${n} caractères`; },
  chat(m) { this.doc.chat = (this.doc.chat || []).concat([{ ...m, t: Date.now() }]).slice(-40); this.renderChat(); this.changed(); },
  async createFromBrief(b) {
    if (!AI.ok()) { toast(AI.unavailableMsg(), 4000); return; }
    const F = FORMATS[b.format] || FORMATS.post, doc = Designs.make(b, { w: F.w, h: F.h, background: { type: "solid", color: (WS.cur.colors || [])[0] || "#141218" }, fx: {}, layers: [] });
    await Designs.save(doc); await this.open(doc.id);
    const steps = ["Lecture du brief et de la marque", "Concept et composition", ...(b.quality ? ["Relecture critique du rendu", "Finitions"] : ["Rendu"])];
    this.ctl = new AbortController(); const signal = this.ctl.signal;
    this.chat({ role: "user", text: b.idea || KINDS[b.kind].label });
    try {
      this.setBusy(steps, 1);
      const r = await aiCreate(b, { signal, onText: ({ text }) => this.progress(text.length) });
      doc.design = r.design; await prepareDesign(doc.design); this.fit(); this.draw();
      let msg = { role: "ai", text: r.concept ? `Concept : ${r.concept}` : "Première version prête." };
      if (b.quality) {
        this.setBusy(steps, 2);
        const c = await aiCritique(doc, { signal, onText: ({ text }) => this.progress(text.length) });
        this.push(JSON.stringify(doc.design)); doc.design = c.design; await prepareDesign(doc.design); this.draw();
        msg = { role: "ai", text: (r.concept ? `Concept : ${r.concept}\n\n` : "") + "Après relecture de mon rendu, j'ai corrigé :", list: c.fixes, undo: true };
      }
      this.chat(msg); await Designs.save(doc);
    } catch (e) { this.chat({ role: "ai", err: true, text: AI.err(e) + (doc.design.layers.length ? "" : " Tu peux relancer avec « Relire et améliorer » ou une demande ci-dessous.") }); if (!doc.design.layers.length) { doc.design = sanitizeDesign(blankDesign(b.format), F.w, F.h); await prepareDesign(doc.design); this.draw(); } }
    finally { this.ctl = null; this.setBusy(null); this.renderAll(); }
  },
  async ask(text, o = {}) {
    if (!this.doc || this.busy) return; if (!AI.ok()) return toast(AI.unavailableMsg(), 4000);
    const doc = this.doc; this.chat({ role: "user", text: o.fmt ? `Adapter au format ${FORMATS[o.fmt].label}` : text });
    this.ctl = new AbortController(); this.setBusy(["Analyse du rendu actuel", o.fmt ? "Recomposition au nouveau format" : "Application de la demande"], 1);
    try {
      const r = await aiEdit(doc, text, { signal: this.ctl.signal, fmt: o.fmt, onText: ({ text: tx }) => this.progress(tx.length) });
      this.push(); doc.design = r.design; if (o.fmt) { doc.format = o.fmt; $("#edFmt").textContent = `${FORMATS[o.fmt].label} · ${r.design.w}×${r.design.h}`; }
      await prepareDesign(doc.design); this.sel = null; this.fit(); this.draw(); this.chat({ role: "ai", text: r.summary, undo: true }); await Designs.save(doc);
    } catch (e) { this.chat({ role: "ai", err: true, text: AI.err(e) }); }
    finally { this.ctl = null; this.setBusy(null); this.renderAll(); }
  },
  async critique() {
    if (!this.doc || this.busy) return; if (!AI.ok()) return toast(AI.unavailableMsg(), 4000);
    const doc = this.doc; this.chat({ role: "user", text: "Relis et améliore ce visuel" });
    this.ctl = new AbortController(); this.setBusy(["Rendu du visuel", "Relecture critique", "Corrections"], 1);
    try { const c = await aiCritique(doc, { signal: this.ctl.signal, onText: ({ text }) => this.progress(text.length) }); this.push(); doc.design = c.design; await prepareDesign(doc.design); this.sel = null; this.draw(); this.chat({ role: "ai", text: "Corrections apportées :", list: c.fixes, undo: true }); await Designs.save(doc); }
    catch (e) { this.chat({ role: "ai", err: true, text: AI.err(e) }); }
    finally { this.ctl = null; this.setBusy(null); this.renderAll(); }
  }
};
function loadFontFor(l) { if (!l || l.type !== "text") return; try { document.fonts.load(`${l.italic ? "italic " : ""}${l.weight} 60px "${l.font}"`).then(() => Editor.draw(), () => { }); } catch (e) { } }

/* editor events */
$("#edOv").addEventListener("pointerdown", e => Editor.onDown(e));
$("#edOv").addEventListener("dblclick", () => { const l = Editor.layer(); if (l && l.type === "text") { const ta = $("#edProps textarea[data-k=text]"); if (ta) { ta.focus(); ta.select(); } } });
$("#edBack").onclick = () => { Editor.close(); App.go("gallery"); };
$("#edTitle").onchange = e => { if (Editor.doc) { Editor.doc.name = e.target.value.trim() || "Sans titre"; Editor.changed(); } };
$("#edUndo").onclick = () => Editor.doUndo(); $("#edRedo").onclick = () => Editor.doRedo();
$("#edAddText").onclick = () => Editor.addText(); $("#edAddShape").onclick = () => Editor.addShape();
$("#edAddImg").onclick = () => Editor.etab("media");
$("#edVariants").onclick = () => Editor.doc && Variants.fromDoc(Editor.doc);
$("#edExport").onclick = () => Editor.doc && Exporter.open(Editor.doc);
$$("[data-etab]").forEach(b => b.onclick = () => Editor.etab(b.dataset.etab));
$("#edProps").addEventListener("focusin", () => { Editor._pend = Editor.snap(); });
$("#edProps").addEventListener("pointerdown", () => { Editor._pend = Editor.snap(); });
$("#edProps").addEventListener("input", e => Editor.onInput(e));
$("#edProps").addEventListener("change", e => { if (e.target.tagName === "SELECT") return; Editor.changed(); });
$("#edProps").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return; const l = Editor.layer();
  if (b.dataset.arr) return Editor.arrange(b.dataset.arr);
  if (b.dataset.act === "dup") return Editor.dup(); if (b.dataset.act === "del") return Editor.del();
  if (b.dataset.act === "lock" && l) { Editor.push(); l.locked = !l.locked; Editor.renderProps(); Editor.renderLayers(); Editor.drawOv(); return Editor.changed(); }
  if (b.dataset.reseed && l) { Editor.push(); l.seed = Math.floor(Math.random() * 999); Editor.draw(); return Editor.changed(); }
  if (b.dataset.set && l) { Editor.push(); const k = b.dataset.set, v = b.dataset.v; l[k] = ["strokeOnly", "repeat", "tape"].includes(k) ? !!v : v; if (k === "strokeOnly" && l.strokeOnly && !(l.stroke && l.stroke.width)) l.stroke = { color: typeof l.color === "string" ? l.color : "#ffffff", width: Math.max(2, Math.round(l.size / 40)) }; Editor.draw(); Editor.renderProps(); Editor.changed(); }
});
$("#edLayers").addEventListener("click", e => {
  const h = e.target.closest("[data-hide]"), lk = e.target.closest("[data-lock]");
  if (h || lk) { const l = Editor.d.layers.find(x => x.id === (h || lk).dataset[h ? "hide" : "lock"]); Editor.push(); if (h) l.hidden = !l.hidden; else l.locked = !l.locked; Editor.draw(); Editor.renderLayers(); return Editor.changed(); }
  const r = e.target.closest("[data-lay]"); if (r) Editor.select(r.dataset.lay || null);
});
$("#edAssets").addEventListener("click", async e => {
  if (e.target.closest("[data-up]")) { const got = await importImages(await pickFiles()); Editor.renderMedia(); if (got[0]) Editor.addImage(got[0].id); return; }
  const a = e.target.closest("[data-addimg]"); if (!a) return; const l = Editor.layer();
  if (l && l.type === "image") { Editor.push(); l.asset = a.dataset.addimg; Editor.draw(); Editor.changed(); toast("Image remplacée"); }
  else if (!l && Editor.d.background.type === "image") { Editor.push(); Editor.d.background.asset = a.dataset.addimg; Editor.draw(); Editor.changed(); }
  else Editor.addImage(a.dataset.addimg);
});
$("#edChat").addEventListener("click", e => { if (e.target.closest("[data-undo]")) Editor.doUndo(); });
$("#edQuick").addEventListener("click", e => { const b = e.target.closest("button"); if (b) Editor.ask(b.textContent); });
const edSend = () => { const v = $("#edAsk").value.trim(); if (!v) return; $("#edAsk").value = ""; Editor.ask(v); };
$("#edSend").onclick = edSend;
$("#edAsk").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); edSend(); } });
$("#edCritique").onclick = () => Editor.critique();
$("#edAdapt").onchange = e => { const f = e.target.value; e.target.value = ""; if (f) Editor.ask("Adapte ce visuel à ce nouveau format en recomposant intelligemment.", { fmt: f }); };
new ResizeObserver(() => { if (Editor.d && !$("#editor").hidden) { Editor.fit(); Editor.draw(); } }).observe($("#edStage"));
document.addEventListener("keydown", e => {
  if (App.view !== "create" || $("#editor").hidden || !$("#modal").hidden || e.target.closest("input,textarea,select")) return;
  const l = Editor.layer(), mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? Editor.doRedo() : Editor.doUndo(); }
  else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); Editor.doRedo(); }
  else if (mod && e.key.toLowerCase() === "d" && l) { e.preventDefault(); Editor.dup(); }
  else if ((e.key === "Delete" || e.key === "Backspace") && l) { e.preventDefault(); Editor.del(); }
  else if (e.key === "Escape") Editor.select(null);
  else if (l && e.key.startsWith("Arrow")) { e.preventDefault(); if (!Editor._nudge) Editor.push(); clearTimeout(Editor._nudge); Editor._nudge = setTimeout(() => Editor._nudge = null, 600); const s = e.shiftKey ? 10 : 1; if (e.key === "ArrowLeft") l.x -= s; if (e.key === "ArrowRight") l.x += s; if (e.key === "ArrowUp") l.y -= s; if (e.key === "ArrowDown") l.y += s; Editor.draw(); Editor.changed(); }
});

/* ================= VARIANTS ================= */
const Variants = {
  dirs: ["Direction A — la plus audacieuse et graphique : typographie forte, parti pris tranché.", "Direction B — élégante et éditoriale : raffinement, espace, finesse typographique.", "Direction C — inattendue : une idée visuelle surprenante qui fait arrêter le scroll."],
  async run(b, base) {
    if (!AI.ok()) return toast(AI.unavailableMsg(), 4000);
    const ctl = new AbortController(), res = [null, null, null], errs = [];
    const paint = () => {
      const c = $("#modalCard"); if (!c || !c.querySelector(".vgrid")) return;
      c.querySelector(".vgrid").innerHTML = res.map((r, i) => `<button class="vcard" data-pick="${i}" ${r && r.thumb ? "" : "disabled"}><div class="im" style="${r && r.thumb ? `background-image:url('${r.thumb}');aspect-ratio:${r.design.w}/${r.design.h}` : ""}">${r ? (r.thumb ? "" : "Rendu…") : errs[i] ? "Échec" : `<span class="row" style="gap:8px"><span class="spin"></span>Création…</span>`}</div><div class="meta">${r ? esc(r.concept || this.dirs[i].split(" — ")[0]) : esc(this.dirs[i].split(" — ")[0])}</div></button>`).join("");
    };
    Modal.open(`<div class="row"><div class="orb work"></div><h2>3 propositions</h2></div><p class="note">Trois directions artistiques différentes. Choisis celle que tu préfères pour l'ouvrir dans l'éditeur.</p><div class="vgrid"></div><div class="row"><button class="btn ghost" id="vStop">Arrêter</button></div>`, true);
    paint(); $("#vStop").onclick = () => { ctl.abort(); Modal.close(); };
    const one = async i => {
      try { const r = await aiCreate(b, { signal: ctl.signal, variant: this.dirs[i] }); await prepareDesign(r.design); r.thumb = await renderThumb(r.design); res[i] = r; }
      catch (e) { errs[i] = AI.err(e); }
      paint();
    };
    await Promise.all([0, 1, 2].map(i => sleep(i * 400).then(() => one(i))));
    if (!res.some(Boolean)) { const c = $("#modalCard"); if (c && !$("#modal").hidden) c.querySelector(".note").innerHTML = `<span class="err">${esc(errs.find(Boolean) || "Aucune proposition n'a abouti.")}</span>`; return; }
    $("#modalCard").onclick = async e => {
      const p = e.target.closest("[data-pick]"); if (!p || p.disabled) return; const r = res[+p.dataset.pick]; Modal.close();
      if (base) { Editor.push(); base.design = r.design; Editor.chat({ role: "ai", text: `Variante choisie : ${r.concept || ""}`, undo: true }); await Designs.save(base); Editor.fit(); Editor.draw(); Editor.renderAll(); }
      else { const doc = Designs.make(b, r.design); doc.chat = [{ role: "ai", text: `Concept : ${r.concept}`, t: Date.now() }]; await Designs.save(doc); Editor.open(doc.id); }
    };
  },
  fromBrief(b) { this.run(b, null); },
  fromDoc(doc) { const b = JSON.parse(JSON.stringify(doc.brief || Brief.fresh({ kind: doc.kind, format: doc.format }))); b.format = doc.format; this.run(b, doc); }
};

/* ================= EXPORT ================= */
const Exporter = {
  open(doc) {
    const d = doc.design;
    Modal.open(`<h2>Exporter</h2><p class="note">${esc(doc.name)} · ${d.w}×${d.h} px</p>
      <div class="segs" id="xFmt"><button data-x="png" aria-pressed="true">PNG</button><button data-x="jpg" aria-pressed="false">JPG</button><button data-x="pdf" aria-pressed="false">PDF (impression)</button></div>
      <div class="segs" id="xScale"><button data-s="1" aria-pressed="true">Standard ×1</button><button data-s="2" aria-pressed="false">Haute définition ×2</button></div>
      <img class="prev" src="${doc.thumb || ""}" alt="Aperçu">
      <div class="row"><button class="btn primary" id="xGo">Enregistrer le fichier</button><button class="btn" id="xShare">Publier sur Instagram / TikTok</button><button class="btn ghost" data-close>Fermer</button></div>`);
    let fmt = "png", sc = 1;
    $("#xFmt").onclick = e => { const b = e.target.closest("[data-x]"); if (!b) return; fmt = b.dataset.x; $$("#xFmt button").forEach(x => x.setAttribute("aria-pressed", x === b)); };
    $("#xScale").onclick = e => { const b = e.target.closest("[data-s]"); if (!b) return; sc = +b.dataset.s; $$("#xScale button").forEach(x => x.setAttribute("aria-pressed", x === b)); };
    const base = (doc.name || "creation").replace(/[^\w\- àâäéèêëïîôöùûüç]/gi, "").trim().replace(/\s+/g, "-").slice(0, 40) || "creation";
    $("#xShare").onclick = async () => {
      const b = $("#xShare"); b.disabled = true;
      try {
        await prepareDesign(d); const c = document.createElement("canvas"); c.width = d.w * 2; c.height = d.h * 2; renderDesign(c.getContext("2d"), d, 2);
        const blob = await new Promise(r => c.toBlob(r, "image/jpeg", .93));
        await Publish.open({ blob, name: base + ".jpg", kind: "image" });
      } catch (e) { toast("Le partage a échoué."); }
      finally { if (b.isConnected) b.disabled = false; }
    };
    $("#xGo").onclick = async () => {
      $("#xGo").disabled = true; $("#xGo").innerHTML = `<span class="spin"></span>Préparation…`;
      try {
        await prepareDesign(d); const c = document.createElement("canvas"); c.width = d.w * sc; c.height = d.h * sc; renderDesign(c.getContext("2d"), d, sc);
        if (fmt === "pdf") {
          if (!window.jspdf) throw new Error("pdf");
          const { jsPDF } = window.jspdf, pdf = new jsPDF({ orientation: d.w > d.h ? "landscape" : "portrait", unit: "px", format: [d.w, d.h], hotfixes: ["px_scaling"] });
          pdf.addImage(c.toDataURL("image/jpeg", .95), "JPEG", 0, 0, d.w, d.h); await saveFile(base + ".pdf", pdf.output("blob"));
        } else { const blob = await new Promise(r => c.toBlob(r, fmt === "png" ? "image/png" : "image/jpeg", .93)); await saveFile(`${base}.${fmt}`, blob); }
      } catch (e) { toast(e && e.message === "pdf" ? "Le module PDF n'a pas pu se charger. Exporte en PNG." : "L'export a échoué."); }
      finally { const b = $("#xGo"); if (b) { b.disabled = false; b.textContent = "Enregistrer le fichier"; } }
    };
  }
};
