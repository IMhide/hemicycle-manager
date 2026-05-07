import type { PageLoad } from './$types';
import {
	loadPersonnes,
	loadGroupes,
	loadScrutinsIndex,
	loadMeta,
	loadLegislatures
} from '$lib/data';

export const load: PageLoad = async ({ fetch }) => {
	const legislatures = await loadLegislatures(fetch);
	const legCourante = [...legislatures].sort((a, b) => b.num - a.num)[0]?.num ?? 17;

	const [personnes, groupes, scrutins, meta] = await Promise.all([
		loadPersonnes(fetch),
		loadGroupes(fetch, legCourante),
		loadScrutinsIndex(fetch),
		loadMeta(fetch)
	]);
	return { personnes, groupes, scrutins, meta, legislatures, legCourante };
};
