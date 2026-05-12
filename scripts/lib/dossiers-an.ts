/**
 * Parser pour le dump `Dossiers_Legislatifs.json.zip` d'Etalab AN.
 *
 * Le dump contient ~2 500 dossiers parlementaires : projets de loi, propositions
 * de loi, résolutions, missions de contrôle, commissions d'enquête, …
 * On en retient uniquement les types qui peuvent agréger des scrutins
 * (lois et résolutions AN), filtrés par législature.
 *
 * Pour chaque dossier on extrait :
 *  - identité : uid (DLR…), titre officiel, legislature, type
 *  - procédure : code normalisé (projet de loi, proposition, PLF, …)
 *  - initiateurs : PA-ids des députés à l'origine du dépôt
 *  - timeline : dates clés (dépôt, procédure accélérée, promulgation)
 *
 * Sortie : `static/data/dossiers-an.json` (compact, ~1-2 MB).
 *
 * NB : Le dump ne référence pas les scrutins amendement/article. On rattache
 * les scrutins via le parser de titres (cf `texte-parser.ts`), ce dump sert
 * uniquement à enrichir les métadonnées (titre propre, statut, dates).
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { asArray } from './cache.ts';

// ────────────────────────────────────────────────────────────────────────────
// Types publics
// ────────────────────────────────────────────────────────────────────────────

/** Code procédure parlementaire (extrait de `procedureParlementaire.code`).
 *
 * Mapping vérifié sur le dump Etalab 17ᵉ (mai 2026). Les codes Etalab ne sont
 * PAS séquentiels — ils sautent (1-7 puis 16, 21, 23) et les codes 5 et 7
 * mélangent "Projet ou proposition" (organique/constitutionnelle).
 *
 * On ne distingue pas Projet vs Proposition pour organique et constitutionnelle
 * faute de granularité Etalab (cf libellés). Quand on a besoin de cette
 * distinction, le titre du dossier (commence par "Projet" ou "Proposition") fait foi. */
export type CodeProcedure =
	| 'projet-loi-ordinaire' // 1
	| 'proposition-loi-ordinaire' // 2
	| 'projet-loi-finances' // 3 — PLF de l'année
	| 'projet-loi-finances-rectificative' // 21
	| 'projet-loi-financement-ss' // 4 — PLFSS
	| 'loi-organique' // 5
	| 'ratification-traite-convention' // 6
	| 'loi-constitutionnelle' // 7
	| 'petition' // 16
	| 'proposition-loi-article-11' // 23 — référendum d'initiative partagée
	| 'autre';

export interface DossierAN {
	/** UID Etalab du dossier (ex. "DLR5L17N53284"). */
	id: string;
	legislature: number;
	/** Titre officiel issu de `titreDossier.titre`. */
	titre: string;
	/** Slug court côté AN (utilisé dans les URLs assemblee-nationale.fr). */
	titreChemin: string | null;
	/** URL côté Sénat si le texte y a été examiné (cf navette). */
	senatUrl: string | null;
	procedure: {
		code: CodeProcedure;
		/** Libellé brut Etalab, conservé pour affichage. */
		libelle: string;
	};
	/** PA-ids des députés initiateurs du dépôt (peut être vide pour les projets gouvernementaux). */
	initiateurs: string[];
	timeline: DossierTimeline;
	/** Type XSI brut Etalab — utile pour filtrer ou afficher différemment. */
	type: string;
}

export interface DossierTimeline {
	/** Date du 1er dépôt AN (codeActe `AN1-DEPOT`). */
	dateDepotAN: string | null;
	/** Date du déclenchement de la procédure accélérée (codeActe `AN1-PROCACC`). */
	dateProcedureAccelere: string | null;
	/** Date de promulgation au JO (acte `Promulgation_Type`). */
	datePromulgation: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Mapping procédures Etalab
// ────────────────────────────────────────────────────────────────────────────

/**
 * Table de correspondance des codes procédure Etalab → enum interne.
 *
 * ⚠️ Codes Etalab non séquentiels et "Projet ou proposition" indifférencié
 * pour 5 et 7 (cf libellés observés sur le dump 17ᵉ mai 2026).
 * Codes inconnus → 'autre'.
 */
const PROCEDURE_CODE_MAP = new Map<string, CodeProcedure>([
	['1', 'projet-loi-ordinaire'],
	['2', 'proposition-loi-ordinaire'],
	['3', 'projet-loi-finances'],
	['4', 'projet-loi-financement-ss'],
	['5', 'loi-organique'],
	['6', 'ratification-traite-convention'],
	['7', 'loi-constitutionnelle'],
	['16', 'petition'],
	['21', 'projet-loi-finances-rectificative'],
	['23', 'proposition-loi-article-11']
]);

export function normaliseProcedureCode(code: string | null | undefined): CodeProcedure {
	if (!code) return 'autre';
	return PROCEDURE_CODE_MAP.get(code) ?? 'autre';
}

// ────────────────────────────────────────────────────────────────────────────
// Extraction initiateurs
// ────────────────────────────────────────────────────────────────────────────

interface InitiateurRaw {
	acteurs?: {
		acteur?: { acteurRef?: string } | Array<{ acteurRef?: string }>;
	};
}

export function extractInitiateurs(initiateur: unknown): string[] {
	if (!initiateur || typeof initiateur !== 'object') return [];
	const i = initiateur as InitiateurRaw;
	const acteurs = asArray(i.acteurs?.acteur);
	return acteurs.map((a) => a.acteurRef ?? '').filter((s) => s.length > 0);
}

// ────────────────────────────────────────────────────────────────────────────
// Extraction timeline
// ────────────────────────────────────────────────────────────────────────────

/** Tronque une date ISO Etalab à `YYYY-MM-DD`. */
function dateOnly(d: string | null | undefined): string | null {
	if (!d) return null;
	return d.slice(0, 10);
}

interface ActeRaw {
	'@xsi:type'?: string;
	codeActe?: string;
	dateActe?: string;
	actesLegislatifs?: { acteLegislatif?: ActeRaw | ActeRaw[] };
}

interface ActesLegislatifsRaw {
	acteLegislatif?: ActeRaw | ActeRaw[];
}

/**
 * Parcours récursif des actes pour extraire les dates clés.
 *
 * Le dump Etalab nest les actes sur 15+ niveaux (Etape → DepotInitiative → …).
 * On fait un walk simple et on garde la PREMIÈRE date trouvée pour chaque
 * type d'acte d'intérêt (DepotInitiative, ProcedureAccelere, Promulgation).
 */
export function extractTimeline(actes: unknown): DossierTimeline {
	const tl: DossierTimeline = {
		dateDepotAN: null,
		dateProcedureAccelere: null,
		datePromulgation: null
	};
	if (!actes || typeof actes !== 'object') return tl;

	function walk(node: unknown) {
		if (!node || typeof node !== 'object') return;
		if (Array.isArray(node)) {
			for (const x of node) walk(x);
			return;
		}
		const acte = node as ActeRaw;
		const t = acte['@xsi:type'];
		const code = acte.codeActe;
		const d = dateOnly(acte.dateActe);
		if (d) {
			if (t === 'DepotInitiative_Type' && code === 'AN1-DEPOT' && !tl.dateDepotAN) {
				tl.dateDepotAN = d;
			}
			if (t === 'ProcedureAccelere_Type' && !tl.dateProcedureAccelere) {
				tl.dateProcedureAccelere = d;
			}
			if (t === 'Promulgation_Type' && !tl.datePromulgation) {
				tl.datePromulgation = d;
			}
		}
		walk(acte.actesLegislatifs?.acteLegislatif);
	}

	walk((actes as ActesLegislatifsRaw).acteLegislatif);
	return tl;
}

// ────────────────────────────────────────────────────────────────────────────
// Filtre legis + type
// ────────────────────────────────────────────────────────────────────────────

/** Types XSI qu'on conserve (textes pouvant agréger des scrutins).
 *
 * NB : `DossierResolutionAN` n'a pas le suffixe `_Type` contrairement aux
 * autres (incohérence Etalab observée sur le dump 17ᵉ mai 2026). */
const KEPT_TYPES = new Set(['DossierLegislatif_Type', 'DossierResolutionAN']);

export function shouldKeepDossier(
	dossier: { legislature?: string; '@xsi:type'?: string },
	allowedLegislatures: Set<number>
): boolean {
	const t = dossier['@xsi:type'];
	if (!t || !KEPT_TYPES.has(t)) return false;
	const leg = parseInt(dossier.legislature ?? '', 10);
	if (!Number.isFinite(leg)) return false;
	return allowedLegislatures.has(leg);
}

// ────────────────────────────────────────────────────────────────────────────
// Pipeline complet : parse tous les fichiers du dump
// ────────────────────────────────────────────────────────────────────────────

interface DossierRaw {
	'@xsi:type'?: string;
	uid?: string;
	legislature?: string;
	titreDossier?: { titre?: string; titreChemin?: string | null; senatChemin?: string | null };
	procedureParlementaire?: { code?: string; libelle?: string };
	initiateur?: unknown;
	actesLegislatifs?: unknown;
}

/**
 * Parse tous les fichiers `*.json` du dossier d'extraction `dump/json/dossierParlementaire/`,
 * filtre par législatures et retourne la liste des dossiers conservés.
 */
export async function parseDossiersDir(
	dossiersDir: string,
	allowedLegislatures: Set<number>
): Promise<DossierAN[]> {
	const files = await readdir(dossiersDir);
	const out: DossierAN[] = [];
	for (const f of files) {
		if (!f.endsWith('.json')) continue;
		const raw = JSON.parse(await readFile(join(dossiersDir, f), 'utf8'));
		const d: DossierRaw = raw.dossierParlementaire ?? {};
		if (!shouldKeepDossier(d, allowedLegislatures)) continue;
		const uid = d.uid ?? '';
		const leg = parseInt(d.legislature ?? '', 10);
		const titreDossier = d.titreDossier ?? {};
		const proc = d.procedureParlementaire ?? {};
		out.push({
			id: uid,
			legislature: leg,
			titre: titreDossier.titre ?? '(sans titre)',
			titreChemin: titreDossier.titreChemin ?? null,
			senatUrl: titreDossier.senatChemin ?? null,
			procedure: {
				code: normaliseProcedureCode(proc.code),
				libelle: proc.libelle ?? '(procédure inconnue)'
			},
			initiateurs: extractInitiateurs(d.initiateur),
			timeline: extractTimeline(d.actesLegislatifs),
			type: d['@xsi:type'] ?? 'autre'
		});
	}
	return out;
}

/** Écrit le résultat dans `static/data/dossiers-an.json`. */
export async function writeDossiers(outPath: string, dossiers: DossierAN[]): Promise<void> {
	// Tri stable par uid pour avoir un output déterministe (utile pour les diffs git)
	const sorted = [...dossiers].sort((a, b) => a.id.localeCompare(b.id));
	await writeFile(outPath, JSON.stringify(sorted));
}
