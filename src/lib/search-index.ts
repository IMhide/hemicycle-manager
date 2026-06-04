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
import {
	lookupEluByPaId,
	lookupEluByMatricule,
	eluCategorie,
	eluUrlCarriere,
	type Elu
} from './elus';

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

/**
 * Résultat « élu » unifié cross-chambre (ADR 0031, principe « une personne =
 * une fiche »). Un bicaméral n'apparaît qu'UNE fois ici, peu importe qu'il ait
 * matché côté AN, côté Sénat, ou les deux. Construit en dédupliquant
 * `personnes` + `senateurs` par `eluId`.
 */
export interface SearchEluResult {
	eluId: string;
	href: string;
	prenom: string;
	nom: string;
	photoUrl: string;
	/** Groupe le plus récent (pastille + sigle), tous mandats confondus. */
	groupeLibelleAbrege: string | null;
	groupeCouleur: string | null;
	/** 'an' | 'senat' | 'bicameral' — pilote le libellé chambre affiché. */
	categorie: 'an' | 'senat' | 'bicameral';
	/** true si en exercice (au moins un mandat sans date de fin). */
	enExercice: boolean;
}

/**
 * Résultat « groupe » unifié AN + Sénat. Contrairement aux élus, PAS de
 * déduplication : un groupe AN et un groupe Sénat sont des entités distinctes
 * (pages différentes). On les affiche dans une seule section avec un tag de
 * chambre pour distinguer.
 */
export interface SearchGroupeResult {
	key: string;
	href: string;
	chambre: 'AN' | 'SENAT';
	libelle: string;
	libelleAbrege: string;
	couleur: string;
	effectif: number;
	/** Contexte temporel affiché : « 17ᵉ » (AN) ou « 2023-2026 » (Sénat). */
	contexte: string;
}

export interface SearchResults {
	/** Liste UNIFIÉE et dédupliquée AN + Sénat (cf SearchEluResult). */
	elus: SearchEluResult[];
	/** Liste UNIFIÉE AN + Sénat, non dédupliquée (cf SearchGroupeResult). */
	groupes: SearchGroupeResult[];
	textes: TexteUnifie[];
}

const MAX_PER_CATEGORY = {
	// Matching interne AN/Sénat : on en garde plus en amont (6×) car la fusion
	// dédoublonne ensuite ; `elus`/`groupes` sont les plafonds des listes
	// unifiées affichées.
	personnes: 5,
	senateurs: 5,
	elus: 7,
	groupesAN: 4, // matching interne par chambre
	groupesSenat: 4,
	groupes: 5, // plafond de la liste GROUPES unifiée affichée
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

/** Mandat le plus récent d'un Elu (date de début max) — porte le groupe affiché. */
function mandatLePlusRecent(elu: Elu): Elu['mandats'][number] | undefined {
	if (elu.mandats.length === 0) return undefined;
	return [...elu.mandats].sort((a, b) => b.debut.localeCompare(a.debut))[0];
}

/** Projette un Elu du manifest en résultat de recherche affichable. */
function toEluResult(elu: Elu): SearchEluResult {
	const dernier = mandatLePlusRecent(elu);
	return {
		eluId: elu.id,
		href: eluUrlCarriere(elu.id),
		prenom: elu.prenom,
		nom: elu.nom,
		photoUrl: elu.photoUrl,
		groupeLibelleAbrege: dernier?.groupeLibelleAbrege ?? null,
		groupeCouleur: dernier?.groupeCouleur ?? null,
		categorie: eluCategorie(elu),
		enExercice: elu.mandats.some((m) => m.fin === null)
	};
}

/**
 * Fusionne les résultats AN (`personnes`) et Sénat (`senateurs`) en UNE liste
 * d'élus dédupliquée par `eluId` (cf ADR 0031). L'ordre d'apparition (=
 * pertinence) des deux listes sources est préservé via un merge entrelacé :
 * on parcourt alternativement les deux files, en sautant les eluId déjà vus —
 * ainsi un bicaméral bien classé d'un côté ne se retrouve pas relégué.
 *
 * Si le manifest `elus.json` n'est pas (encore) chargé, `lookupElu*` renvoie
 * `null` : on tombe en mode dégradé (l'entrée est ignorée). En pratique le
 * layout charge le manifest avant toute recherche.
 */
function fusionnerElus(
	personnes: Personne[],
	senateurs: Senateur[],
	max: number
): SearchEluResult[] {
	const out: SearchEluResult[] = [];
	const vus = new Set<string>();
	const push = (elu: Elu | null) => {
		if (!elu || vus.has(elu.id)) return;
		vus.add(elu.id);
		out.push(toEluResult(elu));
	};
	const n = Math.max(personnes.length, senateurs.length);
	for (let i = 0; i < n && out.length < max; i++) {
		// Personne.id = PA-id (ex. "PA1592") ; Senateur.id = matricule (ADR 0024).
		if (i < personnes.length) push(lookupEluByPaId(personnes[i].id));
		if (out.length >= max) break;
		if (i < senateurs.length) push(lookupEluByMatricule(senateurs[i].id));
	}
	return out.slice(0, max);
}

/** Projette un groupe AN en résultat de recherche unifié. */
function groupeANToResult(g: Groupe): SearchGroupeResult {
	return {
		key: `an:${g.legislature}:${g.id}`,
		href: `/assemblee/groupes/${g.legislature}/${g.id}/`,
		chambre: 'AN',
		libelle: g.libelle,
		libelleAbrege: g.libelleAbrege,
		couleur: g.couleur,
		effectif: g.effectifFin,
		contexte: `${g.legislature}ᵉ`
	};
}

/** Projette un groupe Sénat en résultat de recherche unifié. */
function groupeSenatToResult(g: GroupeSenat): SearchGroupeResult {
	return {
		key: `senat:${g.triennat}:${g.code}`,
		href: `/senat/triennats/${g.triennat}/`,
		chambre: 'SENAT',
		libelle: g.libelle,
		libelleAbrege: g.libelleAbrege,
		couleur: g.couleur,
		effectif: g.effectifFin,
		contexte: g.triennat
	};
}

/**
 * Fusionne les groupes AN et Sénat en UNE liste affichée, SANS déduplication
 * (entités distinctes, pages distinctes) — juste un merge entrelacé qui
 * préserve la pertinence de chaque source, plafonné à `max`. Le tag de chambre
 * (porté par `chambre`) distingue visuellement les deux.
 */
function fusionnerGroupes(
	groupesAN: Groupe[],
	groupesSenat: GroupeSenat[],
	max: number
): SearchGroupeResult[] {
	const out: SearchGroupeResult[] = [];
	const n = Math.max(groupesAN.length, groupesSenat.length);
	for (let i = 0; i < n && out.length < max; i++) {
		if (i < groupesAN.length) out.push(groupeANToResult(groupesAN[i]));
		if (out.length >= max) break;
		if (i < groupesSenat.length) out.push(groupeSenatToResult(groupesSenat[i]));
	}
	return out.slice(0, max);
}

export function searchAll(index: SearchIndex, query: string): SearchResults {
	const q = normalize(query.trim());
	if (!q) return { elus: [], groupes: [], textes: [] };

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

	// ─── Fusions cross-chambre (ADR 0031) ─────────────────────────────
	// Élus : entrelace + dédoublonne par eluId (un bicaméral = 1 entrée).
	// Groupes : entrelace SANS dédup (entités/pages distinctes), tag chambre.
	// On passe les listes matchées complètes (déjà triées par pertinence).
	const elus = fusionnerElus(matchedPersonnes, matchedSenateurs, MAX_PER_CATEGORY.elus);
	const groupes = fusionnerGroupes(matchedGroupes, matchedGroupesSenat, MAX_PER_CATEGORY.groupes);

	return {
		elus,
		groupes,
		textes: matchedTextes
	};
}
