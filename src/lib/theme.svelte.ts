/**
 * Store de thème clair/sombre (design v2, cf design-system/MASTER.md).
 *
 * - Persistance localStorage (`politidex-theme`).
 * - Au 1er chargement : respecte le choix mémorisé, sinon `prefers-color-scheme`.
 * - Applique `data-theme` + classe `.dark` sur `<html>` (lus par les tokens CSS).
 *
 * L'anti-FOUC (application avant hydratation) est géré par un petit script
 * inline dans app.html.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'politidex-theme';

function initialTheme(): Theme {
	if (typeof document === 'undefined') return 'light';
	const attr = document.documentElement.getAttribute('data-theme');
	if (attr === 'dark' || attr === 'light') return attr;
	return 'light';
}

class ThemeStore {
	current = $state<Theme>('light');

	constructor() {
		if (typeof document !== 'undefined') {
			this.current = initialTheme();
		}
	}

	#apply(theme: Theme) {
		const root = document.documentElement;
		root.setAttribute('data-theme', theme);
		root.classList.toggle('dark', theme === 'dark');
		try {
			localStorage.setItem(STORAGE_KEY, theme);
		} catch {
			/* localStorage indisponible (mode privé) : on ignore */
		}
	}

	toggle() {
		this.set(this.current === 'dark' ? 'light' : 'dark');
	}

	set(theme: Theme) {
		this.current = theme;
		if (typeof document !== 'undefined') this.#apply(theme);
	}
}

export const theme = new ThemeStore();
