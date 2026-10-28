import type { Answers, Dna, Kit, Profil } from "../../../core/brand";

// What sign-up keeps on the iPhone: the answers, the brand kit and the carnet written from them.
export type Brand = { profil: Profil; answers: Answers; kit: Kit; logoUri: string | null; dna: Dna | null; byAi: boolean; at: string };
export const emptyKit = (): Kit => ({ couleurs: [], polices: { titres: "", texte: "" }, logo: false });
