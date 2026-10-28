import type { Answers, Dna, Kit, Profil } from "../../../core/brand";
import type { Memory } from "../../../core/corrections";

// What sign-up keeps on the iPhone: the answers, the brand kit, the carnet written from them, and the
// rules learnt from corrections (lot 5).
export type Brand = { profil: Profil; answers: Answers; kit: Kit; logoUri: string | null; dna: Dna | null; byAi: boolean; at: string; memory?: Memory };
export const emptyKit = (): Kit => ({ couleurs: [], polices: { titres: "", texte: "" }, logo: false });
