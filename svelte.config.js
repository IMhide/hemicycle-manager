import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		prerender: {
			// Pendant la stack refonte/03..05, la racine `/` linkote vers `/elus`
			// et `/classement` qui ne sont pas encore créés (PR #D, PR #E). On
			// laisse le prerender ignorer ces 404 le temps que la stack soit
			// complète — à supprimer en PR #G ou dès que les routes existent.
			handleHttpError: ({ path, referrer, message }) => {
				if (path === '/elus' || path === '/classement') return;
				throw new Error(`${message} (linked from ${referrer})`);
			}
		}
	}
};

export default config;
