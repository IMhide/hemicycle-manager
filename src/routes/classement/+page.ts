import type { PageLoad } from './$types';
import { loadElusManifest } from '$lib/elus';

// SPA mode : tri sur 1856 élus côté client. Pas de prerender (le manifest
// peut bouger à chaque build, on évite de figer le HTML).
export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch }) => {
	const manifest = await loadElusManifest(fetch);
	return { manifest };
};
