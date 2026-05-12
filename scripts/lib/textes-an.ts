/**
 * Agrégation des scrutins AN en `Texte`s législatifs.
 *
 * Croise trois sources :
 *  1. Scrutins (avec leur dossierRef Etalab quand disponible, ~11% du temps)
 *  2. Parser de titres `texte-parser.ts` (couvre 99,5%)
 *  3. Dump dossiers `dossiers-an.ts` (métadonnées : titre officiel, etc.)
 *
 * Stratégie de groupement :
 *  - Clé primaire = `dossierRef` quand connu côté scrutin
 *  - Sinon clé secondaire = `sig-<legislature>-<type>-<nomNormalise>`
 *    (la législature est incluse pour éviter de fusionner deux textes de
 *    législatures différentes portant un nom similaire)
 *  - Quand un scrutin sans dossierRef partage la signature d'un scrutin avec
 *    dossierRef, on les regroupe sous le dossierRef (deuxième passe)
 *
 * Retour :
 *  - `textes` : Texte[] trié par dateDebut ascendant
 *  - `scrutinToTexte` : Map<scrutinUid, texteId | null>
 */

import {
	extractTexteSignature,
	type TypeTexte as ParserTypeTexte
} from './texte-parser.ts';
import type { DossierAN, CodeProcedure } from './dossiers-an.ts';
import type { Texte, TexteType } from '../../src/lib/types.ts';

// ────────────────────────────────────────────────────────────────────────────
// Types d'entrée
// ────────────────────────────────────────────────────────────────────────────

/** Sous-ensemble minimal des champs scrutin nécessaires pour l'agrégation. */
export interface ScrutinPourAgreg {
	uid: string;
	legislature: number;
	date: string;
	titre: string;
	/** dossierRef Etalab si présent dans `objet.dossierLegislatif.dossierRef`. */
	dossierRef: string | null;
	typeVote: string;
	sort: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Mapping TypeTexte parser ↔ TypeTexte (côté types.ts public)
// ────────────────────────────────────────────────────────────────────────────

/** Le parser de titres et le type public utilisent des libellés très proches
 *  mais le parser distingue plus finement (PLFR vs PLF de fin de gestion).
 *  Cette fonction projette vers le type public. */
function projectTypeFromParser(t: ParserTypeTexte): TexteType {
	switch (t) {
		case 'projet-loi':
		case 'projet-loi-reglement':
			return 'projet-loi';
		case 'projet-loi-organique':
			return 'projet-loi-organique';
		case 'projet-loi-constitutionnelle':
			return 'projet-loi-constitutionnelle';
		case 'projet-loi-finances':
		case 'projet-loi-finances-fin-gestion': // pas de catégorie publique dédiée
			return 'projet-loi-finances';
		case 'projet-loi-finances-rectificative':
			return 'projet-loi-finances-rectificative';
		case 'projet-loi-financement-ss':
		case 'projet-loi-financement-ss-rectificative':
			return 'projet-loi-financement-ss';
		case 'proposition-loi':
			return 'proposition-loi';
		case 'proposition-loi-organique':
			return 'proposition-loi-organique';
		case 'proposition-loi-constitutionnelle':
			return 'proposition-loi-constitutionnelle';
		case 'proposition-resolution':
			return 'proposition-resolution';
		case 'proposition-resolution-europeenne':
			return 'proposition-resolution-europeenne';
	}
}

/** Mapping du code procédure dump dossiers → TexteType public. */
function projectTypeFromDossier(code: CodeProcedure): TexteType {
	switch (code) {
		case 'projet-loi-ordinaire':
			return 'projet-loi';
		case 'proposition-loi-ordinaire':
		case 'proposition-loi-article-11':
			return 'proposition-loi';
		case 'projet-loi-finances':
			return 'projet-loi-finances';
		case 'projet-loi-finances-rectificative':
			return 'projet-loi-finances-rectificative';
		case 'projet-loi-financement-ss':
			return 'projet-loi-financement-ss';
		case 'loi-organique':
			// On ne peut pas distinguer projet/proposition côté Etalab — défaut
			// = projet, le titre redresse souvent ("Proposition de loi organique…").
			return 'projet-loi-organique';
		case 'loi-constitutionnelle':
			return 'projet-loi-constitutionnelle';
		case 'ratification-traite-convention':
			return 'projet-loi';
		case 'petition':
		case 'autre':
			return 'autre';
	}
}

// ────────────────────────────────────────────────────────────────────────────
// Cœur de l'agrégation
// ────────────────────────────────────────────────────────────────────────────

interface BucketEnCours {
	id: string;
	/** True si l'id provient d'un dossierRef Etalab, false si c'est une signature. */
	hasDossierRef: boolean;
	legislature: number;
	scrutinUids: string[];
	dates: string[];
	typeVotes: string[];
	sorts: string[];
	/** Type éditorial dérivé du parser ou du dossier. */
	type: TexteType;
	/** Titre dérivé du parser de titre (fallback si le dossier n'a pas matché). */
	titreFallback: string;
	signature: string | null;
}

export interface AggregationResult {
	textes: Texte[];
	/** scrutinUid → texteId, ou `null` pour les motions/suspensions hors champ. */
	scrutinToTexte: Map<string, string | null>;
}

/** Reconstitue un titre lisible depuis le titre brut d'un scrutin de type
 *  "ensemble" ou "article" en gardant uniquement le segment "<type de texte> <nom>"
 *  jusqu'à "(première lecture)". */
function reconstructTitreFallback(titre: string): string {
	// On retire le préambule "l'amendement n° X de …", "l'article 5 de …",
	// "le sous-amendement … à l'amendement …", "la motion de rejet de …"
	// pour ne garder que la partie qui commence par "projet de loi" ou "proposition de loi".
	const m = /(projet de loi|proposition de loi|proposition de résolution)\b/i.exec(titre);
	if (!m) return titre.replace(/\s*\([^)]*\)\s*\.?\s*$/, '').trim();
	let tail = titre.slice(m.index);
	// Retire le suffixe "(première lecture)" et le point final
	tail = tail.replace(/\s*\((première|deuxième|troisième|seconde|nouvelle|dernière) lecture[^)]*\)\s*\.?\s*$/i, '');
	tail = tail.replace(/\s*\.\s*$/, '');
	return tail.trim();
}

/**
 * Agrège la liste de scrutins en `Texte`s en s'appuyant sur :
 *  - le `dossierRef` côté scrutin pour la clé principale (quand présent)
 *  - le parser de titres pour la clé fallback (signature)
 *  - le dump dossiers pour les métadonnées d'enrichissement
 */
export function aggregeTextesAN(
	scrutins: ScrutinPourAgreg[],
	dossiers: DossierAN[]
): AggregationResult {
	const buckets = new Map<string, BucketEnCours>();
	const scrutinToTexte = new Map<string, string | null>();
	// Lookup signature → bucketId (pour la 2e passe : rattacher les scrutins sans
	// dossierRef qui partagent une signature avec un bucket déjà créé via dossierRef).
	const signatureToBucketId = new Map<string, string>();

	// ── Passe 1 : créer/peupler les buckets dossierRef en premier, puis les signatures
	// On trie d'abord pour traiter les scrutins avec dossierRef en premier — ainsi
	// les buckets prennent leur id dossierRef avant qu'une signature concurrente
	// ne crée son propre bucket "sig-…".
	const ordered = [...scrutins].sort((a, b) => {
		if (a.dossierRef && !b.dossierRef) return -1;
		if (!a.dossierRef && b.dossierRef) return 1;
		return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
	});

	for (const s of ordered) {
		const sig = extractTexteSignature(s.titre);
		if (sig === null) {
			// Pas un texte législatif (motion de censure, suspension, …)
			scrutinToTexte.set(s.uid, null);
			continue;
		}
		// Clé signature stable (incluant la législature pour cloisonner)
		const signatureKey = `${s.legislature}|${sig.typeTexte}|${sig.nomNormalise}`;

		// Choix de l'id du bucket : dossierRef > signature
		let bucketId: string;
		let hasDossierRef: boolean;
		if (s.dossierRef) {
			bucketId = s.dossierRef;
			hasDossierRef = true;
		} else if (signatureToBucketId.has(signatureKey)) {
			bucketId = signatureToBucketId.get(signatureKey)!;
			hasDossierRef = bucketId.startsWith('sig-') ? false : true;
		} else {
			bucketId = `sig-${signatureKey}`;
			hasDossierRef = false;
		}

		// On enregistre l'association signature → bucketId pour les scrutins ultérieurs
		// (un scrutin sans dossierRef pourra retrouver le bucket créé par un autre avec dossierRef)
		if (!signatureToBucketId.has(signatureKey)) {
			signatureToBucketId.set(signatureKey, bucketId);
		}

		let b = buckets.get(bucketId);
		if (!b) {
			b = {
				id: bucketId,
				hasDossierRef,
				legislature: s.legislature,
				scrutinUids: [],
				dates: [],
				typeVotes: [],
				sorts: [],
				type: projectTypeFromParser(sig.typeTexte),
				titreFallback: reconstructTitreFallback(s.titre),
				signature: signatureKey
			};
			buckets.set(bucketId, b);
		}
		b.scrutinUids.push(s.uid);
		b.dates.push(s.date);
		b.typeVotes.push(s.typeVote);
		b.sorts.push(s.sort);
		scrutinToTexte.set(s.uid, bucketId);
	}

	// ── Passe 2 : enrichissement par le dump dossiers
	const dossiersById = new Map(dossiers.map((d) => [d.id, d]));

	// ── Passe 3 : finalisation des Texte
	const textes: Texte[] = [];
	for (const b of buckets.values()) {
		const dossier = b.hasDossierRef ? dossiersById.get(b.id) : undefined;
		// Tri chronologique des scrutins du bucket
		const tuples = b.scrutinUids.map((uid, i) => ({
			uid,
			date: b.dates[i],
			typeVote: b.typeVotes[i],
			sort: b.sorts[i]
		}));
		tuples.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

		const scrutinsTri = tuples.map((t) => t.uid);
		const dateDebut = tuples[0].date;
		const dateFin = tuples[tuples.length - 1].date;
		const sortFinal = tuples[tuples.length - 1].sort;
		const nbVotesSolennels = tuples.filter((t) => t.typeVote === 'scrutin public solennel').length;

		const titre = dossier?.titre ?? b.titreFallback;
		const type: TexteType = dossier ? projectTypeFromDossier(dossier.procedure.code) : b.type;
		const procedureLibelle = dossier?.procedure.libelle ?? null;
		const initiateurs = dossier?.initiateurs ?? [];
		const datePromulgation = dossier?.timeline.datePromulgation ?? null;

		textes.push({
			id: b.id,
			legislature: b.legislature,
			titre,
			type,
			procedureLibelle,
			initiateurs,
			scrutins: scrutinsTri,
			dateDebut,
			dateFin,
			datePromulgation,
			sortFinal,
			nbScrutins: scrutinsTri.length,
			nbVotesSolennels,
			enrichiDossiersAN: !!dossier
		});
	}

	// Tri final par dateDebut ascendant (puis legislature pour stabilité)
	textes.sort((a, b) => {
		if (a.dateDebut !== b.dateDebut) return a.dateDebut < b.dateDebut ? -1 : 1;
		return a.legislature - b.legislature;
	});

	return { textes, scrutinToTexte };
}
