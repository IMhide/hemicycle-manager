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
	normaliseNomTexte,
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
	/** dossierRef Etalab si présent dans `objet.dossierLegislatif.dossierRef`.
	 *  Couvre ~11% des scrutins 17ᵉ, utilisé en clé secondaire. */
	dossierRef: string | null;
	/** seanceRef Etalab du scrutin. Croisé avec les `reunionRef` extraits de
	 *  l'arbre `actesLegislatifs` des dossiers (méthode Poligraph), permet de
	 *  rattacher 83,7% des scrutins à un dossier officiel DLR…. */
	seanceRef: string | null;
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
		case 'resolution':
		case 'resolution-art-34-1':
			return 'proposition-resolution';
		case 'commission-enquete':
		case 'mission-information':
		case 'engagement-responsabilite':
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
 * Désambiguïse plusieurs dossiers candidats en utilisant la signature titre
 * du scrutin. Stratégie : on combine le **type de texte** (libellé brut, ex.
 * "projet de loi de finances") et le **nom** de la signature, on en extrait
 * les mots significatifs (≥4 caractères), et on cherche le dossier dont le
 * titre partage le plus de mots avec cet ensemble.
 *
 * Le scrutin gagne si :
 *  - il a au moins 2 mots en commun avec le titre du dossier (seuil bas pour
 *    accommoder les signatures courtes comme "pour 2026" type "projet de loi
 *    de finances" → mots {pour, 2026, projet, finances})
 *  - aucun autre candidat n'a le même score
 *
 * Retourne `null` si aucun candidat ne franchit le seuil OU si égalité au
 * sommet (préfère le fallback signature plutôt que de trancher au hasard).
 */
function desambigueParTitre(
	candidatsIds: Iterable<string>,
	signatureType: string,
	signatureNom: string,
	dossiersById: Map<string, DossierAN>
): string | null {
	const sigBlob = `${signatureType} ${signatureNom}`;
	const sigWords = new Set(
		normaliseNomTexte(sigBlob)
			.split(' ')
			.filter((w) => w.length > 3)
	);
	if (sigWords.size === 0) return null;
	let best: { id: string; score: number } | null = null;
	let runnerUpScore = -1;
	for (const id of candidatsIds) {
		const dossier = dossiersById.get(id);
		if (!dossier) continue;
		const dossierWords = new Set(
			normaliseNomTexte(dossier.titre)
				.split(' ')
				.filter((w) => w.length > 3)
		);
		let common = 0;
		for (const w of sigWords) if (dossierWords.has(w)) common++;
		if (common < 2) continue;
		if (best === null || common > best.score) {
			runnerUpScore = best?.score ?? -1;
			best = { id, score: common };
		} else if (common > runnerUpScore) {
			runnerUpScore = common;
		}
	}
	if (best === null) return null;
	if (best.score === runnerUpScore) return null;
	return best.id;
}

/**
 * Agrège la liste de scrutins en `Texte`s en s'appuyant sur trois sources :
 *  - **seanceRef↔reunionRef** (méthode Poligraph, source d'autorité) : 83,7% des
 *    scrutins ont un dossierRef officiel via cette méthode
 *  - **dossierRef côté scrutin** (Etalab) : fallback quand seanceRef ne suffit pas
 *  - **signature parser de titres** : dernier filet (motions, séances orphelines)
 *
 * @param scrutins liste enrichie de seanceRef/dossierRef
 * @param dossiers liste des DossierAN extraite du dump
 * @param reunionToDossierIds index `reunionRef → Set<dossierUid>` extrait du dump
 */
export function aggregeTextesAN(
	scrutins: ScrutinPourAgreg[],
	dossiers: DossierAN[],
	reunionToDossierIds: Map<string, Set<string>> = new Map()
): AggregationResult {
	const buckets = new Map<string, BucketEnCours>();
	const scrutinToTexte = new Map<string, string | null>();
	const signatureToBucketId = new Map<string, string>();
	const dossiersById = new Map(dossiers.map((d) => [d.id, d]));

	// On trie pour traiter en priorité les scrutins susceptibles d'établir un id
	// officiel DLR (via seanceRef ou dossierRef), avant les scrutins qui ne
	// peuvent que créer une signature. Ainsi les buckets prennent leur id DLR
	// avant qu'un sig-… concurrent ne soit créé pour la même signature.
	const ordered = [...scrutins].sort((a, b) => {
		const aHasOfficial = !!(a.seanceRef || a.dossierRef);
		const bHasOfficial = !!(b.seanceRef || b.dossierRef);
		if (aHasOfficial && !bHasOfficial) return -1;
		if (!aHasOfficial && bHasOfficial) return 1;
		return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
	});

	for (const s of ordered) {
		const sig = extractTexteSignature(s.titre);
		if (sig === null) {
			scrutinToTexte.set(s.uid, null);
			continue;
		}
		const signatureKey = `${s.legislature}|${sig.typeTexte}|${sig.nomNormalise}`;

		// Cascade pour déterminer l'id du bucket :
		// 1. seanceRef → 1 dossier candidat (match unique) → DLR
		// 2. seanceRef → plusieurs candidats → désambiguïsation par signature titre → DLR
		// 3. dossierRef côté scrutin → DLR
		// 4. signature déjà connue → on récupère le bucket existant
		// 5. sinon → nouveau bucket sig-…
		let bucketId: string | null = null;
		let hasDossierRef = false;

		// (1) + (2) : matching par seanceRef
		if (s.seanceRef) {
			const candidats = reunionToDossierIds.get(s.seanceRef);
			if (candidats && candidats.size === 1) {
				bucketId = [...candidats][0];
				hasDossierRef = true;
			} else if (candidats && candidats.size > 1) {
				// On utilise le titre du scrutin (riche en mots) pour la désambiguïsation
				// plutôt que la seule signature normalisée (qui peut être courte type "pour 2026").
				const disamb = desambigueParTitre(candidats, s.titre, sig.nomNormalise, dossiersById);
				if (disamb !== null) {
					bucketId = disamb;
					hasDossierRef = true;
				}
			}
		}
		// (3) : dossierRef côté scrutin
		if (bucketId === null && s.dossierRef) {
			bucketId = s.dossierRef;
			hasDossierRef = true;
		}
		// (4) : signature déjà mappée
		if (bucketId === null && signatureToBucketId.has(signatureKey)) {
			bucketId = signatureToBucketId.get(signatureKey)!;
			hasDossierRef = !bucketId.startsWith('sig-');
		}
		// (5) : nouveau bucket sig-…
		if (bucketId === null) {
			bucketId = `sig-${signatureKey}`;
			hasDossierRef = false;
		}

		// Enregistre la signature → bucket pour les futurs scrutins qui n'auraient
		// ni seanceRef matché, ni dossierRef, mais partageraient la signature.
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

	// ── Passe 2 : finalisation des Texte (dossiersById déjà construit en haut)
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
		const senatUrl = dossier?.senatUrl ?? null;

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
			enrichiDossiersAN: !!dossier,
			senatUrl,
			versionAutreChambre: null // sera muté par build-cross-chambre.ts (N3.c)
		});
	}

	// Tri final par dateDebut ascendant (puis legislature pour stabilité)
	textes.sort((a, b) => {
		if (a.dateDebut !== b.dateDebut) return a.dateDebut < b.dateDebut ? -1 : 1;
		return a.legislature - b.legislature;
	});

	return { textes, scrutinToTexte };
}
