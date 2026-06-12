import type { PageLoad } from './$types';

// La FAQ expose sa description SEO via data.description (émise par le +layout,
// cf ADR 0043) — évite un doublon avec le <meta> du layout.
export const load: PageLoad = () => {
	return {
		description:
			'Comment ça marche ? Toutes les décisions et métriques de PolitiDex (Overall, présence, loyauté, frondes…) expliquées en clair.'
	};
};
