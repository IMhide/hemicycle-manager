import type { PageLoad } from './$types';
import {
	loadPersonnes,
	loadGroupes,
	loadScrutinsRecent,
	loadMeta,
	loadLegislatures
} from '$lib/data';

// Allègement (cf ADR 0041) : la home AN n'affiche que ~8 scrutins récents et un
// compteur de textes. On charge donc `scrutins-recent.json` (~30 Ko) au lieu de
// `scrutins-index.json` (6,1 Mo), et on dérive le compteur de textes depuis
// `meta.counts.textes` au lieu de tirer `textes.json` (1,4 Mo) juste pour `.length`.
// `personnes.json` reste chargé tel quel (le survol lit mandat.stats/rangs ; une
// projection lite est gardée en réserve — Option A, cf plan SEO).
export const load: PageLoad = async ({ fetch }) => {
	const legislatures = await loadLegislatures(fetch);
	const legCourante = [...legislatures].sort((a, b) => b.num - a.num)[0]?.num ?? 17;

	const [personnes, groupes, scrutins, meta] = await Promise.all([
		loadPersonnes(fetch),
		loadGroupes(fetch, legCourante),
		loadScrutinsRecent(fetch),
		loadMeta(fetch)
	]);
	return {
		personnes,
		groupes,
		scrutins,
		meta,
		legislatures,
		legCourante,
		nbTextes: meta.counts.textes,
		description:
			"L'hémicycle interactif de l'Assemblée nationale : survolez chaque siège pour voir la fiche du député, son groupe, sa présence et ses votes. 15ᵉ, 16ᵉ et 17ᵉ législatures."
	};
};
