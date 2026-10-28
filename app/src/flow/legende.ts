import { fetch } from "expo/fetch";
import type { TimelineV1 } from "../../../core/timeline";
import { SERVER, aiUrl, serverHeaders } from "./server";

// The post's caption written by the AI from the edit (POST /api/legende, lib/legende.js). Null when the
// AI is off or out of reach: the screen then leaves the field empty, never the brief copied in.
export async function aiCaption(t: TimelineV1, brief: string, style: object, previous?: string, signal?: AbortSignal): Promise<TimelineV1["legende"] | null> {
  if (!aiUrl()) return null;
  const res = await fetch(`${SERVER.url}/api/legende`, {
    method: "POST", signal, headers: serverHeaders.get(),
    body: JSON.stringify({ brief, style, precedente: previous, plateformes: ["reels", "tiktok", "shorts"], timeline: { titre: t.titre, intention: t.intention, duree: t.duree, plans: t.plans.map(p => ({ raison: p.raison })), textes: t.textes.map(x => ({ texte: x.texte, accent: x.accent })) } }),
  });
  if (!res.ok) return null;
  const out = await res.json();
  return out?.legende?.texte ? out.legende : null;
}
