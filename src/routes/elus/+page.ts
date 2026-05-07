import type { PageLoad } from './$types';
import { loadElusManifest } from '$lib/elus';

// SPA mode : la liste cross-chambre lit `elus.json` côté client (1.1 MB
// raisonnable, mais on évite de prerender le JSON dans le HTML pour 1856 élus).
export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch }) => {
	const manifest = await loadElusManifest(fetch);
	return { manifest };
};
