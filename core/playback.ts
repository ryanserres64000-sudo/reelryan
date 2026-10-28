// Where we are in an edit (étape 3 de la refonte, lecteur plein écran): the shot under the play head,
// how far into it, the texts on screen, and the shot boundaries the bars at the top and the
// « précédent / suivant » taps jump to. Edit time, so speed and transitions are counted.
import { TRANSITION_SECONDS, type TimelineV1 } from "./timeline.ts";

export type Segment = { start: number; end: number };

export function segments(t: Pick<TimelineV1, "plans">): Segment[] {
  let at = 0;
  return t.plans.map((p, i) => {
    const start = Math.max(0, at - (i && p.transition !== "coupe" ? TRANSITION_SECONDS : 0));
    const end = start + (p.fin - p.debut) / (p.vitesse || 1);
    at = end;
    return { start, end };
  });
}

export function shotAt(segs: Segment[], time: number): { index: number; progress: number } {
  if (!segs.length) return { index: 0, progress: 0 };
  // The later shot wins inside a transition: it is the one coming on screen.
  let index = 0;
  for (let i = 0; i < segs.length; i++) if (time >= segs[i].start) index = i;
  const s = segs[index];
  return { index, progress: Math.min(1, Math.max(0, (time - s.start) / (s.end - s.start || 1))) };
}

// « Précédent » goes to the start of the shot, or to the one before when already at its start (as in
// the stories); « suivant » to the next shot, or to the end.
export function jump(segs: Segment[], time: number, dir: -1 | 1, grace = 0.6): number {
  if (!segs.length) return 0;
  const { index } = shotAt(segs, time);
  if (dir > 0) return index + 1 < segs.length ? segs[index + 1].start : segs[segs.length - 1].end;
  return time - segs[index].start > grace || index === 0 ? segs[index].start : segs[index - 1].start;
}

export const textsAt = (t: Pick<TimelineV1, "textes">, time: number) => t.textes.filter(x => time >= x.debut && time < x.fin);

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
