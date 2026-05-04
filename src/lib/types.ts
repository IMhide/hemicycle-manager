// Types partagés entre le pipeline data et le front-end.
// Doivent rester en phase avec scripts/fetch-data.ts.

export interface Depute {
	id: string;
	prenom: string;
	nom: string;
	civ: string;
	groupeId: string | null;
	circo: { dep: string; depNum: string; num: string; region: string } | null;
	place: number | null;
	dateNaissance: string | null;
	profession: string | null;
	photoUrl: string;
	datePriseFonction: string | null;
	premiereElection: boolean;
}

export interface Groupe {
	id: string;
	libelle: string;
	libelleAbrege: string;
	couleur: string;
	effectif: number;
	preseance: number;
	presidentId: string | null;
}

export type VotePosition = 'pour' | 'contre' | 'abstention' | 'nonVotant' | 'absent';

export interface ScrutinIndex {
	uid: string;
	numero: number;
	date: string;
	titre: string;
	sort: string;
	pour: number;
	contre: number;
	abstention: number;
	demandeur: string | null;
}

export interface ScrutinDetail extends ScrutinIndex {
	objet: string;
	typeVote: string;
	votes: Record<string, VotePosition>;
	groupes: Array<{
		id: string;
		effectif: number;
		positionMajoritaire: string;
		decompte: { pour: number; contre: number; abstention: number; nonVotant: number };
	}>;
	frondeurs: string[];
}

export interface DeputeStats {
	id: string;
	scrutinsEligibles: number;
	pour: number;
	contre: number;
	abstention: number;
	nonVotant: number;
	absent: number;
	frondes: number;
	tauxPresence: number;
	tauxParticipation: number;
	tauxLoyaute: number | null;
	activite: number;
	rangs: {
		presence: number;
		participation: number;
		loyaute: number | null;
		frondes: number;
		activite: number;
	};
}

export interface GroupeStats {
	id: string;
	cohesion: number | null;
	scrutinsConsideres: number;
	tauxPresenceMoyen: number;
	frondesTotales: number;
	topLoyalistes: Array<{ id: string; tauxLoyaute: number }>;
	topFrondeurs: Array<{ id: string; frondes: number }>;
	rangs: {
		cohesion: number | null;
		presence: number;
		frondes: number;
	};
}

/** Compact: [scrutinUid, position, isFronde 0|1] */
export type VoteHistoryItem = [string, VotePosition, 0 | 1];

export interface BuildMeta {
	generatedAt: string;
	legislature: number;
	counts: { deputes: number; groupes: number; scrutins: number; historiques?: number };
	sources: Record<string, string>;
}
