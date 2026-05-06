import type { PageLoad } from './$types';
import {
	loadSenateur,
	loadGroupesSenat,
	loadSessions,
	loadHistoriqueSenat,
	loadScrutinsSenatIndex
} from '$lib/data';

// SPA mode : la fiche détail Sénat est rendue côté client (volume historique
// par sénateur trop grand pour prerender chaque matricule).
export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params, url }) => {
	const senateur = await loadSenateur(fetch, params.matricule);
	if (!senateur) throw new Error(`Sénateur ${params.matricule} introuvable`);

	const sessions = await loadSessions(fetch);
	const sessionParam = url.searchParams.get('session');
	const sessionScope = sessionParam ? parseInt(sessionParam, 10) : null;

	// Charge les groupes pour toutes les sessions touchées par le sénateur
	const sessionsTouchees = senateur.carriere.sessions;
	const groupesBySession = await Promise.all(
		sessionsTouchees.map((s) => loadGroupesSenat(fetch, s))
	);
	const groupes = groupesBySession.flat();

	const [historique, scrutinsIndex] = await Promise.all([
		loadHistoriqueSenat(fetch, params.matricule).catch(() => []),
		loadScrutinsSenatIndex(fetch)
	]);

	return { senateur, groupes, sessions, sessionScope, historique, scrutinsIndex };
};
