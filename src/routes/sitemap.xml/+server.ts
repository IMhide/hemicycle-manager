import type { RequestHandler } from './$types';
import { buildSitemapIndex, XML_HEADERS } from '$lib/sitemap';
import { loadMeta } from '$lib/data';

// Index de sitemaps (cf ADR 0044) — pointe vers les sitemaps enfants. Prérendu.
export const prerender = true;

export const GET: RequestHandler = async ({ fetch }) => {
	const lastmod = await loadMeta(fetch)
		.then((m) => m.generatedAt.slice(0, 10))
		.catch(() => undefined);

	const xml = buildSitemapIndex([
		{ loc: '/sitemap-pages.xml', lastmod },
		{ loc: '/sitemap-elus.xml', lastmod },
		{ loc: '/sitemap-textes.xml', lastmod }
	]);

	return new Response(xml, { headers: XML_HEADERS });
};
