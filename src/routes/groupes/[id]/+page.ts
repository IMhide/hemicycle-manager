import type { PageLoad } from './$types';
import { loadDeputes, loadGroupes, loadDeputeStats, loadGroupeStats } from '$lib/data';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const [deputes, groupes, deputeStats, groupeStats] = await Promise.all([
		loadDeputes(fetch),
		loadGroupes(fetch),
		loadDeputeStats(fetch),
		loadGroupeStats(fetch)
	]);
	const groupe = groupes.find((g) => g.id === params.id);
	if (!groupe) throw new Error(`Groupe ${params.id} introuvable`);
	const stats = groupeStats.find((s) => s.id === params.id);
	if (!stats) throw new Error(`Stats du groupe ${params.id} introuvables`);
	return { groupe, groupes, deputes, deputeStats, stats };
};
