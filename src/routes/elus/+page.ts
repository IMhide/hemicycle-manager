import type { PageLoad } from './$types';
import { loadElusManifest } from '$lib/elus';

// Prerendu (cf ADR 0041) : la liste cross-chambre rend son HTML statique. Le
// manifest `elus.json` est déjà chargé UNE FOIS par +layout.ts (cache module
// partagé) — pas de réinline de 1.1 Mo par page. Tri/filtre client après
// hydratation.
export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
	const manifest = await loadElusManifest(fetch);
	return {
		manifest,
		description:
			"Cherchez parmi tous les députés et sénateurs de l'ère Macron. Chaque fiche réunit votes, présence, loyauté et parcours cross-chambre Assemblée nationale / Sénat."
	};
};
