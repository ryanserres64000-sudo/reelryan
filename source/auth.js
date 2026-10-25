/* ================= ACCOUNTS (site and app) ================= */
// Optional MaDA account (Supabase): e-mail code, Apple or Google. Signed in,
// brands, creations and ideas sync through the table mada_docs (Store "cloud"
// mode), and Instagram / TikTok can be connected. Inside Claude, the Claude
// account is used instead and none of this shows.
const Status = {
  p: null,
  get() { return this.p || (this.p = window.MadaServer ? MadaServer.json("/api/status").catch(() => null) : Promise.resolve(null)); }
};

const Auth = {
  sb: null, session: null, user: null, available: false,

  native() { return !!window.MadaNative; },
  name() { const m = (this.user && this.user.user_metadata) || {}; return m.full_name || m.name || (this.user && this.user.email ? this.user.email.split("@")[0] : ""); },

  async init() {
    if (!window.MadaServer || !window.supabase) return;
    let cfg = null;
    try { cfg = JSON.parse(lsGet("mada-supa") || "null"); } catch (e) { }
    const st = await Status.get();
    if (st) { cfg = st.supabase || null; lsSet("mada-supa", JSON.stringify(cfg)); }
    if (!cfg || !cfg.url) return;
    this.available = true;
    try {
      this.sb = supabase.createClient(cfg.url, cfg.anonKey, { auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: !this.native() } });
      const { data } = await this.sb.auth.getSession();
      this.set(data && data.session);
    } catch (e) { this.available = false; return; }
    if (/[?&]code=/.test(location.search)) history.replaceState(null, "", location.pathname);
    if (this.user) await this.adopt();
    this.sb.auth.onAuthStateChange((ev, session) => {
      const had = !!this.user; this.set(session);
      if (ev === "SIGNED_IN" && !had) this.adopt().then(() => { toast("Connecté ✦"); setTimeout(() => location.reload(), 400); });
      if (ev === "SIGNED_OUT" && had) location.reload();
    });
    if (this.native()) this.listenLinks();
  },

  set(session) {
    this.session = session || null; this.user = session ? session.user : null;
    MadaServer.setIdentity(this.user ? this.user.id : "", session ? session.access_token : "");
    if (this.user) App.me = { name: this.name(), email: this.user.email };
  },

  // Data on this device made without an account joins the first account that signs in;
  // data left by another account is removed (it stays in that account).
  async adopt() {
    const owner = lsGet("mada-owner");
    if (owner && owner !== this.user.id) await L.op("docs", "readwrite", st => st.clear());
    lsSet("mada-owner", this.user.id);
  },

  listenLinks() {
    MadaNative.plugin("App").addListener("appUrlOpen", async ({ url }) => {
      if (!url || !url.startsWith(MadaNative.scheme + "://")) return;
      const u = new URL(url.replace(MadaNative.scheme + "://", "https://app/"));
      MadaNative.plugin("Browser").close().catch(() => { });
      if (u.pathname === "/auth") {
        const code = u.searchParams.get("code");
        if (!code) return toast("Connexion annulée.");
        const { error } = await this.sb.auth.exchangeCodeForSession(code);
        if (error) toast("La connexion n'a pas abouti. Réessaie.");
      }
      if (u.pathname === "/social") Social.returned(u.searchParams.get("provider"), u.searchParams.get("ok") === "1");
    });
  },

  async oauth(provider) {
    const native = this.native();
    const { data, error } = await this.sb.auth.signInWithOAuth({ provider, options: { redirectTo: native ? MadaNative.scheme + "://auth" : location.origin + "/", skipBrowserRedirect: native } });
    if (error) return toast(/not enabled|unsupported/i.test(error.message || "") ? "Cette connexion n'est pas encore activée." : "Connexion impossible pour l'instant.");
    if (native) await MadaNative.plugin("Browser").open({ url: data.url, presentationStyle: "popover" });
  },

  open(reason) {
    if (!this.available) return toast("Les comptes ne sont pas encore activés sur ce serveur.");
    Modal.open(`<div class="eyebrow">Compte MaDA</div><h2>${reason ? "Connecte-toi pour continuer" : "Crée ton compte ou connecte-toi"}</h2>
      <p class="note">${esc(reason || "Retrouve tes marques et créations sur tous tes appareils, et publie directement sur Instagram et TikTok.")}</p>
      <div class="auth-btns"><button class="btn auth-apple" data-oauth="apple"><span aria-hidden="true"></span> Continuer avec Apple</button><button class="btn auth-google" data-oauth="google"><b aria-hidden="true">G</b> Continuer avec Google</button></div>
      <div class="auth-or"><span>ou avec ton e-mail</span></div>
      <div id="auMail"><div class="inrow"><input class="inp" id="auEmail" type="email" inputmode="email" autocomplete="email" placeholder="ton@email.com" aria-label="Adresse e-mail"><button class="btn primary" id="auSend">Recevoir un code</button></div></div>
      <p class="pro-legal">En continuant, tu acceptes les <a href="${Pro.link("conditions")}" target="_blank" rel="noopener">conditions d'utilisation</a> et la <a href="${Pro.link("confidentialite")}" target="_blank" rel="noopener">politique de confidentialité</a>.</p>
      <div class="row"><button class="btn ghost sm" data-close>Plus tard</button></div>`);
    $$("[data-oauth]").forEach(b => b.onclick = () => this.oauth(b.dataset.oauth));
    const send = async () => {
      const email = $("#auEmail").value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast("Adresse e-mail invalide.");
      $("#auSend").disabled = true; $("#auSend").innerHTML = `<span class="spin"></span>Envoi…`;
      const { error } = await this.sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: this.native() ? undefined : location.origin + "/" } });
      if (error) { toast(/rate|seconds/i.test(error.message || "") ? "Attends un peu avant de redemander un code." : "Envoi impossible. Vérifie l'adresse."); $("#auSend").disabled = false; $("#auSend").textContent = "Recevoir un code"; return; }
      $("#auMail").innerHTML = `<p class="note">Code envoyé à <b style="color:var(--fg)">${esc(email)}</b>. Il peut mettre une minute à arriver (regarde aussi les indésirables).</p>
        <div class="inrow"><input class="inp" id="auCode" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="Code reçu" aria-label="Code reçu par e-mail"><button class="btn primary" id="auOk">Valider</button></div>
        <button class="btn ghost sm" id="auBack">Changer d'adresse</button>`;
      $("#auCode").focus();
      const ok = async () => {
        const token = $("#auCode").value.replace(/\s/g, "");
        if (token.length < 6) return toast("Entre le code reçu par e-mail.");
        $("#auOk").disabled = true;
        const { error: er } = await this.sb.auth.verifyOtp({ email, token, type: "email" });
        if (er) { toast("Code incorrect ou expiré."); $("#auOk").disabled = false; }
      };
      $("#auOk").onclick = ok; $("#auCode").onkeydown = e => { if (e.key === "Enter") ok(); };
      $("#auBack").onclick = () => this.open(reason);
    };
    $("#auSend").onclick = send; $("#auEmail").onkeydown = e => { if (e.key === "Enter") send(); };
  },

  async signOut() {
    await L.op("docs", "readwrite", st => st.clear()); lsSet("mada-owner", "");
    await this.sb.auth.signOut();
    location.reload();
  },

  confirmDelete() {
    Modal.open(`<h2>Supprimer ton compte ?</h2><p class="note">Ton compte, tes marques, créations et idées enregistrées en ligne, tes connexions Instagram et TikTok et les données de cet appareil seront effacés définitivement.${Pro.pro && Pro.native() ? " Ton abonnement MaDA Pro n'est pas annulé automatiquement : gère-le dans les réglages de ton compte Apple ou Google." : ""}</p>
      <div class="fld"><label class="lbl" for="adConfirm">Écris SUPPRIMER pour confirmer</label><input class="inp" id="adConfirm" autocomplete="off"></div>
      <div class="row"><button class="btn danger" id="adGo" disabled>Supprimer définitivement</button><button class="btn ghost" data-close>Annuler</button></div>`);
    $("#adConfirm").oninput = e => $("#adGo").disabled = e.target.value.trim().toUpperCase() !== "SUPPRIMER";
    $("#adGo").onclick = async () => {
      $("#adGo").disabled = true; $("#adGo").innerHTML = `<span class="spin"></span>Suppression…`;
      try { await MadaServer.post("/api/account"); }
      catch (e) { toast("La suppression n'a pas abouti. Réessaie ou écris-nous."); $("#adGo").disabled = false; $("#adGo").textContent = "Supprimer définitivement"; return; }
      try { await this.sb.auth.signOut({ scope: "local" }); } catch (e) { }
      await wipeDevice();
    };
  },

  card() {
    if (!this.available) return "";
    if (!this.user) return `<div class="card"><div class="sec-h"><h2>Mon compte</h2><span class="pill">Invité</span></div>
      <p class="note">Crée ton compte gratuit pour retrouver tes créations sur tous tes appareils et publier sur Instagram et TikTok. Ce que tu as déjà créé ici sera ajouté à ton compte.</p>
      <div class="row"><button class="btn primary" id="acLogin">Créer mon compte / Me connecter</button></div></div>`;
    return `<div class="card"><div class="sec-h"><h2>Mon compte</h2><span class="pill ai">Connecté</span></div>
      <p class="note">${esc(this.user.email || this.name())}. Tes marques, créations et idées sont synchronisées. Les images et vidéos importées restent sur l'appareil où tu les as ajoutées.</p>
      <div class="row"><button class="btn" id="acOut">Se déconnecter</button><button class="btn ghost danger" id="acDel">Supprimer mon compte</button></div></div>`;
  },
  bindCard() {
    const a = $("#acLogin"); if (a) a.onclick = () => this.open();
    const o = $("#acOut"); if (o) o.onclick = () => this.signOut();
    const d = $("#acDel"); if (d) d.onclick = () => this.confirmDelete();
  }
};

// Cloud backend for Store when signed in, with the same small interface as Claude's db.
const SupaDB = {
  collection() {
    const t = () => Auth.sb.from("mada_docs");
    const ok = r => { if (r.error) throw r.error; return r; };
    return {
      where(field, op, value) {
        return { get: async () => ({ docs: (ok(await t().select("data").eq("kind", value)).data || []).map(r => ({ data: () => r.data })) }) };
      },
      doc(key) {
        return {
          set: async body => { ok(await t().upsert({ user_id: Auth.user.id, key, kind: body.kind, data: body, updated_at: new Date().toISOString() })); },
          delete: async () => { ok(await t().delete().eq("key", key)); }
        };
      }
    };
  }
};

/* ---------- First launch ---------- */
const Onboard = {
  STEPS: [
    ["✦", "Dis ton idée, MaDA crée", "Écris ou dicte ce que tu veux : affiche, story, post, carrousel. MaDA compose 3 propositions à ton image en moins d'une minute."],
    ["▶", "Monte tes Reels en musique", "Importe tes vidéos et photos, choisis une musique : MaDA coupe sur le rythme, ajoute les textes et les sous-titres."],
    ["↗", "Publie sur Instagram et TikTok", "Connecte tes comptes et publie directement, puis suis tes statistiques avec les conseils de l'IA."]
  ],
  maybe() { if (!lsGet("mada-onboarded")) this.show(0); },
  show(i) {
    const [icon, title, text] = this.STEPS[i], last = i === this.STEPS.length - 1;
    Modal.open(`<div class="onb"><div class="onb-ico" aria-hidden="true">${icon}</div><div class="eyebrow">${i + 1} / ${this.STEPS.length}</div><h2>${title}</h2><p class="note">${text}</p>
      <div class="onb-dots" aria-hidden="true">${this.STEPS.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
      <div class="row" style="justify-content:center">${last
        ? (Auth.available && !Auth.user ? `<button class="btn primary" id="obAcc">Créer mon compte</button><button class="btn ghost" id="obEnd">Plus tard</button>` : `<button class="btn primary" id="obEnd">C'est parti</button>`)
        : `<button class="btn primary" id="obNext">Suivant</button><button class="btn ghost" id="obEnd">Passer</button>`}</div></div>`);
    const end = () => { lsSet("mada-onboarded", "1"); Modal.close(); };
    const n = $("#obNext"); if (n) n.onclick = () => this.show(i + 1);
    $("#obEnd").onclick = end;
    const a = $("#obAcc"); if (a) a.onclick = () => { lsSet("mada-onboarded", "1"); Auth.open(); };
  }
};
