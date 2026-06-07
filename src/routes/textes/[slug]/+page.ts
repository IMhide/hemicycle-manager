import type { PageLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import {
	loadTexteUnifieBySlug,
	loadTextesUnifies,
	loadScrutinsIndex,
	loadScrutinsSenatIndex,
	loadPersonnes,
	loadActeursNoms,
	loadTexte,
	loadTexteSenat
} from '$lib/data';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const slug = decodeURIComponent(params.slug);
	const texte = await loadTexteUnifieBySlug(fetch, slug);
	if (!texte) {
		// Rétro-compat / liens entrants par id brut (canonique, AN ou Sénat) :
		// on résout l'unifié et on redirige vers son slug canonique (cf ADR 0042).
		const all = await loadTextesUnifies(fetch);
		const byId = all.find(
			(t) => t.id === slug || t.an?.texteId === slug || t.senat?.texteId === slug
		);
		if (byId) {
			throw redirect(307, `/textes/${byId.slug}`);
		}
		throw error(404, `Texte ${slug} introuvable`);
	}

	// Charge en parallèle : les détails AN et Sénat selon disponibilité
	const [anTexte, senatTexte, scrutinsAN, scrutinsSenat, personnes, acteursNoms] =
		await Promise.all([
			texte.an ? loadTexte(fetch, texte.an.texteId) : Promise.resolve(null),
			texte.senat ? loadTexteSenat(fetch, texte.senat.texteId) : Promise.resolve(null),
			texte.an ? loadScrutinsIndex(fetch) : Promise.resolve([]),
			texte.senat ? loadScrutinsSenatIndex(fetch) : Promise.resolve([]),
			loadPersonnes(fetch),
			loadActeursNoms(fetch).catch(() => [])
		]);

	const scrutinsANbyUid = new Map(scrutinsAN.map((s) => [s.uid, s]));
	const scrutinsSenatByUid = new Map(scrutinsSenat.map((s) => [s.uid, s]));
	const scrutinsANduTexte = anTexte
		? anTexte.scrutins.map((uid) => scrutinsANbyUid.get(uid)).filter((s) => !!s)
		: [];
	const scrutinsSenatduTexte = senatTexte
		? senatTexte.scrutins.map((uid) => scrutinsSenatByUid.get(uid)).filter((s) => !!s)
		: [];

	return {
		texte,
		anTexte,
		senatTexte,
		scrutinsAN: scrutinsANduTexte,
		scrutinsSenat: scrutinsSenatduTexte,
		personnes,
		acteursNoms
	};
};
