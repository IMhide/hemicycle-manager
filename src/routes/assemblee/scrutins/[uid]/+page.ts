import type { PageLoad } from './$types';
import {
	loadPersonnes,
	loadGroupes,
	loadScrutinDetail,
	loadScrutinsIndex,
	loadLegislatures,
	loadTexte
} from '$lib/data';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const detail = await loadScrutinDetail(fetch, params.uid);
	const legislatures = await loadLegislatures(fetch);
	const groupesByLeg = await Promise.all(legislatures.map((l) => loadGroupes(fetch, l.num)));
	const [personnes, index] = await Promise.all([loadPersonnes(fetch), loadScrutinsIndex(fetch)]);
	const groupes = groupesByLeg.flat();
	// Charge le Texte parent si rattaché (cf ADR 0035)
	const texte = detail.texteId ? await loadTexte(fetch, detail.texteId) : null;
	return { personnes, groupes, detail, index, legislatures, texte };
};
