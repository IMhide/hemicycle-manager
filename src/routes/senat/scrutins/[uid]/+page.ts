import type { PageLoad } from './$types';
import {
	loadScrutinSenatDetail,
	loadGroupesSenat,
	loadScrutinsSenatIndex,
	loadSenateurs
} from '$lib/data';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const detail = await loadScrutinSenatDetail(fetch, params.uid);
	const [index, groupes, senateurs] = await Promise.all([
		loadScrutinsSenatIndex(fetch),
		loadGroupesSenat(fetch, detail.sesann),
		loadSenateurs(fetch)
	]);
	return { detail, groupes, index, senateurs };
};
