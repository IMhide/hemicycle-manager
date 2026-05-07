import type { PageLoad } from './$types';
import {
	loadPersonnes,
	loadGroupes,
	loadScrutinDetail,
	loadScrutinsIndex,
	loadLegislatures
} from '$lib/data';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const detail = await loadScrutinDetail(fetch, params.uid);
	const legislatures = await loadLegislatures(fetch);
	const groupesByLeg = await Promise.all(legislatures.map((l) => loadGroupes(fetch, l.num)));
	const [personnes, index] = await Promise.all([loadPersonnes(fetch), loadScrutinsIndex(fetch)]);
	const groupes = groupesByLeg.flat();
	return { personnes, groupes, detail, index, legislatures };
};
