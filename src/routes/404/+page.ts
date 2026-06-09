import type { PageLoad } from './$types';

// Page 404 prérendue (cf ADR 0041). Sert de cible à `error_page 404` dans
// nginx → un vrai 404 stylé (et non le soft-404 = home renvoyée en 200).
// Produit build/404/index.html sous trailingSlash:'always'.
export const prerender = true;
export const ssr = true;

export const load: PageLoad = () => {
	return { description: "Cette page n'existe pas ou plus sur PolitiDex." };
};
