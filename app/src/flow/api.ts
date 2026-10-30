import { fetch } from "expo/fetch";
import { LIMITS, Timeout } from "../../../core/progress";
import { noteError } from "../diag";
import { serverHeaders } from "./server";
import { readLine } from "./stream";
import type { MontageResult } from "./types";

// The server writes a line at least every 10 s (lib/montage.js); after `LIMITS.silenceMs` without any,
// the connection is taken as lost and the edit stops with a clear message instead of waiting forever.
// With a `job` id, a lost connection (the app left, iOS cut it) is not the end: the server finishes the
// edit and the app fetches it (`waitForJob`), without paying for a new one.
export async function streamMontage(url: string, body: unknown, onStep: (s: number) => void, signal: AbortSignal, job?: string): Promise<MontageResult> {
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
      // The server answered: an HTTP error is not a missing connection (build 12 said « Pas de connexion »).
      throw Object.assign(new Error(err.message || `HTTP ${res.status}`), { code: err.error || "server_error" });
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
    if (signal.aborted) throw e;
    // The connection dropped (or went silent) after the server took the edit: it goes on over there.
    const coded = typeof (e as { code?: unknown })?.code === "string" && (e as { code: string }).code !== "network";
    if (job && (silent || !coded)) {
      noteError("montage", `connexion perdue, je récupère le travail : ${e instanceof Error ? e.message : String(e)}`);
      return waitForJob(url, job, onStep, signal);
    }
    if (silent) throw new Timeout();
    throw e;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
  }
}

export type JobState = { etat: "en_cours" } | { etat: "pret"; resultat: MontageResult } | { etat: "erreur"; error: string; message?: string } | { etat: "introuvable" };

// Where the server is with an edit sent earlier, or null when it cannot be reached right now.
export async function jobState(url: string, job: string, signal?: AbortSignal): Promise<JobState | null> {
  try {
    const res = await fetch(`${url}/api/montage?travail=${encodeURIComponent(job)}`, { headers: serverHeaders.get(), signal });
    if (!res.ok) return null;
    return (await res.json()) as JobState;
  } catch (e) {
    if (signal?.aborted) throw e;
    return null;
  }
}

// Asks every few seconds until the edit is ready, failed or unknown to the server. The steps on screen
// jump to « relecture » meanwhile: the server does not tell them to a phone that came back.
export async function waitForJob(url: string, job: string, onStep: (s: number) => void, signal: AbortSignal): Promise<MontageResult> {
  const until = Date.now() + LIMITS.totalMs;
  let misses = 0;
  onStep(3);
  while (Date.now() < until) {
    if (signal.aborted) throw Object.assign(new Error("aborted"), { code: "aborted" });
    const s = await jobState(url, job, signal);
    if (s?.etat === "pret") return s.resultat;
    if (s?.etat === "erreur") throw Object.assign(new Error(s.message || s.error), { code: s.error });
    if (s?.etat === "introuvable") throw Object.assign(new Error("Le serveur n'a pas gardé ce montage."), { code: "network" });
    // No answer at all: the network may still be waking up after the app came back.
    if (!s && ++misses > 10) throw Object.assign(new Error("Le serveur ne répond plus."), { code: "network" });
    if (s) misses = 0;
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  throw new Timeout();
}
const POLL_MS = 4000;
