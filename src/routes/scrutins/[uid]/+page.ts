import type { PageLoad } from './$types';
import {
	loadDeputes,
	loadGroupes,
	loadScrutinDetail,
	loadScrutinsIndex
} from '$lib/data';

// SPA mode: do not prerender 6287 pages, render client-side instead.
export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const [deputes, groupes, detail, index] = await Promise.all([
		loadDeputes(fetch),
		loadGroupes(fetch),
		loadScrutinDetail(fetch, params.uid),
		loadScrutinsIndex(fetch)
	]);
	return { deputes, groupes, detail, index };
};
