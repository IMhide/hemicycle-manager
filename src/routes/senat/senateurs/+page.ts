import type { PageLoad } from './$types';
import { loadSenateurs, loadGroupesSenat, loadSessions } from '$lib/data';

export const load: PageLoad = async ({ fetch }) => {
	const sessions = await loadSessions(fetch);
	const groupesBySession = await Promise.all(sessions.map((s) => loadGroupesSenat(fetch, s.sesann)));
	const senateurs = await loadSenateurs(fetch);
	const groupes = groupesBySession.flat();
	return { senateurs, groupes, sessions };
};
