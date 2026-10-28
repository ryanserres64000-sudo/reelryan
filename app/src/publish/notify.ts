import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import { nextSunday, weeklySummary } from "../../../core/publish";
import { fr } from "../copy/fr";

// Notifications (étape 7): the Sunday summary, one a week at most, and « ta vidéo est prête » when an
// export ends while the app is in the background. Both local: nothing goes through a server. Off until
// the person turns them on in Réglages; the permission is asked at that moment, never at launch.
export type NotifySettings = { weekly: boolean; exportDone: boolean };
const KEY = "mada.notifications.v1", WEEKLY_ID = "mada-bilan";
const OFF: NotifySettings = { weekly: false, exportDone: false };
const supported = Platform.OS === "ios";

if (supported) Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

export async function loadNotify(): Promise<NotifySettings> {
  try { return { ...OFF, ...JSON.parse((await AsyncStorage.getItem(KEY)) ?? "{}") }; } catch { return OFF; }
}
export async function saveNotify(s: NotifySettings): Promise<NotifySettings> {
  // Turning one on asks the permission; refused, both stay off.
  if ((s.weekly || s.exportDone) && supported) {
    const p = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: false, allowBadge: false } }).catch(() => ({ granted: false }));
    if (!p.granted) s = OFF;
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
  if (!s.weekly && supported) await Notifications.cancelScheduledNotificationAsync(WEEKLY_ID).catch(() => {});
  return s;
}
export const canNotify = () => supported;

// Rescheduled each time the app opens or a Reel is saved, so the count is the week's.
export async function scheduleWeekly(made: { at: string }[], idea: string | null): Promise<void> {
  if (!supported || !(await loadNotify()).weekly) return;
  const when = nextSunday(), { title, body } = weeklySummary(made, { now: when, idea });
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({ identifier: WEEKLY_ID, content: { title, body }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when } }).catch(() => {});
}

export async function exportDone(): Promise<void> {
  if (!supported || AppState.currentState === "active" || !(await loadNotify()).exportDone) return;
  await Notifications.scheduleNotificationAsync({ content: { title: fr.publish.doneTitle, body: fr.publish.doneBody }, trigger: null }).catch(() => {});
}
