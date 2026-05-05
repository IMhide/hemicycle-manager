/**
 * Global search index — chargé à la première requête, puis caché.
 *
 * Indexe les **personnes** (cf ADR 0015 : une personne = une fiche cross-leg)
 * et tous les groupes connus toutes législatures (cf ADR 0016 : la recherche
 * doit matcher une personne via n'importe laquelle de ses appartenances).
 *
 * Volume : personnes ~1-2 MB, groupes/{leg} ~5 KB chacun, scrutins-index ~500 KB
 * → on diffère le chargement après le boot.
 */

import type { Personne, Groupe, ScrutinIndex } from './types';
import { loadPersonnes, loadGroupes, loadScrutinsIndex, loadLegislatures } from './data';

export interface SearchIndex {
	personnes: Personne[];
	groupes: Groupe[]; // tous groupes toutes législatures
	groupesById: Map<string, Groupe>;
	scrutins: ScrutinIndex[];
}

let cached: SearchIndex | null = null;
let inflight: Promise<SearchIndex> | null = null;

export async function ensureSearchIndex(): Promise<SearchIndex> {
	if (cached) return cached;
	if (inflight) return inflight;

	inflight = (async () => {
		const legislatures = await loadLegislatures(fetch);
		const [personnes, scrutins, ...groupesByLeg] = await Promise.all([
			loadPersonnes(fetch),
			loadScrutinsIndex(fetch),
			...legislatures.map((l) => loadGroupes(fetch, l.num))
		]);
		const groupes = groupesByLeg.flat();
		const groupesById = new Map(groupes.map((g) => [g.id, g]));
		cached = { personnes, groupes, groupesById, scrutins };
		inflight = null;
		return cached;
	})();

	return inflight;
}

/** Strip diacritics + lowercase for accent-insensitive search. */
export function normalize(s: string): string {
	return s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase();
}

export interface SearchResults {
	personnes: Array<Personne & { groupePrincipal?: Groupe }>;
	groupes: Groupe[];
	scrutins: ScrutinIndex[];
}

const MAX_PER_CATEGORY = { personnes: 5, groupes: 3, scrutins: 5 };

/** Le groupe "principal" d'une personne pour l'affichage (cf ADR 0016) :
 *  groupe le plus récent enregistré tous mandats confondus, en ignorant les
 *  appartenances NI transitoires. */
function groupePrincipalDe(p: Personne, groupesById: Map<string, Groupe>): Groupe | undefined {
	for (let i = p.mandats.length - 1; i >= 0; i--) {
		const m = p.mandats[i];
		for (let j = m.appartenancesGroupe.length - 1; j >= 0; j--) {
			const a = m.appartenancesGroupe[j];
			if (a.isTransitoireNI) continue;
			const g = groupesById.get(a.groupeId);
			if (g) return g;
		}
	}
	return undefined;
}

export function searchAll(index: SearchIndex, query: string): SearchResults {
	const q = normalize(query.trim());
	if (!q) return { personnes: [], groupes: [], scrutins: [] };

	// ─── Personnes : match nom/prénom OU libellé d'un groupe d'appartenance
	const matchedPersonnes: Array<Personne & { groupePrincipal?: Groupe }> = [];
	for (const p of index.personnes) {
		const hayName = normalize(`${p.identite.prenom} ${p.identite.nom}`);
		let match = hayName.includes(q);
		if (!match) {
			// Match via une appartenance de groupe (libellé court ou long)
			outer: for (const m of p.mandats) {
				for (const a of m.appartenancesGroupe) {
					const g = index.groupesById.get(a.groupeId);
					if (!g) continue;
					const hayG = normalize(`${g.libelleAbrege} ${g.libelle}`);
					if (hayG.includes(q)) {
						match = true;
						break outer;
					}
				}
			}
		}
		if (match) {
			matchedPersonnes.push({
				...p,
				groupePrincipal: groupePrincipalDe(p, index.groupesById)
			});
			if (matchedPersonnes.length >= MAX_PER_CATEGORY.personnes * 6) break;
		}
	}
	// Préférer les matches en début de nom
	matchedPersonnes.sort((a, b) => {
		const an = normalize(`${a.identite.prenom} ${a.identite.nom}`);
		const bn = normalize(`${b.identite.prenom} ${b.identite.nom}`);
		const ai = an.indexOf(q);
		const bi = bn.indexOf(q);
		// Les matches via groupe sortent avec ai = -1 (q n'est pas dans le nom)
		// → on les pousse plus bas en priorisant les vrais matches de nom.
		if (ai === -1 && bi !== -1) return 1;
		if (bi === -1 && ai !== -1) return -1;
		if (ai !== bi) return ai - bi;
		return an.localeCompare(bn);
	});

	// ─── Groupes : match libelleAbrege ou libelle (toutes législatures)
	const matchedGroupes: Groupe[] = [];
	for (const g of index.groupes) {
		const hay = normalize(`${g.libelleAbrege} ${g.libelle}`);
		if (hay.includes(q)) matchedGroupes.push(g);
	}
	// Tri : plus récent en premier
	matchedGroupes.sort((a, b) => b.legislature - a.legislature || a.preseance - b.preseance);

	// ─── Scrutins : match titre (déjà triés desc dans l'index)
	const matchedScrutins: ScrutinIndex[] = [];
	for (const s of index.scrutins) {
		if (normalize(s.titre).includes(q)) {
			matchedScrutins.push(s);
			if (matchedScrutins.length >= MAX_PER_CATEGORY.scrutins) break;
		}
	}

	return {
		personnes: matchedPersonnes.slice(0, MAX_PER_CATEGORY.personnes),
		groupes: matchedGroupes.slice(0, MAX_PER_CATEGORY.groupes),
		scrutins: matchedScrutins
	};
}
