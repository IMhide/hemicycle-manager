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
			// Pendant la stack refonte, la racine `/` linkote vers `/classement`
			// qui n'est pas encore créé (PR #E). On laisse le prerender ignorer
			// ce 404 le temps que la PR #E le crée — à supprimer en PR #G.
			handleHttpError: ({ path, referrer, message }) => {
				if (path === '/classement') return;
				throw new Error(`${message} (linked from ${referrer})`);
			}
		}
	}
};

export default config;
