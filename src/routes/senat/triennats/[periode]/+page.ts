import type { PageLoad } from './$types';
import {
	loadSenateurs,
	loadGroupesSenat,
	loadScrutinsSenatIndex,
	loadTriennats,
	loadMetaSenat
} from '$lib/data';
import { isTriennatId, type TriennatId } from '$lib/triennats';

// SPA mode : le rendu se fait côté client à partir des JSON statiques.
// Évite d'avoir à connaître la liste des triennats au moment du prerender CI
// (où les data sont mockées vides).
export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const periode = params.periode;
	if (!isTriennatId(periode)) throw new Error(`Triennat invalide : ${periode}`);
	const triennatCourant: TriennatId = periode;

	const triennats = await loadTriennats(fetch);
	if (!triennats.some((t) => t.id === triennatCourant)) {
		throw new Error(`Triennat ${triennatCourant} non couvert`);
	}

	const [senateurs, groupes, scrutins, meta] = await Promise.all([
		loadSenateurs(fetch),
		loadGroupesSenat(fetch, triennatCourant),
		loadScrutinsSenatIndex(fetch),
		loadMetaSenat(fetch)
	]);

	return { senateurs, groupes, scrutins, meta, triennats, triennatCourant };
};
