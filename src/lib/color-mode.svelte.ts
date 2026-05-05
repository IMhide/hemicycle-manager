/**
 * Mode de coloration de l'hémicycle, persisté en localStorage.
 *
 * - 'gradient' : gradient politique CHES gauche → droite (cohérent cross-leg, source CHES 2024)
 * - 'groupe'   : couleurs officielles de chaque groupe (Etalab `couleurAssociee`)
 */

export type ColorMode = 'gradient' | 'groupe';

const STORAGE_KEY = 'politidex.hemicycle.colorMode';
const DEFAULT: ColorMode = 'gradient';

function readInitial(): ColorMode {
	if (typeof window === 'undefined') return DEFAULT;
	const v = window.localStorage.getItem(STORAGE_KEY);
	return v === 'gradient' || v === 'groupe' ? v : DEFAULT;
}

let value = $state<ColorMode>(readInitial());

export const colorMode = {
	get current(): ColorMode {
		return value;
	},
	set(v: ColorMode) {
		value = v;
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(STORAGE_KEY, v);
		}
	}
};
