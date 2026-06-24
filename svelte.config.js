import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { isToleratedPrerenderError } from './src/lib/prerender-policy.js';

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
			handleUnseenRoutes: 'warn',
			// Historiques de vote manquants (cf ADR 0041, PR #33) : un élu présent
			// au manifest mais sans aucun vote enregistré (ex. ministre/secrétaire
			// d'État n'ayant siégé que brièvement) n'a pas de fichier
			// `/data/historique/{paId}.json` — c'est légitime, pas une donnée
			// manquante. La fiche le gère déjà via `.catch(() => [])`, mais le
			// crawler SSG remonte tout fetch 404 comme erreur fatale. On l'ignore
			// pour cette seule famille d'URLs : un élu sans historique ne doit
			// JAMAIS casser le déploiement complet. Toute autre erreur reste
			// fatale. Prédicat extrait + testé : src/lib/prerender-policy.js.
			handleHttpError: ({ path, referrer, message }) => {
				if (isToleratedPrerenderError(path)) {
					console.warn(`Prerender: historique absent, ignoré — ${path} (réf. ${referrer})`);
					return;
				}
				throw new Error(message);
			},
			// Les endpoints sitemap (cf ADR 0044) ne sont liés depuis aucune page
			// prérendue → on les déclare explicitement pour que le crawler SSG les
			// génère (sinon strict:true les manque). `*` conserve la découverte
			// automatique des routes prérendues. robots.txt est servi statiquement.
			entries: [
				'*',
				'/sitemap.xml',
				'/sitemap-pages.xml',
				'/sitemap-elus.xml',
				'/sitemap-textes.xml'
			]
		}
	}
};

export default config;
