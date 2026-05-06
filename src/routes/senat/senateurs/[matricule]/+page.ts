import type { PageLoad } from './$types';
import {
	loadSenateur,
	loadGroupesSenat,
	loadTriennats,
	loadHistoriqueSenat,
	loadScrutinsSenatIndex
} from '$lib/data';
import type { TriennatId } from '$lib/triennats';

// SPA mode : la fiche détail Sénat est rendue côté client (volume historique
// par sénateur trop grand pour prerender chaque matricule).
export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const senateur = await loadSenateur(fetch, params.matricule);
	if (!senateur) throw new Error(`Sénateur ${params.matricule} introuvable`);

	const triennats = await loadTriennats(fetch);

	// Charge les groupes pour tous les triennats touchés par le sénateur (cf ADR 0028)
	const triennatsTouches: TriennatId[] = senateur.carriere.triennats as TriennatId[];
	const groupesByTriennat = await Promise.all(
		triennatsTouches.map((t) => loadGroupesSenat(fetch, t))
	);
	const groupes = groupesByTriennat.flat();

	const [historique, scrutinsIndex] = await Promise.all([
		loadHistoriqueSenat(fetch, params.matricule).catch(() => []),
		loadScrutinsSenatIndex(fetch)
	]);

	return { senateur, groupes, triennats, historique, scrutinsIndex };
};
