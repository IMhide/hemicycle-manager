import type { PageLoad } from './$types';
import {
	loadSenateurs,
	loadGroupesSenat,
	loadScrutinsSenatIndex,
	loadSessions,
	loadMetaSenat
} from '$lib/data';

// SPA mode : le rendu se fait côté client à partir des JSON statiques.
// Évite d'avoir à connaître la liste des sessions au moment du prerender CI
// (où les data sont mockées vides).
export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const sesann = parseInt(params.sesann, 10);
	if (!Number.isFinite(sesann)) throw new Error(`Session invalide : ${params.sesann}`);

	const sessions = await loadSessions(fetch);
	if (!sessions.some((s) => s.sesann === sesann)) {
		throw new Error(`Session ${sesann} non couverte`);
	}

	const [senateurs, groupes, scrutins, meta] = await Promise.all([
		loadSenateurs(fetch),
		loadGroupesSenat(fetch, sesann),
		loadScrutinsSenatIndex(fetch),
		loadMetaSenat(fetch)
	]);

	return { senateurs, groupes, scrutins, meta, sessions, sessionCourante: sesann };
};
