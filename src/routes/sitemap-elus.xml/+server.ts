import type { RequestHandler } from './$types';
import { buildUrlset, XML_HEADERS, type SitemapUrl } from '$lib/sitemap';
import { loadElusManifest } from '$lib/elus';
import { loadMeta } from '$lib/data';

// Sitemap des fiches élu (cf ADR 0044) — une <loc> par slug. Tolère un manifest
// vide (placeholder CI → urlset vide, build vert).
export const prerender = true;

export const GET: RequestHandler = async ({ fetch }) => {
	const lastmod = await loadMeta(fetch)
		.then((m) => m.generatedAt.slice(0, 10))
		.catch(() => undefined);

	const manifest = await loadElusManifest(fetch).catch(() => ({ elus: [] }));
	const urls: SitemapUrl[] = manifest.elus.map((e) => ({
		loc: `/elus/${e.slug}/`,
		lastmod
	}));

	return new Response(buildUrlset(urls), { headers: XML_HEADERS });
};
