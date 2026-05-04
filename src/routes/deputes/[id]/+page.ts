import type { PageLoad } from './$types';
import {
	loadDeputes,
	loadGroupes,
	loadDeputeStats,
	loadDeputeHistorique,
	loadScrutinsIndex
} from '$lib/data';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const [deputes, groupes, stats, historique, scrutinsIndex] = await Promise.all([
		loadDeputes(fetch),
		loadGroupes(fetch),
		loadDeputeStats(fetch),
		loadDeputeHistorique(fetch, params.id),
		loadScrutinsIndex(fetch)
	]);

	const depute = deputes.find((d) => d.id === params.id);
	if (!depute) {
		throw new Error(`Député ${params.id} introuvable`);
	}
	const stat = stats.find((s) => s.id === params.id);
	if (!stat) {
		throw new Error(`Stats du député ${params.id} introuvables`);
	}
	const groupe = depute.groupeId ? groupes.find((g) => g.id === depute.groupeId) ?? null : null;

	return { depute, groupe, stat, historique, scrutinsIndex, groupes };
};
