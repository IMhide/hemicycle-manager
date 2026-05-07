import type { PageLoad } from './$types';
import {
	loadPersonnes,
	loadGroupes,
	loadScrutinsIndex,
	loadMeta,
	loadLegislatures
} from '$lib/data';

// SPA mode : le rendu se fait côté client à partir des JSON statiques.
// Évite d'avoir à connaître la liste des legs au moment du prerender CI
// (où les data sont mockées vides).
export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const num = parseInt(params.num, 10);
	if (!Number.isFinite(num)) throw new Error(`Législature invalide : ${params.num}`);

	const legislatures = await loadLegislatures(fetch);
	if (!legislatures.some((l) => l.num === num)) {
		throw new Error(`Législature ${num} non couverte`);
	}

	const [personnes, groupes, scrutins, meta] = await Promise.all([
		loadPersonnes(fetch),
		loadGroupes(fetch, num),
		loadScrutinsIndex(fetch),
		loadMeta(fetch)
	]);
	return { personnes, groupes, scrutins, meta, legislatures, legCourante: num };
};
