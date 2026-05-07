import type { PageLoad } from './$types';
import { loadGroupesSenat, loadSenateurs } from '$lib/data';
import { isTriennatId, type TriennatId } from '$lib/triennats';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const periode = params.periode;
	if (!isTriennatId(periode)) throw new Error(`Triennat invalide : ${periode}`);
	const triennat: TriennatId = periode;

	const [groupes, senateurs] = await Promise.all([
		loadGroupesSenat(fetch, triennat),
		loadSenateurs(fetch)
	]);
	const groupe = groupes.find((g) => g.code === params.code);
	if (!groupe) throw new Error(`Groupe ${params.code} introuvable pour le triennat ${triennat}`);

	return { groupe, triennat, senateurs };
};
