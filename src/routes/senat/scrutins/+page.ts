import type { PageLoad } from './$types';
import { loadScrutinsSenatIndex, loadTriennats } from '$lib/data';

export const load: PageLoad = async ({ fetch }) => {
	const [scrutins, triennats] = await Promise.all([
		loadScrutinsSenatIndex(fetch),
		loadTriennats(fetch)
	]);
	return { scrutins, triennats };
};
