/**
 * Triennats sénatoriaux — unité de regroupement principale Sénat (cf ADR 0028 + 0029).
 *
 * Un triennat est la période entre deux renouvellements sénatoriaux consécutifs
 * (séries 1 et 2 alternant tous les 3 ans). Il joue côté Sénat le rôle de la
 * législature côté AN. La session annuelle reste brique data sous-jacente
 * (`SessionStats`) mais n'est plus exposée comme unité de regroupement.
 *
 * Liste figée des 3 triennats couverts depuis le 2017-09-24 (scope ère Macron,
 * ADR 0029) — parité avec les 3 législatures AN (15ᵉ, 16ᵉ, 17ᵉ).
 * Le triennat 2023-2026 est en cours.
 */

export type TriennatId = string; // format `${YYYY}-${YYYY}` (ex. "2023-2026")

export interface Triennat {
	id: TriennatId;
	anneeDebut: number;
	anneeFin: number;
	dateDebut: string; // ISO 8601, début du triennat (renouvellement initial)
	dateFin: string; // ISO 8601, fin du triennat (renouvellement de fin)
	serieRenouveleeDebut: 1 | 2;
	serieRenouveleeFin: 1 | 2;
	enCours: boolean;
}

/**
 * Table figée des 3 triennats couverts (scope ère Macron, ADR 0029).
 * Bornes calées sur la date du renouvellement (généralement dernier dimanche
 * de septembre). Voir ADR 0028 + 0029 et `Code électoral L.290 et s.`.
 *
 * NB: les dates exactes de renouvellement varient légèrement (24-28 sept).
 * On retient le 28 septembre comme borne stable (post-renouvellement).
 */
export const TRIENNATS: readonly Triennat[] = [
	{
		id: '2017-2020',
		anneeDebut: 2017,
		anneeFin: 2020,
		dateDebut: '2017-09-24',
		dateFin: '2020-09-27',
		serieRenouveleeDebut: 2,
		serieRenouveleeFin: 1,
		enCours: false
	},
	{
		id: '2020-2023',
		anneeDebut: 2020,
		anneeFin: 2023,
		dateDebut: '2020-09-27',
		dateFin: '2023-09-24',
		serieRenouveleeDebut: 1,
		serieRenouveleeFin: 2,
		enCours: false
	},
	{
		id: '2023-2026',
		anneeDebut: 2023,
		anneeFin: 2026,
		dateDebut: '2023-09-24',
		dateFin: '2026-09-27', // prévu (dernier dim. sept. 2026)
		serieRenouveleeDebut: 2,
		serieRenouveleeFin: 1,
		enCours: true
	}
];

const BY_ID = new Map(TRIENNATS.map((t) => [t.id, t]));

/** Récupère un triennat par son id (string `YYYY-YYYY`). */
export function getTriennat(id: TriennatId): Triennat | null {
	return BY_ID.get(id) ?? null;
}

/** Vrai si la chaîne matche le format d'un id de triennat. */
export function isTriennatId(value: string): value is TriennatId {
	return /^\d{4}-\d{4}$/.test(value) && BY_ID.has(value);
}

/**
 * Trouve le triennat contenant une date ISO 8601.
 * Comparaison `[dateDebut, dateFin)` — la date de renouvellement appartient au
 * triennat suivant (ex. 2023-09-24 → "2023-2026", 2023-09-23 → "2020-2023").
 *
 * Retourne null si la date est avant le premier triennat (avant 2017-09-24)
 * ou après le dernier (après 2026-09-27).
 */
export function triennatOfDate(dateIso: string): Triennat | null {
	for (const t of TRIENNATS) {
		if (dateIso >= t.dateDebut && dateIso < t.dateFin) return t;
	}
	return null;
}

/**
 * Trouve le triennat parent d'une session annuelle (`sesann` = année de début, ex. 2024).
 * Une session sept N → sept N+1 commence en octobre N (heuristique pipeline) ;
 * elle est rattachée au triennat dont la fenêtre contient ce 1er octobre N.
 *
 * NB: les renouvellements ayant lieu en septembre (entre deux sessions),
 * une session est toujours strictement contenue dans un seul triennat.
 */
export function triennatOfSesann(sesann: number): Triennat | null {
	const debutSession = `${sesann}-10-01`;
	return triennatOfDate(debutSession);
}

/**
 * Liste les sessions (`sesann`) qui appartiennent à un triennat.
 * Renvoie un tableau ordonné chronologiquement (3 sessions par triennat).
 */
export function sessionsOfTriennat(id: TriennatId): number[] {
	const t = getTriennat(id);
	if (!t) return [];
	const sessions: number[] = [];
	for (let s = t.anneeDebut; s < t.anneeFin; s++) {
		// vérification de cohérence : la session démarre dans le triennat
		if (triennatOfSesann(s)?.id === id) sessions.push(s);
	}
	return sessions;
}

/**
 * Renvoie la liste des triennats traversés par une période (mandat sénatorial).
 * Un mandat complet (6 ans) traverse 2 triennats ; un mandat fragmenté ou partiel
 * peut en traverser 1 à 3 (cf ADR 0028 § "Rattachement").
 */
export function triennatsOfPeriode(
	dateDebutIso: string,
	dateFinIso: string | null
): Triennat[] {
	const fin = dateFinIso ?? '9999-12-31';
	return TRIENNATS.filter((t) => t.dateDebut < fin && dateDebutIso < t.dateFin);
}

/** Triennat actuellement en cours (ou null si on est entre deux). */
export function triennatEnCours(): Triennat | null {
	return TRIENNATS.find((t) => t.enCours) ?? null;
}

/** Libellé court humain (ex. "2023-2026"). */
export function libelleTriennat(id: TriennatId): string {
	return id;
}

/** Libellé long humain (ex. "Triennat 2023-2026"). */
export function libelleTriennatLong(id: TriennatId): string {
	return `Triennat ${id}`;
}
