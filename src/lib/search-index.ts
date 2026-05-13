/**
 * Global search index — chargé à la première requête, puis caché.
 *
 * Périmètre : **élus** (personnes AN + sénateurs) et **textes législatifs**
 * (TexteUnifie cross-chambre). Les groupes AN/Sénat sont aussi indexés pour
 * matcher une personne via ses appartenances (cf ADR 0016).
 *
 * Les scrutins ne sont plus exposés ici (cf NEXT_STEPS / refonte topbar
 * 2026-05-13) : trop de bruit (~17k entrées), peu de valeur de recherche
 * directe — on accède aux scrutins depuis la fiche `/textes/[id]` ou les
 * listes chambre `/assemblee/scrutins/` et `/senat/scrutins/`.
 */

import type { Personne, Groupe, Senateur, GroupeSenat, TexteUnifie } from './types';
import {
	loadPersonnes,
	loadGroupes,
	loadLegislatures,
	loadSenateurs,
	loadGroupesSenat,
	loadTriennats,
	loadTextesUnifies
} from './data';

export interface SearchIndex {
	personnes: Personne[];
	groupes: Groupe[]; // tous groupes toutes législatures
	groupesById: Map<string, Groupe>;
	senateurs: Senateur[];
	groupesSenat: GroupeSenat[];
	/** code → liste de GroupeSenat (toutes sessions où ce code a existé). */
	groupesSenatByCode: Map<string, GroupeSenat[]>;
	textes: TexteUnifie[];
}

let cached: SearchIndex | null = null;
let inflight: Promise<SearchIndex> | null = null;

export async function ensureSearchIndex(): Promise<SearchIndex> {
	if (cached) return cached;
	if (inflight) return inflight;

	inflight = (async () => {
		const [legislatures, triennats] = await Promise.all([
			loadLegislatures(fetch),
			loadTriennats(fetch)
		]);
		const [personnes, senateurs, textes, groupesByLeg, groupesByTriennat] = await Promise.all([
			loadPersonnes(fetch),
			loadSenateurs(fetch),
			loadTextesUnifies(fetch),
			Promise.all(legislatures.map((l) => loadGroupes(fetch, l.num))),
			Promise.all(triennats.map((t) => loadGroupesSenat(fetch, t.id)))
		]);
		const groupes = groupesByLeg.flat();
		const groupesById = new Map(groupes.map((g) => [g.id, g]));

		const groupesSenat = groupesByTriennat.flat();
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
			senateurs,
			groupesSenat,
			groupesSenatByCode,
			textes
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
	senateurs: Array<Senateur & { groupePrincipal?: GroupeSenat }>;
	groupesSenat: GroupeSenat[];
	textes: TexteUnifie[];
}

const MAX_PER_CATEGORY = {
	personnes: 5,
	senateurs: 5,
	groupes: 3,
	groupesSenat: 3,
	textes: 5
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
 *  (dernier mandat, dernière appartenance), recherché dans le triennat le plus
 *  récent où le code a existé (cf ADR 0028). */
function groupePrincipalSenateurDe(
	s: Senateur,
	groupesSenatByCode: Map<string, GroupeSenat[]>
): GroupeSenat | undefined {
	const lastM = s.mandats.at(-1);
	const lastApp = lastM?.appartenancesGroupe.at(-1);
	if (!lastApp) return undefined;
	const candidats = groupesSenatByCode.get(lastApp.groupeCode);
	if (!candidats || candidats.length === 0) return undefined;
	// Le plus récent (triennat max — tri lexicographique sur "YYYY-YYYY" fonctionne)
	return [...candidats].sort((a, b) => b.triennat.localeCompare(a.triennat))[0];
}

export function searchAll(index: SearchIndex, query: string): SearchResults {
	const q = normalize(query.trim());
	if (!q) return { personnes: [], groupes: [], senateurs: [], groupesSenat: [], textes: [] };

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

	// ─── Groupes Sénat (dédupliqués par code, on garde le triennat le plus récent, cf ADR 0028) ──
	const matchedGroupesSenatMap = new Map<string, GroupeSenat>();
	for (const g of index.groupesSenat) {
		const hay = normalize(`${g.libelleAbrege} ${g.libelle}`);
		if (hay.includes(q)) {
			const existing = matchedGroupesSenatMap.get(g.code);
			if (!existing || existing.triennat.localeCompare(g.triennat) < 0)
				matchedGroupesSenatMap.set(g.code, g);
		}
	}
	const matchedGroupesSenat = [...matchedGroupesSenatMap.values()].sort(
		(a, b) => b.triennat.localeCompare(a.triennat) || a.preseance - b.preseance
	);

	// ─── Textes législatifs (cross-chambre, manifest déjà trié date desc) ─
	const matchedTextes: TexteUnifie[] = [];
	for (const t of index.textes) {
		if (normalize(t.titre).includes(q)) {
			matchedTextes.push(t);
			if (matchedTextes.length >= MAX_PER_CATEGORY.textes) break;
		}
	}

	return {
		personnes: matchedPersonnes.slice(0, MAX_PER_CATEGORY.personnes),
		senateurs: matchedSenateurs.slice(0, MAX_PER_CATEGORY.senateurs),
		groupes: matchedGroupes.slice(0, MAX_PER_CATEGORY.groupes),
		groupesSenat: matchedGroupesSenat.slice(0, MAX_PER_CATEGORY.groupesSenat),
		textes: matchedTextes
	};
}
