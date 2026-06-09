import type { RequestHandler } from './$types';
import { buildUrlset, XML_HEADERS, type SitemapUrl } from '$lib/sitemap';
import { loadMeta } from '$lib/data';

// Sitemap des pages statiques/listes (cf ADR 0044) — toutes en trailing slash.
// On exclut les ~17,5k scrutins (minces, noindex/canonical vers texte — cf H2).
export const prerender = true;

const STATIC_PATHS = [
	'/',
	'/elus/',
	'/textes/',
	'/classement/',
	'/faq/',
	'/assemblee/',
	'/assemblee/deputes/',
	'/assemblee/scrutins/',
	'/assemblee/groupes/',
	'/assemblee/classements/',
	'/senat/',
	'/senat/senateurs/',
	'/senat/scrutins/',
	'/senat/groupes/',
	'/senat/classements/'
];

export const GET: RequestHandler = async ({ fetch }) => {
	const lastmod = await loadMeta(fetch)
		.then((m) => m.generatedAt.slice(0, 10))
		.catch(() => undefined);

	const urls: SitemapUrl[] = STATIC_PATHS.map((loc) => ({ loc, lastmod }));
	return new Response(buildUrlset(urls), { headers: XML_HEADERS });
};
