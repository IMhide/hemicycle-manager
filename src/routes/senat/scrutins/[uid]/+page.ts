import type { PageLoad } from './$types';
import {
	loadScrutinSenatDetail,
	loadGroupesSenat,
	loadScrutinsSenatIndex
} from '$lib/data';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const detail = await loadScrutinSenatDetail(fetch, params.uid);
	const [index, groupes] = await Promise.all([
		loadScrutinsSenatIndex(fetch),
		loadGroupesSenat(fetch, detail.sesann)
	]);
	return { detail, groupes, index };
};
