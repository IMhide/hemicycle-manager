import type { PageLoad } from './$types';
import { loadPersonnes, loadGroupes, loadLegislatures } from '$lib/data';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const legislature = parseInt(params.legislature, 10);
	if (!Number.isFinite(legislature)) throw new Error(`Législature invalide : ${params.legislature}`);

	const legislatures = await loadLegislatures(fetch);
	if (!legislatures.some((l) => l.num === legislature)) {
		throw new Error(`Législature ${legislature} non couverte`);
	}

	const [personnes, groupes] = await Promise.all([
		loadPersonnes(fetch),
		loadGroupes(fetch, legislature)
	]);

	const groupe = groupes.find((g) => g.id === params.id);
	if (!groupe) throw new Error(`Groupe ${params.id} introuvable en ${legislature}ᵉ`);

	return { groupe, groupes, personnes, legislatures, legislature };
};
