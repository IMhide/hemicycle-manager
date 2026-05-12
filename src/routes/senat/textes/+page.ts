import type { PageLoad } from './$types';
import { loadTextesSenat, loadTriennats } from '$lib/data';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch }) => {
	const [textes, triennats] = await Promise.all([loadTextesSenat(fetch), loadTriennats(fetch)]);
	return { textes, triennats };
};
