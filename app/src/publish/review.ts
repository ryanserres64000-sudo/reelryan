import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import { START_REVIEW, markAsked, recordExport, reviewDue, type ReviewState } from "../../../core/publish";

// The App Store review prompt, after the third export that worked, never after an error (étude,
// « Publier et revenir »). iOS decides whether it really shows.
const KEY = "mada.avis.v1";
const load = async (): Promise<ReviewState> => { try { return { ...START_REVIEW, ...JSON.parse((await AsyncStorage.getItem(KEY)) ?? "{}") }; } catch { return START_REVIEW; } };
const save = (s: ReviewState) => AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});

export async function afterExport(ok: boolean): Promise<void> {
  let s = recordExport(await load(), ok);
  if (ok && reviewDue(s)) {
    try { if (await StoreReview.isAvailableAsync()) { await StoreReview.requestReview(); s = markAsked(s); } } catch { /* no prompt, no harm */ }
  }
  await save(s);
}
