import type { PageLoad } from './$types';
import { loadGroupesSenat, loadSenateurs } from '$lib/data';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const sesann = parseInt(params.sesann, 10);
	if (!Number.isFinite(sesann)) throw new Error(`Session invalide : ${params.sesann}`);

	const [groupes, senateurs] = await Promise.all([
		loadGroupesSenat(fetch, sesann),
		loadSenateurs(fetch)
	]);
	const groupe = groupes.find((g) => g.code === params.code);
	if (!groupe) throw new Error(`Groupe ${params.code} introuvable pour la session ${sesann}`);

	return { groupe, sesann, senateurs };
};
