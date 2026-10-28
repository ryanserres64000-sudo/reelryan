import { fetch } from "expo/fetch";
import { keepLocked, type EditDoc } from "../../../core/edit";
import type { Clips } from "../../../core/timeline";
import { SERVER, aiUrl, serverHeaders } from "./server";

// What the rules on the phone could not do goes to POST /api/retouche (lib/retouche.js), with the
// locked shots and texts flagged; they are put back exactly on return. Null when there is no server.
export async function aiRetouche(d: EditDoc, demande: string, clips: Clips, style: object, brief: string, signal?: AbortSignal): Promise<{ doc: EditDoc; corrections: string[] } | null> {
  if (!aiUrl()) return null;
  const res = await fetch(`${SERVER.url}/api/retouche`, {
    method: "POST", signal,
    headers: serverHeaders.get(),
    body: JSON.stringify({
      demande, brief, style, timeline: d.timeline,
      rushes: Object.entries(clips).map(([id, c]) => ({ id, duree: c.duration })),
      verrous: { plans: d.planIds.flatMap((id, i) => (d.locked.includes(id) ? [i] : [])), textes: d.texteIds.flatMap((id, i) => (d.locked.includes(id) ? [i] : [])) },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const out = await res.json();
  return { doc: keepLocked(d, out.timeline), corrections: out.timeline?.relecture?.corrections ?? [] };
}
