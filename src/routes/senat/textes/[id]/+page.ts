import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { loadTexteSenat, loadScrutinsSenatIndex } from '$lib/data';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const id = decodeURIComponent(params.id);
	const [texte, scrutinsIndex] = await Promise.all([
		loadTexteSenat(fetch, id),
		loadScrutinsSenatIndex(fetch)
	]);
	if (!texte) throw error(404, `Texte Sénat ${id} introuvable`);
	const scrutinIndexByUid = new Map(scrutinsIndex.map((s) => [s.uid, s]));
	const scrutinsDuTexte = texte.scrutins.map((uid) => scrutinIndexByUid.get(uid)).filter((s) => !!s);
	return { texte, scrutins: scrutinsDuTexte };
};
