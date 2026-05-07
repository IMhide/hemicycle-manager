import type { PageLoad } from './$types';
import { loadScrutinsIndex, loadGroupes, loadLegislatures } from '$lib/data';

export const load: PageLoad = async ({ fetch }) => {
	const legislatures = await loadLegislatures(fetch);
	const groupesByLeg = await Promise.all(legislatures.map((l) => loadGroupes(fetch, l.num)));
	const scrutins = await loadScrutinsIndex(fetch);
	const groupes = groupesByLeg.flat();
	return { scrutins, groupes, legislatures };
};
