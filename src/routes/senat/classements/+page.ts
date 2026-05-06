import type { PageLoad } from './$types';
import { loadSenateurs, loadGroupesSenat, loadTriennats } from '$lib/data';

export const load: PageLoad = async ({ fetch }) => {
	const triennats = await loadTriennats(fetch);
	const groupesByTriennat = await Promise.all(triennats.map((t) => loadGroupesSenat(fetch, t.id)));
	const senateurs = await loadSenateurs(fetch);
	const groupes = groupesByTriennat.flat();
	return { senateurs, groupes, triennats };
};
