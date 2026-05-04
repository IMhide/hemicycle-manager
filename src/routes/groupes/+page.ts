import type { PageLoad } from './$types';
import { loadGroupes, loadGroupeStats } from '$lib/data';

export const load: PageLoad = async ({ fetch }) => {
	const [groupes, stats] = await Promise.all([loadGroupes(fetch), loadGroupeStats(fetch)]);
	return { groupes, stats };
};
