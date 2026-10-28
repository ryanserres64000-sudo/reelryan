import { requireOptionalNativeModule } from "expo";
import { SERVER } from "../flow/server";

// What this build really has, shown in Réglages so a test on the iPhone tells what is missing
// (Ryan's first test, 28 octobre 2026: the edit fell back to samples without saying why).
const errors: string[] = [];
export const noteError = (where: string, message: string) => { errors.unshift(`${where} : ${message}`); errors.length = Math.min(errors.length, 5); };

export type DiagKey = "vision" | "video" | "store" | "audio" | "server" | "access";
export function diagnostic(): { key: DiagKey; ok: boolean }[] {
  const has = (m: string) => !!requireOptionalNativeModule(m);
  return [
    { key: "vision", ok: has("MadaVision") }, { key: "video", ok: has("MadaVideo") },
    { key: "store", ok: has("MadaStore") }, { key: "audio", ok: has("MadaAudio") },
    { key: "server", ok: !!SERVER.url }, { key: "access", ok: !!SERVER.access },
  ];
}
export const lastErrors = () => [...errors];
