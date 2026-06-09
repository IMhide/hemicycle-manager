import type { PageLoad } from './$types';
import {
	loadSenateurs,
	loadGroupesSenat,
	loadScrutinsSenatRecent,
	loadTriennats,
	loadMetaSenat
} from '$lib/data';
import type { TriennatId } from '$lib/triennats';

// Allègement (cf ADR 0041) : la home Sénat n'affiche que ~8 scrutins récents du
// triennat courant. On charge `scrutins-recent.json` (~projection légère) au lieu
// de `scrutins-index.json` (~1 Mo). `senateurs.json` reste tel quel (le survol lit
// les stats du sénateur ; projection lite gardée en réserve — Option A, cf plan).
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
		loadScrutinsSenatRecent(fetch),
		loadMetaSenat(fetch)
	]);

	return { senateurs, groupes, scrutins, meta, triennats, triennatCourant };
};
