import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import { escapeXml, buildUrlset, buildSitemapIndex, SITE_URL } from './sitemap.ts';

describe('escapeXml', () => {
	test('échappe les 5 caractères réservés', () => {
		assert.equal(escapeXml(`a & b < c > d " e ' f`), 'a &amp; b &lt; c &gt; d &quot; e &apos; f');
	});

	test('laisse intact un texte sans caractère réservé', () => {
		assert.equal(escapeXml('jean-louis-masson-pa346218'), 'jean-louis-masson-pa346218');
	});
});

describe('buildUrlset', () => {
	test('préfixe chaque loc par SITE_URL et inclut lastmod', () => {
		const xml = buildUrlset([{ loc: '/elus/damien-abad/', lastmod: '2026-05-25' }]);
		assert.match(xml, /<loc>https:\/\/politidex\.fr\/elus\/damien-abad\/<\/loc>/);
		assert.match(xml, /<lastmod>2026-05-25<\/lastmod>/);
		assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
	});

	test('omet lastmod si absent', () => {
		const xml = buildUrlset([{ loc: '/faq/' }]);
		assert.doesNotMatch(xml, /<lastmod>/);
	});

	test('échappe les & dans une loc (slug avec &)', () => {
		const xml = buildUrlset([{ loc: '/textes/a&b/' }]);
		assert.match(xml, /a&amp;b/);
		assert.doesNotMatch(xml, /a&b/);
	});

	test('urlset vide reste un document valide', () => {
		const xml = buildUrlset([]);
		assert.match(xml, /<urlset[^>]*>\n\n<\/urlset>/);
	});
});

describe('buildSitemapIndex', () => {
	test('émet des <sitemap> pour chaque enfant', () => {
		const xml = buildSitemapIndex([
			{ loc: '/sitemap-elus.xml', lastmod: '2026-05-25' },
			{ loc: '/sitemap-textes.xml' }
		]);
		assert.match(xml, /<sitemapindex/);
		assert.match(xml, new RegExp(`<loc>${SITE_URL}/sitemap-elus\\.xml</loc>`));
		assert.match(xml, /<lastmod>2026-05-25<\/lastmod>/);
		assert.match(xml, new RegExp(`<loc>${SITE_URL}/sitemap-textes\\.xml</loc>`));
	});
});
