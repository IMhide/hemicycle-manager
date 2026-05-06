import type { PageLoad } from './$types';
import {
	loadSenateurs,
	loadGroupesSenat,
	loadScrutinsSenatIndex,
	loadTriennats,
	loadMetaSenat
} from '$lib/data';
import type { TriennatId } from '$lib/triennats';

export const load: PageLoad = async ({ fetch }) => {
	const triennats = await loadTriennats(fetch);
	// Triennat courant : celui marqué enCours, sinon le plus récent
	const triennatCourant: TriennatId =
		(triennats.find((t) => t.enCours)?.id ??
			[...triennats].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))[0]?.id ??
			'2023-2026') as TriennatId;

	const [senateurs, groupes, scrutins, meta] = await Promise.all([
		loadSenateurs(fetch),
		loadGroupesSenat(fetch, triennatCourant),
		loadScrutinsSenatIndex(fetch),
		loadMetaSenat(fetch)
	]);

	return { senateurs, groupes, scrutins, meta, triennats, triennatCourant };
};
