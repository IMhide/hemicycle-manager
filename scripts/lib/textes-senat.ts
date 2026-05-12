/**
 * Agrégation des scrutins Sénat en `TexteSenat`s législatifs (N3.b navette).
 *
 * Symétrique de `textes-an.ts` mais plus simple : il n'existe **aucune FK**
 * dans `dosleg.sql` entre `scr` (scrutin) et `loi` (dossier législatif). Le
 * seul levier est donc le **matching par signature titre** entre :
 *   - `scr.scrint` côté scrutin (parsé via `texte-parser.ts`, mutualisé AN/Sénat)
 *   - `loi.loitit` côté dossier (signature pré-calculée dans `dosleg-textes.ts`)
 *
 * Stratégie cascade :
 *   1. Signature scrutin présente ET trouve un dossier de signature identique
 *      → id = `loicod` du dossier, texte enrichi
 *   2. Signature scrutin présente sans dossier matché
 *      → id = `sig-<sesann>|<type>|<nom>`, texte non enrichi
 *   3. Signature absente (motion, suspension, scrutin de procédure)
 *      → texteId = null pour ce scrutin
 *
 * Triennat (cf ADR 0028+0029) : on dérive le triennat du premier scrutin du
 * texte. Pour les ranges qui chevauchent deux triennats, on s'aligne sur le
 * premier — la fiche texte affichera la timeline complète quand même.
 */

import {
	extractTexteSignature,
	type TypeTexte as ParserTypeTexte
} from './texte-parser.ts';
import type { DossierSenat } from './dosleg-textes.ts';
import { libelleTypeLoi } from './dosleg-textes.ts';
import type { TexteSenat, TexteSenatType } from '../../src/lib/types.ts';
import { triennatOfDate } from '../../src/lib/triennats.ts';

// ────────────────────────────────────────────────────────────────────────────
// Types d'entrée
// ────────────────────────────────────────────────────────────────────────────

/** Sous-ensemble minimal d'un scrutin Sénat nécessaire pour l'agrégation. */
export interface ScrutinSenatPourAgreg {
	uid: string; // `${sesann}-${scrnum}`
	sesann: number;
	scrnum: number;
	date: string; // YYYY-MM-DD (extrait du timestamp scr.scrdat)
	titre: string; // scr.scrint
	sort: string; // scr.soslib
}

// ────────────────────────────────────────────────────────────────────────────
// Mapping ParserTypeTexte → TexteSenatType
// ────────────────────────────────────────────────────────────────────────────

function projectTypeFromParser(t: ParserTypeTexte): TexteSenatType {
	switch (t) {
		case 'projet-loi':
		case 'projet-loi-reglement':
			return 'pjl';
		case 'projet-loi-organique':
			return 'pjlo';
		case 'projet-loi-constitutionnelle':
			return 'pjlc';
		case 'projet-loi-finances':
		case 'projet-loi-finances-fin-gestion':
			return 'pjlf';
		case 'projet-loi-finances-rectificative':
			return 'pjlr';
		case 'projet-loi-financement-ss':
			return 'pjfs';
		case 'projet-loi-financement-ss-rectificative':
			return 'pfsr';
		case 'proposition-loi':
			return 'ppl';
		case 'proposition-loi-organique':
			return 'pplo';
		case 'proposition-loi-constitutionnelle':
			return 'pplc';
		case 'proposition-resolution':
			return 'ppra';
		case 'proposition-resolution-europeenne':
			return 'pac';
	}
}

// ────────────────────────────────────────────────────────────────────────────
// Cœur de l'agrégation
// ────────────────────────────────────────────────────────────────────────────

interface BucketEnCours {
	id: string;
	hasDossier: boolean;
	scrutinUids: string[];
	dates: string[];
	sorts: string[];
	type: TexteSenatType;
	titreFallback: string;
	signature: string;
	sesannPremier: number;
}

export interface AggregationResultSenat {
	textes: TexteSenat[];
	scrutinToTexte: Map<string, string | null>;
}

/** Compose un titre lisible pour un texte enrichi : préfixe le libellé du type
 *  au `loitit` du dossier (ex. "Proposition de loi visant à X"), sauf si le
 *  `loitit` commence déjà par le type (cas des libellés Sénat verbeux qui
 *  contiennent "proposition de loi…"). Évite les doublons "Proposition de loi
 *  proposition de loi…". */
function composeTitreDossier(typeLibelle: string, loitit: string): string {
	if (!loitit) return typeLibelle;
	const loititLower = loitit.toLowerCase();
	const typeLower = typeLibelle.toLowerCase();
	if (loititLower.startsWith(typeLower)) return loitit;
	// Cas plus subtils : "projet de loi" préfixe le libellé du type "Projet de loi de finances"
	if (loititLower.startsWith('projet de loi') || loititLower.startsWith('proposition de loi') || loititLower.startsWith('proposition de résolution')) {
		return loitit;
	}
	return `${typeLibelle} ${loitit}`;
}

/** Reconstitue un titre lisible depuis un titre `scr.scrint` Sénat.
 *  On retire le préambule "sur l'article X de la", "sur l'amendement n° Y …",
 *  "sur l'ensemble de la" pour garder uniquement "projet de loi … / proposition de loi …". */
function reconstructTitreFallback(titre: string): string {
	const m = /(projet de loi|proposition de loi|proposition de résolution)\b/i.exec(titre);
	if (!m) return titre.trim();
	let tail = titre.slice(m.index);
	tail = tail.replace(/\s*\((première|deuxième|troisième|seconde|nouvelle|dernière) lecture[^)]*\)\s*\.?\s*$/i, '');
	tail = tail.replace(/\s*\.\s*$/, '');
	return tail.trim();
}

/** Agrège les scrutins Sénat en `TexteSenat`s en croisant avec les dossiers
 *  `loi` du dump dosleg. */
export function aggregeTextesSenat(
	scrutins: ScrutinSenatPourAgreg[],
	dossiers: DossierSenat[]
): AggregationResultSenat {
	const buckets = new Map<string, BucketEnCours>();
	const scrutinToTexte = new Map<string, string | null>();
	const signatureToBucketId = new Map<string, string>();

	// Index dossiers par signature normalisée pour matching O(1).
	// La clé combine type+signature pour limiter les fausses correspondances
	// (ex. PPL et PJL portant un titre similaire).
	const dossiersBySignature = new Map<string, DossierSenat>();
	for (const d of dossiers) {
		if (!d.signatureNomNormalise || !d.loicod) continue;
		// On indexe sur le nom seul (pas le type) car le type du dossier
		// dosleg peut différer du type extrait du parser (ex. typloicod="prog"
		// projet de loi de programmation = "projet de loi" pour le parser).
		// L'index par nom suffit, c'est unique en pratique pour les loitit Sénat.
		const key = d.signatureNomNormalise;
		// Si plusieurs dossiers partagent le même nom (rare), on garde le premier
		if (!dossiersBySignature.has(key)) {
			dossiersBySignature.set(key, d);
		}
	}

	const ordered = [...scrutins].sort((a, b) =>
		a.date < b.date ? -1 : a.date > b.date ? 1 : a.scrnum - b.scrnum
	);

	for (const s of ordered) {
		const sig = extractTexteSignature(s.titre);
		if (sig === null) {
			scrutinToTexte.set(s.uid, null);
			continue;
		}
		const signatureKey = `${s.sesann}|${sig.typeTexte}|${sig.nomNormalise}`;

		let bucketId: string | null = null;
		let hasDossier = false;
		let dossierMatched: DossierSenat | undefined;

		// Niveau 1 — match par signature normalisée du dossier
		const dossier = dossiersBySignature.get(sig.nomNormalise);
		if (dossier) {
			bucketId = dossier.loicod;
			hasDossier = true;
			dossierMatched = dossier;
		}

		// Niveau 2 — signature déjà mappée à un bucket existant
		if (bucketId === null && signatureToBucketId.has(signatureKey)) {
			bucketId = signatureToBucketId.get(signatureKey)!;
			hasDossier = !bucketId.startsWith('sig-');
		}

		// Niveau 3 — nouveau bucket sig-…
		if (bucketId === null) {
			bucketId = `sig-${signatureKey}`;
			hasDossier = false;
		}

		if (!signatureToBucketId.has(signatureKey)) {
			signatureToBucketId.set(signatureKey, bucketId);
		}

		let b = buckets.get(bucketId);
		if (!b) {
			b = {
				id: bucketId,
				hasDossier,
				scrutinUids: [],
				dates: [],
				sorts: [],
				type: dossierMatched?.type ?? projectTypeFromParser(sig.typeTexte),
				titreFallback: reconstructTitreFallback(s.titre),
				signature: signatureKey,
				sesannPremier: s.sesann
			};
			buckets.set(bucketId, b);
		}
		b.scrutinUids.push(s.uid);
		b.dates.push(s.date);
		b.sorts.push(s.sort);
		scrutinToTexte.set(s.uid, bucketId);
	}

	const dossiersByLoicod = new Map(dossiers.map((d) => [d.loicod, d]));
	const textes: TexteSenat[] = [];
	for (const b of buckets.values()) {
		const dossier = b.hasDossier ? dossiersByLoicod.get(b.id) : undefined;
		const tuples = b.scrutinUids.map((uid, i) => ({
			uid,
			date: b.dates[i],
			sort: b.sorts[i]
		}));
		tuples.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

		const scrutinsTri = tuples.map((t) => t.uid);
		const dateDebut = tuples[0].date;
		const dateFin = tuples[tuples.length - 1].date;
		const sortFinal = tuples[tuples.length - 1].sort;

		const titre = dossier ? composeTitreDossier(dossier.typeLibelle, dossier.titre) : b.titreFallback;
		const type = dossier?.type ?? b.type;
		const typeLibelle = dossier?.typeLibelle ?? libelleTypeLoi(b.type);
		const etat = dossier?.etat ?? 'inconnu';
		const numeroLoi = dossier?.numeroLoi ?? null;
		const datePromulgation = dossier?.datePromulgation ?? null;
		const urlJO = dossier?.urlJO ?? null;
		const triennat = triennatOfDate(dateDebut)?.id ?? '';

		textes.push({
			id: b.id,
			triennat,
			titre,
			type,
			typeLibelle,
			etat,
			numeroLoi,
			scrutins: scrutinsTri,
			dateDebut,
			dateFin,
			datePromulgation,
			urlJO,
			sortFinal,
			nbScrutins: scrutinsTri.length,
			enrichiDosleg: !!dossier,
			versionAutreChambre: null // sera muté par build-cross-chambre.ts (N3.c)
		});
	}

	textes.sort((a, b) => {
		if (a.dateDebut !== b.dateDebut) return a.dateDebut < b.dateDebut ? -1 : 1;
		return a.id.localeCompare(b.id);
	});

	return { textes, scrutinToTexte };
}
