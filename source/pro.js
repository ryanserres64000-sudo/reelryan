/* ================= MADA PRO ================= */
// In the iOS / Android app, purchases go through Apple / Google via the
// RevenueCat plugin ("Purchases"); the server checks the same entitlement for
// the AI quota. Without a gate on the server (or inside Claude) everyone has
// full access and none of this is shown.
const Pro = {
  ENTITLEMENT: "pro",
  on: false, pro: lsGet("mada-pro") === "1", freePerDay: 0, rc: null, pkgs: [], ready: false,

  native() { return !!window.MadaNative; },
  allowed() { return !this.on || this.pro; },
  set(v) { this.pro = !!v; lsSet("mada-pro", v ? "1" : "0"); if (App.view === "account") Account.render(); },
  apply(info) { const e = info && info.entitlements && info.entitlements.active; if (e) this.set(!!e[this.ENTITLEMENT]); },

  async init() {
    const S = window.MadaServer, st = await Status.get();
    if (st) { this.on = !!st.gated; this.freePerDay = st.freePerDay || 0; if (st.gated) this.set(!!st.pro || this.pro); }
    const keys = window.MADA_RC_KEYS || {}, key = this.native() && keys[MadaNative.platform];
    if (key) {
      try {
        this.rc = MadaNative.plugin("Purchases");
        await this.rc.configure({ apiKey: key, appUserID: S ? S.user : undefined });
        this.apply((await this.rc.getCustomerInfo()).customerInfo);
        const o = await this.rc.getOfferings();
        this.pkgs = (o && o.current && o.current.availablePackages) || [];
      } catch (e) { this.rc = null; }
    }
    this.ready = true;
    window.addEventListener("mada:pro-required", () => this.paywall(this.freePerDay ? `Tu as utilisé tes ${this.freePerDay} demandes IA gratuites d'aujourd'hui.` : "Limite gratuite du jour atteinte."));
  },

  priceLabel(p) {
    const pr = p.product || {}, per = { MONTHLY: " / mois", ANNUAL: " / an", WEEKLY: " / semaine", LIFETIME: " à vie" }[p.packageType] || "";
    return (pr.priceString || "") + per;
  },

  paywall(reason) {
    const buy = this.native() && this.rc && this.pkgs.length;
    Modal.open(`<div class="eyebrow">MaDA Pro</div><h2>Tout MaDA, sans limite</h2>
      ${reason ? `<p class="note">${esc(reason)}</p>` : ""}
      <ul class="pro-perks"><li>Créations et retouches IA illimitées</li><li>Galerie de musique complète, utilisable dans tes montages et hors connexion</li><li>Tous les formats d'export, en haute définition</li><li>Espaces de marque illimités</li><li>Les nouveautés en premier : publication directe, analyses détaillées</li></ul>
      ${buy ? `<div class="row" id="proPkgs">${this.pkgs.map((p, i) => `<button class="btn ${i ? "" : "primary"}" data-pkg="${i}">${esc(this.priceLabel(p))}</button>`).join("")}</div>
        <div class="row"><button class="btn sm ghost" id="proRestore">Restaurer mes achats</button><button class="btn sm ghost" data-close>Plus tard</button></div>
        <p class="pro-legal">Paiement par ton compte ${MadaNative.platform === "ios" ? "Apple" : "Google Play"}. Un abonnement se renouvelle automatiquement sauf annulation au moins 24 h avant la fin de la période, depuis les réglages de ton compte. <a href="${this.link("conditions")}" target="_blank" rel="noopener">Conditions</a> · <a href="${this.link("confidentialite")}" target="_blank" rel="noopener">Confidentialité</a></p>`
        : `<p class="note">${this.native() ? "Les achats ne sont pas encore disponibles. Réessaie dans un instant." : "MaDA Pro s'achète dans l'app MaDA sur iPhone et Android. Il est ensuite actif partout."}</p><div class="row"><button class="btn ghost" data-close>Fermer</button></div>`}`);
    const P = $("#proPkgs");
    if (P) P.onclick = async e => {
      const b = e.target.closest("[data-pkg]"); if (!b) return;
      $$("#proPkgs button").forEach(x => x.disabled = true); b.innerHTML = `<span class="spin"></span>Paiement…`;
      try {
        const r = await this.rc.purchasePackage({ aPackage: this.pkgs[+b.dataset.pkg] });
        this.apply(r.customerInfo);
        if (this.pro) { Modal.close(); toast("Bienvenue dans MaDA Pro ✦", 3500); return; }
        toast("Paiement reçu, activation en cours…");
      } catch (er) { if (!(er && (er.userCancelled || er.code === "1" || /cancel/i.test(er.message || "")))) toast("Le paiement n'a pas abouti."); }
      if ($("#proPkgs")) { $$("#proPkgs button").forEach((x, i) => { x.disabled = false; x.textContent = this.priceLabel(this.pkgs[i]); }); }
    };
    const R = $("#proRestore");
    if (R) R.onclick = async () => {
      R.disabled = true;
      try { this.apply((await this.rc.restorePurchases()).customerInfo); toast(this.pro ? "MaDA Pro est actif" : "Aucun achat à restaurer sur ce compte"); if (this.pro) Modal.close(); }
      catch (e) { toast("Restauration impossible pour l'instant."); }
      if (R.isConnected) R.disabled = false;
    };
  },

  link(page) { const base = (window.MadaServer && MadaServer.base) || ""; return `${base}/${page}.html`; },

  card() {
    if (!this.on) return "";
    return `<div class="card"><div class="sec-h"><h2>MaDA Pro</h2><span class="pill ${this.pro ? "ai" : ""}">${this.pro ? "Actif" : "Gratuit"}</span></div>
      <p class="note">${this.pro ? "Merci ! Toutes les fonctions sont débloquées." : `Version gratuite : ${this.freePerDay} demandes IA par jour. Passe Pro pour tout débloquer.`}</p>
      <div class="row">${this.pro ? (this.native() ? `<button class="btn" id="acSubs">Gérer mon abonnement</button>` : "") : `<button class="btn primary" id="acPro">Passer à MaDA Pro</button>`}</div></div>`;
  },
  bindCard() {
    const a = $("#acPro"); if (a) a.onclick = () => this.paywall();
    const s = $("#acSubs"); if (s) s.onclick = () => window.open(MadaNative.platform === "ios" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions", "_blank");
  }
};
