import type { PageLoad } from './$types';
import { loadTextes, loadLegislatures } from '$lib/data';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch }) => {
	const [textes, legislatures] = await Promise.all([
		loadTextes(fetch),
		loadLegislatures(fetch)
	]);
	return { textes, legislatures };
};
