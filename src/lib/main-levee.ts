/**
 * Déduction du suffixe "main levée" pour un acte de timeline navette
 * sans scrutin nominal.
 *
 * Quand l'AN ou le Sénat vote en séance sans scrutin public, Etalab
 * marque malgré tout l'acte de vote dans `actesLegislatifs`. Sans info
 * de sort explicite, on déduit "adopté à main levée" si la navette
 * a continué (un acte ultérieur existe ou le texte est promulgué).
 * Les motions de censure restent neutres ("à main levée") car leur
 * sort dépend du seuil 289 et non de la continuation de la navette.
 */

import type { TimelineActe } from './types.ts';

/** True quand le code d'acte porte un vote (et non un dépôt, saisine, etc.). */
export function isVoteActe(a: Pick<TimelineActe, 'code'>): boolean {
	return (
		a.code.endsWith('-DEBATS-DEC') ||
		a.code === 'CMP-DEBATS-AN-DEC' ||
		a.code === 'CMP-DEBATS-SN-DEC' ||
		a.code.endsWith('-MOTION-VOTE')
	);
}

/** Retourne le suffixe à afficher sous la date, ou '' si non applicable.
 *  Préconditions : la timeline est triée chronologiquement (cf
 *  `extractTimelineNavette`). */
export function mainLeveeSuffix(
	acte: TimelineActe,
	idx: number,
	timeline: TimelineActe[],
	datePromulgation: string | null
): string {
	if (acte.scrutinUid) return '';
	if (!isVoteActe(acte)) return '';
	if (acte.code.endsWith('-MOTION-VOTE')) return 'à main levée';
	const navetteAContinue =
		!!datePromulgation ||
		timeline.some((other, j) => j > idx && other.date >= acte.date);
	return navetteAContinue ? 'adopté à main levée' : 'à main levée';
}
