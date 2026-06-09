import type { RequestHandler } from './$types';
import { buildUrlset, XML_HEADERS, type SitemapUrl } from '$lib/sitemap';
import { loadTextesUnifiesLite, loadMeta } from '$lib/data';

// Sitemap des fiches texte unifié (cf ADR 0044) — une <loc> par slug. On lit la
// projection lite (suffisante : on n'a besoin que du slug). Tolère l'absence.
export const prerender = true;

export const GET: RequestHandler = async ({ fetch }) => {
	const lastmod = await loadMeta(fetch)
		.then((m) => m.generatedAt.slice(0, 10))
		.catch(() => undefined);

	const textes = await loadTextesUnifiesLite(fetch).catch(() => []);
	const urls: SitemapUrl[] = textes.map((t) => ({
		loc: `/textes/${t.slug}/`,
		lastmod
	}));

	return new Response(buildUrlset(urls), { headers: XML_HEADERS });
};
