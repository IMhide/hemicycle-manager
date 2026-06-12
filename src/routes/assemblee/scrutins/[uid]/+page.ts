import type { PageLoad } from './$types';
import {
	loadPersonnes,
	loadGroupes,
	loadScrutinDetail,
	loadScrutinsIndex,
	loadLegislatures,
	loadTexte,
	loadTexteSlugResolver
} from '$lib/data';
import { SITE_URL } from '$lib/sitemap';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const detail = await loadScrutinDetail(fetch, params.uid);
	const legislatures = await loadLegislatures(fetch);
	const groupesByLeg = await Promise.all(legislatures.map((l) => loadGroupes(fetch, l.num)));
	const [personnes, index] = await Promise.all([loadPersonnes(fetch), loadScrutinsIndex(fetch)]);
	const groupes = groupesByLeg.flat();
	// Charge le Texte parent si rattaché (cf ADR 0035) + son slug pour le lien
	// vers la fiche unifiée (cf ADR 0042).
	const texte = detail.texteId ? await loadTexte(fetch, detail.texteId) : null;
	const texteSlug = detail.texteId
		? (await loadTexteSlugResolver(fetch))(detail.texteId)
		: null;
	// Canonical vers la fiche texte parente (cf ADR 0043) — lu par le +layout
	// (un seul <link rel="canonical">). Absent si le scrutin n'a pas de texte.
	const canonicalOverride = texteSlug ? `${SITE_URL}/textes/${texteSlug}/` : undefined;
	return {
		personnes,
		groupes,
		detail,
		index,
		legislatures,
		texte,
		texteSlug,
		canonicalOverride
	};
};
