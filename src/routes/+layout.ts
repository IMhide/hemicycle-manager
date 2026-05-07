import type { LayoutLoad } from './$types';
import { loadElusManifest } from '$lib/elus';
import { loadFamilles } from '$lib/familles';

// Layout root partageant les données : on charge le manifest bicaméral
// `elus.json` UNE FOIS et il alimente le cache module dans `$lib/elus`.
// Les helpers `lookupEluByPaId` / `lookupEluByMatricule` (utilisés par
// MemberRow, MiniDeputeCard, GlobalSearch, hémicycles, scrutins, groupes,
// classements) résolvent ensuite `paId → eluId` synchroniquement.
//
// Cf ADR 0030 §"Réécriture additionnelle des liens vers fiches détail" et
// ADR 0031 §"Code applicatif".

export const prerender = true;
export const trailingSlash = 'always';

export const load: LayoutLoad = async ({ fetch }) => {
	// Charge le manifest et alimente les indexes du module `elus.ts`. Tolère
	// l'absence (placeholder CI vide → manifest.count === 0, lookups
	// retourneront null partout, les caller-side fallbacks géreront).
	const manifest = await loadElusManifest(fetch).catch(() => ({
		generatedAt: '1970-01-01T00:00:00Z',
		count: 0,
		countBicameral: 0,
		elus: [],
		warnings: []
	}));
	// Charge la table des familles politiques (cf ADR 0034) — utilisée par
	// les filtres "Famille politique" sur /elus, /assemblee/deputes,
	// /senat/senateurs. Échec silencieux toléré (filtre dégradé, pas bloquant).
	const famillesData = await loadFamilles(fetch).catch(() => ({
		list: [],
		byGroupeIdAN: {},
		byGroupeCodeSenat: {}
	}));
	return {
		elusManifest: manifest,
		familles: famillesData.list,
		famillesByGroupeIdAN: famillesData.byGroupeIdAN,
		famillesByGroupeCodeSenat: famillesData.byGroupeCodeSenat
	};
};
