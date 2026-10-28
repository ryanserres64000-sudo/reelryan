import { AbrilFatface_400Regular } from "@expo-google-fonts/abril-fatface/400Regular";
import { Anton_400Regular } from "@expo-google-fonts/anton/400Regular";
import { ArchivoBlack_400Regular } from "@expo-google-fonts/archivo-black/400Regular";
import { BebasNeue_400Regular } from "@expo-google-fonts/bebas-neue/400Regular";
import { BodoniModa_400Regular } from "@expo-google-fonts/bodoni-moda/400Regular";
import { BodoniModa_700Bold } from "@expo-google-fonts/bodoni-moda/700Bold";
import { BricolageGrotesque_400Regular } from "@expo-google-fonts/bricolage-grotesque/400Regular";
import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque/700Bold";
import { Caveat_400Regular } from "@expo-google-fonts/caveat/400Regular";
import { Caveat_700Bold } from "@expo-google-fonts/caveat/700Bold";
import { CormorantGaramond_400Regular } from "@expo-google-fonts/cormorant-garamond/400Regular";
import { CormorantGaramond_700Bold } from "@expo-google-fonts/cormorant-garamond/700Bold";
import { DelaGothicOne_400Regular } from "@expo-google-fonts/dela-gothic-one/400Regular";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_700Bold } from "@expo-google-fonts/dm-sans/700Bold";
import { Fraunces_400Regular } from "@expo-google-fonts/fraunces/400Regular";
import { Fraunces_700Bold } from "@expo-google-fonts/fraunces/700Bold";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Montserrat_400Regular } from "@expo-google-fonts/montserrat/400Regular";
import { Montserrat_700Bold } from "@expo-google-fonts/montserrat/700Bold";
import { PinyonScript_400Regular } from "@expo-google-fonts/pinyon-script/400Regular";
import { PlayfairDisplay_400Regular } from "@expo-google-fonts/playfair-display/400Regular";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display/700Bold";
import { Poppins_400Regular } from "@expo-google-fonts/poppins/400Regular";
import { Poppins_700Bold } from "@expo-google-fonts/poppins/700Bold";
import { useFonts } from "expo-font";
import type { Font } from "../../../core/design";

// The 16 OFL fonts a visual or a title duo can use (core/timeline.ts POLICES, étude ch. 6 §3 ; core/typo.ts),
// in a regular and a bold face. Loaded only when the person opens the visuals.
const FILES = {
  AbrilFatface_400Regular, Anton_400Regular, ArchivoBlack_400Regular, BebasNeue_400Regular, BodoniModa_400Regular, BodoniModa_700Bold, DelaGothicOne_400Regular, PinyonScript_400Regular, BricolageGrotesque_400Regular, BricolageGrotesque_700Bold, Caveat_400Regular, Caveat_700Bold,
  CormorantGaramond_400Regular, CormorantGaramond_700Bold, DMSans_400Regular, DMSans_700Bold, Fraunces_400Regular, Fraunces_700Bold, Inter_400Regular, Inter_700Bold,
  Montserrat_400Regular, Montserrat_700Bold, PlayfairDisplay_400Regular, PlayfairDisplay_700Bold, Poppins_400Regular, Poppins_700Bold,
};
const FACES: Record<Font, [string, string]> = {
  Anton: ["Anton_400Regular", "Anton_400Regular"], "Archivo Black": ["ArchivoBlack_400Regular", "ArchivoBlack_400Regular"], "Bebas Neue": ["BebasNeue_400Regular", "BebasNeue_400Regular"],
  "Bricolage Grotesque": ["BricolageGrotesque_400Regular", "BricolageGrotesque_700Bold"], Caveat: ["Caveat_400Regular", "Caveat_700Bold"],
  "Cormorant Garamond": ["CormorantGaramond_400Regular", "CormorantGaramond_700Bold"], "DM Sans": ["DMSans_400Regular", "DMSans_700Bold"],
  Fraunces: ["Fraunces_400Regular", "Fraunces_700Bold"], Inter: ["Inter_400Regular", "Inter_700Bold"], Montserrat: ["Montserrat_400Regular", "Montserrat_700Bold"],
  "Playfair Display": ["PlayfairDisplay_400Regular", "PlayfairDisplay_700Bold"], Poppins: ["Poppins_400Regular", "Poppins_700Bold"],
  "Pinyon Script": ["PinyonScript_400Regular", "PinyonScript_400Regular"], "Bodoni Moda": ["BodoniModa_400Regular", "BodoniModa_700Bold"],
  "Abril Fatface": ["AbrilFatface_400Regular", "AbrilFatface_400Regular"], "Dela Gothic One": ["DelaGothicOne_400Regular", "DelaGothicOne_400Regular"],
};
export const face = (font: Font, weight: number) => (FACES[font] ?? FACES["DM Sans"])[weight >= 600 ? 1 : 0];
export const useVisualFonts = () => useFonts(FILES)[0];
// The font file itself, for the native video render (app/modules/mada-video registers it by URL).
export const fontModule = (font: Font, weight: number) => FILES[face(font, weight) as keyof typeof FILES];
