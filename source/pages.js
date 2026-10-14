/* ================= APP SHELL ================= */
const ICONS = {
  dash: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  create: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 15.5 11 12l2.5 2.5L16 11l2.5 3"/><circle cx="9" cy="8.5" r="1.5"/>',
  video: '<rect x="3" y="5.5" width="13" height="13" rx="2.5"/><path d="m16 10.5 5-3v9l-5-3"/>',
  ideas: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  insta: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r=".8"/>',
  brand: '<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="10" r="1.4"/><circle cx="14.5" cy="8.5" r="1.4"/><circle cx="15.5" cy="13.5" r="1.4"/><path d="M11 17.5c1 .6 2 .4 2-.8 0-1.5 2-1.4 3-.9"/>',
  gallery: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  account: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>'
};
const ico = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;
const NAV = [["dash", "Accueil"], ["create", "Créer un visuel"], ["video", "Monter une vidéo"], ["ideas", "Idées & veille"], ["insta", "Analyse Instagram"], ["brand", "Identité de marque"], ["gallery", "Mes créations"], ["account", "Compte"]];

const App = {
  view: "dash", me: null,
  renderSide() {
    const b = WS.cur;
    $("#navlist").innerHTML = NAV.map(([k, l]) => `<button class="nav" data-go="${k}" ${App.view === k ? 'aria-current="page"' : ""}>${ico(k)}<span>${l}</span>${k === "ideas" && Veille.fresh ? '<span class="badge">neuf</span>' : ""}</button>`).join("");
    $("#wsDot").textContent = brandInitial(b); $("#wsDot").style.background = brandColor(b);
    $("#wsName").textContent = b.name; $("#wsType").textContent = b.type;
    $("#mobileWs").innerHTML = `<span class="ws-dot" style="background:${brandColor(b)}">${esc(brandInitial(b))}</span><select class="sel" id="mWs" aria-label="Espace de marque">${WS.list.map(x => `<option value="${x.id}"${x.id === b.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}<option value="__new">+ Nouvel espace…</option></select>`;
    $("#mWs").onchange = e => e.target.value === "__new" ? newSpaceModal() : WS.switchTo(e.target.value);
    this.renderMe();
  },
  renderMe() {
    const n = (this.me && this.me.name) || "";
    $("#meBox").innerHTML = `<span class="avatar">${esc((n || "?").charAt(0).toUpperCase())}</span><span><b>${esc(n || "Mon compte")}</b>${esc(Store.label())}</span>`;
  },
  go(v, o = {}) {
    if (v === this.view && !o.force && !(v === "create" && !o.editor && !$("#editor").hidden)) return;
    if (this.view === "video" && v !== "video") Video.close && Video.close();
    if (this.view === "create" && v !== "create" && Editor.doc) Editor.close();
    this.view = v; lsSet("rr-view", v);
    $$(".view").forEach(s => s.hidden = s.id !== "view-" + v);
    $$(".nav").forEach(n => n.toggleAttribute("aria-current", n.dataset.go === v)); $$(".nav").forEach(n => n.dataset.go === v ? n.setAttribute("aria-current", "page") : n.removeAttribute("aria-current"));
    window.scrollTo(0, 0);
    if (v === "dash") Dash.render();
    if (v === "create" && !o.editor) { if (Editor.doc) Editor.close(); $("#editor").hidden = true; $("#briefScreen").hidden = false; Brief.render(); }
    if (v === "video") Video.open(WS.cur.id);
    if (v === "ideas") IdeasPage.render();
    if (v === "insta") Insta.render();
    if (v === "brand") BrandPage.render();
    if (v === "gallery") Gallery.render();
    if (v === "account") Account.render();
  }
};
$("#navlist").addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (b) App.go(b.dataset.go, { force: true }); });
$("#wsBtn").onclick = () => { const m = $("#wsMenu"); m.hidden = !m.hidden; if (!m.hidden) renderWsMenu(); };
function renderWsMenu() {
  $("#wsMenu").innerHTML = WS.list.map(b => `<button data-ws="${b.id}"><span class="ws-dot" style="background:${brandColor(b)}">${esc(brandInitial(b))}</span><span>${esc(b.name)}</span></button>`).join("") + `<button data-ws="__new"><span class="ws-dot" style="background:var(--panel-3)">+</span><span>Nouvel espace</span></button>`;
}
$("#wsMenu").addEventListener("click", e => { const b = e.target.closest("[data-ws]"); if (!b) return; $("#wsMenu").hidden = true; b.dataset.ws === "__new" ? newSpaceModal() : WS.switchTo(b.dataset.ws); });
function newSpaceModal() {
  Modal.open(`<h2>Nouvel espace de marque</h2><p class="note">Un espace par marque, client ou influenceur que tu gères : sa charte, ses images, ses créations et ses idées restent séparées.</p>
    <div class="fld"><label class="lbl" for="nsName">Nom</label><input class="inp" id="nsName" placeholder="Ex : Grand Café, @lea.style, Soirées BDE"></div>
    <div class="g2"><div class="fld"><label class="lbl" for="nsType">Type</label><select class="sel" id="nsType">${BRAND_TYPES.map(t => `<option>${t}</option>`).join("")}</select></div>
    <div class="fld"><label class="lbl" for="nsHandle">Compte Instagram</label><input class="inp" id="nsHandle" placeholder="@compte"></div></div>
    <div class="row"><button class="btn primary" id="nsGo">Créer l'espace</button><button class="btn ghost" data-close>Annuler</button></div>`);
  $("#nsName").focus();
  $("#nsGo").onclick = async () => { const name = $("#nsName").value.trim(); if (!name) return $("#nsName").focus(); Modal.close(); await WS.create({ name, type: $("#nsType").value, handle: $("#nsHandle").value.trim() }); App.go("brand", { force: true }); toast(`Espace « ${name} » créé`); };
}

/* ================= DASHBOARD ================= */
const Dash = {
  async render() {
    const b = WS.cur, n = (App.me && App.me.name || "").split(" ")[0];
    const designs = (await Designs.load()).slice(0, 8), ideas = (await Ideas.load()).items || [];
    const rep = Veille.latest;
    $("#view-dash").innerHTML = `<div class="page">
      <section class="hero">
        <div class="eyebrow">${esc(b.name)} · ${esc(b.type)}</div>
        <h1>${n ? `Bonjour ${esc(n)}.` : "Bonjour."} <em>Qu'est-ce qu'on crée&nbsp;?</em></h1>
        <div class="bigask"><textarea id="dAsk" rows="2" aria-label="Décris ce que tu veux créer" placeholder="Ex : une affiche pour notre soirée jazz du 21, style art déco, avec la photo du bar…"></textarea><button class="btn ai big" id="dGo">✦ Lancer</button></div>
        <div class="chips">${["Story pour annoncer une nouveauté", "Flyer de soirée", "Post carrousel d'astuces", "Collage récap du week-end", "Reel de 20 s avec mes vidéos", "Pub pour une offre spéciale"].map(t => `<button class="chip" data-sugg="${esc(t)}">${t}</button>`).join("")}</div>
      </section>
      <section class="tiles">
        ${[["create", "Créer un visuel", "Flyers, affiches, stories, posts, collages, pubs."], ["video", "Monter une vidéo", "Importe tout : l'IA choisit les meilleurs moments."], ["ideas", "Trouver des idées", "Concepts et campagnes adaptés à ta marque."], ["insta", "Analyser Instagram", "Ton style, ce qui marche, ce qu'il faut changer."], ["brand", "Identité de marque", "Couleurs, polices, ton, logo : la base de tout."]].map(([k, t, s]) => `<button class="tile" data-go2="${k}">${ico(k)}<b>${t}</b><span>${s}</span></button>`).join("")}
      </section>
      ${!b.description && !b.ig ? `<div class="card" style="border-color:#E8C27A55"><div class="sec-h"><h2>Commence par ta marque</h2></div><p class="note">Plus l'IA connaît ${esc(b.name)}, plus les créations sont justes. Décris-la en 2 phrases, ajoute ton logo, ou laisse l'IA construire ta charte.</p><div class="row"><button class="btn primary" data-go2="brand">Définir mon identité</button><button class="btn" data-go2="insta">Analyser mon Instagram</button></div></div>` : ""}
      <section style="display:flex;flex-direction:column;gap:12px"><div class="sec-h"><h2>Créations récentes</h2>${designs.length ? `<button class="btn sm ghost" data-go2="gallery" style="margin-left:auto">Tout voir</button>` : ""}</div>
        ${designs.length ? `<div class="thumbs">${designs.map(thumbCard).join("")}</div>` : `<div class="empty">Aucune création dans cet espace pour l'instant.<button class="btn primary" data-go2="create">Créer mon premier visuel</button></div>`}</section>
      <section class="g2">
        <div class="card"><div class="sec-h"><h2>Idées à produire</h2><button class="btn sm ghost" data-go2="ideas" style="margin-left:auto">Ouvrir</button></div>
          ${ideas.length ? ideas.slice(0, 3).map(i => `<div class="trend"><b>${esc(i.title)}</b><p>${esc(i.hook || i.concept || "")}</p></div>`).join("") : `<p class="note">Génère des idées de contenus adaptées à ta marque et aux tendances.</p>`}</div>
        <div class="card"><div class="sec-h"><h2>Veille de la semaine</h2></div>
          ${rep ? `<p class="note">${esc(fmtDate(rep.createdAt || Date.parse(rep.date)))} · ${esc(rep.title || "")}</p>${(rep.trends || []).slice(0, 3).map(t => `<div class="trend"><b>${esc(t.name)}</b><p>${esc(t.description || "")}</p></div>`).join("")}` : `<p class="note">L'agent de veille dépose ici un rapport de tendances chaque semaine.</p>`}</div>
      </section></div>`;
    $("#view-dash").onclick = e => {
      const g = e.target.closest("[data-go2]"); if (g) return App.go(g.dataset.go2, { force: true });
      const s = e.target.closest("[data-sugg]"); if (s) { $("#dAsk").value = s.dataset.sugg; $("#dAsk").focus(); return; }
      const o = e.target.closest("[data-open]"); if (o) return Editor.open(o.dataset.open);
    };
    $("#dGo").onclick = () => routeRequest($("#dAsk").value.trim());
    $("#dAsk").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); routeRequest($("#dAsk").value.trim()); } });
  }
};
function guessKind(t) {
  t = t.toLowerCase();
  if (/(vid[ée]o|reel|réel|montage|tiktok|clip)/.test(t)) return "video";
  if (/flyer|tract/.test(t)) return "flyer"; if (/affiche|poster/.test(t)) return "poster"; if (/story|stories/.test(t)) return "story";
  if (/soir[ée]e|f[êe]te|event|[ée]v[ée]nement|concert|dj/.test(t)) return "event"; if (/collage|moodboard|r[ée]cap/.test(t)) return "collage";
  if (/pub|publicit|promo|offre|soldes|-\d+ ?%/.test(t)) return "ad"; if (/menu|carte/.test(t)) return "menu"; if (/banni[èe]re|couverture/.test(t)) return "banner";
  if (/miniature|thumbnail/.test(t)) return "thumb"; if (/citation|annonce|quote/.test(t)) return "quote"; return "post";
}
function routeRequest(text) {
  if (!text) return $("#dAsk") && $("#dAsk").focus();
  const k = guessKind(text);
  if (k === "video") { App.go("video", { force: true }); Video.prefill && Video.prefill(text); return; }
  Brief.prefill({ kind: k, idea: text }); App.go("create", { force: true }); toast("Choisis tes images si besoin, puis lance la création.");
}

/* ================= BRAND ================= */
const BrandPage = {
  render() {
    const b = WS.cur, logo = b.logo && Assets.get(b.logo);
    const fo = v => `<option value="">Libre (l'IA choisit)</option>` + FONT_NAMES.map(f => `<option${f === v ? " selected" : ""}>${f}</option>`).join("");
    $("#view-brand").innerHTML = `<div class="page">
      <div class="page-h"><div class="grow"><div class="eyebrow">Identité de marque</div><h1>${esc(b.name)}</h1><p>Tout ce que l'IA doit savoir pour créer juste. Ces informations sont injectées dans chaque création, vidéo et idée de cet espace.</p></div>
        <button class="btn ai" id="brAI">✦ Construire ma charte avec l'IA</button></div>
      <div class="card"><div class="g2">
        <div class="fld"><label class="lbl" for="brName">Nom</label><input class="inp" id="brName" data-b="name" value="${esc(b.name)}"></div>
        <div class="fld"><label class="lbl" for="brHandle">Compte Instagram</label><input class="inp" id="brHandle" data-b="handle" value="${esc(b.handle)}" placeholder="@compte"></div>
        <div class="fld"><label class="lbl" for="brType">Type</label><select class="sel" id="brType" data-b="type">${BRAND_TYPES.map(t => `<option${t === b.type ? " selected" : ""}>${t}</option>`).join("")}</select></div>
        <div class="fld"><label class="lbl" for="brTag">Signature / slogan</label><input class="inp" id="brTag" data-b="tagline" value="${esc(b.tagline)}"></div></div>
        <div class="fld"><label class="lbl" for="brDesc">Description (qui, quoi, pourquoi c'est unique)</label><textarea class="inp" id="brDesc" data-b="description" rows="3" placeholder="Ex : Café-pâtisserie de luxe place de la Madeleine, iconique depuis 1886, clientèle internationale…">${esc(b.description)}</textarea></div>
        <div class="g2"><div class="fld"><label class="lbl" for="brAud">Public visé</label><textarea class="inp" id="brAud" data-b="audience" rows="2">${esc(b.audience)}</textarea></div>
        <div class="fld"><label class="lbl" for="brTone">Ton de voix</label><textarea class="inp" id="brTone" data-b="tone" rows="2" placeholder="Ex : élégant, chaleureux, une pointe d'humour">${esc(b.tone)}</textarea></div></div></div>
      <div class="card"><div class="sec-h"><h2>Couleurs</h2><span class="note">La première sert souvent de fond, la dernière d'accent.</span></div>
        <div class="colors" id="brColors">${(b.colors || []).map((c, i) => `<label><input type="color" data-ci="${i}" value="${c}" aria-label="Couleur ${i + 1}">${c}</label>`).join("")}${(b.colors || []).length < 6 ? `<button class="btn sm" id="brAddC">+ Couleur</button>` : ""}${(b.colors || []).length > 1 ? `<button class="btn sm ghost" id="brDelC">− Retirer la dernière</button>` : ""}</div></div>
      <div class="card"><div class="sec-h"><h2>Typographie</h2></div><div class="g2">
        <div class="fld"><label class="lbl" for="brFd">Titres</label><select class="sel" id="brFd">${fo(b.fonts.display)}</select></div>
        <div class="fld"><label class="lbl" for="brFb">Texte</label><select class="sel" id="brFb">${fo(b.fonts.body)}</select></div></div>
        <div class="row" style="gap:20px;align-items:baseline"><span style="font-family:'${b.fonts.display || "Syne"}';font-size:34px;font-weight:700;letter-spacing:-.02em">${esc(b.name)}</span><span style="font-family:'${b.fonts.body || "DM Sans"}';color:var(--muted)">${esc(b.tagline || "Texte courant de la marque")}</span></div></div>
      <div class="card"><div class="sec-h"><h2>Logo</h2></div><div class="row">${logo ? `<span style="width:84px;height:84px;border-radius:12px;background:#fff url('${logo.url}') center/contain no-repeat;border:1px solid var(--line)"></span>` : ""}<button class="btn" id="brLogo">${logo ? "Changer le logo" : "Importer le logo (PNG transparent idéal)"}</button>${logo ? `<button class="btn ghost danger" id="brLogoDel">Retirer</button>` : ""}</div></div>
      <div class="card"><div class="sec-h"><h2>Univers et règles</h2></div>
        <div class="fld"><label class="lbl" for="brKw">Univers / mots-clés</label><input class="inp" id="brKw" data-b="keywords" value="${esc(b.keywords)}" placeholder="Ex : patrimoine parisien, gourmandise, rose et noir, rayures"></div>
        <div class="g2"><div class="fld"><label class="lbl" for="brDo">À faire</label><textarea class="inp" id="brDo" data-b="dos" rows="2">${esc(b.dos)}</textarea></div>
        <div class="fld"><label class="lbl" for="brDont">À éviter</label><textarea class="inp" id="brDont" data-b="donts" rows="2">${esc(b.donts)}</textarea></div></div></div>
      <div class="card"><div class="sec-h"><h2>Tous mes espaces</h2><button class="btn sm" id="brNew" style="margin-left:auto">+ Nouvel espace</button></div>
        <p class="note">Gère plusieurs marques, clients ou influenceurs. Chaque espace garde sa charte, ses images, ses créations et ses idées.</p>
        ${WS.list.map(x => `<div class="row" style="justify-content:space-between;border-top:1px solid var(--line);padding-top:10px"><span class="row"><span class="ws-dot" style="background:${brandColor(x)};width:26px;height:26px;font-size:12px;border-radius:8px">${esc(brandInitial(x))}</span><b>${esc(x.name)}</b><span class="note">${esc(x.type)}</span></span><span class="row">${x.id === b.id ? '<span class="pill">Actif</span>' : `<button class="btn sm" data-sw="${x.id}">Ouvrir</button>`}<button class="btn sm ghost danger" data-rm="${x.id}">Supprimer</button></span></div>`).join("")}</div>
    </div>`;
    const V = $("#view-brand");
    V.oninput = e => { const k = e.target.dataset.b; if (k) { b[k] = e.target.value; if (k === "name") App.renderSide(); WS.saveSoon(); } const ci = e.target.dataset.ci; if (ci !== undefined) { b.colors[+ci] = e.target.value; e.target.parentElement.lastChild.textContent = e.target.value; App.renderSide(); WS.saveSoon(); } };
    $("#brFd").onchange = e => { b.fonts.display = e.target.value; WS.save(); this.render(); };
    $("#brFb").onchange = e => { b.fonts.body = e.target.value; WS.save(); this.render(); };
    const add = $("#brAddC"); if (add) add.onclick = () => { b.colors.push("#888888"); WS.save(); this.render(); };
    const dl = $("#brDelC"); if (dl) dl.onclick = () => { b.colors.pop(); WS.save(); this.render(); };
    $("#brLogo").onclick = async () => { const got = await importImages(await pickFiles("image/*", false), "logo"); if (got[0]) { b.logo = got[0].id; await WS.save(); this.render(); } };
    const ld = $("#brLogoDel"); if (ld) ld.onclick = async () => { b.logo = null; await WS.save(); this.render(); };
    $("#brNew").onclick = newSpaceModal;
    V.onclick = async e => {
      const s = e.target.closest("[data-sw]"); if (s) return WS.switchTo(s.dataset.sw);
      const r = e.target.closest("[data-rm]"); if (r) {
        const x = WS.list.find(y => y.id === r.dataset.rm);
        Modal.open(`<h2>Supprimer « ${esc(x.name)} » ?</h2><p class="note">Sa charte, ses images, ses créations et ses idées seront supprimées définitivement.</p><div class="row"><button class="btn danger" id="rmGo">Supprimer définitivement</button><button class="btn ghost" data-close>Annuler</button></div>`);
        $("#rmGo").onclick = async () => { Modal.close(); await WS.remove(x.id); App.go("brand", { force: true }); };
      }
    };
    $("#brAI").onclick = () => this.ai();
  },
  async ai() {
    if (!AI.ok()) return toast(AI.unavailableMsg(), 4000);
    const b = WS.cur, btn = $("#brAI"); btn.disabled = true; btn.innerHTML = `<span class="spin"></span>L'IA construit ta charte…`;
    try {
      const ids = [b.logo, ...Assets.list.filter(a => a.tag === "photo").slice(0, 5).map(a => a.id)].filter(Boolean);
      const imgs = []; for (const id of ids.slice(0, Math.max(0, AI.imgMax))) { const t = await Assets.thumbBlob(id, 512); if (t) imgs.push(t); }
      const r = await AI.json(`Tu es directeur de création en agence de branding. Construis une charte de marque précise, distinctive et exploitable pour des contenus Instagram.
${brandContext()}
${imgs.length ? `Images jointes : ${b.logo ? "la première est le logo, " : ""}les autres sont des photos de la marque. Inspire-toi de leurs couleurs et de leur ambiance.` : "Aucune image fournie."}
Polices possibles (choisis-en 2 parmi celles-ci uniquement) : ${FONTS_TXT}
Réponds uniquement avec ce JSON :
{"tagline":"signature courte","description":"2 phrases","audience":"public visé précis","tone":"ton de voix en 3 à 5 adjectifs + une phrase","colors":["#RRGGBB", 4 à 5 couleurs : fond, texte, accent…],"fonts":{"display":"police titres","body":"police texte"},"keywords":"univers visuel en mots-clés","dos":"3 règles à suivre","donts":"3 choses à éviter","why":"2 phrases qui justifient les choix"}
Garde les informations factuelles déjà fournies ; n'invente ni chiffres ni adresses.`, { images: imgs });
      const cols = (Array.isArray(r.colors) ? r.colors : []).map(c => sColor(c, null)).filter(c => c && /^#[0-9a-f]{6}$/i.test(c)).slice(0, 6);
      Modal.open(`<h2>Proposition de charte</h2><p class="note">${esc(r.why || "")}</p>
        <div class="row">${cols.map(c => `<span class="swatch" style="background:${c};width:44px;height:44px;border-radius:10px"></span>`).join("")}</div>
        <div><span style="font-family:'${sFont(r.fonts && r.fonts.display)}';font-size:30px;font-weight:700">${esc(b.name)}</span><br><span style="font-family:'${sFont(r.fonts && r.fonts.body)}';color:var(--muted)">${esc(r.tagline || "")}</span></div>
        <p class="note"><b>Ton :</b> ${esc(r.tone || "")}<br><b>Public :</b> ${esc(r.audience || "")}<br><b>Univers :</b> ${esc(r.keywords || "")}</p>
        <div class="row"><button class="btn primary" id="chOk">Appliquer à ma marque</button><button class="btn ghost" data-close>Ignorer</button></div>`);
      document.fonts.load(`700 30px "${sFont(r.fonts && r.fonts.display)}"`).catch(() => { });
      $("#chOk").onclick = async () => {
        Object.assign(b, { tagline: r.tagline || b.tagline, description: b.description || r.description || "", audience: r.audience || b.audience, tone: r.tone || b.tone, keywords: r.keywords || b.keywords, dos: r.dos || b.dos, donts: r.donts || b.donts });
        if (cols.length) b.colors = cols; if (r.fonts) b.fonts = { display: sFont(r.fonts.display), body: sFont(r.fonts.body) };
        await WS.save(); Modal.close(); App.renderSide(); this.render(); toast("Charte appliquée");
      };
    } catch (e) { toast(AI.err(e), 4000); }
    finally { const b2 = $("#brAI"); if (b2) { b2.disabled = false; b2.textContent = "✦ Construire ma charte avec l'IA"; } }
  }
};

/* ================= INSTAGRAM ANALYSIS ================= */
const Insta = {
  render() {
    const b = WS.cur, ig = b.ig, shots = Assets.list.filter(a => a.tag === "screenshot");
    $("#view-insta").innerHTML = `<div class="page">
      <div class="page-h"><div class="grow"><div class="eyebrow">Analyse Instagram</div><h1>Ce que ton compte dit de toi</h1><p>Ajoute des captures d'écran de ton profil, de ta grille, de tes meilleures publications et de tes statistiques (Insights). L'IA analyse ton style, tes performances visibles et te dit quoi changer.</p></div></div>
      <div class="card"><div class="sec-h"><h2>Captures d'écran</h2><span class="note">${shots.length} ajoutée${shots.length > 1 ? "s" : ""}${AI.imgMax ? ` · l'IA en lit ${AI.imgMax} au maximum` : ""}</span></div>
        <div class="assets">${`<button class="asset add" id="igAdd" aria-label="Ajouter des captures">+</button>` + shots.map(a => `<button class="asset" data-shot="${a.id}" style="background-image:url('${a.url}')" aria-label="Retirer ${esc(a.name)}" title="Retirer"></button>`).join("")}</div>
        <p class="note">Conseil : profil (en-tête + 12 premières publications), Insights « Vue d'ensemble » des 30 derniers jours, 2 ou 3 publications qui ont le mieux marché avec leurs statistiques. Touche une capture pour la retirer.</p>
        <div class="g2"><div class="fld"><label class="lbl" for="igHandle">Compte analysé</label><input class="inp" id="igHandle" value="${esc(b.handle)}" placeholder="@compte"></div>
        <div class="fld"><label class="lbl" for="igGoal">Objectif</label><input class="inp" id="igGoal" placeholder="Ex : gagner des abonnés locaux, remplir les soirées, vendre plus"></div></div>
        <div class="row"><button class="btn ai" id="igGo" ${shots.length ? "" : "disabled"}>✦ Analyser mon compte</button><span class="note" id="igState"></span></div></div>
      <div class="card"><div class="sec-h"><h2>Connexion directe à Instagram</h2></div><p class="note">La lecture automatique des statistiques passe par l'API officielle de Meta, qu'une page ne peut pas appeler elle-même. Deux connecteurs Claude existent pour s'en approcher : <b>Metricool</b> (statistiques et planification) et <b>vidIQ</b> (recherche de tendances Instagram, TikTok, YouTube). Une fois l'un d'eux connecté dans Claude, je peux les brancher à cet écran.</p></div>
      <div id="igResult">${ig ? this.result(ig) : ""}</div></div>`;
    $("#igAdd").onclick = async () => { await importImages(await pickFiles(), "screenshot"); this.render(); };
    $("#view-insta").onclick = async e => {
      const s = e.target.closest("[data-shot]"); if (s) { await Assets.del(s.dataset.shot); return this.render(); }
      const ap = e.target.closest("#igApply"); if (ap) { b.colors = ig.style.palette.slice(0, 6); await WS.save(); App.renderSide(); toast("Palette appliquée à ta charte"); }
      const c = e.target.closest("[data-mk]"); if (c) { const p = ig.plan[+c.dataset.mk]; Brief.prefill({ kind: guessKind(p.format || "post") === "video" ? "post" : guessKind(p.format || "post"), idea: `${p.idea}` }); if (/reel|vid/i.test(p.format || "")) { App.go("video", { force: true }); Video.prefill && Video.prefill(p.idea); } else App.go("create", { force: true }); }
    };
    $("#igGo").onclick = () => this.analyze();
  },
  result(ig) {
    const sc = ig.scores || {}, lab = { esthetique: "Esthétique", coherence: "Cohérence", engagement: "Engagement", originalite: "Originalité", regularite: "Régularité" };
    return `<div style="display:flex;flex-direction:column;gap:14px">
      <div class="card"><div class="sec-h"><h2>Synthèse</h2><span class="note">Analyse du ${fmtDate(ig.date)}</span></div><p style="margin:0;line-height:1.6">${esc(ig.summary)}</p>
        ${ig.stats ? `<div class="row">${Object.entries(ig.stats).filter(([, v]) => v).map(([k, v]) => `<span class="pill">${esc(k)} : ${esc(v)}</span>`).join("")}</div>` : ""}
        <div style="display:flex;flex-direction:column;gap:8px">${Object.entries(sc).map(([k, v]) => `<div class="score"><b style="font-weight:500">${lab[k] || esc(k)}</b><div class="bar"><i style="width:${clamp(num(v, 0), 0, 10) * 10}%"></i></div><span>${num(v, 0)}/10</span></div>`).join("")}</div></div>
      <div class="g2">
        <div class="card"><h2 style="margin:0;font-size:16px">Ce qui marche</h2><ul class="blist">${(ig.works || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div class="card"><h2 style="margin:0;font-size:16px">À améliorer</h2><ul class="blist">${(ig.improve || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
      ${ig.style ? `<div class="card"><div class="sec-h"><h2>Ton style actuel</h2>${(ig.style.palette || []).length ? `<button class="btn sm" id="igApply" style="margin-left:auto">Utiliser cette palette dans ma charte</button>` : ""}</div><div class="row">${(ig.style.palette || []).map(c => `<span class="swatch" style="background:${c};width:40px;height:40px;border-radius:10px" title="${c}"></span>`).join("")}</div>
        <p class="note"><b>Ambiance :</b> ${esc(ig.style.mood || "")}<br><b>Photo :</b> ${esc(ig.style.photography || "")}<br><b>Typographie :</b> ${esc(ig.style.typography || "")}</p></div>` : ""}
      <div class="g2"><div class="card"><h2 style="margin:0;font-size:16px">Piliers de contenu</h2><ul class="blist">${(ig.pillars || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div class="card"><h2 style="margin:0;font-size:16px">Opportunités</h2><ul class="blist">${(ig.opportunities || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
      ${(ig.plan || []).length ? `<div class="card"><div class="sec-h"><h2>Plan des 7 prochains jours</h2></div><div class="plan">${ig.plan.map((p, i) => `<div><b>${esc(p.day || "J" + (i + 1))} · ${esc(p.format || "")}</b>${esc(p.idea || "")}<button class="btn sm" data-mk="${i}" style="align-self:flex-start;margin-top:4px">Créer</button></div>`).join("")}</div></div>` : ""}
    </div>`;
  },
  async analyze() {
    if (!AI.ok()) return toast(AI.unavailableMsg(), 4000);
    const b = WS.cur, shots = Assets.list.filter(a => a.tag === "screenshot").slice(0, Math.max(1, AI.imgMax));
    const st = $("#igState"), btn = $("#igGo"); btn.disabled = true; st.innerHTML = `<span class="row" style="gap:8px"><span class="spin"></span>Analyse en cours (jusqu'à 2 minutes)…</span>`;
    try {
      const imgs = []; for (const a of shots) { const t = await Assets.thumbBlob(a.id, 1200); if (t) imgs.push(t); }
      const handle = $("#igHandle").value.trim(), goal = $("#igGoal").value.trim();
      if (handle && handle !== b.handle) { b.handle = handle; }
      const r = await AI.json(`Tu es stratège social media et directeur artistique, expert Instagram. Analyse ce compte à partir des ${imgs.length} captures d'écran jointes (profil, grille, publications, statistiques).
Compte : ${handle || "non précisé"}. Objectif : ${goal || "croissance et image de marque"}.
${brandContext()}
Sois concret, franc et spécifique à CE compte (cite ce que tu vois). N'invente aucun chiffre : ne reporte que les statistiques lisibles sur les captures.
Réponds uniquement avec ce JSON :
{"summary":"4 à 5 phrases de diagnostic","stats":{"Abonnés":"","Publications":"","Portée":"","Engagement":""},"scores":{"esthetique":0-10,"coherence":0-10,"engagement":0-10,"originalite":0-10,"regularite":0-10},"style":{"palette":["#RRGGBB" 4 à 6 couleurs dominantes de la grille],"mood":"","photography":"","typography":""},"pillars":["piliers de contenu actuels ou à créer"],"works":["4 à 6 constats"],"improve":["4 à 6 actions précises"],"opportunities":["4 à 6 idées de formats, concepts ou collaborations"],"audience":"","plan":[{"day":"Lun","format":"Reel|Story|Post|Carrousel","idea":"idée concrète"}, 7 éléments]}`, { images: imgs });
      b.ig = { date: Date.now(), summary: String(r.summary || ""), stats: r.stats && typeof r.stats === "object" ? r.stats : null, scores: r.scores || {}, style: r.style ? { ...r.style, palette: (r.style.palette || []).map(c => sColor(c, null)).filter(c => c && /^#[0-9a-f]{6}$/i.test(c)) } : null, pillars: r.pillars || [], works: r.works || [], improve: r.improve || [], opportunities: r.opportunities || [], audience: r.audience || "", plan: Array.isArray(r.plan) ? r.plan.slice(0, 7) : [] };
      await WS.save(); this.render(); toast("Analyse enregistrée dans ta marque");
    } catch (e) { st.innerHTML = `<span class="err">${esc(AI.err(e))}</span>`; btn.disabled = false; }
  }
};

/* ================= IDEAS & VEILLE ================= */
const Ideas = {
  doc: null,
  async load() { if (this.doc && this.doc.id === WS.cur.id) return this.doc; const all = await Store.all("ideas"); this.doc = all.find(d => d.id === WS.cur.id) || { id: WS.cur.id, items: [] }; return this.doc; },
  save() { return Store.put("ideas", this.doc); }
};
const Veille = {
  reports: [], latest: null, fresh: false, config: null,
  async init() {
    if (!Store.db) return;
    try {
      Store.db.collection("veille").orderBy("createdAt", "desc").limit(6).onSnapshot(s => {
        this.reports = s.docs.map(d => d.data()).filter(Boolean); this.latest = this.reports[0] || null;
        this.fresh = !!this.latest && (this.latest.createdAt || 0) > num(lsGet("rr-veille-seen"), 0); App.renderSide();
        if (App.view === "ideas") IdeasPage.renderVeille(); if (App.view === "dash") Dash.render();
      }, () => { });
      const c = await Store.db.doc("agent/config").get(); this.config = c.exists ? c.data() : null;
    } catch (e) { }
  }
};
const IdeasPage = {
  async render() {
    const doc = await Ideas.load();
    $("#view-ideas").innerHTML = `<div class="page">
      <div class="page-h"><div class="grow"><div class="eyebrow">Idées & veille · ${esc(WS.cur.name)}</div><h1>Quoi publier ensuite</h1><p>L'IA croise ta marque, ton analyse Instagram et la veille de tendances pour proposer des concepts concrets, prêts à produire.</p></div></div>
      <div class="card"><div class="g2"><div class="fld"><label class="lbl" for="iFocus">Objectif ou thème (optionnel)</label><input class="inp" id="iFocus" placeholder="Ex : lancement du menu d'hiver, soirée du 21, gagner des abonnés locaux"></div>
        <div class="fld"><label class="lbl" for="iMix">Formats</label><select class="sel" id="iMix"><option value="">Mix équilibré</option><option>Surtout des Reels</option><option>Surtout des visuels (posts, stories)</option><option>Une campagne complète sur 2 semaines</option></select></div></div>
        <div class="row"><button class="btn ai" id="iGo">✦ Proposer 8 idées</button><span class="note" id="iState"></span></div></div>
      <div id="veilleBox"></div>
      <div class="sec-h"><h2>Mes idées</h2><span class="note">${doc.items.length} idée${doc.items.length > 1 ? "s" : ""}</span></div>
      <div class="ideas-grid" id="iList">${doc.items.length ? doc.items.map((it, i) => this.card(it, i)).join("") : `<div class="empty" style="grid-column:1/-1">Aucune idée pour l'instant. Lance une génération.</div>`}</div></div>`;
    this.renderVeille();
    $("#iGo").onclick = () => this.generate();
    $("#view-ideas").onclick = async e => {
      const b = e.target.closest("[data-ia]"); if (!b) return; const i = +b.dataset.i, it = doc.items[i];
      if (b.dataset.ia === "visual") { Brief.prefill({ kind: ideaKind(it.format), idea: `${it.title}. ${it.concept || ""} Direction visuelle : ${it.visual || ""}`, infos: { title: "", date: "", place: "", price: "", cta: "", extra: it.hook || "" } }); App.go("create", { force: true }); }
      if (b.dataset.ia === "video") { App.go("video", { force: true }); Video.prefill && Video.prefill(`${it.title}. ${it.concept || ""} Accroche : ${it.hook || ""}`); }
      if (b.dataset.ia === "copy") copyText(`${it.caption || ""}\n\n${(it.hashtags || []).map(h => "#" + String(h).replace(/^#/, "")).join(" ")}`.trim());
      if (b.dataset.ia === "del") { doc.items.splice(i, 1); await Ideas.save(); this.render(); }
      if (b.dataset.ia === "star") { it.star = !it.star; doc.items.sort((a, b2) => (b2.star ? 1 : 0) - (a.star ? 1 : 0)); await Ideas.save(); this.render(); }
      if (b.dataset.ia === "agent") this.agentConfig();
    };
  },
  card(it, i) {
    return `<article class="ideac"><div class="row"><span class="pill ai">${esc(it.format || "Post")}</span>${it.trend ? `<span class="pill">${esc(it.trend)}</span>` : ""}${it.effort ? `<span class="pill">${esc(it.effort)}</span>` : ""}<button class="btn sm ghost" data-ia="star" data-i="${i}" style="margin-left:auto" aria-label="${it.star ? "Retirer des favoris" : "Mettre en favori"}">${it.star ? "★" : "☆"}</button></div>
      <h3>${esc(it.title)}</h3>${it.hook ? `<div class="hook">« ${esc(it.hook)} »</div>` : ""}<p>${esc(it.concept || "")}</p>${it.visual ? `<p class="note"><b>Visuel :</b> ${esc(it.visual)}</p>` : ""}${it.why ? `<p class="note"><b>Pourquoi :</b> ${esc(it.why)}</p>` : ""}
      <div class="acts">${/reel|vid/i.test(it.format || "") ? `<button class="btn sm primary" data-ia="video" data-i="${i}">Monter la vidéo</button>` : `<button class="btn sm primary" data-ia="visual" data-i="${i}">Créer le visuel</button>`}${it.caption ? `<button class="btn sm" data-ia="copy" data-i="${i}">Copier la légende</button>` : ""}<button class="btn sm ghost danger" data-ia="del" data-i="${i}">Retirer</button></div></article>`;
  },
  renderVeille() {
    const el = $("#veilleBox"); if (!el) return; const r = Veille.latest, owner = App.isOwner;
    if (r) lsSet("rr-veille-seen", String(r.createdAt || Date.now())); Veille.fresh = false;
    el.innerHTML = `<div class="card"><div class="sec-h"><h2>Veille de tendances</h2><span class="note">${r ? `Rapport du ${esc(fmtDate(r.createdAt || Date.parse(r.date)))}` : "Aucun rapport pour l'instant"}</span>${owner ? `<button class="btn sm" data-ia="agent" data-i="0">Régler l'agent</button>` : ""}</div>
      ${r ? `<p style="margin:0;line-height:1.55">${esc(r.summary || "")}</p><div class="g2">${(r.trends || []).slice(0, 8).map(t => `<div class="trend"><b>${esc(t.name)}</b><p>${esc(t.description || "")}</p>${t.howToUse ? `<p class="note">→ ${esc(t.howToUse)}</p>` : ""}</div>`).join("")}</div>${(r.sources || []).length ? `<p class="note">Sources : ${r.sources.slice(0, 6).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener" style="color:var(--ai)">${esc(s.title || s.url)}</a>`).join(" · ")}</p>` : ""}`
        : `<p class="note">Un agent de recherche parcourt le web chaque semaine (tendances Instagram et TikTok, design, événements, mode, food, hôtellerie de luxe…) et dépose son rapport ici. Les idées générées s'en inspirent automatiquement.</p>`}</div>`;
  },
  agentConfig() {
    const c = Veille.config || {};
    Modal.open(`<h2>Agent de veille</h2><p class="note">Ces thèmes guident la recherche hebdomadaire. Le rapport est visible par toutes les personnes qui utilisent l'application.</p>
      <div class="fld"><label class="lbl" for="agTopics">Thèmes à surveiller</label><textarea class="inp" id="agTopics" rows="5">${esc(c.topics || "Tendances Reels et formats Instagram/TikTok du moment\nTendances graphiques (typo, couleurs, styles d'affiches)\nHôtellerie de luxe, palaces et restauration à Paris\nÉvénementiel et soirées à Paris\nMode et lifestyle")}</textarea></div>
      <div class="row"><button class="btn primary" id="agSave">Enregistrer</button><button class="btn ghost" data-close>Fermer</button></div>`);
    $("#agSave").onclick = async () => { try { const body = { topics: $("#agTopics").value.trim(), updatedAt: Date.now() }; await Store.db.doc("agent/config").set(body); Veille.config = body; Modal.close(); toast("Thèmes enregistrés"); } catch (e) { toast("Enregistrement impossible ici."); } };
  },
  async generate() {
    if (!AI.ok()) return toast(AI.unavailableMsg(), 4000);
    const doc = await Ideas.load(), st = $("#iState"), btn = $("#iGo"); btn.disabled = true; st.innerHTML = `<span class="row" style="gap:8px"><span class="spin"></span>L'IA cherche des idées…</span>`;
    const r0 = Veille.latest, today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    try {
      const r = await AI.json(`Tu es directeur de création et stratège de contenu pour Instagram et TikTok. Nous sommes le ${today}.
${brandContext()}
${r0 ? `VEILLE DE TENDANCES RÉCENTE : ${r0.summary || ""}\n${(r0.trends || []).slice(0, 10).map(t => `- ${t.name} : ${t.description || ""}`).join("\n")}` : "Pas de rapport de veille disponible : appuie-toi sur ta connaissance des formats qui fonctionnent."}
Objectif / thème : ${$("#iFocus").value.trim() || "libre"}. Formats : ${$("#iMix").value || "mix équilibré"}.
Idées déjà proposées (ne pas répéter) : ${doc.items.slice(0, 20).map(i => i.title).join(" ; ") || "aucune"}.
Propose 8 idées ORIGINALES, spécifiques à cette marque (jamais génériques), réalisables avec un téléphone, chacune avec un vrai angle créatif.
Réponds uniquement avec ce JSON :
{"ideas":[{"title":"titre court","format":"Reel|Story|Post|Carrousel|Flyer|Affiche|Pub|Collage","hook":"accroche des 2 premières secondes ou titre du visuel","concept":"2-3 phrases : déroulé ou contenu","visual":"direction visuelle précise (cadrage, couleurs, typo, ambiance)","caption":"légende prête à publier","hashtags":["5 à 8 sans #"],"why":"pourquoi ça marchera pour cette marque","trend":"tendance exploitée ou vide","effort":"rapide|moyen|ambitieux"}]}`);
      const items = (Array.isArray(r.ideas) ? r.ideas : []).filter(i => i && i.title).map(i => ({ ...i, id: uid("i"), created: Date.now() }));
      doc.items = [...items, ...doc.items].slice(0, 60); await Ideas.save(); this.render(); toast(`${items.length} idées ajoutées`);
    } catch (e) { st.innerHTML = `<span class="err">${esc(AI.err(e))}</span>`; btn.disabled = false; }
  }
};
function ideaKind(f) { f = (f || "").toLowerCase(); if (f.includes("story")) return "story"; if (f.includes("flyer")) return "flyer"; if (f.includes("affiche")) return "poster"; if (f.includes("pub")) return "ad"; if (f.includes("collage")) return "collage"; return "post"; }

/* ================= GALLERY ================= */
const Gallery = {
  async render() {
    const list = await Designs.load(true);
    $("#view-gallery").innerHTML = `<div class="page">
      <div class="page-h"><div class="grow"><div class="eyebrow">Mes créations · ${esc(WS.cur.name)}</div><h1>Galerie</h1><p>${list.length} création${list.length > 1 ? "s" : ""} · ${esc(Store.label())}. Les images importées restent sur l'appareil où tu les as ajoutées.</p></div>
        <button class="btn primary" id="gNew">+ Nouvelle création</button><button class="btn" id="gVid">Projet vidéo</button></div>
      ${list.length ? `<div class="thumbs">${list.map(d => thumbCard(d).replace('</div></div>', `</div><div class="acts"><button class="btn sm" data-g="open" data-id="${d.id}">Ouvrir</button><button class="btn sm" data-g="dup" data-id="${d.id}">Dupliquer</button><button class="btn sm" data-g="exp" data-id="${d.id}">Exporter</button><button class="btn sm ghost danger" data-g="del" data-id="${d.id}">Supprimer</button></div></div>`)).join("")}</div>` : `<div class="empty">Aucune création dans cet espace.<button class="btn primary" id="gNew2">Créer mon premier visuel</button></div>`}</div>`;
    $("#gNew").onclick = () => App.go("create", { force: true }); const n2 = $("#gNew2"); if (n2) n2.onclick = () => App.go("create", { force: true });
    $("#gVid").onclick = () => App.go("video", { force: true });
    $("#view-gallery").onclick = async e => {
      const o = e.target.closest("[data-open]"); if (o) return Editor.open(o.dataset.open);
      const b = e.target.closest("[data-g]"); if (!b) return; const d = list.find(x => x.id === b.dataset.id);
      if (b.dataset.g === "open") Editor.open(d.id);
      if (b.dataset.g === "dup") { const c = JSON.parse(JSON.stringify(d)); c.id = uid("d"); c.name += " (copie)"; c.createdAt = Date.now(); await Designs.save(c); this.render(); }
      if (b.dataset.g === "exp") { await prepareDesign(d.design); Exporter.open(d); }
      if (b.dataset.g === "del") { Modal.open(`<h2>Supprimer « ${esc(d.name)} » ?</h2><div class="row"><button class="btn danger" id="gDel">Supprimer</button><button class="btn ghost" data-close>Annuler</button></div>`); $("#gDel").onclick = async () => { Modal.close(); await Designs.del(d.id); this.render(); }; }
    };
  }
};

/* ================= ACCOUNT ================= */
const Account = {
  render() {
    const SA = !!window.__RR_STANDALONE, n = (App.me && App.me.name) || "", cloud = Store.mode === "cloud" && !Store.readOnly;
    $("#view-account").innerHTML = `<div class="page">
      <div class="page-h"><div class="grow"><div class="eyebrow">Compte</div><h1>${esc(n || "Mon compte")}</h1><p>${SA ? "Version autonome : aucune connexion nécessaire. Tout ce que tu crées est enregistré dans ce navigateur, et l'IA fonctionne via le serveur de l'application." : "Chaque personne se connecte avec son propre compte Claude et retrouve son espace privé : ses marques, ses créations et ses idées ne sont visibles que par elle."}</p></div></div>
      <div class="g2">
        <div class="card"><div class="sec-h"><h2>Sauvegarde</h2><span class="pill ${cloud ? "ai" : ""}">${cloud ? "En ligne" : "Sur cet appareil"}</span></div>
          <p class="note">${cloud ? "Tes marques, créations et idées sont synchronisées avec ton compte : tu les retrouves sur tous tes appareils. Les images importées, elles, restent dans le navigateur où tu les as ajoutées." : Store.mode === "cloud" ? "Ton niveau d'accès ne permet pas la sauvegarde en ligne : tout est enregistré dans ce navigateur. Demande au propriétaire de l'application de te passer en « Contributeur » dans le menu Partager." : "La sauvegarde en ligne n'est pas disponible dans cette vue : tout est enregistré dans ce navigateur."}</p></div>
        ${SA ? "" : `<div class="card"><div class="sec-h"><h2>Inviter d'autres personnes</h2></div>
          <p class="note">Ouvre le menu <b>Partager</b> de cette application dans Claude et ajoute les personnes en <b>Contributeur</b> : elles pourront créer et sauvegarder dans leur propre espace privé. En simple lecteur, elles utilisent l'application mais leurs créations restent sur leur appareil.</p></div>`}
        <div class="card"><div class="sec-h"><h2>Espaces gérés</h2></div><p class="note">${WS.list.length} espace${WS.list.length > 1 ? "s" : ""} : ${WS.list.map(b => esc(b.name)).join(", ")}.</p><div class="row"><button class="btn" id="acBrand">Gérer mes espaces</button><button class="btn" id="acNew">+ Nouvel espace</button></div></div>
        <div class="card"><div class="sec-h"><h2>Intelligence artificielle</h2><span class="pill ${AI.ok() ? "ai" : ""}">${AI.ok() ? "Active" : "Indisponible"}</span></div><p class="note">${SA ? "L'IA tourne sur le serveur de l'application : personne n'a besoin de compte." : "Chaque génération utilise ton propre compte Claude. La première fois, Claude te demande l'autorisation."}${AI.imgMax ? ` L'IA peut regarder jusqu'à ${AI.imgMax} images par demande.` : ""}</p></div>
      </div>
      <div class="card"><div class="sec-h"><h2>Mes données</h2></div><p class="note">Télécharge une copie de tes marques, créations et idées (sans les images).</p><div class="row"><button class="btn" id="acExp">Exporter mes données (JSON)</button></div></div></div>`;
    $("#acBrand").onclick = () => App.go("brand", { force: true }); $("#acNew").onclick = newSpaceModal;
    $("#acExp").onclick = async () => { const data = { exportedAt: new Date().toISOString(), brands: await Store.all("brand"), designs: (await Store.all("design")).map(d => ({ ...d, thumb: undefined })), ideas: await Store.all("ideas") }; saveFile("mada-donnees.json", JSON.stringify(data, null, 2)); };
  }
};

/* ================= BOOT ================= */
(async function boot() {
  await L.open();
  await WS.load(); await Assets.refresh(WS.cur.id);
  App.renderSide();
  const v0 = lsGet("rr-view"); App.view = ""; App.go(NAV.some(n => n[0] === v0) && v0 !== "create" ? v0 : "dash");
  AI.init().then(() => { if (App.view === "create" && $("#editor").hidden) Brief.render(); if (App.view === "account") Account.render(); });
  await Store.init();
  if (Store.user) { try { App.me = await Store.user.me(); App.isOwner = await Store.user.isOwner(); } catch (e) { } }
  if (Store.mode === "cloud") { const cur = WS.cur.id; await WS.load(); if (WS.list.some(b => b.id === cur)) WS.cur = WS.list.find(b => b.id === cur); Designs.list = null; Ideas.doc = null; await Assets.refresh(WS.cur.id); App.go(App.view, { force: true }); }
  App.renderSide(); Veille.init();
})();
