// Typographic duos for Reel titles (Ryan, références du 28 octobre : titres @coachtijoux « petale /
// constance », « VOGUE / rivule », « DiDA / spire »). A heavy display word, and under it, overlapping a
// little, an accent word in a fine contrasting face. The duo belongs to the brand kit, like the colours:
// the phone picks it from the DNA and sends it in `charte.duo`; the AI only chooses which titles get an
// accent and writes it. Each duo uses 2 families in all, the other texts included (étude, ch. 6 §3,
// « 2 polices au plus »). Fonts are OFL (Google Fonts), bundled in the app.
import type { POLICES } from "./timeline.ts";

type Police = (typeof POLICES)[number];
export type Casse = "majuscules" | "minuscules" | "telle-quelle";
export type Face = { police: Police; poids: 400 | 700; casse: Casse };
export type Duo = {
  id: string; nom: string;
  titre: Face; accent: Face;
  // The other texts (infos, signature, subtitles): one of the two families, the legible one.
  texte: Face;
  // Accent size against the title, and how much of the accent line climbs over the title (0 to 0.5).
  echelle: number; chevauchement: number;
  ambiance: string;
};

const f = (police: Police, poids: 400 | 700 = 400, casse: Casse = "telle-quelle"): Face => ({ police, poids, casse });

export const DUOS = [
  { id: "couture", nom: "Couture", titre: f("Bodoni Moda", 700, "majuscules"), accent: f("Pinyon Script"), texte: f("Bodoni Moda"), echelle: 0.85, chevauchement: 0.35, ambiance: "mode, beauté, chic" },
  { id: "petale", nom: "Pétale", titre: f("Archivo Black", 400, "minuscules"), accent: f("Pinyon Script"), texte: f("Archivo Black"), echelle: 0.8, chevauchement: 0.3, ambiance: "beauté, bien-être, lifestyle" },
  { id: "ballet", nom: "Ballet", titre: f("Pinyon Script"), accent: f("Archivo Black", 400, "minuscules"), texte: f("Archivo Black"), echelle: 0.55, chevauchement: 0.25, ambiance: "danse, mariage, événement" },
  { id: "affiche", nom: "Affiche", titre: f("Abril Fatface"), accent: f("DM Sans", 400, "minuscules"), texte: f("DM Sans"), echelle: 0.6, chevauchement: 0.1, ambiance: "restaurant, café, épicerie" },
  { id: "club", nom: "Club", titre: f("Dela Gothic One", 400, "majuscules"), accent: f("Bebas Neue", 400, "minuscules"), texte: f("Bebas Neue"), echelle: 0.8, chevauchement: 0.15, ambiance: "sport, coach, énergie" },
  { id: "atelier", nom: "Atelier", titre: f("Fraunces", 700), accent: f("Caveat", 700), texte: f("Fraunces"), echelle: 0.8, chevauchement: 0.25, ambiance: "artisan, fait main, chaleureux" },
  { id: "edito", nom: "Édito", titre: f("Playfair Display", 700), accent: f("Montserrat", 400, "majuscules"), texte: f("Montserrat"), echelle: 0.4, chevauchement: 0, ambiance: "conseil, immobilier, expertise" },
  { id: "brut", nom: "Brut", titre: f("Anton", 400, "majuscules"), accent: f("Cormorant Garamond", 400), texte: f("Cormorant Garamond", 700), echelle: 0.75, chevauchement: 0.2, ambiance: "photo, architecture, tatouage" },
] as const satisfies readonly Duo[];

export type DuoId = (typeof DUOS)[number]["id"];
export const DUO_IDS = DUOS.map(d => d.id) as DuoId[];
export const duoById = (id: string | null | undefined): Duo | null => DUOS.find(d => d.id === id) ?? null;

// The duo that fits the brand, without AI: the house style first, then the tone.
const PAR_STYLE: Record<string, DuoId> = {
  comptoir: "affiche", atelier: "atelier", coach: "club", conseil: "edito", vitrine: "petale",
  "avant-apres": "brut", coulisses: "atelier", evenement: "ballet", chic: "couture", temoignage: "edito",
};
const PAR_TON: Record<string, DuoId> = { chaleureux: "atelier", expert: "edito", drole: "affiche", chic: "couture", energique: "club", direct: "brut" };
export function duoFor(dna: { style_maison?: string; ton?: string } | null): DuoId | null {
  if (!dna) return null;
  return PAR_STYLE[dna.style_maison ?? ""] ?? PAR_TON[(dna.ton ?? "").toLowerCase()] ?? null;
}

export const applyCasse = (s: string, c: Casse) => (c === "majuscules" ? s.toLocaleUpperCase("fr") : c === "minuscules" ? s.toLocaleLowerCase("fr") : s);

// What the director is told (lib/montage.js), only when the brand has a duo.
export const duoPrompt = (d: Duo) => `TITRE EN DUO (charte de la personne : « ${d.nom} ») : pour l'accroche, et au plus un autre titre, tu peux ajouter un « accent » : 1 à 2 mots qui complètent le texte et s'affichent dessous dans une police fine qui contraste (${d.accent.police}). Exemples : texte « 3 erreurs », accent « à éviter » ; texte « Le brunch », accent « du dimanche ». L'accent ne répète pas le texte. Laisse « accent » vide partout ailleurs, et sur un texte imposé par le brief si le découper le dénaturerait.`;

// Sound effects (Ryan, référence coachtijoux du 28 octobre) : the house rule, always given.
export const EFFETS_PROMPT = "BRUITAGES (« effets ») : seulement sur un vrai moment clé (révélation, avant/après, chute, prix annoncé), 4 au plus, 3 s d'écart au moins, jamais sur une coupe ordinaire. Un montage posé ou une voix qui parle n'en a souvent aucun. Le son tendance s'ajoute ensuite dans l'appli de la plateforme : les bruitages doivent rester discrets.";

// What lib/montage.js and lib/retouche.js add to the director's consignes for this brand kit.
export function typoSonPrompt(duo: string | null | undefined): string {
  const d = duoById(duo);
  return [EFFETS_PROMPT, d ? duoPrompt(d) : "Pas de titre en duo pour cette marque : laisse « accent » vide partout."].join("\n");
}
