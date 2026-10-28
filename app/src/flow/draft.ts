import AsyncStorage from "@react-native-async-storage/async-storage";
import { packDraft, readDraft, type Draft } from "../../../core/draft";
import type { TimelineV1 } from "../../../core/timeline";
import type { Brief, MontageResult, Music, Rush } from "./types";

// The Reel in progress, as Flow holds it. Vision measurements are left out (they are redone from the
// rushes in a few seconds); everything the person chose or changed is kept.
export type FlowDraft = {
  rushes: Omit<Rush, "triage">[]; selected: string[]; demo: boolean; brief: Brief; music: Music;
  result: { r: MontageResult; s: number } | null; editing: number; keptVersion: number | null;
  // The editor's current state, saved at every change even before « Enregistrer ».
  editorTimeline: TimelineV1 | null;
};

const KEY = "mada.brouillon.v1";
let timer: ReturnType<typeof setTimeout> | null = null;

export async function loadDraft(): Promise<Draft<FlowDraft> | null> {
  try { return readDraft<FlowDraft>(await AsyncStorage.getItem(KEY)); } catch { return null; }
}

// Saved a moment after the last change, so a burst of gestures writes once.
export function saveDraft(step: string, data: Omit<FlowDraft, "rushes"> & { rushes: Rush[] }, delay: number) {
  const raw = packDraft(step, { ...data, rushes: data.rushes.map(({ triage, ...r }) => r) });
  if (!raw) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { AsyncStorage.setItem(KEY, raw).catch(() => {}); }, delay);
}

export function clearDraft() {
  if (timer) clearTimeout(timer);
  AsyncStorage.removeItem(KEY).catch(() => {});
}
