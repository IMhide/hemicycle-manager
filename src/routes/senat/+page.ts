import type { PageLoad } from './$types';
import {
	loadSenateurs,
	loadGroupesSenat,
	loadScrutinsSenatIndex,
	loadSessions,
	loadMetaSenat
} from '$lib/data';

export const load: PageLoad = async ({ fetch }) => {
	const sessions = await loadSessions(fetch);
	const sessionCourante =
		[...sessions].sort((a, b) => b.sesann - a.sesann)[0]?.sesann ?? new Date().getFullYear();

	const [senateurs, groupes, scrutins, meta] = await Promise.all([
		loadSenateurs(fetch),
		loadGroupesSenat(fetch, sessionCourante),
		loadScrutinsSenatIndex(fetch),
		loadMetaSenat(fetch)
	]);

	return { senateurs, groupes, scrutins, meta, sessions, sessionCourante };
};
