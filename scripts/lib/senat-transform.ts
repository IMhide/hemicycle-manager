/**
 * Transformations métier pures du pipeline Sénat (cf ADR 0023..0025).
 *
 * Fonctions pures (pas d'I/O) qui assemblent les structures finales à partir
 * des sources brutes. Toutes testées dans `senat-transform.test.ts`.
 */

export interface RawAppartenanceGroupe {
	groupeCode: string;
	dateDebut: string; // ISO
	dateFin: string | null; // null = en cours
}

/**
 * Retourne les `sesann` (années de début de session, ex. 2024 pour 2024-2025)
 * couvertes par un mandat dont l'intervalle est [`debut`, `fin`].
 *
 * Convention parlementaire : une session annuelle commence le 1er octobre N
 * et se termine le 30 septembre N+1. Un mandat couvre la session N si son
 * intervalle [debut, fin] intersecte [N-10-01, (N+1)-09-30].
 *
 * Si `fin` est null (mandat en cours), on étend jusqu'à `today` (par défaut
 * la date d'aujourd'hui réelle, sinon la valeur passée).
 */
export function sessionsCovering(
	debut: string,
	fin: string | null,
	today: string = new Date().toISOString().slice(0, 10)
): number[] {
	const debutDate = parseDate(debut);
	const finDate = parseDate(fin ?? today);

	const out: number[] = [];
	// La session N (sesann=N) court du 1er oct N au 30 sept N+1.
	// On itère sur N de l'année du début à l'année de fin.
	const startYear = sesannForDate(debutDate);
	const endYear = sesannForDate(finDate);
	for (let y = startYear; y <= endYear; y++) {
		out.push(y);
	}
	return out;
}

/** Renvoie le `sesann` (année de début) de la session contenant `d`.
 *  Si d est en oct/nov/déc → sesann = year(d). Sinon (jan-sept) → sesann = year(d)-1. */
function sesannForDate(d: Date): number {
	const y = d.getUTCFullYear();
	const m = d.getUTCMonth(); // 0 = janvier
	return m >= 9 ? y : y - 1; // mois 9 = octobre
}

function parseDate(iso: string): Date {
	// Force UTC pour éviter les surprises DST
	const s = iso.slice(0, 10);
	const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
	return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Retourne le code du groupe d'appartenance du sénateur à la date `iso` (ADR 0016
 * transposée). Renvoie null si :
 *   - aucune appartenance ne couvre la date
 *   - l'appartenance courante est NI ou AUCUN (ces sénateurs n'ont pas de
 *     groupe pour le calcul de loyauté)
 */
export function groupeAuVote(
	apps: RawAppartenanceGroupe[],
	iso: string
): string | null {
	for (const a of apps) {
		if (a.dateDebut > iso) continue;
		if (a.dateFin && a.dateFin < iso) continue;
		// Trouvée. Si NI ou AUCUN, on retourne null (pas de groupe pour loyauté).
		if (a.groupeCode === 'NI' || a.groupeCode === 'AUCUN') return null;
		return a.groupeCode;
	}
	return null;
}
