// Tous les textes de l'app, au ton MaDa (étude, ch. 6 §3) : tutoiement, « je » pour MaDa,
// phrases courtes, verbes d'action, pas de jargon (ni « timeline » ni « BPM » hors Réglages),
// une pointe d'humour, jamais de culpabilisation. Aucun écran n'écrit de texte en dur.

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const secondes = (s: number) => `${Math.round(s)} seconde${Math.round(s) > 1 ? "s" : ""}`;

export const fr = {
  app: { name: "Ma DA", fullName: "Ma DA : Studio créatif IA", tagline: "Tu fais ton métier, MaDa fait tes Reels." },

  onboarding: {
    step1: "Choisis quelques vidéos de ta journée. Je m'occupe du montage.",
    step2: "Dis-moi en une phrase ce que tu veux montrer. Comme à un ami.",
    step3: (s: number) => `Voilà ton premier Reel. Monté en ${secondes(s)}.`,
    privacy: "Tes vidéos restent sur ton iPhone.",
  },

  rush: {
    badge: { blur: "flou", face: "visage", speech: "parole", dark: "sombre" },
    selected: (n: number) => `Rush ${n}, sélectionné`,
    notSelected: "Rush non sélectionné",
    duration: (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`,
  },

  generation: {
    steps: (rushes: number, kept: number, variants: number) => [
      `Je regarde tes ${plural(rushes, "rush", "rushes")}`,
      `Je garde les ${plural(kept, "meilleur moment", "meilleurs moments")}`,
      `Je monte ${plural(variants, "version", "versions")}`,
      "Je relis et je corrige",
      "C'est prêt",
    ],
    madeIn: (s: number) => `Monté en ${secondes(s)}`,
    cancel: "Arrêter",
  },

  result: {
    variants: { hook: "Accroche forte", calm: "Posée", rhythm: "Rythmée" },
    why: "Pourquoi ce montage",
    review: (n: number) => n ? `J'ai corrigé ${plural(n, "chose", "choses")} avant de te montrer` : "Rien à corriger, je te le montre tel quel",
    reviewExample: "J'ai corrigé 2 choses avant de te montrer : l'accroche était trop longue, et un plan était flou.",
    nextShots: "Pour la prochaine fois",
    choose: "Je prends celle-ci",
  },

  corrections: {
    field: "Dis-moi ce qu'on change",
    send: "Changer",
    suggestions: ["Plus rythmé", "Logo à la fin", "Enlève le plan flou"],
    changed: "Ce que je viens de changer est surligné.",
    learned: (rule: string) => `J'ai noté : ${rule}. Tu peux changer ça dans ton carnet de style.`,
    undo: "Annuler",
    redo: "Rétablir",
  },

  music: {
    title: "Et le son ?",
    recommended: "Conseillé pour toi",
    soon: "Bientôt",
    cards: {
      mine: { title: "Mon son", detail: "Un lien MP3 ou un fichier" },
      catalog: { title: "Catalogue MaDa", detail: "Des morceaux sous licence" },
      trending: { title: "Son tendance", detail: "Je cale le montage, tu ajoutes le son dans Instagram ou TikTok" },
      none: { title: "Sans musique", detail: "Ta voix, nettoyée, avec sous-titres" },
    },
    linkPlaceholder: "Colle un lien qui finit par .mp3",
    linkAdd: "Ajouter",
    rights: "Je détiens les droits de ce son ou j'ai l'autorisation de l'utiliser.",
    warning: "Instagram et TikTok peuvent couper le son d'une musique protégée, surtout sur un compte professionnel, parfois des semaines après. Le mode Son tendance évite ce risque.",
    lengths: [15, 30, 60] as const,
    length: (s: number) => `${s} s`,
    passage: "Glisse pour choisir le passage",
    tapTempo: "Tape le rythme",
    errors: {
      streaming: "Ce lien ouvre une page d'écoute, pas un fichier. Colle un lien qui finit par .mp3, ou importe le fichier depuis Fichiers.",
      insecure: "Ce lien n'est pas sécurisé. Essaie la version qui commence par https.",
      webPage: "Je trouve une page web à cette adresse, pas un son. Ouvre-la, télécharge le fichier, puis importe-le.",
      format: "Je ne sais pas lire ce fichier. MP3, M4A, AAC ou WAV, ça marche.",
      tooBig: "Ce son dépasse 50 Mo ou 10 minutes. Coupe-le ou choisis un extrait.",
      network: "Le téléchargement n'aboutit pas. Vérifie ta connexion, je réessaie quand tu veux.",
      noTempo: "Je n'entends pas de rythme clair. Tape-le du doigt sur l'écran, ou continue sans calage.",
      invalid: "Ce n'est pas un lien. Colle une adresse qui commence par https.",
    },
    trendingReminder: (tempo: number) => `Ajoute ton son dans l'app, tempo ${tempo}.`,
  },

  frise: {
    label: "Ton montage",
    shot: (i: number, s: number) => `Plan ${i}, ${secondes(s)}`,
    beat: "Temps fort de la musique",
  },

  export: {
    cta: "Exporter",
    platforms: "Reels, TikTok et Shorts",
    success: "C'est dans ta pellicule. Ta légende est copiée, il n'y a plus qu'à coller.",
    resume: "On reprend où on en était.",
    remaining: (s: number) => `Encore ${secondes(s)}`,
  },

  paywall: {
    title: "Tu as aimé ? Garde ta DA.",
    detail: "30 montages par mois, ton style qui s'affine, sans filigrane. 6,99 € par mois, sans engagement.",
    benefits: ["30 montages par mois", "Ton style qui s'affine à chaque correction", "Sans filigrane, sur Reels, TikTok et Shorts"],
    yearly: { label: "À l'année", price: "49,99 €", per: "par an", saving: "Tu économises 40 %" },
    monthly: { label: "Au mois", price: "6,99 €", per: "par mois", saving: "" },
    cta: "Continuer",
    restore: "Restaurer mes achats",
    terms: "Conditions",
    privacy: "Confidentialité",
    close: "Fermer",
    priceLock: "Ton prix reste le même tant que tu restes abonné.",
  },

  status: { saved: "Enregistré", counter: (n: number) => `${plural(n, "montage restant", "montages restants")} ce mois-ci` },

  errors: {
    network: "Je n'arrive pas à joindre mon studio. Ton montage est gardé, on reprend dès que le réseau revient.",
    rushes: "Il me faut un peu plus de matière : ajoute un ou deux plans de plus de 2 secondes.",
  },

  consent: "Pour monter, j'envoie 15 à 30 petites images de tes vidéos à Claude (Anthropic). Elles ne sont ni gardées ni utilisées pour entraîner l'IA.",

  nav: { back: "Retour", next: "Continuer", retry: "Réessayer", restart: "Recommencer" },

  import: {
    title: "Choisis tes rushes",
    detail: "3 à 25 vidéos ou photos de ta journée. Je les trie pendant que tu écris ton brief.",
    pick: "Ajouter depuis la photothèque",
    pickError: "Je n'ai pas pu ouvrir ta photothèque. Réessaie, ou vérifie l'accès dans Réglages.",
    sample: "Ce sont des rushes d'exemple : ajoute les tiens quand tu veux.",
    count: (n: number, total: string, max: string) => `${plural(n, "rush", "rushes")} · ${total} sur ${max}`,
    countPro: (n: number, total: string) => `${plural(n, "rush", "rushes")} · ${total}`,
    tooFew: (n: number) => `Encore ${plural(n, "rush", "rushes")} et je peux monter.`,
    tooMany: "25 rushes au maximum : retire-en un pour en ajouter un autre.",
    tooLong: "En gratuit, je monte jusqu'à 1 min 30 de rushes. Retire un rush, ou passe en Pro pour aller plus loin.",
    triage: "Tri en cours sur ton iPhone",
  },

  brief: {
    title: "Qu'est-ce qu'on montre ?",
    detail: "Une phrase, comme à un ami. Mets un texte entre « guillemets » et je le garde mot pour mot.",
    trade: "Ton métier",
    trades: {
      coach: { label: "Coach", example: "Ma séance du samedi au parc, l'énergie du groupe, et finir sur « Premier cours offert »." },
      restaurant: { label: "Restaurant", example: "Le nouveau burger du jeudi, du grill à l'assiette, termine sur « Ouvert dès 11h »." },
      artisan: { label: "Artisan", example: "La restauration de cette commode, avant et après, avec mes mains au travail." },
      commerce: { label: "Commerce", example: "Les nouveautés de la boutique cette semaine, ambiance douce, « 12 rue Thiers » à la fin." },
      freelance: { label: "Freelance", example: "Une journée de tournage pour un client, du café du matin au rendu final." },
    },
    useExample: "Prendre l'exemple",
    field: "Ton brief",
    dictate: "Dicter",
    dictateHint: "Touche le micro du clavier et parle : j'écris pour toi.",
    goal: "Objectif",
    goals: ["Faire venir du monde", "Vendre un produit", "Montrer mon savoir-faire", "Annoncer une nouveauté"],
    tone: "Ton",
    tones: ["Chaleureux", "Drôle", "Haut de gamme", "Direct"],
    duration: "Durée",
    durations: [15, 30, 60] as const,
    durationValue: (s: number) => `${s} s`,
    platforms: "Où tu publies",
    platformNames: { reels: "Reels", tiktok: "TikTok", shorts: "Shorts" },
    platformsMin: "Choisis au moins une plateforme.",
    cta: "Appel à l'action",
    ctas: ["Réserve", "Passe nous voir", "Lien en bio", "Écris-moi", "Aucun"],
    imposed: "Gardé mot pour mot",
    empty: "Écris au moins quelques mots, ou prends l'exemple.",
    compose: { goal: "Objectif", tone: "Ton", cta: "Appel à l'action à la fin" },
  },

  musicScreen: {
    detail: "Je cale les coupes sur le rythme. Tu peux aussi monter sans musique.",
    importFile: "Importer un fichier",
    importHint: "Depuis Fichiers, ou partagé avec Ma DA depuis AirDrop ou Dictaphone.",
    downloading: (share: number | null) => share === null ? "Je télécharge ton son…" : `Je télécharge ton son… ${Math.round(share * 100)} %`,
    analyzing: "J'écoute le rythme…",
    cancel: "Annuler",
    change: "Changer de son",
    tempo: (bpm: number) => `Tempo ${Math.round(bpm)}`,
    tempoTapped: (bpm: number) => `Tempo ${Math.round(bpm)}, tapé par toi`,
    listen: "Écouter le passage",
    stopListening: "Arrêter l'écoute",
    tapArea: "Tape ici sur chaque temps",
    tapMore: (n: number) => `Encore ${plural(n, "tap", "taps")}`,
    tapKeep: (bpm: number) => `Garder le tempo ${Math.round(bpm)}`,
    tapRetry: "Recommencer les taps",
    noDecoder: "Je ne peux pas écouter ce son sur cet appareil. Tape le rythme, ou continue sans calage.",
    noSync: "Continuer sans calage",
    rightsNeeded: "Coche la case des droits pour continuer.",
    trendingTempo: "Le tempo de ton son tendance",
    trendingDetail: "Je cale les coupes sur ce tempo et j'exporte sans musique. Tu ajoutes le son dans Instagram ou TikTok au moment de publier.",
    noneDetail: "Je garde ta voix et je te propose des sous-titres.",
  },

  generationScreen: {
    title: "Je monte ton Reel",
    error: "Le montage n'a pas abouti. Ton brief et tes rushes sont gardés.",
  },

  resultScreen: {
    title: "Tes versions",
    swipe: "Balaye pour comparer",
    corrections: "Ce que j'ai corrigé",
    shot: (i: number, raison: string) => `Plan ${i} : ${raison}`,
    missing: "À vérifier",
    preview: "Aperçu",
    chosen: "Version gardée. L'export arrive juste après.",
  },

  dev: { catalogue: "Voir le design system", demo: "Données d'exemple" },

  catalogue: {
    title: "Design system",
    intro: "Tous les composants de MaDa, en mode clair et sombre.",
    sections: { colors: "Couleurs", type: "Typographie", buttons: "Boutons", rushes: "Cartes de rush", frise: "Frise", music: "Musique", wave: "Forme d'onde", generation: "Génération", paywall: "Paywall", saved: "Pastille" },
    themeDark: "Sombre",
    themeLight: "Clair",
    replay: "Rejouer",
    sample: { body: "Le Reel à ton image, en 2 minutes.", caption: "Monté avec MaDa", mono: "0:12" },
  },
} as const;
