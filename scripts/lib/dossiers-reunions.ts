/**
 * Extraction des `reunionRef` (références de séance/réunion) à partir de
 * l'arbre `actesLegislatifs` d'un dossier législatif Etalab.
 *
 * Méthode inspirée de Poligraph : on construit un index
 * `reunionRef → Set<dossierUid>`, puis pour chaque scrutin on lit son
 * `seanceRef` et on retrouve le ou les dossiers candidats.
 *
 * Mesure sur la 17ᵉ législature (6 530 scrutins) :
 *  - 59,3% des scrutins → 1 dossier candidat (match direct)
 *  - 27,7% → plusieurs dossiers candidats (séance traitant plusieurs textes)
 *  - 13,0% → aucun dossier (typiquement motions de censure hors-dossier
 *    et séances dont le dump dossiers n'a pas encore référencé la
 *    discussion)
 *
 * Cette fonction est volontairement isolée pour permettre des tests unitaires
 * sans dépendance au filesystem.
 */

import { asArray } from './cache.ts';

interface ActeRaw {
	'@xsi:type'?: string;
	reunionRef?: string | null;
	actesLegislatifs?: { acteLegislatif?: ActeRaw | ActeRaw[] };
}

interface ActesLegislatifsRaw {
	acteLegislatif?: ActeRaw | ActeRaw[];
}

/**
 * Walk récursif de l'arbre `actesLegislatifs` d'un dossier pour collecter
 * tous les `reunionRef` (uniques). Les valeurs vides ou null sont ignorées.
 *
 * Le walk est strict : il ne descend QUE dans le champ `actesLegislatifs.acteLegislatif`
 * (et ses tableaux), pas dans tous les champs string. Cela évite les
 * faux positifs sur d'autres champs qui pourraient contenir une chaîne
 * commençant par "RUANR".
 */
export function extractReunionRefs(actes: unknown): Set<string> {
	const out = new Set<string>();
	if (!actes || typeof actes !== 'object') return out;

	function walk(node: unknown) {
		if (!node || typeof node !== 'object') return;
		if (Array.isArray(node)) {
			for (const x of node) walk(x);
			return;
		}
		const acte = node as ActeRaw;
		const ref = acte.reunionRef;
		if (typeof ref === 'string' && ref.length > 0) {
			out.add(ref);
		}
		const children = acte.actesLegislatifs?.acteLegislatif;
		if (children !== undefined) {
			for (const child of asArray(children)) walk(child);
		}
	}

	walk((actes as ActesLegislatifsRaw).acteLegislatif);
	return out;
}
