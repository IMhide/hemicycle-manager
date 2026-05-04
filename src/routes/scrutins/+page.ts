import type { PageLoad } from './$types';
import { loadScrutinsIndex, loadGroupes } from '$lib/data';

export const load: PageLoad = async ({ fetch }) => {
	const [scrutins, groupes] = await Promise.all([
		loadScrutinsIndex(fetch),
		loadGroupes(fetch)
	]);
	return { scrutins, groupes };
};
