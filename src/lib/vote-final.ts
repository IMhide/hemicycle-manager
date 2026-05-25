/**
 * Détection du "vote final" d'un texte législatif AN.
 *
 * Un texte est soumis à des dizaines de scrutins (amendements, articles,
 * sous-amendements, motions de procédure…). Mais un seul scellera son sort :
 * le vote AN qui acte l'adoption ou le rejet. C'est cette information qu'on
 * veut mettre en avant dans la vue "Par texte" de la fiche élu.
 *
 * Stratégie : on prend le dernier acte AN de type "vote sur l'ensemble"
 * dans la timeline navette (cf ADR 0037), en cascade de priorité :
 *
 *   1. ANLDEF-DEBATS-DEC      → lecture définitive AN (mot final si CMP échouée)
 *   2. CMP-DEBATS-AN-DEC      → vote AN sur le texte CMP (cas accord CMP)
 *   3. ANNLEC-DEBATS-DEC      → nouvelle lecture AN
 *   4. ANLUNI-DEBATS-DEC      → lecture unique AN
 *   5. AN3-DEBATS-DEC         → 3ᵉ lecture AN
 *   6. AN2-DEBATS-DEC         → 2ᵉ lecture AN
 *   7. AN1-DEBATS-DEC         → 1ʳᵉ lecture AN (cas projet bloqué en navette)
 *
 * On retourne le scrutinUid attaché à l'acte. Si l'acte n'a pas de scrutin
 * nominal (vote à main levée), on retourne null — le texte est sans
 * "vote final identifiable" côté UI.
 */

import type { TimelineActe, ScrutinIndex } from './types.ts';

/** Codes d'actes AN éligibles comme "vote final", du plus prioritaire au moins. */
const FINAL_CODES_AN_PRIO = [
	'ANLDEF-DEBATS-DEC',
	'CMP-DEBATS-AN-DEC',
	'ANNLEC-DEBATS-DEC',
	'ANLUNI-DEBATS-DEC',
	'AN3-DEBATS-DEC',
	'AN2-DEBATS-DEC',
	'AN1-DEBATS-DEC'
];

/** Retourne l'acte timeline qui correspond au "vote final" du texte côté AN,
 *  ou null si la timeline ne contient aucun vote AN sur l'ensemble.
 *
 *  Pour donner un *vote utilisable* à l'UI, on parcourt la cascade en deux
 *  passes : d'abord on cherche un acte prioritaire qui a un `scrutinUid` (vote
 *  nominal exploitable) ; à défaut, on retombe sur l'acte prioritaire même s'il
 *  est sans scrutin (vote à main levée). Sans cette double passe, un texte
 *  avec `CMP-DEBATS-AN-DEC` à main levée masquerait son `AN1-DEBATS-DEC`
 *  pourtant scrutin nominal — alors qu'il est strictement plus informatif. */
export function findActeFinal(timeline: TimelineActe[]): TimelineActe | null {
	// 1ʳᵉ passe : acte prioritaire avec scrutinUid
	for (const code of FINAL_CODES_AN_PRIO) {
		const found = timeline.find((a) => a.code === code && a.scrutinUid);
		if (found) return found;
	}
	// 2ᵉ passe : acte prioritaire même sans scrutinUid
	for (const code of FINAL_CODES_AN_PRIO) {
		const found = timeline.find((a) => a.code === code);
		if (found) return found;
	}
	return null;
}

/** Retourne l'uid du scrutin nominal correspondant au vote final, ou null
 *  si pas d'acte final OU si l'acte final n'a pas de scrutin nominal résolu
 *  (vote à main levée, ou pas de match dans le pool des scrutins du texte). */
export function findScrutinFinalUid(timeline: TimelineActe[]): string | null {
	const acte = findActeFinal(timeline);
	return acte?.scrutinUid ?? null;
}

/** Détecte un scrutin "vote sur l'ensemble" via son titre — fallback quand
 *  la timeline navette est vide (texte non enrichi par le dump dossiers AN).
 *
 *  Les votes solennels AN portent typiquement un titre du type :
 *   - "l'ensemble du projet de loi …"
 *   - "l'ensemble de la proposition de loi …"
 *   - "l'ensemble du projet de loi organique …"
 *
 *  Convention Etalab très stable, suffisamment fiable pour servir de fallback. */
export function isTitreVoteSurEnsemble(titre: string): boolean {
	// Apostrophes droites (') ET typographiques (') doivent matcher
	const re = /l['’]ensemble\s+(du|de la|des)\s+(projet|proposition)/i;
	return re.test(titre);
}

/** Cherche le scrutin "vote sur l'ensemble" le plus récent parmi une liste de
 *  scrutins (typiquement ceux d'un texte). Retourne null si aucun match. */
export function findScrutinSurEnsemble(scrutins: ScrutinIndex[]): ScrutinIndex | null {
	const matches = scrutins.filter((s) => isTitreVoteSurEnsemble(s.titre));
	if (matches.length === 0) return null;
	matches.sort((a, b) => b.date.localeCompare(a.date));
	return matches[0];
}

/** Détermine le scrutin "vote final" pour un texte, avec cascade :
 *   1. Timeline navette (méthode primaire, ADR 0037)
 *   2. Détection par titre "l'ensemble du projet/proposition" (fallback)
 *  Retourne null si aucun des deux ne donne de résultat exploitable. */
export function findScrutinFinalUidForTexte(
	timeline: TimelineActe[],
	scrutinsDuTexte: ScrutinIndex[]
): string | null {
	const uidTimeline = findScrutinFinalUid(timeline);
	if (uidTimeline) return uidTimeline;
	const fallback = findScrutinSurEnsemble(scrutinsDuTexte);
	return fallback?.uid ?? null;
}
