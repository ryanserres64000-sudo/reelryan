import { fetch } from "expo/fetch";
import { readLine } from "./stream";
import type { MontageResult } from "./types";

export async function streamMontage(url: string, body: unknown, onStep: (s: number) => void, signal: AbortSignal, access?: string): Promise<MontageResult> {
  const res = await fetch(`${url}/api/montage`, {
    method: "POST", signal, body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...(access ? { "x-rr-access": access } : {}) },
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.message || `HTTP ${res.status}`), { code: err.error || "network" });
  }
  const reader = res.body.getReader(), decoder = new TextDecoder();
  let buffer = "", result: MontageResult | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = done ? "" : lines.pop() ?? "";
    for (const l of lines) result = readLine(l, onStep) ?? result;
    if (done) break;
  }
  if (!result) throw Object.assign(new Error("Réponse incomplète."), { code: "network" });
  return result;
}
