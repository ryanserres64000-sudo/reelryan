// Timeline JSON: what the AI returns and what the renderer draws.
// The phone app will read the same format, so keep it small and explicit.

export const TRANSITIONS = ["coupe", "fondu", "glisse", "zoom"];
export const TEXT_POSITIONS = ["haut", "centre", "bas"];
export const TEXT_STYLES = ["accroche", "titre", "info", "signature"];
export const CROPS = ["centre", "gauche", "droite"];

// JSON schema for structured outputs (no numeric bounds: sanitizeTimeline enforces them).
export const TIMELINE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["titre", "intention", "plans", "textes"],
  properties: {
    titre: { type: "string", description: "Nom court du montage" },
    intention: { type: "string", description: "En une phrase : l'idée du montage et pourquoi il colle au brief" },
    plans: {
      type: "array",
      description: "Les plans dans l'ordre de lecture",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source", "debut", "fin", "cadrage", "transition", "garder_son", "raison"],
        properties: {
          source: { type: "string", description: "Identifiant du rush, par exemple clip02" },
          debut: { type: "number", description: "Début dans le rush, en secondes" },
          fin: { type: "number", description: "Fin dans le rush, en secondes" },
          cadrage: { type: "string", enum: CROPS, description: "Partie de l'image gardée en 9:16" },
          transition: { type: "string", enum: TRANSITIONS, description: "Transition depuis le plan précédent (ignorée pour le premier)" },
          garder_son: { type: "boolean", description: "Garder le son d'origine (voix, ambiance)" },
          raison: { type: "string", description: "Pourquoi ce plan, en quelques mots" }
        }
      }
    },
    textes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["texte", "debut", "fin", "position", "style"],
        properties: {
          texte: { type: "string", description: "Texte affiché, 6 mots maximum" },
          debut: { type: "number", description: "Début dans le montage final, en secondes" },
          fin: { type: "number", description: "Fin dans le montage final, en secondes" },
          position: { type: "string", enum: TEXT_POSITIONS },
          style: { type: "string", enum: TEXT_STYLES }
        }
      }
    }
  }
};

export const TRANSITION_SECONDS = 0.3;
const MIN_SHOT = 0.5;
const round = n => Math.round(n * 100) / 100;

// Final duration of the edit once transitions overlap consecutive shots.
export function timelineDuration(plans) {
  return plans.reduce((t, p, i) => t + (p.fin - p.debut) - (i && p.transition !== "coupe" ? TRANSITION_SECONDS : 0), 0);
}

// Validates and repairs an AI timeline against the real rushes.
// `clips` maps id -> { duration }. `beat` (seconds) snaps shot lengths to the tempo.
export function sanitizeTimeline(raw, clips, { beat = 0, maxDuration = 60 } = {}) {
  const warnings = [];
  if (!raw || !Array.isArray(raw.plans)) throw new Error("Timeline invalide : pas de plans.");
  const plans = [];
  let total = 0;
  for (const p of raw.plans) {
    const clip = clips[p?.source];
    if (!clip) { warnings.push(`Plan ignoré : rush inconnu « ${p?.source} ».`); continue; }
    let debut = Math.max(0, Math.min(Number(p.debut) || 0, clip.duration - MIN_SHOT));
    let fin = Math.min(clip.duration, Number(p.fin) || 0);
    const transition = plans.length && TRANSITIONS.includes(p.transition) ? p.transition : "coupe";
    const overlap = plans.length && transition !== "coupe" ? TRANSITION_SECONDS : 0;
    if (beat > 0) {
      // Whole beats, plus the overlap a transition eats, so every cut lands on the beat.
      let beats = Math.max(1, Math.round((fin - debut) / beat));
      while (beats > 1 && beats * beat + overlap > clip.duration) beats--;
      const length = Math.min(clip.duration, beats * beat + overlap);
      if (debut + length > clip.duration) debut = clip.duration - length;
      fin = debut + length;
    }
    if (fin - debut < MIN_SHOT) { warnings.push(`Plan ignoré : trop court (${p.source} ${debut}-${fin}).`); continue; }
    if (total + (fin - debut) - overlap > maxDuration) { warnings.push("Montage coupé : durée maximale atteinte."); break; }
    total += (fin - debut) - overlap;
    plans.push({
      source: p.source, debut: round(debut), fin: round(fin),
      cadrage: CROPS.includes(p.cadrage) ? p.cadrage : "centre",
      transition, garder_son: !!p.garder_son, raison: String(p.raison || "")
    });
  }
  if (!plans.length) throw new Error("Timeline invalide : aucun plan utilisable.");
  const duration = timelineDuration(plans);
  const textes = (Array.isArray(raw.textes) ? raw.textes : [])
    .map(t => ({
      texte: String(t?.texte || "").trim().slice(0, 80),
      debut: round(Math.max(0, Number(t?.debut) || 0)),
      fin: round(Math.min(duration, Number(t?.fin) || 0)),
      position: TEXT_POSITIONS.includes(t?.position) ? t.position : "centre",
      style: TEXT_STYLES.includes(t?.style) ? t.style : "titre"
    }))
    .filter(t => t.texte && t.fin - t.debut >= 0.4);
  return {
    timeline: { titre: String(raw.titre || "Montage"), intention: String(raw.intention || ""), format: { w: 1080, h: 1920, fps: 30 }, plans, textes },
    duration: round(duration),
    warnings
  };
}
