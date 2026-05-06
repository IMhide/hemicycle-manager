import type { PageLoad } from './$types';
import { loadScrutinsSenatIndex, loadSessions } from '$lib/data';

export const load: PageLoad = async ({ fetch }) => {
	const [scrutins, sessions] = await Promise.all([
		loadScrutinsSenatIndex(fetch),
		loadSessions(fetch)
	]);
	return { scrutins, sessions };
};
