import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			// Coquille SPA dans 200.html (et non index.html) pour que la home
			// garde son HTML prérendu (titre, OG, contenu) au lieu d'être écrasée
			// par le fallback. Cf ADR 0041. nginx sert 200.html en fallback scopé.
			fallback: '200.html',
			precompress: false,
			strict: true
		}),
		prerender: {
			// Tolère un manifest vide (CI : placeholders `[]` → entries() renvoie []
			// → 0 page détail). Sans ça, le crawler strict échoue car les routes
			// /elus/[slug] et /textes/[slug] « marquées prérendables » ne sont
			// jamais atteintes. En build réel (data présente), entries() est non
			// vide → routes prérendues normalement. Cf ADR 0041.
			handleUnseenRoutes: 'warn'
		}
	}
};

export default config;
