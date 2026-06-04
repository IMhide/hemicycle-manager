import type { PageLoad } from './$types';
import { loadTriennats, loadGroupesSenat } from '$lib/data';
import type { TriennatId } from '$lib/triennats';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch }) => {
	const triennats = await loadTriennats(fetch);
	const groupesByTriennat = await Promise.all(
		triennats.map((t) => loadGroupesSenat(fetch, t.id as TriennatId))
	);
	return { triennats, groupesByTriennat };
};
