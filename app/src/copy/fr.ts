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
