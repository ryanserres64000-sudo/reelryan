// Edit recipes (plan « éditeur pro et montages », 30 octobre, from Ryan's own edits: the Hyde teaser,
// the Royal Monceau vlog, the narrated palace Reels). A recipe is a way of editing, not a fixed
// template: it sets the rhythm, the place and look of the texts, the sound and the ending. The AI picks
// one and fills it with the person's rushes and words; the looks come from code, in the brand's
// colours and fonts when they fit, so two people on the same recipe get two different videos.
import { FONT_FAMILIES, type TextFont, type TextLook, type TextPlace } from "./textlook.ts";

// The poster capitals of a teaser (« 800 PERSONNES »): the condensed display fonts, not every bold one.
const AFFICHE: readonly TextFont[] = ["Anton", "Bebas Neue", "Archivo Black", "Dela Gothic One"];

export const RECETTES = ["teaser", "vlog", "recit"] as const;
export type RecetteId = (typeof RECETTES)[number];
type Style = "accroche" | "titre" | "info" | "signature";
type Brand = { polices: { titre: string; texte: string } };

export type Recette = {
  id: RecetteId; nom: string; pour: string;
  // The most texts the « naturel » check keeps for a length (core/natural.ts).
  maxTextes: (duree: number) => number;
  consignes: string;
};

export const RECIPES: Record<RecetteId, Recette> = {
  teaser: {
    id: "teaser", nom: "Teaser d'événement", pour: "soirées, concerts, lancements, portes ouvertes",
    maxTextes: d => Math.max(3, Math.ceil(d / 1.8)),
    consignes: `« teaser » (Teaser d'événement : vendre des places, vite) : 10 à 20 s. Plans de 1 à 1,5 s, les plus vivants (foule, lumières, gestes, verres), coupés sur le temps. Une phrase choc par plan, 1 à 4 mots, qui commence avec son plan : un compte à rebours si la date est proche (« J-6 »), un chiffre qui fait envie (« 800 PERSONNES »), le prix avec l'ancien s'il y a une réduction, puis l'appel (« IL NE MANQUE PLUS QUE TOI »). Ces phrases sont en style « accroche » ou « titre ». Finis par 3 à 4 s sur un plan calme : l'appel à l'action en « signature » (« JE PRENDS MA PLACE ») et, en « info », la date, l'heure et le lieu seulement s'ils sont écrits dans le brief. Son des rushes coupé (garder_son false) sauf demande : le son tendance s'ajoute sur Instagram.`,
  },
  vlog: {
    id: "vlog", nom: "Vlog élégant", pour: "hôtels, restaurants, lieux, coulisses",
    maxTextes: d => Math.max(3, Math.ceil(d / 4)),
    consignes: `« vlog » (Vlog élégant : raconter un lieu, donner envie) : 30 à 60 s. Ouvre sur un plan large du lieu avec un titre court en style « titre » (le nom du lieu ou du sujet). Plans de lieux et de détails de 1 à 2 s. Quand quelqu'un parle face caméra, garde son plan entier (4 à 5 s, garder_son true) sans couper sa phrase et, si le brief donne son prénom et son rôle, un texte « info » « Prénom — rôle » pendant qu'il parle ; jamais de nom inventé. Les lieux en « info », en petit (« Le Bar Long »). Coupes ou fondus doux, aucun effet. Finis sur un plan calme avec une phrase sobre en « signature ».`,
  },
  recit: {
    id: "recit", nom: "Récit sous-titré", pour: "expériences, avis, conseils racontés",
    maxTextes: d => Math.max(3, Math.ceil(d / 2.5)),
    consignes: `« recit » (Récit sous-titré : raconter une expérience) : 20 à 45 s. La voix (voix off ou personne qui parle, garder_son true) porte le récit. Une accroche au début en « accroche », puis des phrases courtes en style « info », une par plan de 2 à 3 s, qui racontent dans l'ordre : l'arrivée, la découverte, le moment fort, la conclusion. Elles s'écrivent mot à mot en bas de l'image. Légende longue, façon récit, 3 à 5 phrases.`,
  },
};

// What the director is told (lib/montage.js, lib/retouche.js).
export const RECETTES_PROMPT = `RECETTES DE MONTAGE : pour chaque variante, choisis la recette qui colle à la demande et aux rushes, et écris-la dans « recette ». Date, prix, billets, soirée, lancement → « teaser ». Un lieu à faire découvrir, des gens qui parlent face caméra → « vlog ». Une voix off, un avis, une expérience racontée → « recit ». Si aucune ne colle (conseil, produit, avant-après…), « aucune » : tu montes comme d'habitude. Les variantes peuvent prendre deux recettes différentes quand la demande hésite.
${RECETTES.map(r => `- ${RECIPES[r].consignes}`).join("\n")}
MOT EN COULEUR (« mot ») : pour un texte de recette, le mot qui claque (un chiffre, un lieu, un prix, « vues »), écrit exactement comme dans le texte, sinon vide ; jamais deux mots en couleur dans un même texte. Avec « aucune », laisse « mot » vide.
N'invente jamais une date, une heure, un prix, un lieu, un nom ou un chiffre absent du brief : écris la phrase sans.`;

const LOWER_THIRD: TextPlace = { x: 0.38, y: 0.78, w: 0.6, s: 1, r: 0 };
const CAPTION: TextPlace = { x: 0.5, y: 0.72, w: 0.86, s: 1.1, r: 0 };
// The brand's title font when it has the recipe's character, else the recipe's own.
const titleFont = (brand: Brand, family: readonly TextFont[], own: TextFont): TextFont =>
  (family as readonly string[]).includes(brand.polices.titre) ? (brand.polices.titre as TextFont) : own;

// A text's look and place in a recipe. `mot` is kept when the AI or the person chose one.
export function recipeLook(id: RecetteId, style: Style, brand: Brand, mot?: string): { look: TextLook; place?: TextPlace } {
  const word = mot ? { mot } : {};
  const big = style === "accroche" || style === "titre";
  if (id === "teaser") {
    const police = titleFont(brand, AFFICHE, "Anton");
    if (style === "signature") return { look: { role: "titre", couleur: null, fond: "arrondi", align: "centre", anim: "zoom", police, majuscules: true, ...word } };
    if (style === "info") return { look: { role: "texte", couleur: null, fond: "ombre", align: "centre", anim: "fondu", majuscules: true, ...word } };
    return { look: { role: "titre", couleur: null, fond: "ombre", align: "centre", anim: "zoom", police, majuscules: true, ...word } };
  }
  if (id === "vlog") {
    const police = titleFont(brand, FONT_FAMILIES.elegante, "Playfair Display");
    if (style === "info") return { look: { role: "texte", couleur: null, fond: "ombre", align: "gauche", anim: "glisse", ...word }, place: LOWER_THIRD };
    return { look: { role: "titre", couleur: null, fond: "ombre", align: "centre", anim: "fondu", police, majuscules: true, espace: big ? 0.15 : 0.1, ...word } };
  }
  if (style === "info") return { look: { role: "texte", couleur: null, fond: "ombre", align: "centre", anim: "mots", ...word }, place: CAPTION };
  return { look: { role: big ? "titre" : "texte", couleur: null, fond: "ombre", align: "centre", anim: "fondu", ...word } };
}

// The accent word only when it is really in the text (the AI may misspell or invent it).
export function wordIn(texte: string, mot: unknown): string | undefined {
  if (typeof mot !== "string") return undefined;
  const m = mot.replace(/\s+/g, " ").trim().slice(0, 40);
  return m && texte.toLocaleLowerCase("fr-FR").includes(m.toLocaleLowerCase("fr-FR")) ? m : undefined;
}

// « Textes qui tombent sur le temps » (teaser): a text starting near a cut starts on it. The cuts are
// already on the beat (sanitizePlans), so the words land with the music.
export function onCuts<T extends { debut: number; fin: number }>(textes: T[], cuts: number[], tolerance = 0.6): T[] {
  return textes.map(x => {
    let best: number | null = null;
    for (const c of cuts) if (Math.abs(c - x.debut) <= tolerance && (best === null || Math.abs(c - x.debut) < Math.abs(best - x.debut))) best = c;
    if (best === null || best === x.debut) return x;
    const len = x.fin - x.debut;
    return { ...x, debut: Math.round(best * 100) / 100, fin: Math.round((best + len) * 100) / 100 };
  });
}
