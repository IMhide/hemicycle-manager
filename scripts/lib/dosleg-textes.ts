/**
 * Extraction des dossiers législatifs Sénat depuis le dump `dosleg.sql`
 * (cf ADR 0025, N3.b navette cross-chambre).
 *
 * Le dump contient une table `loi` qui est la table maîtresse des dossiers
 * législatifs Sénat. Pour chaque ligne, on construit un `DossierSenat`
 * structuré qui sert ensuite de **source d'enrichissement** pour les textes
 * agrégés depuis les scrutins (cf `textes-senat.ts`).
 *
 * Différences avec le pipeline AN :
 *  - Pas de FK structurée entre `scr` (scrutin) et `loi` (dossier). Le matching
 *    se fait par **signature titre** (`scr.scrint` ↔ `loi.loitit`).
 *  - Pas d'arbre d'actes législatifs équivalent à `actesLegislatifs` côté AN ;
 *    la chronologie complète n'est pas reconstructible dans cette première
 *    itération (à creuser éventuellement avec `lecass` + `lecture` plus tard).
 *
 * Mesures sur le dump 2026-05 :
 *  - 12 301 dossiers `loi` au total
 *  - 593 dossiers avec `date_loi >= 2017-09-01` (ère Macron promulguée)
 *  - les dossiers en cours / rejetés / caducs sont à inclure aussi pour le
 *    matching des scrutins (un texte peut avoir été voté sans être promulgué).
 */

import type {
	TexteSenatType,
	TexteSenatEtat
} from '../../src/lib/types.ts';
import { extractTexteSignature, normaliseNomTexte } from './texte-parser.ts';

// ────────────────────────────────────────────────────────────────────────────
// Ligne brute issue de COPY loi … FROM stdin
// ────────────────────────────────────────────────────────────────────────────

/** Sous-ensemble des champs `loi` utilisés par cette lib. Tous string|null
 *  car streamCopyBlocks restitue le décodage PG (avec `\N` → null). */
export interface DossierSenatBrut {
	loicod: string | null;
	typloicod: string | null;
	etaloicod: string | null;
	loitit: string | null;
	loiint: string | null;
	date_loi: string | null;
	loidatjo: string | null;
	loinumjo: string | null;
	url_jo: string | null;
	numero: string | null;
}

/** Dossier Sénat normalisé, prêt à être croisé avec les scrutins. */
export interface DossierSenat {
	loicod: string;
	type: TexteSenatType;
	typeLibelle: string;
	etat: TexteSenatEtat;
	titre: string;
	dateDoss: string | null; // date_loi YYYY-MM-DD (date de promulgation ou de dépôt selon l'état)
	datePromulgation: string | null;
	urlJO: string | null;
	numeroLoi: string | null;
	/** Signature normalisée pour le matching scrutin → dossier
	 *  (typeTexte, nomNormalise). Construite via `extractTexteSignature` sur le
	 *  titre prefixe `proposition de loi visant à …` ou `projet de loi…`. */
	signatureNomNormalise: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Mappings type/état
// ────────────────────────────────────────────────────────────────────────────

const TYPE_LIBELLES: Record<TexteSenatType, string> = {
	pjl: 'Projet de loi',
	pjlo: 'Projet de loi organique',
	pjlc: 'Projet de loi constitutionnelle',
	pjlf: 'Projet de loi de finances',
	pjlr: 'Projet de loi de finances rectificative',
	pjlg: 'Projet de loi de règlement',
	pjfs: 'Projet de loi de financement de la sécurité sociale',
	pfsr: 'Projet de loi de financement de la sécurité sociale rectificative',
	prog: 'Projet de loi de programmation',
	ppl: 'Proposition de loi',
	pplo: 'Proposition de loi organique',
	pplc: 'Proposition de loi constitutionnelle',
	ppro: 'Proposition de loi de programmation',
	refe: "Proposition de loi en application de l'article 11",
	pac: 'Résolution européenne',
	ppre: 'Modification du règlement du Sénat',
	ppra: 'Proposition de résolution autre',
	pprp: "Résolution en application de l'article 34-1",
	enq: "Commission d'enquête",
	cvn: 'Convention',
	mref: 'Motion référendaire',
	dape: 'Déclaration politique générale',
	autre: 'Autre'
};

/** Mappe un `typloicod` brut (4 chars, padding-trimmed) → TexteSenatType.
 *  Retourne `'autre'` pour les codes inconnus afin que le pipeline reste
 *  résilient si Etalab ajoute un nouveau type. */
export function mapTypeLoi(typloicod: string | null): TexteSenatType {
	if (!typloicod) return 'autre';
	const k = typloicod.trim().toLowerCase();
	if (k in TYPE_LIBELLES) return k as TexteSenatType;
	return 'autre';
}

/** Libellé long lisible pour un type donné. */
export function libelleTypeLoi(t: TexteSenatType): string {
	return TYPE_LIBELLES[t];
}

/** Mappe un `etaloicod` (2 chars) → TexteSenatEtat. */
export function mapEtatLoi(etaloicod: string | null): TexteSenatEtat {
	if (!etaloicod) return 'inconnu';
	const k = etaloicod.trim();
	switch (k) {
		case '01':
			return 'en-cours';
		case '02':
			return 'fusionne';
		case '03':
			return 'rejete';
		case '04':
			return 'promulgue';
		case '05':
			return 'caduc';
		case '06':
			return 'retire';
		default:
			return 'inconnu';
	}
}

// ────────────────────────────────────────────────────────────────────────────
// Assemblage DossierSenat
// ────────────────────────────────────────────────────────────────────────────

/** Convertit un timestamp PG `YYYY-MM-DD HH:MM:SS` → `YYYY-MM-DD`. */
function dateOnly(ts: string | null): string | null {
	if (!ts) return null;
	return ts.slice(0, 10);
}

/** Construit un `DossierSenat` depuis une ligne brute `loi`.
 *
 *  - `loicod` est trimmé (champ `character(12)` avec padding spaces)
 *  - `titre` est `loitit` (libellé court) ou `loiint` (libellé long) en fallback,
 *    trimmé pour les `character(N)` avec padding
 *  - `signatureNomNormalise` est obtenue en construisant un titre artificiel
 *    "{typeLibelle} {loitit}" et en passant par `extractTexteSignature`.
 *    Cela garantit que la même fonction normalise les titres dossier et scrutin.
 *  - On essaie le titre tel quel d'abord, sinon avec le préfixe inféré du type
 *    (ex. `proposition de loi visant à X` quand le dump donne juste `visant à X`).
 */
export function buildDossierSenatFromRow(row: DossierSenatBrut): DossierSenat {
	const type = mapTypeLoi(row.typloicod);
	const etat = mapEtatLoi(row.etaloicod);
	const titreBrut = (row.loitit && row.loitit.trim()) || (row.loiint && row.loiint.trim()) || '';
	const signatureNomNormalise = computeDossierSignature(titreBrut, type);
	return {
		loicod: (row.loicod ?? '').trim(),
		type,
		typeLibelle: libelleTypeLoi(type),
		etat,
		titre: titreBrut.trim(),
		dateDoss: dateOnly(row.date_loi),
		datePromulgation: dateOnly(row.loidatjo),
		urlJO: row.url_jo,
		numeroLoi: row.loinumjo?.trim() || row.numero?.trim() || null,
		signatureNomNormalise
	};
}

/** Calcule la signature normalisée d'un dossier Sénat pour matching avec les
 *  scrutins. Le titre `loitit` est souvent fourni sous la forme `visant à …`
 *  ou `relative à …` sans préfixe `proposition de loi` (qui vient du type).
 *  On reconstruit un titre canonique pour le passer dans `extractTexteSignature`. */
function computeDossierSignature(titre: string, type: TexteSenatType): string {
	if (!titre) return '';
	// Le titre dossier seul peut ne pas matcher TYPE_TEXTE_PATTERN. On reconstruit
	// un titre canonique en préfixant le libellé du type.
	const typeText = TYPE_TYPETEXT[type];
	if (!typeText) {
		// Cas d'un type sans projection texte (motion, convention, …)
		// On normalise directement le titre brut.
		return normaliseNomTexte(titre);
	}
	const canonical = `${typeText} ${titre}`;
	const sig = extractTexteSignature(canonical);
	if (sig) return sig.nomNormalise;
	// Fallback : normalisation directe du titre brut
	return normaliseNomTexte(titre);
}

/** Prefix textuel canonique à injecter devant le `loitit` Sénat pour permettre
 *  à `extractTexteSignature` de matcher (le parser AN attend une occurrence
 *  de "projet de loi" / "proposition de loi" / etc. dans la chaîne). */
const TYPE_TYPETEXT: Partial<Record<TexteSenatType, string>> = {
	pjl: 'projet de loi',
	pjlo: 'projet de loi organique',
	pjlc: 'projet de loi constitutionnelle',
	pjlf: 'projet de loi de finances',
	pjlr: 'projet de loi de finances rectificative',
	pjlg: 'projet de loi de règlement',
	pjfs: 'projet de loi de financement de la sécurité sociale',
	pfsr: 'projet de loi de financement de la sécurité sociale rectificative',
	prog: 'projet de loi de programmation',
	ppl: 'proposition de loi',
	pplo: 'proposition de loi organique',
	pplc: 'proposition de loi constitutionnelle',
	ppro: 'proposition de loi de programmation',
	refe: 'proposition de loi',
	pac: 'proposition de résolution européenne',
	ppre: 'proposition de résolution',
	ppra: 'proposition de résolution',
	pprp: 'proposition de résolution'
};
