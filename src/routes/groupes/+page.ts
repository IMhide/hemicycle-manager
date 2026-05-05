import type { PageLoad } from './$types';
import { loadGroupes, loadLegislatures } from '$lib/data';

export const load: PageLoad = async ({ fetch }) => {
	const legislatures = await loadLegislatures(fetch);
	const groupesByLeg = await Promise.all(legislatures.map((l) => loadGroupes(fetch, l.num)));
	return { legislatures, groupesByLeg };
};
