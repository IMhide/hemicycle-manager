import type { PageLoad } from './$types';

// La home expose sa description SEO via data.description (émise par le +layout,
// cf ADR 0043) — évite un doublon avec le <meta> du layout.
export const load: PageLoad = () => {
	return {
		description:
			'PolitiDex regroupe les fiches Football Manager des députés et sénateurs français — votes, scrutins, hémicycles, classements. Open data, open source.'
	};
};
