import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ThemeProvider, useMadaFonts, useTheme } from "./src/design";
import { DesignCatalogue } from "./src/screens/DesignCatalogue";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Lot 1: the app shows the design system catalogue. The real screens arrive with lot 2.
export default function App() {
  const [loaded, error] = useMadaFonts();
  useEffect(() => { if (loaded || error) SplashScreen.hideAsync().catch(() => {}); }, [loaded, error]);
  if (!loaded && !error) return null;
  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}

function Root() {
  const { scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <DesignCatalogue />
    </>
  );
}
