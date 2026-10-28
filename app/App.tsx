import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Intro, ThemeProvider, useMadaFonts, useTheme } from "./src/design";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Flow } from "./src/flow/Flow";

SplashScreen.preventAutoHideAsync().catch(() => {});
// Light by default (« Atelier clair »). Web preview only: ?dark opens the dark mode, for screenshots.
const WEB_DARK = typeof location !== "undefined" && location.search.includes("dark");

export default function App() {
  const [loaded, error] = useMadaFonts();
  useEffect(() => { if (loaded || error) SplashScreen.hideAsync().catch(() => {}); }, [loaded, error]);
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider initial={WEB_DARK ? "dark" : "light"}>
        <Root />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { scheme } = useTheme();
  // The logo animation plays over the first screen, once per launch.
  const [intro, setIntro] = useState(true);
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Flow />
      {intro ? <Intro onDone={() => setIntro(false)} /> : null}
    </>
  );
}
