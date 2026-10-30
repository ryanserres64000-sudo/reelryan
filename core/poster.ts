// The poster read by AI (plan « éditeur pro et montages », étape 5 ; Ryan, 30 octobre : « un promoteur
// de soirée, à partir d'une affiche, quelques rushes et des idées »). The small model reads what is
// written on the poster; the person checks every field before it is used; the edit then takes the
// poster's colours, the countdown and an end card made of these facts, never invented ones.
// Shared by the app (fields, brief) and the server (POST /api/affiche, lib/affiche.js).

export type Affiche = {
  evenement: string; date: string; date_iso: string; heures: string; lieu: string; adresse: string;
  prix: string; prix_barre: string; billetterie: string; partenaires: string[]; accroche: string; couleurs: string[];
};
// The fields the person can correct, in the order they are shown.
export const AFFICHE_CHAMPS = ["evenement", "date", "heures", "lieu", "adresse", "prix", "prix_barre", "billetterie", "accroche"] as const;
export type AfficheChamp = (typeof AFFICHE_CHAMPS)[number];

// The poster's width sent to the AI: enough to read the small print, about 150 KB.
export const POSTER_PX = 1024;

export const EMPTY_AFFICHE: Affiche = { evenement: "", date: "", date_iso: "", heures: "", lieu: "", adresse: "", prix: "", prix_barre: "", billetterie: "", partenaires: [], accroche: "", couleurs: [] };

const field = (description: string) => ({ type: "string", description });
export const AFFICHE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["evenement", "date", "date_iso", "heures", "lieu", "adresse", "prix", "prix_barre", "billetterie", "partenaires", "accroche", "couleurs"],
  properties: {
    evenement: field("Nom de l'événement, tel qu'écrit"),
    date: field("La date telle qu'écrite (« VENDREDI 23.10 »), ou vide"),
    date_iso: field("La même date au format AAAA-MM-JJ si le jour et le mois sont lisibles (année : celle donnée dans la consigne si elle n'est pas écrite), sinon vide"),
    heures: field("Les horaires tels qu'écrits (« 23H–05H »), ou vide"),
    lieu: field("Le nom du lieu (« Club Haussmann »), ou vide"),
    adresse: field("L'adresse si elle est écrite, ou vide"),
    prix: field("Le prix à payer tel qu'écrit (« 13,50 € »), ou vide"),
    prix_barre: field("L'ancien prix ou le prix normal s'il y a une réduction (« 15 € »), ou vide"),
    billetterie: field("Où acheter les places (« Shotgun », un lien), ou vide"),
    partenaires: { type: "array", items: { type: "string" }, description: "Les noms des partenaires ou co-organisateurs écrits ou en logo, 4 au plus" },
    accroche: field("Le slogan ou la phrase forte de l'affiche (« Hyde your face »), ou vide"),
    couleurs: { type: "array", items: { type: "string" }, description: "Les 1 à 3 couleurs dominantes de l'affiche, en #RRGGBB, de la plus marquante à la moins marquante" },
  },
};

export const AFFICHE_SYSTEM = `Tu lis une affiche d'événement (soirée, concert, lancement, portes ouvertes) pour en tirer les informations pratiques.
Recopie exactement ce qui est écrit, avec les mêmes chiffres et la même orthographe. Si une information n'est pas lisible ou n'est pas sur l'affiche, laisse le champ vide : n'invente jamais une date, une heure, un prix, un lieu ou un partenaire, même plausible. La personne vérifiera chaque champ.`;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const HEX = /^#[0-9A-F]{6}$/;

export function sanitizeAffiche(raw: unknown): Affiche {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const iso = text(r.date_iso, 10);
  return {
    evenement: text(r.evenement, 80), date: text(r.date, 40), heures: text(r.heures, 40), lieu: text(r.lieu, 80), adresse: text(r.adresse, 120),
    date_iso: /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso)) ? iso : "",
    prix: text(r.prix, 30), prix_barre: text(r.prix_barre, 30), billetterie: text(r.billetterie, 80), accroche: text(r.accroche, 80),
    partenaires: (Array.isArray(r.partenaires) ? r.partenaires : []).map(p => text(p, 40)).filter(Boolean).slice(0, 4),
    couleurs: [...new Set((Array.isArray(r.couleurs) ? r.couleurs : []).map(c => text(c, 7).toUpperCase()).filter(c => HEX.test(c)))].slice(0, 3),
  };
}

// « J-6 » when the event is 1 to 14 days away, « CE SOIR » on the day; nothing otherwise. `today` is
// the phone's date, so the countdown is right where the person is.
export function countdown(dateIso: string, today: Date): string | null {
  if (!dateIso) return null;
  const [y, m, d] = dateIso.split("-").map(Number);
  const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000);
  return days === 0 ? "CE SOIR" : days >= 1 && days <= 14 ? `J-${days}` : null;
}

// What the poster adds to the brief, once checked. The end card's lines go between « » so the edit
// writes them word for word and warns when one is missing (core/timeline.ts imposedTexts).
export function afficheBrief(a: Affiche, today: Date): string {
  const quand = [a.date, a.heures].filter(Boolean).join(" · ");
  const prix = a.prix && a.prix_barre ? `${a.prix} au lieu de ${a.prix_barre}` : a.prix;
  const j = countdown(a.date_iso, today);
  const lines = [
    "INFOS DE L'AFFICHE, vérifiées par la personne : utilise-les telles quelles et n'en invente aucune autre. Recette teaser sauf demande contraire (les mots entre guillemets ci-dessous s’affichent tels quels).",
    a.evenement && `Événement : ${a.evenement}`,
    quand && `Quand : ${quand}`,
    a.lieu && `Lieu : ${[a.lieu, a.adresse].filter(Boolean).join(", ")}`,
    prix && `Prix : ${prix}`,
    a.accroche && `Phrase de l'affiche : ${a.accroche}`,
    a.partenaires.length && `Partenaires : ${a.partenaires.join(", ")}`,
    j && `Compte à rebours : ouvre sur « ${j} ».`,
    (a.evenement || quand || a.lieu) && `Carte de fin, dans les 3 à 4 dernières secondes : ${[a.evenement && `« ${a.evenement} » en titre`, quand && `« ${quand} »`, a.lieu && `« ${a.lieu} »`].filter(Boolean).join(", ")} en info${a.billetterie ? `, et sous l'appel à l'action « Billets sur ${a.billetterie} »` : ""}.`,
  ];
  return lines.filter(Boolean).join("\n");
}
