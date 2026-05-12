import type { PageLoad } from './$types';
import { loadTextesUnifies, loadLegislatures, loadTriennats } from '$lib/data';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch }) => {
	const [textes, legislatures, triennats] = await Promise.all([
		loadTextesUnifies(fetch),
		loadLegislatures(fetch),
		loadTriennats(fetch)
	]);
	return { textes, legislatures, triennats };
};
