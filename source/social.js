/* ================= INSTAGRAM & TIKTOK ================= */
// Official connection (OAuth on the platform's own page), direct publishing
// and statistics, through the MaDA server (/api/social/*). Needs a MaDA account.
const Social = {
  NAMES: { instagram: "Instagram", tiktok: "TikTok" },
  accounts: [], available: {}, loaded: false, cfg: null,

  async init() {
    const st = await Status.get();
    this.cfg = st && st.social && st.social.enabled ? st.social : null;
    const q = new URLSearchParams(location.search);
    if (q.get("social")) { history.replaceState(null, "", location.pathname); this.returned(q.get("social"), q.get("ok") === "1"); }
  },
  enabled() { return !!this.cfg && Auth.available; },
  providers() { return ["instagram", "tiktok"].filter(p => this.cfg && this.cfg[p]); },
  acc(p) { return this.accounts.find(a => a.provider === p); },

  async load(force) {
    if (!this.enabled() || !Auth.user) { this.accounts = []; return this.accounts; }
    if (this.loaded && !force) return this.accounts;
    try { const r = await MadaServer.json("/api/social/accounts"); this.accounts = r.accounts || []; this.loaded = true; } catch (e) { }
    return this.accounts;
  },

  async connect(p) {
    if (!Auth.user) return Auth.open(`Crée ton compte MaDA pour connecter ${this.NAMES[p]}.`);
    if (!Pro.allowed()) return Pro.paywall("La publication directe et les statistiques font partie de MaDA Pro.");
    try {
      const r = await MadaServer.post("/api/social/start", { provider: p, app: Auth.native() });
      if (Auth.native()) await MadaNative.plugin("Browser").open({ url: r.url, presentationStyle: "popover" });
      else location.href = r.url;
    } catch (e) { toast("Connexion impossible pour l'instant."); }
  },
  async returned(p, ok) {
    await this.load(true);
    toast(ok ? `${this.NAMES[p] || "Compte"} est connecté ✦` : "La connexion n'a pas été terminée.", 3500);
    if (["insta", "account"].includes(App.view)) App.go(App.view, { force: true });
  },
  async disconnect(p) {
    try { await MadaServer.post("/api/social/disconnect", { provider: p }); } catch (e) { return toast("Déconnexion impossible pour l'instant."); }
    await this.load(true); toast(`${this.NAMES[p]} est déconnecté`);
    if (["insta", "account"].includes(App.view)) App.go(App.view, { force: true });
  },

  card() {
    if (!this.enabled()) return "";
    return `<div class="card"><div class="sec-h"><h2>Instagram et TikTok</h2></div>
      <p class="note">Connecte tes comptes pour publier directement depuis MaDA et suivre tes statistiques. La connexion se fait sur la page officielle d'Instagram ou de TikTok : MaDA ne voit jamais ton mot de passe.</p>
      <div class="soc-list">${this.providers().map(p => { const a = this.acc(p); return `<div class="soc-row"><span class="soc-ico ${p}" aria-hidden="true">${p === "instagram" ? "◎" : "♪"}</span><span class="grow"><b>${this.NAMES[p]}</b><small>${a ? "@" + esc(a.username || "connecté") : p === "instagram" ? "Compte professionnel ou créateur" : "Tous les comptes"}</small></span>
        ${a ? `<button class="btn sm ghost" data-soc-off="${p}">Déconnecter</button>` : `<button class="btn sm primary" data-soc-on="${p}">Connecter</button>`}</div>`; }).join("")}</div></div>`;
  },
  bindCard(root) {
    root.querySelectorAll("[data-soc-on]").forEach(b => b.onclick = () => this.connect(b.dataset.socOn));
    root.querySelectorAll("[data-soc-off]").forEach(b => b.onclick = () => this.disconnect(b.dataset.socOff));
  }
};

/* ---------- Publishing ---------- */
const Publish = {
  PRIVACY: { PUBLIC_TO_EVERYONE: "Tout le monde", MUTUAL_FOLLOW_FRIENDS: "Amis", FOLLOWER_OF_CREATOR: "Abonnés", SELF_ONLY: "Moi uniquement" },

  // kind: "video" | "image"
  async open({ blob, name, kind, caption = "", duration = 0 }) {
    if (!Social.enabled()) return shareFile(name, blob, caption);
    await Social.load();
    const ext = (name.split(".").pop() || "").toLowerCase(), badFmt = kind === "video" ? !/mp4|mov/.test(ext) : !/jpe?g/.test(ext);
    const provs = Social.providers().filter(p => kind === "video" || p === "instagram");
    Modal.open(`<div class="sec-h"><h2>Publier</h2><button class="btn sm ghost" data-close style="margin-left:auto">Fermer</button></div>
      ${!Auth.user ? `<p class="note">Connecte-toi à ton compte MaDA pour publier directement sur Instagram et TikTok.</p><div class="row"><button class="btn primary" id="pbLogin">Me connecter</button><button class="btn" id="pbShare">Partager autrement</button></div>` : `
      <div class="pb-targets">${provs.map(p => { const a = Social.acc(p); return `<div class="pb-t" data-p="${p}">
        <label class="soc-row"><span class="soc-ico ${p}" aria-hidden="true">${p === "instagram" ? "◎" : "♪"}</span><span class="grow"><b>${Social.NAMES[p]}</b><small>${a ? "@" + esc(a.username || "") : "Non connecté"}</small></span>
        ${a ? `<input type="checkbox" class="pb-on" data-p="${p}" ${badFmt ? "disabled" : ""} aria-label="Publier sur ${Social.NAMES[p]}">` : `<button class="btn sm" data-soc-on="${p}">Connecter</button>`}</label>
        <div class="pb-opts" id="pbo-${p}" hidden></div></div>`; }).join("")}
      </div>
      ${badFmt ? `<p class="note err">${kind === "video" ? "Cette vidéo est au format WebM, refusé par Instagram et TikTok. Exporte-la depuis l'app MaDA ou Safari pour obtenir un MP4." : "Exporte l'image en JPG pour la publier."}</p>` : ""}
      <div class="fld"><label class="lbl" for="pbCap">Légende</label><textarea class="inp" id="pbCap" rows="4" maxlength="2200">${esc(caption)}</textarea></div>
      <div id="pbState"></div>
      <div class="row"><button class="btn primary" id="pbGo" disabled>Publier</button><button class="btn" id="pbShare">Partager autrement</button></div>`}`, false);
    const share = $("#pbShare"); if (share) share.onclick = () => shareFile(name, blob, ($("#pbCap") || {}).value || caption);
    const login = $("#pbLogin"); if (login) login.onclick = () => Auth.open("Connecte-toi pour publier directement.");
    const card = $("#modalCard"); Social.bindCard(card);
    if (!Auth.user) return;
    const opts = {};
    const sync = () => { $("#pbGo").disabled = !$$(".pb-on").some(c => c.checked) || $$(".pb-on").some(c => c.checked && c.dataset.p === "tiktok" && !opts.tiktok.privacy_level); };
    card.querySelectorAll(".pb-on").forEach(c => c.onchange = async () => {
      const p = c.dataset.p, box = $("#pbo-" + p); box.hidden = !c.checked;
      if (c.checked && !box.dataset.ready) {
        box.dataset.ready = "1";
        if (p === "instagram") {
          opts.instagram = { format: kind === "video" ? "reel" : "post" };
          const f = kind === "video" ? [["reel", "Reel"], ["story", "Story"]] : [["post", "Publication"], ["story", "Story"]];
          box.innerHTML = `<div class="segs">${f.map(([k, l]) => `<button data-f="${k}" aria-pressed="${k === opts.instagram.format}">${l}</button>`).join("")}</div>`;
          box.querySelector(".segs").onclick = e => { const b = e.target.closest("[data-f]"); if (!b) return; opts.instagram.format = b.dataset.f; box.querySelectorAll("[data-f]").forEach(x => x.setAttribute("aria-pressed", x === b)); };
        } else await this.tiktokOpts(box, opts, duration, sync);
      }
      sync();
    });
    $("#pbGo").onclick = () => this.run({ blob, ext, kind, opts });
  },

  // TikTok asks apps to show the creator, let them pick who can see the post (no default)
  // and the interaction settings, and to state the Music Usage Confirmation.
  async tiktokOpts(box, opts, duration, sync) {
    box.innerHTML = `<p class="note"><span class="spin"></span>Lecture de ton compte TikTok…</p>`;
    let ci;
    try { ci = await MadaServer.json("/api/social/creator?provider=tiktok"); }
    catch (e) { box.innerHTML = `<p class="note err">TikTok ne répond pas. ${e && e.code === "reconnect" ? "Reconnecte ton compte." : "Réessaie dans un instant."}</p>`; return; }
    opts.tiktok = { privacy_level: "", disable_comment: !!ci.comment_disabled, disable_duet: !!ci.duet_disabled, disable_stitch: !!ci.stitch_disabled, brand_content: false, brand_organic: false };
    const tooLong = ci.max_video_post_duration_sec && duration > ci.max_video_post_duration_sec;
    box.innerHTML = `<p class="note">Publié sur le compte <b style="color:var(--fg)">${esc(ci.creator_nickname || "")}</b>.${tooLong ? ` <span class="err">Ta vidéo dépasse la durée maximale autorisée (${ci.max_video_post_duration_sec} s).</span>` : ""}</p>
      <div class="fld"><label class="lbl" for="ttPriv">Qui peut voir cette vidéo ?</label><select class="sel" id="ttPriv"><option value="">Choisis…</option>${(ci.privacy_level_options || []).map(o => `<option value="${esc(o)}">${esc(this.PRIVACY[o] || o)}</option>`).join("")}</select></div>
      <div class="pb-checks">
        <label><input type="checkbox" id="ttCom" ${ci.comment_disabled ? "disabled" : "checked"}> Autoriser les commentaires</label>
        <label><input type="checkbox" id="ttDuet" ${ci.duet_disabled ? "disabled" : "checked"}> Autoriser les Duos</label>
        <label><input type="checkbox" id="ttStitch" ${ci.stitch_disabled ? "disabled" : "checked"}> Autoriser les Collages</label>
        <label><input type="checkbox" id="ttBrand"> Contenu promotionnel</label>
      </div>
      <div class="pb-checks" id="ttBrandBox" hidden><label><input type="checkbox" id="ttOwn"> Ma propre marque</label><label><input type="checkbox" id="ttPaid"> Partenariat rémunéré</label></div>
      <p class="pro-legal" id="ttLegal">En publiant, tu acceptes la <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener">confirmation d'utilisation de la musique</a> de TikTok.</p>`;
    const t = opts.tiktok, upd = () => {
      t.privacy_level = $("#ttPriv").value; t.disable_comment = !$("#ttCom").checked; t.disable_duet = !$("#ttDuet").checked; t.disable_stitch = !$("#ttStitch").checked;
      $("#ttBrandBox").hidden = !$("#ttBrand").checked; t.brand_organic = $("#ttBrand").checked && $("#ttOwn").checked; t.brand_content = $("#ttBrand").checked && $("#ttPaid").checked;
      // Branded content cannot be private on TikTok.
      const self = $("#ttPriv").querySelector('option[value="SELF_ONLY"]'); if (self) self.disabled = t.brand_content;
      if (t.brand_content && t.privacy_level === "SELF_ONLY") { $("#ttPriv").value = ""; t.privacy_level = ""; }
      $("#ttLegal").innerHTML = t.brand_content ? `En publiant, tu acceptes la <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noopener">politique sur le contenu de marque</a> et la <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener">confirmation d'utilisation de la musique</a> de TikTok.` : `En publiant, tu acceptes la <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener">confirmation d'utilisation de la musique</a> de TikTok.`;
      sync();
    };
    box.querySelectorAll("select,input").forEach(i => i.onchange = upd);
    if (tooLong) $("#ttPriv").disabled = true;
  },

  async run({ blob, ext, kind, opts }) {
    const targets = $$(".pb-on").filter(c => c.checked).map(c => c.dataset.p);
    const caption = $("#pbCap").value, go = $("#pbGo"), S = $("#pbState");
    go.disabled = true; $$(".pb-on").forEach(c => c.disabled = true);
    const line = (p, html) => { let el = $("#pbs-" + p); if (!el) { el = document.createElement("p"); el.className = "note"; el.id = "pbs-" + p; S.appendChild(el); } el.innerHTML = `<b style="color:var(--fg)">${Social.NAMES[p]}</b> · ${html}`; };
    targets.forEach(p => line(p, `<span class="spin"></span>En attente…`));
    const path = `${Auth.user.id}/${Date.now()}-${uid()}.${ext}`;
    const up = await Auth.sb.storage.from("publish").upload(path, blob, { contentType: blob.type || (kind === "video" ? "video/mp4" : "image/jpeg"), upsert: false });
    if (up.error) { targets.forEach(p => line(p, `<span class="err">Envoi du fichier impossible${/size|large/i.test(up.error.message || "") ? " : fichier trop lourd" : ""}.</span>`)); go.disabled = false; return; }
    let okCount = 0;
    for (let i = 0; i < targets.length; i++) {
      const p = targets[i];
      line(p, `<span class="spin"></span>${kind === "video" ? "Publication (la vidéo est traitée par la plateforme, jusqu'à 3 minutes)…" : "Publication…"}`);
      try {
        const r = await MadaServer.post("/api/social/publish", { provider: p, path, kind, caption, format: opts.instagram && opts.instagram.format, tiktok: opts.tiktok, last: i === targets.length - 1 });
        okCount++;
        line(p, r.pending ? "Envoyée : TikTok finit de la traiter, elle apparaîtra dans quelques minutes." : `Publiée ✦ ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">Voir</a>` : ""}`);
        Store.put("post", { id: uid("pub"), ws: WS.cur.id, provider: p, kind, format: p === "instagram" ? opts.instagram.format : "video", url: r.url || "", caption: caption.slice(0, 300), at: Date.now() });
      } catch (e) {
        line(p, `<span class="err">${esc(this.err(e))}</span>`);
      }
    }
    if (okCount) toast(okCount > 1 ? "Publié sur tes comptes ✦" : "Publié ✦", 3000);
    go.textContent = "Terminé"; go.onclick = () => Modal.close(); go.disabled = false;
  },

  err(e) {
    return ({ reconnect: "La connexion a expiré : reconnecte ton compte dans Statistiques.", not_connected: "Compte non connecté.", media_rejected: e.message || "La plateforme a refusé le fichier.", login_required: "Reconnecte-toi à ton compte MaDA.", timeout: "La plateforme traite encore la vidéo : vérifie dans quelques minutes.", unsupported: e.message || "Format non accepté." })[e && e.code] || "La publication n'a pas abouti. Réessaie.";
  }
};

/* ---------- Statistics (in the Statistiques page) ---------- */
const Stats = {
  data: {},
  num(v) { if (v == null || v === "") return "–"; v = +v; return v >= 1e6 ? (v / 1e6).toFixed(1).replace(".", ",") + " M" : v >= 1e4 ? Math.round(v / 1e3) + " k" : v >= 1e3 ? (v / 1e3).toFixed(1).replace(".", ",") + " k" : String(v); },

  html() {
    if (!Social.enabled()) return "";
    const conn = Social.providers().filter(p => Social.acc(p));
    return `${Social.card()}${conn.map(p => `<div class="card" id="st-${p}"><div class="sec-h"><h2>${Social.NAMES[p]}</h2><span class="note">@${esc(Social.acc(p).username || "")}</span><button class="btn sm ghost" data-st-reload="${p}" style="margin-left:auto">Actualiser</button></div><div class="st-body"><p class="note"><span class="spin"></span>Chargement des statistiques…</p></div></div>`).join("")}
      ${conn.length ? `<div class="card"><div class="sec-h"><h2>Conseils de l'IA</h2></div><p class="note">L'IA lit tes statistiques et te dit ce qui marche, quand publier et quoi publier la semaine prochaine.</p><div class="row"><button class="btn ai" id="stAi">✦ Analyser mes statistiques</button><span class="note" id="stAiState"></span></div><div id="stAiOut">${WS.cur.statsAdvice ? this.adviceHtml(WS.cur.statsAdvice) : ""}</div></div>` : ""}`;
  },

  async bind(root) {
    Social.bindCard(root);
    root.querySelectorAll("[data-st-reload]").forEach(b => b.onclick = () => this.fill(b.dataset.stReload, true));
    const ai = $("#stAi"); if (ai) ai.onclick = () => this.advise();
    root.querySelectorAll("[data-adv]").forEach(b => b.onclick = () => this.make(+b.dataset.adv));
    for (const p of Social.providers().filter(x => Social.acc(x))) this.fill(p);
  },

  async fill(p, force) {
    const box = $(`#st-${p} .st-body`); if (!box) return;
    if (force || !this.data[p]) {
      box.innerHTML = `<p class="note"><span class="spin"></span>Chargement des statistiques…</p>`;
      try { this.data[p] = await MadaServer.json("/api/social/stats?provider=" + p); }
      catch (e) { box.innerHTML = `<p class="note err">${e && e.code === "reconnect" ? "La connexion a expiré : déconnecte puis reconnecte ce compte." : "Statistiques indisponibles pour l'instant."}</p>`; return; }
    }
    const d = this.data[p], pr = d.profile || {}, posts = d.posts || [];
    const avg = k => { const v = posts.map(x => x[k]).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
    const kpis = [["Abonnés", pr.followers], ["Publications", pr.posts], ...(pr.likes != null ? [["J'aime reçus", pr.likes]] : []), ["Vues moyennes", avg("views")], ["J'aime moyens", avg("likes")]];
    box.innerHTML = `<div class="st-kpis">${kpis.map(([l, v]) => `<div><b>${this.num(v)}</b><small>${l}</small></div>`).join("")}</div>
      ${posts.length ? `<div class="st-table" role="table"><div class="st-r st-h" role="row"><span>Publication</span><span>Vues</span><span>Portée</span><span>J'aime</span><span>Comm.</span><span>Partages</span><span>Enreg.</span></div>
      ${posts.map(x => `<a class="st-r" role="row" href="${esc(x.url || "#")}" target="_blank" rel="noopener"><span class="st-post">${x.thumb ? `<img src="${esc(x.thumb)}" alt="" loading="lazy">` : `<i></i>`}<span><b>${esc(x.type)} · ${x.date ? fmtDate(x.date) : ""}</b><small>${esc((x.caption || "").slice(0, 70))}</small></span></span><span>${this.num(x.views)}</span><span>${this.num(x.reach)}</span><span>${this.num(x.likes)}</span><span>${this.num(x.comments)}</span><span>${this.num(x.shares)}</span><span>${this.num(x.saves)}</span></a>`).join("")}</div>` : `<p class="note">Aucune publication pour l'instant.</p>`}`;
  },

  async advise() {
    if (!AI.ok()) return toast(AI.unavailableMsg(), 4000);
    const st = $("#stAiState"), btn = $("#stAi"); btn.disabled = true; st.innerHTML = `<span class="spin"></span>Analyse…`;
    try {
      for (const p of Social.providers().filter(x => Social.acc(x))) if (!this.data[p]) this.data[p] = await MadaServer.json("/api/social/stats?provider=" + p);
      const compact = Object.fromEntries(Object.entries(this.data).map(([p, d]) => [p, { profil: d.profile, publications: (d.posts || []).map(x => ({ type: x.type, date: x.date, legende: (x.caption || "").slice(0, 120), vues: x.views, portee: x.reach, likes: x.likes, commentaires: x.comments, partages: x.shares, enregistrements: x.saves, duree: x.duration })) }]));
      const r = await AI.json(`Tu es stratège social media, expert Instagram et TikTok. Voici les statistiques réelles des comptes de cette marque (JSON) :
${JSON.stringify(compact)}
${brandContext()}
Analyse-les comme un pro : compare les publications entre elles (vues, partages et enregistrements comptent plus que les j'aime), repère les formats, sujets, accroches et jours ou heures qui performent, et ce qui ne marche pas. Cite des publications précises. N'invente aucun chiffre.
Réponds uniquement avec ce JSON :
{"summary":"3 ou 4 phrases de diagnostic","works":["3 à 5 constats sur ce qui marche"],"improve":["3 à 5 points à corriger"],"best_times":"meilleurs jours et heures pour publier, déduits des données","hooks":["3 accroches à tester, adaptées à ce compte"],"plan":[{"day":"Lun","format":"Reel, post, story ou carrousel","idea":"idée concrète"}]} avec 5 à 7 éléments dans plan.`);
      WS.cur.statsAdvice = { date: Date.now(), summary: String(r.summary || ""), works: (r.works || []).map(String), improve: (r.improve || []).map(String), best_times: String(r.best_times || ""), hooks: (r.hooks || []).map(String), plan: (r.plan || []).slice(0, 7) };
      await WS.save();
      $("#stAiOut").innerHTML = this.adviceHtml(WS.cur.statsAdvice); st.textContent = "";
      $$("#stAiOut [data-adv]").forEach(b => b.onclick = () => this.make(+b.dataset.adv));
    } catch (e) { st.innerHTML = `<span class="err">${esc(AI.err(e))}</span>`; }
    btn.disabled = false;
  },

  adviceHtml(a) {
    return `<div style="display:flex;flex-direction:column;gap:12px;margin-top:6px"><p style="margin:0;line-height:1.6">${esc(a.summary)}</p>
      <div class="g2"><div><b>Ce qui marche</b><ul class="blist">${a.works.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div><div><b>À améliorer</b><ul class="blist">${a.improve.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
      ${a.best_times ? `<p class="note"><b style="color:var(--fg)">Quand publier :</b> ${esc(a.best_times)}</p>` : ""}
      ${a.hooks.length ? `<div><b>Accroches à tester</b><ul class="blist">${a.hooks.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      ${a.plan.length ? `<div class="plan">${a.plan.map((p, i) => `<div><b>${esc(p.day || "J" + (i + 1))} · ${esc(p.format || "")}</b>${esc(p.idea || "")}<button class="btn sm" data-adv="${i}" style="align-self:flex-start;margin-top:4px">Créer</button></div>`).join("")}</div>` : ""}
      <p class="note">Analyse du ${fmtDate(a.date)}</p></div>`;
  },

  make(i) {
    const p = WS.cur.statsAdvice.plan[i]; if (!p) return;
    if (/reel|vid|tiktok/i.test(p.format || "")) { App.go("video", { force: true }); Video.prefill && Video.prefill(p.idea); return; }
    Brief.prefill({ kind: guessKind(p.format || "post") === "video" ? "post" : guessKind(p.format || "post"), idea: String(p.idea || "") });
    App.go("create", { force: true });
  }
};
