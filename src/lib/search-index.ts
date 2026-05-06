/**
 * Global search index — chargé à la première requête, puis caché.
 *
 * Indexe les **personnes** (cf ADR 0015 : une personne = une fiche cross-leg)
 * et tous les groupes connus toutes législatures (cf ADR 0016 : la recherche
 * doit matcher une personne via n'importe laquelle de ses appartenances).
 *
 * Phase 3 : ajoute aussi les **sénateurs** (cf ADR 0023..0024) et leurs groupes
 * scopés par session. AN et Sénat restent disjoints en v1 (cf ADR 0023).
 */

import type {
	Personne,
	Groupe,
	ScrutinIndex,
	Senateur,
	GroupeSenat
} from './types';
import {
	loadPersonnes,
	loadGroupes,
	loadScrutinsIndex,
	loadLegislatures,
	loadSenateurs,
	loadGroupesSenat,
	loadSessions
} from './data';

export interface SearchIndex {
	personnes: Personne[];
	groupes: Groupe[]; // tous groupes toutes législatures
	groupesById: Map<string, Groupe>;
	scrutins: ScrutinIndex[];
	senateurs: Senateur[];
	groupesSenat: GroupeSenat[];
	/** code → liste de GroupeSenat (toutes sessions où ce code a existé). */
	groupesSenatByCode: Map<string, GroupeSenat[]>;
}

let cached: SearchIndex | null = null;
let inflight: Promise<SearchIndex> | null = null;

export async function ensureSearchIndex(): Promise<SearchIndex> {
	if (cached) return cached;
	if (inflight) return inflight;

	inflight = (async () => {
		const [legislatures, sessions] = await Promise.all([
			loadLegislatures(fetch),
			loadSessions(fetch)
		]);
		const [personnes, scrutins, senateurs, groupesByLeg, groupesBySession] = await Promise.all([
			loadPersonnes(fetch),
			loadScrutinsIndex(fetch),
			loadSenateurs(fetch),
			Promise.all(legislatures.map((l) => loadGroupes(fetch, l.num))),
			Promise.all(sessions.map((s) => loadGroupesSenat(fetch, s.sesann)))
		]);
		const groupes = groupesByLeg.flat();
		const groupesById = new Map(groupes.map((g) => [g.id, g]));

		const groupesSenat = groupesBySession.flat();
		const groupesSenatByCode = new Map<string, GroupeSenat[]>();
		for (const g of groupesSenat) {
			const arr = groupesSenatByCode.get(g.code) ?? [];
			arr.push(g);
			groupesSenatByCode.set(g.code, arr);
		}

		cached = {
			personnes,
			groupes,
			groupesById,
			scrutins,
			senateurs,
			groupesSenat,
			groupesSenatByCode
		};
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
	senateurs: Array<Senateur & { groupePrincipal?: GroupeSenat }>;
	groupesSenat: GroupeSenat[];
}

const MAX_PER_CATEGORY = {
	personnes: 5,
	senateurs: 5,
	groupes: 3,
	groupesSenat: 3,
	scrutins: 5
};

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

/** Le groupe "principal" d'un sénateur pour l'affichage : dernier groupe connu
 *  (dernier mandat, dernière appartenance), recherché dans la session la plus
 *  récente où le code a existé. */
function groupePrincipalSenateurDe(
	s: Senateur,
	groupesSenatByCode: Map<string, GroupeSenat[]>
): GroupeSenat | undefined {
	const lastM = s.mandats.at(-1);
	const lastApp = lastM?.appartenancesGroupe.at(-1);
	if (!lastApp) return undefined;
	const candidats = groupesSenatByCode.get(lastApp.groupeCode);
	if (!candidats || candidats.length === 0) return undefined;
	// Le plus récent (sesann max)
	return [...candidats].sort((a, b) => b.sesann - a.sesann)[0];
}

export function searchAll(index: SearchIndex, query: string): SearchResults {
	const q = normalize(query.trim());
	if (!q)
		return { personnes: [], groupes: [], scrutins: [], senateurs: [], groupesSenat: [] };

	// ─── Personnes (AN) ────────────────────────────────────────────────
	const matchedPersonnes: Array<Personne & { groupePrincipal?: Groupe }> = [];
	for (const p of index.personnes) {
		const hayName = normalize(`${p.identite.prenom} ${p.identite.nom}`);
		let match = hayName.includes(q);
		if (!match) {
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
	matchedPersonnes.sort((a, b) => {
		const an = normalize(`${a.identite.prenom} ${a.identite.nom}`);
		const bn = normalize(`${b.identite.prenom} ${b.identite.nom}`);
		const ai = an.indexOf(q);
		const bi = bn.indexOf(q);
		if (ai === -1 && bi !== -1) return 1;
		if (bi === -1 && ai !== -1) return -1;
		if (ai !== bi) return ai - bi;
		return an.localeCompare(bn);
	});

	// ─── Sénateurs ─────────────────────────────────────────────────────
	const matchedSenateurs: Array<Senateur & { groupePrincipal?: GroupeSenat }> = [];
	for (const s of index.senateurs) {
		const hayName = normalize(`${s.identite.prenom} ${s.identite.nom}`);
		let match = hayName.includes(q);
		if (!match) {
			outer: for (const m of s.mandats) {
				for (const a of m.appartenancesGroupe) {
					const candidats = index.groupesSenatByCode.get(a.groupeCode);
					if (!candidats) continue;
					for (const g of candidats) {
						const hayG = normalize(`${g.libelleAbrege} ${g.libelle}`);
						if (hayG.includes(q)) {
							match = true;
							break outer;
						}
					}
				}
			}
		}
		if (match) {
			matchedSenateurs.push({
				...s,
				groupePrincipal: groupePrincipalSenateurDe(s, index.groupesSenatByCode)
			});
			if (matchedSenateurs.length >= MAX_PER_CATEGORY.senateurs * 6) break;
		}
	}
	matchedSenateurs.sort((a, b) => {
		const an = normalize(`${a.identite.prenom} ${a.identite.nom}`);
		const bn = normalize(`${b.identite.prenom} ${b.identite.nom}`);
		const ai = an.indexOf(q);
		const bi = bn.indexOf(q);
		if (ai === -1 && bi !== -1) return 1;
		if (bi === -1 && ai !== -1) return -1;
		if (ai !== bi) return ai - bi;
		// Préférer ACTIF sur ANCIEN
		if (a.identite.etat !== b.identite.etat) {
			return a.identite.etat === 'ACTIF' ? -1 : 1;
		}
		return an.localeCompare(bn);
	});

	// ─── Groupes AN (toutes légis) ─────────────────────────────────────
	const matchedGroupes: Groupe[] = [];
	for (const g of index.groupes) {
		const hay = normalize(`${g.libelleAbrege} ${g.libelle}`);
		if (hay.includes(q)) matchedGroupes.push(g);
	}
	matchedGroupes.sort((a, b) => b.legislature - a.legislature || a.preseance - b.preseance);

	// ─── Groupes Sénat (dédupliqués par code, on garde la session la plus récente) ──
	const matchedGroupesSenatMap = new Map<string, GroupeSenat>();
	for (const g of index.groupesSenat) {
		const hay = normalize(`${g.libelleAbrege} ${g.libelle}`);
		if (hay.includes(q)) {
			const existing = matchedGroupesSenatMap.get(g.code);
			if (!existing || existing.sesann < g.sesann) matchedGroupesSenatMap.set(g.code, g);
		}
	}
	const matchedGroupesSenat = [...matchedGroupesSenatMap.values()].sort(
		(a, b) => b.sesann - a.sesann || a.preseance - b.preseance
	);

	// ─── Scrutins (AN, déjà triés desc dans l'index) ───────────────────
	const matchedScrutins: ScrutinIndex[] = [];
	for (const s of index.scrutins) {
		if (normalize(s.titre).includes(q)) {
			matchedScrutins.push(s);
			if (matchedScrutins.length >= MAX_PER_CATEGORY.scrutins) break;
		}
	}

	return {
		personnes: matchedPersonnes.slice(0, MAX_PER_CATEGORY.personnes),
		senateurs: matchedSenateurs.slice(0, MAX_PER_CATEGORY.senateurs),
		groupes: matchedGroupes.slice(0, MAX_PER_CATEGORY.groupes),
		groupesSenat: matchedGroupesSenat.slice(0, MAX_PER_CATEGORY.groupesSenat),
		scrutins: matchedScrutins
	};
}
