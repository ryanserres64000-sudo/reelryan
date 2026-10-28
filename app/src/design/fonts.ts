import { DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import { InstrumentSans_400Regular } from "@expo-google-fonts/instrument-sans/400Regular";
import { InstrumentSans_600SemiBold } from "@expo-google-fonts/instrument-sans/600SemiBold";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif/400Regular";
import { InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif/400Regular_Italic";
import { useFonts } from "expo-font";

// The OFL fonts of « Atelier clair » (Ryan, 28 octobre 2026): Instrument Serif for titles,
// Instrument Sans for everything else, DM Mono for durations.
export function useMadaFonts() {
  return useFonts({ InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic, InstrumentSans_400Regular, InstrumentSans_600SemiBold, DMMono_500Medium });
}
