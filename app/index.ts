import { createElement, type ComponentType } from "react";
import { registerRootComponent } from "expo";
// First, so that an error while loading the rest shows on screen instead of closing the app.
import { CrashScreen } from "./src/crash";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App).
let App: ComponentType;
try {
  App = require("./App").default;
} catch (e) {
  const error = e instanceof Error ? e : new Error(String(e));
  App = () => createElement(CrashScreen, { error, onRetry: () => {} });
}
registerRootComponent(App);
