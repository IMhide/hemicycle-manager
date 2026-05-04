import type { PageLoad } from './$types';
import {
	loadDeputes,
	loadGroupes,
	loadScrutinsIndex,
	loadMeta,
	loadDeputeStats
} from '$lib/data';

export const load: PageLoad = async ({ fetch }) => {
	const [deputes, groupes, scrutins, meta, stats] = await Promise.all([
		loadDeputes(fetch),
		loadGroupes(fetch),
		loadScrutinsIndex(fetch),
		loadMeta(fetch),
		loadDeputeStats(fetch)
	]);
	return { deputes, groupes, scrutins, meta, stats };
};
