/**
 * Extraction de la timeline navette depuis l'arbre `actesLegislatifs` du
 * dump dossiers AN (cf ADR 0037).
 *
 * L'arbre Etalab a une structure récursive : chaque acte peut contenir
 * d'autres actes via `actesLegislatifs.acteLegislatif`. On filtre les codes
 * "remarquables" (vrais événements de navette publics) et on ignore le
 * bruit administratif (saisines de commission, nominations rapporteur, etc.).
 *
 * Codes retenus (30 sur les 167 présents dans le dump) :
 *  - Dépôts : AN1-DEPOT, SN1-DEPOT
 *  - Votes en séance : AN1/AN2/SN1/SN2/ANLUNI/ANNLEC/ANLDEF-DEBATS-DEC
 *  - CMP : CMP-DEPOT, CMP-DEC, CMP-DEBATS-AN/SN-DEC
 *  - Conseil Constitutionnel : CC-SAISIE-*, CC-CONCLUSION
 *  - Promulgation : PROM-PUB
 *  - 49.3 : *-DGVT (déclaration de vote du gouvernement)
 *  - Motion de censure : *-MOTION-VOTE
 *  - Retrait : *-RTRINI
 */

import type {
	TimelineActe,
	TimelinePhase,
	TimelineChambre
} from '../../src/lib/types.ts';

// ────────────────────────────────────────────────────────────────────────────
// Types d'entrée — arbre Etalab brut
// ────────────────────────────────────────────────────────────────────────────

/** Un noeud d'arbre `actesLegislatifs.acteLegislatif`. */
export interface ActeRaw {
	codeActe?: string | null;
	dateActe?: string | null;
	actesLegislatifs?: { acteLegislatif?: ActeRaw | ActeRaw[] | undefined } | undefined;
	[k: string]: unknown;
}

/** Sous-ensemble d'un ScrutinIndex utilisé pour le croisement timeline. */
export interface ScrutinSolennelIndex {
	uid: string;
	date: string; // YYYY-MM-DD
	typeVote: string;
	titre: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Filtre des codes remarquables
// ────────────────────────────────────────────────────────────────────────────

/** Préfixes de chambre/instance qui peuvent porter un acte remarquable. */
const PREFIX_LECTURE_AN = new Set(['AN1', 'AN2', 'AN3', 'ANLUNI', 'ANNLEC', 'ANLDEF', 'AN21']);
const PREFIX_LECTURE_SN = new Set(['SN1', 'SN2', 'SN3']);

/** Suffixes qui constituent un événement remarquable au sein d'une lecture.
 *  On ne retient que les actes "résultat" (DEC = décision/vote final), pas les
 *  séances intermédiaires (DEBATS-SEANCE = chaque séance, trop bruyant). */
const SUFFIX_REMARQUABLE = new Set([
	'DEPOT',
	'DEBATS-DEC',
	'RTRINI', // retiré par initiateur
	'MOTION-VOTE',
	'DGVT' // déclaration de vote du gouvernement = 49.3
]);

/** Codes CMP / CC / PROM retenus en intégralité. */
const CODES_FIXES_REMARQUABLES = new Set([
	'CMP-DEPOT',
	'CMP-DEC',
	'CMP-DEBATS-AN-DEC',
	'CMP-DEBATS-SN-DEC',
	'CC-SAISIE-AN',
	'CC-SAISIE-SN',
	'CC-SAISIE-PR',
	'CC-SAISIE-PM',
	'CC-CONCLUSION',
	'PROM-PUB'
]);

/** Détermine si un code d'acte doit apparaître dans la timeline UI. */
export function isCodeRemarquable(code: string | null | undefined): boolean {
	if (!code) return false;
	if (CODES_FIXES_REMARQUABLES.has(code)) return true;
	// AN/SN + suffixe remarquable
	const m = code.match(/^([A-Z]+\d*[A-Z]*)-(.+)$/);
	if (!m) return false;
	const prefix = m[1];
	const suffix = m[2];
	if (PREFIX_LECTURE_AN.has(prefix) || PREFIX_LECTURE_SN.has(prefix)) {
		return SUFFIX_REMARQUABLE.has(suffix);
	}
	return false;
}

// ────────────────────────────────────────────────────────────────────────────
// Mapping code → chambre / phase / label
// ────────────────────────────────────────────────────────────────────────────

export function codeToChambre(code: string): TimelineChambre {
	if (code === 'PROM-PUB') return 'JO';
	if (code.startsWith('CC-')) return 'CC';
	if (code === 'CMP-DEBATS-AN-DEC') return 'AN';
	if (code === 'CMP-DEBATS-SN-DEC') return 'SEN';
	if (code.startsWith('CMP-')) return 'CMP';
	const m = code.match(/^([A-Z]+\d*[A-Z]*)-/);
	if (!m) return 'AN';
	const prefix = m[1];
	if (PREFIX_LECTURE_AN.has(prefix)) return 'AN';
	if (PREFIX_LECTURE_SN.has(prefix)) return 'SEN';
	return 'AN';
}

export function codeToPhase(code: string): TimelinePhase {
	if (code === 'PROM-PUB') return 'promulgation';
	if (code.startsWith('CC-')) return 'conseil-constitutionnel';
	if (code.startsWith('CMP-')) return 'cmp';
	if (code.endsWith('-DEPOT')) return 'depot';
	if (code.endsWith('-RTRINI')) return 'retrait';
	if (code.endsWith('-DGVT')) return 'engagement-responsabilite';
	if (code.endsWith('-MOTION-VOTE')) return 'motion-censure';
	if (code.startsWith('AN1-') || code.startsWith('SN1-')) return 'premiere-lecture';
	if (code.startsWith('AN2-') || code.startsWith('SN2-')) return 'deuxieme-lecture';
	if (code.startsWith('AN3-') || code.startsWith('SN3-')) return 'deuxieme-lecture';
	if (code.startsWith('ANLUNI-')) return 'lecture-unique';
	if (code.startsWith('ANNLEC-')) return 'nouvelle-lecture';
	if (code.startsWith('ANLDEF-')) return 'lecture-definitive';
	if (code.startsWith('AN21-')) return 'engagement-responsabilite';
	return 'autre';
}

export function codeToLabel(code: string): string {
	// Codes fixes
	if (code === 'PROM-PUB') return 'Promulgation au JO';
	if (code === 'CC-SAISIE-AN') return 'Saisine du Conseil constitutionnel (AN)';
	if (code === 'CC-SAISIE-SN') return 'Saisine du Conseil constitutionnel (Sénat)';
	if (code === 'CC-SAISIE-PR') return 'Saisine du Conseil constitutionnel (Président)';
	if (code === 'CC-SAISIE-PM') return 'Saisine du Conseil constitutionnel (Premier ministre)';
	if (code === 'CC-CONCLUSION') return 'Décision du Conseil constitutionnel';
	if (code === 'CMP-DEPOT') return 'Réunion de la Commission Mixte Paritaire';
	if (code === 'CMP-DEC') return 'Conclusion de la CMP';
	if (code === 'CMP-DEBATS-AN-DEC') return 'Vote sur texte CMP (AN)';
	if (code === 'CMP-DEBATS-SN-DEC') return 'Vote sur texte CMP (Sénat)';
	// Dépôts
	if (code === 'AN1-DEPOT') return "Dépôt à l'Assemblée nationale";
	if (code === 'SN1-DEPOT') return 'Dépôt au Sénat';
	// Votes en séance
	if (code === 'AN1-DEBATS-DEC') return "1ʳᵉ lecture à l'Assemblée nationale";
	if (code === 'SN1-DEBATS-DEC') return '1ʳᵉ lecture au Sénat';
	if (code === 'AN2-DEBATS-DEC') return "2ᵉ lecture à l'Assemblée nationale";
	if (code === 'SN2-DEBATS-DEC') return '2ᵉ lecture au Sénat';
	if (code === 'AN3-DEBATS-DEC') return "3ᵉ lecture à l'Assemblée nationale";
	if (code === 'SN3-DEBATS-DEC') return '3ᵉ lecture au Sénat';
	if (code === 'ANLUNI-DEBATS-DEC') return "Lecture unique à l'Assemblée nationale";
	if (code === 'ANNLEC-DEBATS-SEANCE') return "Nouvelle lecture à l'Assemblée nationale";
	if (code === 'ANNLEC-DEBATS-DEC') return "Nouvelle lecture à l'Assemblée nationale";
	if (code === 'ANLDEF-DEBATS-DEC') return "Lecture définitive à l'Assemblée nationale";
	// 49.3
	if (code.endsWith('-DGVT')) return 'Engagement de responsabilité (49.3)';
	// Motion de censure
	if (code.endsWith('-MOTION-VOTE')) return 'Vote sur motion de censure';
	// Retrait
	if (code.endsWith('-RTRINI')) return 'Retiré par les auteurs';
	return code;
}

// ────────────────────────────────────────────────────────────────────────────
// Parsing récursif
// ────────────────────────────────────────────────────────────────────────────

/** Convertit un timestamp Etalab `2025-01-08T00:00:00.000+01:00` ou
 *  `2025-01-08 00:00:00` → `YYYY-MM-DD`. Retourne null si invalide. */
function dateOnly(s: string | null | undefined): string | null {
	if (!s) return null;
	const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
	return m ? m[1] : null;
}

/** Normalise `actesLegislatifs` qui peut être tableau, objet seul, ou undefined. */
function asArray<T>(x: T | T[] | undefined | null): T[] {
	if (x == null) return [];
	return Array.isArray(x) ? x : [x];
}

/** Walk récursif de l'arbre, accumule les actes remarquables. */
function walkActes(acte: ActeRaw, acc: TimelineActe[]): void {
	const code = acte.codeActe;
	const date = dateOnly(acte.dateActe);
	if (code && date && isCodeRemarquable(code)) {
		acc.push({
			date,
			code,
			chambre: codeToChambre(code),
			phase: codeToPhase(code),
			label: codeToLabel(code),
			scrutinUid: null,
			scrutinChambre: null
		});
	}
	// Récurser dans les enfants
	const children = asArray(acte.actesLegislatifs?.acteLegislatif);
	for (const c of children) walkActes(c, acc);
}

/** Extrait la timeline navette depuis le noeud racine `actesLegislatifs.acteLegislatif`
 *  d'un dossier. Accepte un objet seul, un tableau, ou `{acteLegislatif: ...}`.
 *  Retourne la liste triée chronologiquement (tri stable). */
export function extractTimelineNavette(
	root: ActeRaw | ActeRaw[] | { acteLegislatif?: ActeRaw | ActeRaw[] } | undefined | null
): TimelineActe[] {
	const acc: TimelineActe[] = [];
	if (root == null) return acc;
	// Forme { acteLegislatif: ... }
	let racine: ActeRaw[];
	if (Array.isArray(root)) {
		racine = root;
	} else if (typeof root === 'object' && 'acteLegislatif' in root) {
		racine = asArray((root as { acteLegislatif?: ActeRaw | ActeRaw[] }).acteLegislatif);
	} else {
		racine = [root as ActeRaw];
	}
	for (const a of racine) walkActes(a, acc);
	// Tri chronologique stable (préserve l'ordre source quand date identique)
	const indexed = acc.map((t, i) => ({ t, i }));
	indexed.sort((a, b) => {
		if (a.t.date !== b.t.date) return a.t.date < b.t.date ? -1 : 1;
		return a.i - b.i;
	});
	return indexed.map((x) => x.t);
}

// ────────────────────────────────────────────────────────────────────────────
// Détection bicaméralité
// ────────────────────────────────────────────────────────────────────────────

/** True si la timeline contient au moins un acte à la chambre Sénat
 *  (incluant les CMP-DEBATS-SN-DEC qui portent chambre = SEN). */
export function hasSenatActe(timeline: TimelineActe[]): boolean {
	return timeline.some((t) => t.chambre === 'SEN');
}

// ────────────────────────────────────────────────────────────────────────────
// Croisement avec scrutins nominaux
// ────────────────────────────────────────────────────────────────────────────

/** Cherche le scrutin solennel correspondant à un acte de timeline.
 *  Filtre par date stricte (égalité) ET appartenance au texte (`scrutinsDuTexte`).
 *  Si plusieurs candidats, retourne le premier (cas rare). */
export function resolveScrutinUid(
	acte: TimelineActe,
	scrutinsAN: ScrutinSolennelIndex[],
	scrutinsSEN: ScrutinSolennelIndex[],
	scrutinsDuTexte: Set<string>
): string | null {
	// Seuls les actes "vote" peuvent matcher un scrutin :
	//  - *-DEBATS-DEC (votes en séance des lectures AN/SN)
	//  - *-DEBATS-SEANCE (cas ANNLEC nouvelle lecture)
	//  - CMP-DEBATS-AN-DEC / CMP-DEBATS-SN-DEC (votes sur texte CMP)
	//  - *-MOTION-VOTE (motions de censure)
	if (
		!acte.code.endsWith('-DEC') &&
		!acte.code.endsWith('-SEANCE') &&
		!acte.code.endsWith('-MOTION-VOTE')
	) {
		return null;
	}
	const pool = acte.chambre === 'SEN' ? scrutinsSEN : scrutinsAN;
	// On cherche un scrutin solennel à la même date qui appartient au texte
	for (const s of pool) {
		if (s.date !== acte.date) continue;
		if (!scrutinsDuTexte.has(s.uid)) continue;
		return s.uid;
	}
	return null;
}
