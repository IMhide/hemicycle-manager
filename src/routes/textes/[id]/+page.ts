import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	loadTexteUnifie,
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
	const id = decodeURIComponent(params.id);
	const texte = await loadTexteUnifie(fetch, id);
	if (!texte) {
		// Tentative fallback : id Sénat (loicod) renvoie vers un TexteUnifie dont
		// l'id canonique est l'id AN. On cherche l'unifie qui contient ce loicod.
		const { loadTextesUnifies } = await import('$lib/data');
		const all = await loadTextesUnifies(fetch);
		const bySenatId = all.find((t) => t.senat?.texteId === id);
		if (bySenatId) {
			throw error(307, `/textes/${encodeURIComponent(bySenatId.id)}`);
		}
		throw error(404, `Texte ${id} introuvable`);
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
