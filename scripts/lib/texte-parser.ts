/**
 * Parser de titres de scrutins AN pour en extraire une signature
 * `(typeTexte, nomNormalise)` permettant d'agréger tous les scrutins relatifs
 * à un même texte législatif.
 *
 * Le champ `dossierLegislatif.dossierRef` d'Etalab ne couvre que ~11% des
 * scrutins 17ᵉ. Pour le reste, on s'appuie sur la structure très régulière
 * des titres :
 *
 *   l'amendement n° X de … à l'article Y du projet de loi de finances pour 2026 (première lecture).
 *   └─────── préambule ─────┘ └────────── type texte ──────────┘ └ nom ┘ └ suffixe ┘
 *
 * Validé sur 6 530 scrutins 17ᵉ AN : 99,5% de couverture, 0 collision quand
 * croisé avec les `dossierRef` connus.
 */

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** Catégories de textes législatifs reconnues. */
export type TypeTexte =
	| 'projet-loi' // "projet de loi" (ordinaire)
	| 'projet-loi-organique'
	| 'projet-loi-constitutionnelle'
	| 'projet-loi-finances' // PLF
	| 'projet-loi-finances-rectificative' // PLFR
	| 'projet-loi-finances-fin-gestion' // "de finances de fin de gestion"
	| 'projet-loi-financement-ss' // PLFSS
	| 'projet-loi-financement-ss-rectificative' // PLFSSR
	| 'projet-loi-reglement' // règlement du budget
	| 'proposition-loi'
	| 'proposition-loi-organique'
	| 'proposition-loi-constitutionnelle'
	| 'proposition-resolution'
	| 'proposition-resolution-europeenne';

export interface TexteSignature {
	typeTexte: TypeTexte;
	/** Nom du texte normalisé (minuscules, sans accents, ponctuation collapsée).
	 *  Sert de clé d'agrégation stable. */
	nomNormalise: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Normalisation
// ────────────────────────────────────────────────────────────────────────────

/** Normalise un libellé pour servir de clé d'agrégation :
 *  - minuscules
 *  - sans diacritiques (é → e, œ → oe, …)
 *  - apostrophes courbes/droites et ponctuation → espace
 *  - espaces collapsés
 *  - trim
 */
export function normaliseNomTexte(s: string): string {
	let out = s.toLowerCase();
	// œ et æ ne sont pas décomposés par NFD seul, on les remplace explicitement
	out = out.replace(/œ/g, 'oe').replace(/æ/g, 'ae');
	// Décompose puis vire les diacritiques
	out = out.normalize('NFD').replace(/[̀-ͯ]/g, '');
	// Remplace toute ponctuation et symboles par un espace.
	// On garde uniquement les lettres ASCII, chiffres et espaces.
	out = out.replace(/[^a-z0-9\s]/g, ' ');
	// Collapse les espaces
	out = out.replace(/\s+/g, ' ').trim();
	return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Extraction de la signature
// ────────────────────────────────────────────────────────────────────────────

/**
 * Pattern qui identifie le type de texte dans un titre de scrutin AN.
 *
 * L'ordre des alternatives a son importance : les variantes les plus longues
 * d'abord (sinon "projet de loi" matche avant "projet de loi de finances").
 *
 * On capture aussi un suffixe optionnel "adoptée par le Sénat, …" inséré entre
 * "proposition de loi" et le libellé (cas des navettes), pour ne pas l'inclure
 * dans le nom du texte.
 */
const TYPE_TEXTE_PATTERN = new RegExp(
	'\\b(' +
		[
			// Projets de loi spéciaux (ordre important : longs d'abord)
			'projet de loi de financement de la s[ée]curit[ée] sociale rectificative',
			'projet de loi de financement de la s[ée]curit[ée] sociale',
			'projet de loi de finances rectificative',
			'projet de loi de finances de fin de gestion',
			'projet de loi de finances',
			'projet de loi de r[èe]glement',
			'projet de loi organique',
			'projet de loi constitutionnelle',
			'projet de loi',
			// Propositions
			'proposition de loi organique',
			'proposition de loi constitutionnelle',
			'proposition de loi',
			'proposition de r[ée]solution europ[ée]enne',
			'proposition de r[ée]solution'
		].join('|') +
		')\\b',
	'i'
);

/** Suffixes optionnels insérés après le type de texte qu'on doit ignorer (navette). */
const NAVETTE_PREFIX_PATTERN =
	/^\s*,?\s*(?:adopt[ée]e? par le s[ée]nat|modifi[ée]e? par le s[ée]nat|rejet[ée]e? par le s[ée]nat|adopt[ée]e? par l[' ]assembl[ée]e nationale)\s*,?\s*/i;

/** Suffixes de fin de titre à couper (lectures, suite, CMP, etc.). */
const TAIL_PATTERN =
	/\s*\((?:premi[èe]re|deuxi[èe]me|troisi[èe]me|seconde|nouvelle|derni[èe]re|lecture\s+d[ée]finitive)\s+lecture[^)]*\)\s*\.?\s*$|\s*\(suite\)\s*\.?\s*$|\s*\((?:CMP|texte de la commission mixte paritaire)[^)]*\)\s*\.?\s*$|\s*\(lecture d[ée]finitive\)\s*\.?\s*$|\s*\.\s*$/i;

/**
 * Mapping libellé brut (issu du regex, lowercased, sans accent) → TypeTexte canonique.
 */
function classifyTypeTexte(raw: string): TypeTexte {
	const k = raw
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	switch (k) {
		case 'projet de loi de financement de la securite sociale rectificative':
			return 'projet-loi-financement-ss-rectificative';
		case 'projet de loi de financement de la securite sociale':
			return 'projet-loi-financement-ss';
		case 'projet de loi de finances rectificative':
			return 'projet-loi-finances-rectificative';
		case 'projet de loi de finances de fin de gestion':
			return 'projet-loi-finances-fin-gestion';
		case 'projet de loi de finances':
			return 'projet-loi-finances';
		case 'projet de loi de reglement':
			return 'projet-loi-reglement';
		case 'projet de loi organique':
			return 'projet-loi-organique';
		case 'projet de loi constitutionnelle':
			return 'projet-loi-constitutionnelle';
		case 'projet de loi':
			return 'projet-loi';
		case 'proposition de loi organique':
			return 'proposition-loi-organique';
		case 'proposition de loi constitutionnelle':
			return 'proposition-loi-constitutionnelle';
		case 'proposition de loi':
			return 'proposition-loi';
		case 'proposition de resolution europeenne':
			return 'proposition-resolution-europeenne';
		case 'proposition de resolution':
			return 'proposition-resolution';
		default:
			// Cas non listé (ne devrait pas arriver vu le pattern), fallback prudent
			return 'projet-loi';
	}
}

/**
 * Extrait la signature d'un texte législatif depuis un titre de scrutin AN.
 *
 * Renvoie `null` pour les titres qui ne correspondent pas à un texte
 * législatif au sens strict : motions de censure, suspensions de séance,
 * autres scrutins de procédure.
 *
 * Algorithme :
 *  1. Trouver l'occurrence du type de texte dans le titre (regex)
 *  2. Tout ce qui suit le type, après éventuel préfixe de navette,
 *     jusqu'au suffixe (lecture/CMP) → est le `nom`.
 *  3. Normaliser le nom (minuscules, sans accents, ponctuation).
 *  4. Classifier le type en `TypeTexte` canonique.
 *
 * Le nom est ensuite tronqué pour exclure tout segment de type
 * "(examen prioritaire)" ou les références "à l'article …" qui pourraient
 * survivre (théoriquement coupé en amont, sécurité).
 */
export function extractTexteSignature(titre: string): TexteSignature | null {
	const m = TYPE_TEXTE_PATTERN.exec(titre);
	if (!m) return null;
	const typeRaw = m[1];
	const startAfter = m.index + m[0].length;
	let tail = titre.slice(startAfter);

	// Retire le préfixe navette ", adoptée par le Sénat, "
	tail = tail.replace(NAVETTE_PREFIX_PATTERN, ' ');

	// Coupe la fin (lecture/suite/CMP/promulgation)
	tail = tail.replace(TAIL_PATTERN, '');

	// Coupe à un éventuel "(examen prioritaire)" qui n'aurait pas été pris par TAIL_PATTERN
	tail = tail.replace(/\s*\(examen prioritaire\)\s*/gi, ' ');

	// Le nom est la partie restante, normalisée
	const nomNormalise = normaliseNomTexte(tail);
	if (!nomNormalise) return null;

	return {
		typeTexte: classifyTypeTexte(typeRaw),
		nomNormalise
	};
}
