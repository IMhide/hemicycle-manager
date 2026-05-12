import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { loadTexte, loadScrutinsIndex, loadPersonnes } from '$lib/data';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const id = decodeURIComponent(params.id);
	const [texte, scrutinsIndex, personnes] = await Promise.all([
		loadTexte(fetch, id),
		loadScrutinsIndex(fetch),
		loadPersonnes(fetch)
	]);
	if (!texte) throw error(404, `Texte ${id} introuvable`);
	// On extrait seulement les scrutins du texte (déjà ordonnés chronologiquement)
	const scrutinIndexByUid = new Map(scrutinsIndex.map((s) => [s.uid, s]));
	const scrutinsDuTexte = texte.scrutins
		.map((uid) => scrutinIndexByUid.get(uid))
		.filter((s) => !!s);
	return { texte, scrutins: scrutinsDuTexte, personnes };
};
