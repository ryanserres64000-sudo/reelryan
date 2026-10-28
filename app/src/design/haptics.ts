import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// One small vocabulary of touch feedback (étude de la refonte, « Chaque geste a une réponse »):
// a light tap for a press, a tick when something snaps (selection, beat, magnet), success when a
// Reel is ready, a warning before something is removed. iPhone only; silent elsewhere.
export type HapticKind = "tap" | "tick" | "success" | "warning";

export function haptic(kind: HapticKind = "tap") {
  if (Platform.OS !== "ios") return;
  const run = kind === "tap" ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    : kind === "tick" ? Haptics.selectionAsync()
    : Haptics.notificationAsync(kind === "success" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
  run.catch(() => {});
}
