import type { PageLoad } from './$types';
import { loadPersonnes, loadGroupes, loadLegislatures } from '$lib/data';

export const load: PageLoad = async ({ fetch }) => {
	const legislatures = await loadLegislatures(fetch);
	const groupesByLeg = await Promise.all(legislatures.map((l) => loadGroupes(fetch, l.num)));
	const personnes = await loadPersonnes(fetch);
	const groupes = groupesByLeg.flat();
	return { personnes, groupes, legislatures };
};
