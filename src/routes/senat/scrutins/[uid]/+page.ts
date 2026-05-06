import type { PageLoad } from './$types';
import {
	loadScrutinSenatDetail,
	loadGroupesSenat,
	loadScrutinsSenatIndex,
	loadSenateurs
} from '$lib/data';
import { triennatOfDate } from '$lib/triennats';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const detail = await loadScrutinSenatDetail(fetch, params.uid);
	// Triennat = celui qui contient la date du scrutin (cf ADR 0028)
	const triennat = triennatOfDate(detail.date);
	if (!triennat) throw new Error(`Triennat non trouvé pour le scrutin ${params.uid}`);
	const [index, groupes, senateurs] = await Promise.all([
		loadScrutinsSenatIndex(fetch),
		loadGroupesSenat(fetch, triennat.id),
		loadSenateurs(fetch)
	]);
	return { detail, groupes, index, senateurs };
};
