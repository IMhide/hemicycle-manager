import type { PageLoad } from './$types';
import {
	loadScrutinSenatDetail,
	loadGroupesSenat,
	loadScrutinsSenatIndex,
	loadSenateurs,
	loadTexteSenat,
	loadTexteSlugResolver
} from '$lib/data';
import { SITE_URL } from '$lib/sitemap';
import { triennatOfDate } from '$lib/triennats';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const detail = await loadScrutinSenatDetail(fetch, params.uid);
	// Triennat = celui qui contient la date du scrutin (cf ADR 0028)
	const triennat = triennatOfDate(detail.date);
	if (!triennat) throw new Error(`Triennat non trouvé pour le scrutin ${params.uid}`);
	const [index, groupes, senateurs, texte, resolveSlug] = await Promise.all([
		loadScrutinsSenatIndex(fetch),
		loadGroupesSenat(fetch, triennat.id),
		loadSenateurs(fetch),
		// Charge le TexteSenat parent si rattaché (N3.b navette)
		detail.texteId ? loadTexteSenat(fetch, detail.texteId) : Promise.resolve(null),
		loadTexteSlugResolver(fetch)
	]);
	// Slug de la fiche unifiée (cf ADR 0042) : AN prioritaire si bicaméral.
	const texteSlug = texte
		? resolveSlug(texte.versionAutreChambre?.texteAnId ?? texte.id)
		: null;
	// Canonical vers la fiche texte parente (cf ADR 0043) — lu par le +layout.
	const canonicalOverride = texteSlug ? `${SITE_URL}/textes/${texteSlug}/` : undefined;
	return { detail, groupes, index, senateurs, texte, texteSlug, canonicalOverride };
};
