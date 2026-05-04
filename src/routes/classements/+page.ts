import type { PageLoad } from './$types';
import { loadDeputes, loadGroupes, loadDeputeStats } from '$lib/data';

export const load: PageLoad = async ({ fetch }) => {
	const [deputes, groupes, stats] = await Promise.all([
		loadDeputes(fetch),
		loadGroupes(fetch),
		loadDeputeStats(fetch)
	]);
	return { deputes, groupes, stats };
};
