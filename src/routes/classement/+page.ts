import type { PageLoad } from './$types';
import { loadElusManifest } from '$lib/elus';

// Prerendu (cf ADR 0041) : le classement rend son HTML statique (cardinalité
// finie). Le manifest est partagé via +layout.ts ; le tri sur les 1856 élus
// reste client-side après hydratation. Le HTML figé reflète l'état du build —
// régénéré à chaque redeploy, ce qui est exactement la fraîcheur attendue.
export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
	const manifest = await loadElusManifest(fetch);
	return { manifest };
};
