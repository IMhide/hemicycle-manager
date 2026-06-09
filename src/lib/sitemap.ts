/**
 * Helpers de génération de sitemap XML (cf ADR 0044).
 *
 * Tout est servi via des endpoints `+server.ts` prérendus. Sous
 * `trailingSlash:'always'`, toutes les `<loc>` finissent par `/`.
 */

export const SITE_URL = 'https://politidex.fr';

/** Échappe les 5 caractères réservés XML dans une valeur de texte. */
export function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export interface SitemapUrl {
	/** Chemin absolu commençant par `/` et finissant par `/` (trailing slash). */
	loc: string;
	/** Date de dernière modif ISO (YYYY-MM-DD ou complète). */
	lastmod?: string;
}

/** Construit un document `<urlset>` à partir d'URLs (préfixées par SITE_URL). */
export function buildUrlset(urls: SitemapUrl[]): string {
	const body = urls
		.map((u) => {
			const loc = `<loc>${escapeXml(SITE_URL + u.loc)}</loc>`;
			const lastmod = u.lastmod ? `<lastmod>${escapeXml(u.lastmod)}</lastmod>` : '';
			return `  <url>${loc}${lastmod}</url>`;
		})
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

/** Construit un `<sitemapindex>` pointant vers les sitemaps enfants. */
export function buildSitemapIndex(children: SitemapUrl[]): string {
	const body = children
		.map((c) => {
			const loc = `<loc>${escapeXml(SITE_URL + c.loc)}</loc>`;
			const lastmod = c.lastmod ? `<lastmod>${escapeXml(c.lastmod)}</lastmod>` : '';
			return `  <sitemap>${loc}${lastmod}</sitemap>`;
		})
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>
`;
}

export const XML_HEADERS = {
	'Content-Type': 'application/xml; charset=utf-8'
} as const;
