/* ================= MUSIC GALLERY ================= */
// Search a licensed catalogue through the MaDA server, preview, use in the
// video, keep tracks offline in "Mes musiques" (IndexedDB, store kv, key music:<id>).
const MusicLib = {
  MOODS: [["tendance", "Tendance"], ["chill", "Chill"], ["energie", "Énergie"], ["soiree", "Soirée"], ["rap", "Rap"], ["electro", "Électro"], ["pop", "Pop"], ["luxe", "Luxe"], ["cinematique", "Cinématique"], ["acoustique", "Acoustique"]],
  tab: "find", q: "", mood: "tendance", tracks: [], offset: 0, more: false, busy: false, err: "", lib: [], audio: null, playing: null, onPick: null, seq: 0,

  server() { return window.MadaServer || null; },
  credit(t) { return `Musique : ${t.title} – ${t.artist}${t.provider ? ` (${t.provider}${t.license ? `, ${t.license}` : ""})` : ""}`; },
  dur(s) { s = Math.round(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; },

  async loadLib() { this.lib = ((await L.all("kv")) || []).filter(v => v && v.kind === "music").sort((a, b) => b.added - a.added); },
  async keep(meta, blob) {
    const rec = { kind: "music", ...meta, blob, added: Date.now() };
    await L.put("kv", "music:" + meta.id, rec); await this.loadLib(); return rec;
  },

  async open(onPick) {
    this.onPick = onPick || null;
    await this.loadLib();
    Modal.open(`<div class="sec-h"><h2>Musique</h2><button class="btn sm ghost" data-close style="margin-left:auto">Fermer</button></div>
      <div class="segs" id="muTabs"><button data-mt="find">Découvrir</button><button data-mt="lib">Mes musiques</button></div>
      <div id="muBody"></div>`, true);
    Modal.onclose = () => this.stop();
    $("#muTabs").onclick = e => { const b = e.target.closest("[data-mt]"); if (b) { this.tab = b.dataset.mt; this.render(); } };
    this.render();
    if (this.tab === "find" && !this.tracks.length) this.search();
  },

  render() {
    const B = $("#muBody"); if (!B) return;
    $$("#muTabs button").forEach(b => b.setAttribute("aria-pressed", b.dataset.mt === this.tab));
    if (this.tab === "lib") return this.renderLib(B);
    const S = this.server();
    B.innerHTML = `<div class="inrow"><input class="inp" id="muQ" type="search" placeholder="Cherche un titre, un artiste, une ambiance…" value="${esc(this.q)}" aria-label="Rechercher une musique"><button class="send" id="muGo" aria-label="Rechercher">⌕</button></div>
      <div class="chips" id="muMoods">${this.MOODS.map(([k, l]) => `<button class="chip" data-mood="${k}" aria-pressed="${!this.q && this.mood === k}">${l}</button>`).join("")}</div>
      <div id="muList">${!S ? `<p class="note">La recherche de musique fonctionne dans l'app MaDA et sur le site. Ici, importe tes propres fichiers dans « Mes musiques ».</p>` : this.listHtml()}</div>
      <p class="note">Musiques d'artistes indépendants sous licence. Respecte la licence indiquée et ajoute le crédit dans ta légende quand elle le demande.</p>`;
    const go = () => { this.q = $("#muQ").value.trim(); this.search(); };
    $("#muGo").onclick = go;
    $("#muQ").onkeydown = e => { if (e.key === "Enter") go(); };
    $("#muMoods").onclick = e => { const b = e.target.closest("[data-mood]"); if (!b) return; this.mood = b.dataset.mood; this.q = ""; $("#muQ").value = ""; this.search(); };
    this.bindRows($("#muList"), id => this.tracks.find(t => t.id === id));
    const m = $("#muMore"); if (m) m.onclick = () => this.search(true);
  },

  listHtml() {
    if (this.busy && !this.tracks.length) return `<p class="note"><span class="spin"></span>Recherche…</p>`;
    if (this.err) return `<p class="note">${esc(this.err)}</p>`;
    if (!this.tracks.length) return `<p class="note">Aucune musique trouvée. Essaie un autre mot.</p>`;
    const kept = new Set(this.lib.map(t => t.id));
    return `<div class="mu-list">${this.tracks.map(t => this.rowHtml(t, kept.has(t.id))).join("")}</div>${this.more ? `<button class="btn sm" id="muMore" ${this.busy ? "disabled" : ""}>Plus de musiques</button>` : ""}`;
  },

  rowHtml(t, kept, local) {
    const on = this.playing === t.id;
    return `<div class="mu-row" data-id="${esc(t.id)}">
      <button class="mu-play" data-mu="play" aria-label="${on ? "Pause" : "Écouter"} ${esc(t.title)}" style="${t.cover ? `background-image:url('${esc(t.cover)}')` : ""}">${on ? "❚❚" : "▶"}</button>
      <div class="mu-meta"><b>${esc(t.title)}</b><small>${esc(t.artist || "")}${t.duration ? ` · ${this.dur(t.duration)}` : ""}${t.license ? ` · ${esc(t.license)}` : ""}</small></div>
      <div class="row">${local ? `<button class="btn sm ghost" data-mu="credit" title="Copier le crédit">©</button><button class="btn sm ghost danger" data-mu="del" aria-label="Retirer">✕</button>`
        : kept ? `<span class="pill">Enregistrée</span>` : t.downloadable === false ? "" : `<button class="btn sm ghost" data-mu="keep" title="Garder hors connexion">⬇</button>`}
      ${this.onPick ? `<button class="btn sm primary" data-mu="use">Utiliser</button>` : ""}</div></div>`;
  },

  bindRows(box, find) {
    if (!box) return;
    box.onclick = async e => {
      const b = e.target.closest("[data-mu]"); if (!b) return;
      const t = find(b.closest("[data-id]").dataset.id); if (!t) return;
      const act = b.dataset.mu;
      if (act === "play") return this.toggle(t);
      if (act === "credit") return copyText(this.credit(t));
      if (act === "del") { await L.del("kv", "music:" + t.id); await this.loadLib(); return this.render(); }
      if (!Pro.allowed()) return Pro.paywall("La galerie de musique complète fait partie de MaDA Pro.");
      b.disabled = true; const label = b.textContent; b.innerHTML = `<span class="spin"></span>`;
      try {
        const rec = t.blob ? t : await this.keep(this.meta(t), await this.server().blob("/api/music?file=" + encodeURIComponent(t.id)));
        if (act === "use") {
          this.stop();
          const file = new File([rec.blob], `${rec.artist ? rec.artist + " - " : ""}${rec.title}.mp3`.replace(/[\\/:*?"<>|]/g, ""), { type: rec.blob.type || "audio/mpeg" });
          const pick = this.onPick; Modal.close();
          await pick(file, rec);
          if (rec.provider) toast(`Ajoutée. Crédit à mettre en légende : ${this.credit(rec)}`, 6000);
        } else { toast("Gardée dans « Mes musiques »"); this.render(); }
      } catch (er) {
        toast(er && er.code === "unauthorized" ? "Code d'accès manquant : lance d'abord une création IA pour le saisir." : "Téléchargement impossible. Vérifie ta connexion.");
        if (b.isConnected) { b.disabled = false; b.textContent = label; }
      }
    };
  },

  meta(t) { return { id: t.id, title: t.title, artist: t.artist, duration: t.duration, cover: t.cover, license: t.license, licenseUrl: t.licenseUrl, provider: t.provider }; },

  renderLib(B) {
    B.innerHTML = `<div class="row"><button class="btn" id="muImp">+ Importer mes musiques</button></div>
      <p class="note">Importe uniquement des musiques que tu as le droit d'utiliser : Instagram et TikTok peuvent couper le son ou bloquer une vidéo qui utilise un titre protégé.</p>
      ${this.lib.length ? `<div class="mu-list">${this.lib.map(t => this.rowHtml(t, true, true)).join("")}</div>` : `<p class="note">Aucune musique pour l'instant. Garde des titres depuis « Découvrir » (bouton ⬇) pour les utiliser sans connexion.</p>`}`;
    $("#muImp").onclick = async () => {
      const files = await pickFiles("audio/*", true);
      for (const f of files) await this.keep({ id: uid("own"), title: f.name.replace(/\.[^.]+$/, ""), artist: "", duration: 0, cover: "", license: "Mon fichier", provider: "" }, f);
      if (files.length) { toast(`${files.length} musique${files.length > 1 ? "s" : ""} importée${files.length > 1 ? "s" : ""}`); this.render(); }
    };
    this.bindRows(B, id => this.lib.find(t => t.id === id));
  },

  async search(more) {
    const S = this.server(); if (!S) return this.render();
    const n = ++this.seq;
    this.busy = true; this.err = "";
    if (!more) { this.tracks = []; this.offset = 0; }
    const L0 = $("#muList"); if (L0 && !more) L0.innerHTML = this.listHtml();
    try {
      const p = new URLSearchParams({ offset: String(this.offset) });
      if (this.q) p.set("q", this.q); else p.set("mood", this.mood);
      const r = await S.json("/api/music?" + p);
      if (n !== this.seq) return;
      this.tracks = more ? this.tracks.concat(r.tracks || []) : (r.tracks || []);
      this.offset += (r.tracks || []).length; this.more = (r.tracks || []).length >= 30;
    } catch (e) {
      if (n !== this.seq) return;
      this.err = e && e.code === "music_not_configured" ? "Le catalogue de musique n'est pas encore activé sur le serveur MaDA." : e && e.code === "unauthorized" ? "Code d'accès manquant : lance d'abord une création IA pour le saisir." : "La recherche n'a pas répondu. Vérifie ta connexion et réessaie.";
    }
    this.busy = false;
    if (this.tab === "find") this.render();
  },

  toggle(t) {
    if (this.playing === t.id) { this.stop(); return this.paint(); }
    this.stop();
    const a = this.audio || (this.audio = new Audio());
    if (t.blob) { a.src = URL.createObjectURL(t.blob); a._blob = true; }
    else { const S = this.server(); if (!S) return; a.src = S.url("/api/music?file=" + encodeURIComponent(t.id)); a._blob = false; }
    a.onended = () => { this.playing = null; this.paint(); };
    a.play().catch(() => { this.playing = null; toast("Lecture impossible."); this.paint(); });
    this.playing = t.id; this.paint();
  },
  paint() {
    $$("#muBody .mu-row").forEach(r => { const on = r.dataset.id === this.playing, b = r.querySelector(".mu-play"); b.textContent = on ? "❚❚" : "▶"; b.setAttribute("aria-label", (on ? "Pause" : "Écouter") + " " + r.querySelector("b").textContent); });
  },
  stop() {
    const a = this.audio; if (!a) return;
    a.pause(); if (a._blob && a.src) URL.revokeObjectURL(a.src);
    a.removeAttribute("src"); a.load(); this.playing = null;
  }
};
