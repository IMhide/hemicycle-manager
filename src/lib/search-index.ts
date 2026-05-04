/**
 * Global search index — loads on first request, then cached.
 *
 * The data files (deputes ~200 KB, groupes 4 KB, scrutins-index 2.2 MB)
 * are NOT loaded at app boot to keep the initial page snappy. The first
 * call to `ensureSearchIndex()` triggers a single fetch and memoises.
 */

import type { Depute, Groupe, ScrutinIndex } from './types';
import {
	loadDeputes,
	loadGroupes,
	loadScrutinsIndex
} from './data';

export interface SearchIndex {
	deputes: Depute[];
	groupes: Groupe[];
	scrutins: ScrutinIndex[];
}

let cached: SearchIndex | null = null;
let inflight: Promise<SearchIndex> | null = null;

export async function ensureSearchIndex(): Promise<SearchIndex> {
	if (cached) return cached;
	if (inflight) return inflight;

	inflight = (async () => {
		const [deputes, groupes, scrutins] = await Promise.all([
			loadDeputes(fetch),
			loadGroupes(fetch),
			loadScrutinsIndex(fetch)
		]);
		cached = { deputes, groupes, scrutins };
		inflight = null;
		return cached;
	})();

	return inflight;
}

/**
 * Strip diacritics + lowercase for accent-insensitive search.
 * "Émeric" → "emeric", "Le Pen" → "le pen"
 */
export function normalize(s: string): string {
	return s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase();
}

export interface SearchResults {
	deputes: Array<Depute & { groupe?: Groupe }>;
	groupes: Groupe[];
	scrutins: ScrutinIndex[];
}

const MAX_PER_CATEGORY = { deputes: 5, groupes: 3, scrutins: 5 };

export function searchAll(index: SearchIndex, query: string): SearchResults {
	const q = normalize(query.trim());
	if (!q) return { deputes: [], groupes: [], scrutins: [] };

	const groupesById = new Map(index.groupes.map((g) => [g.id, g]));

	// Députés — match on first/last name (accent-insensitive)
	const matchedDeputes: Array<Depute & { groupe?: Groupe }> = [];
	for (const d of index.deputes) {
		const hay = normalize(`${d.prenom} ${d.nom}`);
		if (hay.includes(q)) {
			matchedDeputes.push({
				...d,
				groupe: d.groupeId ? groupesById.get(d.groupeId) : undefined
			});
			if (matchedDeputes.length >= MAX_PER_CATEGORY.deputes * 4) break; // hard cap before sort
		}
	}
	// Prefer matches at the start of a name (≪ Le Pen ≫ wins over ≪ Lépeule ≫)
	matchedDeputes.sort((a, b) => {
		const an = normalize(`${a.prenom} ${a.nom}`);
		const bn = normalize(`${b.prenom} ${b.nom}`);
		const ai = an.indexOf(q);
		const bi = bn.indexOf(q);
		if (ai !== bi) return ai - bi;
		return an.localeCompare(bn);
	});

	// Groupes — match abbrev or full name
	const matchedGroupes: Groupe[] = [];
	for (const g of index.groupes) {
		const hay = normalize(`${g.libelleAbrege} ${g.libelle}`);
		if (hay.includes(q)) matchedGroupes.push(g);
	}

	// Scrutins — match in title (newest first; index already sorted desc)
	const matchedScrutins: ScrutinIndex[] = [];
	for (const s of index.scrutins) {
		if (normalize(s.titre).includes(q)) {
			matchedScrutins.push(s);
			if (matchedScrutins.length >= MAX_PER_CATEGORY.scrutins) break;
		}
	}

	return {
		deputes: matchedDeputes.slice(0, MAX_PER_CATEGORY.deputes),
		groupes: matchedGroupes.slice(0, MAX_PER_CATEGORY.groupes),
		scrutins: matchedScrutins
	};
}
