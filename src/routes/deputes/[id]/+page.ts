import type { PageLoad } from './$types';
import { loadPersonne, loadGroupes, loadHistorique, loadScrutinsIndex, loadLegislatures } from '$lib/data';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const personne = await loadPersonne(fetch, params.id);
	if (!personne) throw new Error(`Personne ${params.id} introuvable`);

	const legislatures = await loadLegislatures(fetch);
	const groupesByLeg = await Promise.all(legislatures.map((l) => loadGroupes(fetch, l.num)));
	const historique = await loadHistorique(fetch, params.id).catch(() => []);
	const scrutinsIndex = await loadScrutinsIndex(fetch);

	const groupes = groupesByLeg.flat();
	return { personne, groupes, historique, scrutinsIndex, legislatures };
};
