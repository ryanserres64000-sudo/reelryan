import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ThemeProvider, useMadaFonts, useTheme } from "./src/design";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Flow } from "./src/flow/Flow";

SplashScreen.preventAutoHideAsync().catch(() => {});
// Web preview only: ?light opens the light mode, for screenshots.
const WEB_LIGHT = typeof location !== "undefined" && location.search.includes("light");

export default function App() {
  const [loaded, error] = useMadaFonts();
  useEffect(() => { if (loaded || error) SplashScreen.hideAsync().catch(() => {}); }, [loaded, error]);
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider initial={WEB_LIGHT ? "light" : "dark"}>
        <Root />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Flow />
    </>
  );
}
