/**
 * Fusion cross-chambre des `Texte` AN + `TexteSenat` → `TexteUnifie[]` (N3.d,
 * cf ADR 0036).
 *
 * Stratégie :
 *  1. Indexer les Sénat par id (loicod)
 *  2. Pour chaque Texte AN :
 *     - si `versionAutreChambre` pointe vers un TexteSenat connu → bicaméral
 *     - sinon → entrée AN-seule
 *     - on consomme l'id Sénat lié pour éviter le double-comptage
 *  3. Pour chaque TexteSenat non encore consommé → entrée Sénat-seule
 *  4. Tri par dateDebut décroissante
 *
 * Résolution des sources d'autorité par champ : cf ADR 0036.
 */

import type {
	TexteUnifie,
	TexteUnifieEtat,
	TexteUnifieChambreRef,
	TexteUnifieScrutin,
	TexteType,
	TexteSenatType,
	TimelineActe
} from '../../src/lib/types.ts';
import { hasSenatActe } from './timeline-navette.ts';
import { texteSlug } from './slug.ts';

// ────────────────────────────────────────────────────────────────────────────
// Index scrutins (uid → projection légère) pour inliner les scrutins d'un texte
// dans la fiche unifiée (cf ADR 0041). L'appelant fournit ces maps construites
// depuis scrutins-index.json (AN) et senat/scrutins-index.json.
// ────────────────────────────────────────────────────────────────────────────

/** Index uid → scrutin projeté, partagé AN/Sénat (numero unifié). */
export type ScrutinIndexLite = Map<string, TexteUnifieScrutin>;

/** Projette les uids d'un texte en scrutins légers, dans l'ordre, en ignorant
 *  les uids absents de l'index (rare : scrutin filtré en amont). */
function projeteScrutins(uids: string[], index: ScrutinIndexLite): TexteUnifieScrutin[] {
	const out: TexteUnifieScrutin[] = [];
	for (const uid of uids) {
		const s = index.get(uid);
		if (s) out.push(s);
	}
	return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Types d'entrée
// ────────────────────────────────────────────────────────────────────────────

/** Sous-ensemble d'un Texte AN nécessaire à la fusion. */
export interface TexteAnInput {
	id: string;
	legislature: number;
	titre: string;
	type: TexteType;
	procedureLibelle: string | null;
	initiateurs: string[];
	dateDebut: string;
	dateFin: string;
	datePromulgation: string | null;
	sortFinal: string;
	nbScrutins: number;
	nbVotesSolennels: number;
	enrichiDossiersAN: boolean;
	senatUrl: string | null;
	versionAutreChambre: { texteSenatId: string; matchedVia: 'slug' | 'titre' } | null;
	/** Timeline navette extraite du dump AN (cf ADR 0037). Vide si non enrichi. */
	timelineNavette: TimelineActe[];
	/** uids des scrutins nominaux de ce texte (cf ADR 0041, pour l'inlining). */
	scrutins: string[];
}

/** Sous-ensemble d'un TexteSenat nécessaire à la fusion. */
export interface TexteSenatInput {
	id: string;
	triennat: string;
	titre: string;
	type: TexteSenatType;
	typeLibelle: string;
	etat: string; // 'en-cours' | 'promulgue' | 'rejete' | 'caduc' | 'retire' | 'fusionne' | 'inconnu'
	numeroLoi: string | null;
	datePromulgation: string | null;
	urlJO: string | null;
	dateDebut: string;
	dateFin: string;
	sortFinal: string;
	nbScrutins: number;
	enrichiDosleg: boolean;
	versionAutreChambre: { texteAnId: string; matchedVia: 'slug' | 'titre' } | null;
	/** uids des scrutins nominaux de ce texte (cf ADR 0041, pour l'inlining). */
	scrutins: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Projections type AN/Sénat → TexteType
// ────────────────────────────────────────────────────────────────────────────

/** Projection TexteSenatType → TexteType (utilisé pour textes mono-Sénat). */
function projectSenatTypeToAnType(t: TexteSenatType): TexteType {
	switch (t) {
		case 'pjl':
		case 'cvn':
			return 'projet-loi';
		case 'pjlo':
			return 'projet-loi-organique';
		case 'pjlc':
			return 'projet-loi-constitutionnelle';
		case 'pjlf':
			return 'projet-loi-finances';
		case 'pjlr':
			return 'projet-loi-finances-rectificative';
		case 'pjlg':
			return 'projet-loi'; // règlement = AN n'a pas d'équivalent strict
		case 'pjfs':
		case 'pfsr':
			return 'projet-loi-financement-ss';
		case 'prog':
			return 'projet-loi';
		case 'ppl':
		case 'refe':
			return 'proposition-loi';
		case 'pplo':
			return 'proposition-loi-organique';
		case 'pplc':
			return 'proposition-loi-constitutionnelle';
		case 'ppro':
			return 'proposition-loi';
		case 'pac':
			return 'proposition-resolution-europeenne';
		case 'ppre':
		case 'ppra':
		case 'pprp':
			return 'proposition-resolution';
		case 'enq':
		case 'mref':
		case 'dape':
		case 'autre':
			return 'autre';
	}
}

const TEXTE_TYPE_LIBELLES: Record<TexteType, string> = {
	'projet-loi': 'Projet de loi',
	'projet-loi-organique': 'Projet de loi organique',
	'projet-loi-constitutionnelle': 'Projet de loi constitutionnelle',
	'projet-loi-finances': 'Projet de loi de finances',
	'projet-loi-finances-rectificative': 'Projet de loi de finances rectificative',
	'projet-loi-financement-ss': 'Projet de loi de financement de la sécurité sociale',
	'proposition-loi': 'Proposition de loi',
	'proposition-loi-organique': 'Proposition de loi organique',
	'proposition-loi-constitutionnelle': 'Proposition de loi constitutionnelle',
	'proposition-resolution': 'Proposition de résolution',
	'proposition-resolution-europeenne': 'Proposition de résolution européenne',
	autre: 'Autre'
};

// ────────────────────────────────────────────────────────────────────────────
// Cascade etatGlobal
// ────────────────────────────────────────────────────────────────────────────

/** Détermine l'état global d'un texte unifié selon la cascade ADR 0036. */
function deriveEtatUnifie(an: TexteAnInput | null, sen: TexteSenatInput | null): TexteUnifieEtat {
	// Priorité 1 : promulgation
	if (sen?.etat === 'promulgue' || sen?.datePromulgation) return 'promulgue';
	if (an?.datePromulgation) return 'promulgue';

	// Priorité 2 : rejet explicite
	if (sen?.etat === 'rejete') return 'rejete';
	if (an?.sortFinal === 'rejeté') return 'rejete';

	// Priorité 3 : retire/caduc/fusionne (cas Sénat uniquement, AN ne le distingue pas)
	if (sen?.etat === 'retire') return 'retire';
	if (sen?.etat === 'caduc') return 'caduc';
	if (sen?.etat === 'fusionne') return 'fusionne';

	// Priorité 4 : par défaut en-cours
	return 'en-cours';
}

// ────────────────────────────────────────────────────────────────────────────
// Construction du sous-objet chambreRef
// ────────────────────────────────────────────────────────────────────────────

function buildAnRef(an: TexteAnInput, scrutinsIndex: ScrutinIndexLite): TexteUnifieChambreRef {
	return {
		texteId: an.id,
		titre: an.titre,
		dateDebut: an.dateDebut,
		dateFin: an.dateFin,
		nbScrutins: an.nbScrutins,
		sortFinal: an.sortFinal,
		nbVotesSolennels: an.nbVotesSolennels,
		triennat: null,
		scrutins: projeteScrutins(an.scrutins, scrutinsIndex)
	};
}

function buildSenatRef(sen: TexteSenatInput, scrutinsIndex: ScrutinIndexLite): TexteUnifieChambreRef {
	return {
		texteId: sen.id,
		titre: sen.titre,
		dateDebut: sen.dateDebut,
		dateFin: sen.dateFin,
		nbScrutins: sen.nbScrutins,
		sortFinal: sen.sortFinal,
		nbVotesSolennels: 0,
		triennat: sen.triennat,
		scrutins: projeteScrutins(sen.scrutins, scrutinsIndex)
	};
}

// ────────────────────────────────────────────────────────────────────────────
// Construction d'un TexteUnifie depuis un côté ou les deux
// ────────────────────────────────────────────────────────────────────────────

function buildUnifie(
	an: TexteAnInput | null,
	sen: TexteSenatInput | null,
	scrutinsIndexAN: ScrutinIndexLite,
	scrutinsIndexSenat: ScrutinIndexLite
): TexteUnifie {
	if (!an && !sen) throw new Error('buildUnifie: au moins une chambre doit être présente');

	// Bicaméralité refondue (ADR 0037) : on regarde aussi la timeline navette
	// extraite du dump AN. Un texte peut être bicaméral même sans scrutin nominal
	// côté Sénat si le dump AN référence un acte SN1-* (preuve de passage Sénat
	// avec vote à main levée par exemple).
	const timelineNavette = an?.timelineNavette ?? [];
	const bicameral = (an !== null && sen !== null) || hasSenatActe(timelineNavette);
	// Id canonique : AN si présent, sinon Sénat
	const id = an ? an.id : sen!.id;

	// Titre : AN prioritaire (canonique court), sinon Sénat
	const titre = an?.titre ?? sen!.titre;

	// Type : AN prioritaire, sinon projection Sénat
	const type: TexteType = an?.type ?? projectSenatTypeToAnType(sen!.type);
	const typeLibelle = TEXTE_TYPE_LIBELLES[type] ?? 'Texte';

	// Métadonnées loi : Sénat prioritaire (dosleg expose), AN en fallback
	const numeroLoi = sen?.numeroLoi ?? null;
	const datePromulgation = sen?.datePromulgation ?? an?.datePromulgation ?? null;
	const urlJO = sen?.urlJO ?? null;

	// senatUrl côté AN (extrait dump dossiers)
	const senatUrl = an?.senatUrl ?? null;

	// Initiateurs : AN prioritaire (Sénat n'expose pas)
	const initiateurs = an?.initiateurs ?? [];

	// Procédure : AN seulement
	const procedureLibelle = an?.procedureLibelle ?? null;

	// Dates : min(débuts) / max(fins) si AN ET Sénat présents, sinon côté présent.
	// (On utilise la présence des deux côtés, pas `bicameral` qui peut être true
	// avec un seul TexteSenat absent du dataset mais référencé via la timeline.)
	const dateDebut =
		an && sen
			? an.dateDebut < sen.dateDebut
				? an.dateDebut
				: sen.dateDebut
			: (an?.dateDebut ?? sen!.dateDebut);
	const dateFin =
		an && sen
			? an.dateFin > sen.dateFin
				? an.dateFin
				: sen.dateFin
			: (an?.dateFin ?? sen!.dateFin);

	// Scrutins : somme
	const nbScrutins = (an?.nbScrutins ?? 0) + (sen?.nbScrutins ?? 0);

	const etat = deriveEtatUnifie(an, sen);

	return {
		id,
		slug: texteSlug(titre, id), // URL lisible, cf ADR 0042
		titre,
		type,
		typeLibelle,
		etat,
		numeroLoi,
		datePromulgation,
		urlJO,
		senatUrl,
		initiateurs,
		procedureLibelle,
		dateDebut,
		dateFin,
		nbScrutins,
		bicameral,
		an: an ? buildAnRef(an, scrutinsIndexAN) : null,
		senat: sen ? buildSenatRef(sen, scrutinsIndexSenat) : null,
		timelineNavette
	};
}

// ────────────────────────────────────────────────────────────────────────────
// Orchestration
// ────────────────────────────────────────────────────────────────────────────

/** Fusionne les textes AN et Sénat en un manifest unifié cross-chambre.
 *  Cf ADR 0036 pour la sémantique. */
export function fusionneTextesUnifies(
	textesAN: TexteAnInput[],
	textesSenat: TexteSenatInput[],
	scrutinsIndexAN: ScrutinIndexLite = new Map(),
	scrutinsIndexSenat: ScrutinIndexLite = new Map()
): TexteUnifie[] {
	const senatById = new Map(textesSenat.map((t) => [t.id, t]));
	const senatConsommes = new Set<string>();
	const result: TexteUnifie[] = [];

	// Étape 1 : tous les Texte AN (avec ou sans pendant Sénat)
	for (const an of textesAN) {
		const senId = an.versionAutreChambre?.texteSenatId;
		if (senId && senatById.has(senId)) {
			const sen = senatById.get(senId)!;
			result.push(buildUnifie(an, sen, scrutinsIndexAN, scrutinsIndexSenat));
			senatConsommes.add(senId);
		} else {
			result.push(buildUnifie(an, null, scrutinsIndexAN, scrutinsIndexSenat));
		}
	}

	// Étape 2 : tous les TexteSenat non encore consommés
	for (const sen of textesSenat) {
		if (senatConsommes.has(sen.id)) continue;
		result.push(buildUnifie(null, sen, scrutinsIndexAN, scrutinsIndexSenat));
	}

	// Tri par dateDebut décroissante (plus récent en premier)
	result.sort((a, b) => (a.dateDebut < b.dateDebut ? 1 : a.dateDebut > b.dateDebut ? -1 : 0));

	return result;
}
