import { BricolageGrotesque_600SemiBold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import { DMSans_400Regular, DMSans_600SemiBold } from "@expo-google-fonts/dm-sans";
import { useFonts } from "expo-font";

// The OFL fonts of the design system (étude, ch. 6 §3); SF Pro comes with iOS.
export function useMadaFonts() {
  return useFonts({ BricolageGrotesque_600SemiBold, BricolageGrotesque_800ExtraBold, DMSans_400Regular, DMSans_600SemiBold, DMMono_500Medium });
}
