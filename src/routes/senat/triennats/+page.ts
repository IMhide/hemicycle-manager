import type { PageLoad } from './$types';
import { loadTriennats, loadMetaSenat } from '$lib/data';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch }) => {
	const [triennats, meta] = await Promise.all([loadTriennats(fetch), loadMetaSenat(fetch)]);
	return { triennats, meta };
};
