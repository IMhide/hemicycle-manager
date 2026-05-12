export type VoteSearchPosition =
	| 'pour'
	| 'contre'
	| 'abstention'
	| 'nonVotant'
	| 'absent';

export type VoteEntry = {
	id: string;
	prenom: string;
	nom: string;
	groupeLibelle: string;
	groupeCouleur: string | null;
	position: VoteSearchPosition;
	href: string | null;
};
