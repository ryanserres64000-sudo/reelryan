import { fetch } from "expo/fetch";
import { LIMITS, Timeout } from "../../../core/progress";
import { serverHeaders } from "./server";
import { readLine } from "./stream";
import type { MontageResult } from "./types";

// The server writes a line at least every 10 s (lib/montage.js); after `LIMITS.silenceMs` without any,
// the connection is taken as lost and the edit stops with a clear message instead of waiting forever.
export async function streamMontage(url: string, body: unknown, onStep: (s: number) => void, signal: AbortSignal, access?: string): Promise<MontageResult> {
  const ctrl = new AbortController();
  let silent = false, timer: ReturnType<typeof setTimeout> | undefined;
  const watch = () => { clearTimeout(timer); timer = setTimeout(() => { silent = true; ctrl.abort(); }, LIMITS.silenceMs); };
  const stop = () => ctrl.abort();
  signal.addEventListener("abort", stop);
  watch();
  try {
    const res = await fetch(`${url}/api/montage`, {
      method: "POST", signal: ctrl.signal, body: JSON.stringify(body),
      headers: serverHeaders.get(),
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      throw Object.assign(new Error(err.message || `HTTP ${res.status}`), { code: err.error || "network" });
    }
    const reader = res.body.getReader(), decoder = new TextDecoder();
    let buffer = "", result: MontageResult | null = null;
    for (;;) {
      const { value, done } = await reader.read();
      watch();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = done ? "" : lines.pop() ?? "";
      for (const l of lines) result = readLine(l, onStep) ?? result;
      if (done) break;
    }
    if (!result) throw Object.assign(new Error("Réponse incomplète."), { code: "network" });
    return result;
  } catch (e) {
    if (silent && !signal.aborted) throw new Timeout();
    throw e;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
  }
}
