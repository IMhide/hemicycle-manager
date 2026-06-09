import type { PageLoad } from './$types';
import { loadTextesUnifiesLite } from '$lib/data';

// Prerendu (cf ADR 0041) : liste cross-chambre des textes en HTML statique.
// Charge la projection « lite » (sans scrutins inlinés ni timeline) pour ne pas
// gonfler le HTML prérendu. legislatures/triennats ne sont pas lus par la liste
// (texte de prose uniquement) → retirés du load().
export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
	const textes = await loadTextesUnifiesLite(fetch);
	return {
		textes,
		description:
			"Tous les textes de loi examinés par l'Assemblée nationale et le Sénat : résultat des votes, navette parlementaire et état (promulgué, rejeté, en cours) sur PolitiDex."
	};
};
