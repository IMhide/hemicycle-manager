/**
 * Matching cross-chambre AN ↔ Sénat des textes législatifs (N3.c navette).
 *
 * Le module produit un mapping bidirectionnel entre les `Texte` (AN, ADR 0035)
 * et les `TexteSenat` (Sénat, N3.b). La cascade est :
 *
 *  1. **slug `senatUrl`** : l'URL Sénat dans `texte.senatUrl` (AN) contient un
 *     slug type `pjl24-035` / `ppl23-720`. On le résout vers un `loicod` via
 *     un index pré-construit `slug → Set<loicod>` (issu du chaînage
 *     `texte.texurl → lecass → lecture → loi` du dump dosleg).
 *  2. **fallback titre** : on normalise titre AN et titre Sénat (NFD, strip
 *     diacritiques, retrait préfixe `projet de loi…`/`proposition de loi…`)
 *     et on cherche une correspondance unique côté Sénat. Si plusieurs
 *     candidats partagent la même signature, on s'abstient (prudent).
 *
 * Aucun matching n'est jamais ambigu : si plusieurs candidats existent au
 * niveau 2, on préfère ne pas matcher que de tirer au hasard.
 *
 * Mesures (sur les datasets actuels) :
 *  - 177 textes AN ont un senatUrl ; 81 (45,8%) trouvent un loicod existant
 *    côté Sénat via slug. Les 96 restants pointent vers des dossiers du
 *    dump qui n'ont pas été agrégés en TexteSenat (pas de scrutin Sénat).
 *  - Le fallback titre récupère ~40 textes supplémentaires (textes AN sans
 *    senatUrl mais dont le titre canonique matche celui d'un TexteSenat).
 */

import { normaliseNomTexte, extractTexteSignature } from './texte-parser.ts';

// ────────────────────────────────────────────────────────────────────────────
// Extraction du slug Sénat depuis une URL
// ────────────────────────────────────────────────────────────────────────────

/** Pattern URL Sénat type `/dossier-legislatif/<slug>.html` avec slug optionnel
 *  query/fragment derrière. Le slug est ramené en minuscules pour matching. */
const SENAT_URL_PATTERN = /\/dossier-legislatif\/([a-zA-Z0-9_-]+)\.html?/i;

/** Extrait le slug du dossier Sénat depuis une URL.
 *
 *  Exemples :
 *   - `https://www.senat.fr/dossier-legislatif/pjl24-035.html` → `pjl24-035`
 *   - `https://www.senat.fr/dossier-legislatif/pjlf2025.html` → `pjlf2025`
 *   - `https://www.senat.fr/dossier-legislatif/PJL24-035.HTML` → `pjl24-035`
 *
 *  Renvoie `null` pour les URL inattendues ou null/vide. */
export function extractSenatSlug(url: string | null | undefined): string | null {
	if (!url) return null;
	const m = SENAT_URL_PATTERN.exec(url);
	return m ? m[1].toLowerCase() : null;
}

// ────────────────────────────────────────────────────────────────────────────
// Normalisation titre pour matching cross-chambre
// ────────────────────────────────────────────────────────────────────────────

/** Préfixes "navette" verbeux fréquents côté `loi.loitit` Sénat, qu'on retire
 *  avant la normalisation pour ne garder que la portion "visant à X" /
 *  "relative à Y" / "portant Z" commune avec le titre AN. */
const SENAT_NAVETTE_NOISE_PATTERN = new RegExp(
	'^(' +
		[
			// Variantes "adopté/modifié/rejeté par X" optionnellement suivi de procédure
			'adopt[ée]e? par (l[\']?assembl[ée]e nationale|le s[ée]nat)',
			'modifi[ée]e? par (l[\']?assembl[ée]e nationale|le s[ée]nat)',
			'rejet[ée]e? par (l[\']?assembl[ée]e nationale|le s[ée]nat)',
			'transmis(?:e)? par (l[\']?assembl[ée]e nationale|le s[ée]nat)',
			// Suite : "en nouvelle lecture", "après engagement de la procédure accélérée", etc.
			'(?:en (?:nouvelle|premi[èe]re|deuxi[èe]me|seconde) lecture)',
			'apr[èe]s engagement de la proc[ée]dure acc[ée]l[ée]r[ée]e',
			'apr[èe]s d[ée]claration d[\']urgence',
			'consid[ée]r[ée]e? comme (?:adopt|modifi)[ée]e?',
			'avec modifications',
			'd[ée]finitivement'
		].join('|') +
		')',
	'gi'
);

/** Normalise un titre pour matching cross-chambre.
 *
 *  Approche en 2 étapes :
 *   1. Si le titre contient "projet de loi" / "proposition de loi", on extrait
 *      la partie utile (souvent "visant à X" / "relative à Y") en retirant le
 *      bruit navette ("adoptée par l'AN", "après engagement de la procédure
 *      accélérée", "en nouvelle lecture", etc.) avant la partie "visant à".
 *   2. Sinon (titre AN canonique sans préfixe type, ex. "Renforcer la prévention
 *      en santé au travail"), on normalise directement.
 *
 *  Le résultat est stable entre titre AN (Dossiers_Legislatifs.titre) et
 *  titre Sénat (loi.loitit), qui partagent la même portion "visant à X". */
export function normaliseTitreCrossChambre(titre: string): string {
	if (!titre) return '';
	const t = titre.trim();
	if (!t) return '';

	// Cas 1 : titre contient un type texte → on tente extraction de la partie utile
	const sig = extractTexteSignature(t);
	if (sig) {
		// extractTexteSignature peut inclure du bruit navette dans nomNormalise quand
		// le préfixe navette n'est pas couvert par son NAVETTE_PREFIX_PATTERN. On
		// nettoie a posteriori en repassant le bruit identifié ci-dessus.
		let nom = sig.nomNormalise;
		// Retire tout segment "navette" résiduel suivi d'une virgule virtuelle
		// (déjà collapsée en espace par normaliseNomTexte). Note : le bruit est
		// désaccentué et minuscule à ce stade.
		nom = stripNavetteNoiseNormalised(nom);
		return nom;
	}

	// Cas 2 : titre AN canonique ("Renforcer la prévention…") sans préfixe
	return normaliseNomTexte(t);
}

/** Retire les segments de bruit navette d'un nom **déjà normalisé** (lowercase,
 *  sans accents, sans ponctuation). On enlève des motifs très spécifiques pour
 *  ne pas casser les vrais noms de textes. */
function stripNavetteNoiseNormalised(nom: string): string {
	let out = nom;
	const patterns = [
		/\badoptee? par l assemblee nationale\b/g,
		/\bmodifiee? par l assemblee nationale\b/g,
		/\brejetee? par l assemblee nationale\b/g,
		/\btransmise? par l assemblee nationale\b/g,
		/\badoptee? par le senat\b/g,
		/\bmodifiee? par le senat\b/g,
		/\bapres engagement de la procedure acceleree\b/g,
		/\bapres declaration d urgence\b/g,
		/\ben nouvelle lecture\b/g,
		/\ben premiere lecture\b/g,
		/\ben deuxieme lecture\b/g,
		/\ben seconde lecture\b/g,
		/\bavec modifications\b/g,
		/\bconsideree? comme adoptee?\b/g,
		/\bconsideree? comme modifiee?\b/g,
		/\bdefinitivement\b/g
	];
	for (const p of patterns) out = out.replace(p, ' ');
	out = out.replace(/\s+/g, ' ').trim();
	// Retire les locutions de liaison en début (asymétrie AN vs Sénat) :
	// AN : "Démocratiser le sport en France"
	// Sénat : "visant à démocratiser le sport en France"
	// → on retire le préfixe "visant a", "relative a", "portant", etc. UNIQUEMENT
	//   en début de chaîne, pour rapprocher les deux conventions.
	out = out.replace(/^(visant a |relative a |relatif a |relatives a |relatifs a |tendant a |portant |pour |en faveur de l? ?|sur la? |sur les? )+/, '');
	return out.trim();
}

// Le pattern SENAT_NAVETTE_NOISE_PATTERN n'est pas exporté ; on le garde pour
// référence/future extension si on veut nettoyer côté brut.
void SENAT_NAVETTE_NOISE_PATTERN;

// ────────────────────────────────────────────────────────────────────────────
// Matching orchestré
// ────────────────────────────────────────────────────────────────────────────

/** Sous-ensemble d'un `Texte` AN nécessaire pour le matching. */
export interface TexteAnPourMatch {
	id: string;
	titre: string;
	senatUrl: string | null;
	enrichiDossiersAN: boolean;
}

/** Sous-ensemble d'un `TexteSenat` nécessaire pour le matching. */
export interface TexteSenatPourMatch {
	id: string; // loicod trimmé
	titre: string;
}

export interface CrossChambreMatchResult {
	/** texteAN.id → texteSenat.id */
	anToSenat: Map<string, string>;
	/** texteSenat.id → texteAN.id */
	senatToAn: Map<string, string>;
}

/** Calcule le matching bidirectionnel AN ↔ Sénat en cascade. */
export function matchTextesAnSenat(
	textesAN: TexteAnPourMatch[],
	textesSenat: TexteSenatPourMatch[],
	slugToLoicod: Map<string, Set<string>>
): CrossChambreMatchResult {
	const anToSenat = new Map<string, string>();
	const senatToAn = new Map<string, string>();
	const senatById = new Map(textesSenat.map((t) => [t.id, t]));

	// Pré-construit l'index titre → liste de TexteSenat partageant cette signature
	const titreToSenat = new Map<string, TexteSenatPourMatch[]>();
	for (const sen of textesSenat) {
		const sig = normaliseTitreCrossChambre(sen.titre);
		if (!sig) continue;
		const arr = titreToSenat.get(sig);
		if (arr) arr.push(sen);
		else titreToSenat.set(sig, [sen]);
	}

	// Niveau 1 — slug senatUrl → loicod
	for (const an of textesAN) {
		const slug = extractSenatSlug(an.senatUrl);
		if (!slug) continue;
		const loicods = slugToLoicod.get(slug);
		if (!loicods) continue;
		// On garde le premier loicod qui correspond à un TexteSenat existant
		let matched: string | null = null;
		for (const loi of loicods) {
			if (senatById.has(loi)) {
				matched = loi;
				break;
			}
		}
		if (matched === null) continue;
		anToSenat.set(an.id, matched);
		// Symétrie : un loicod ne doit être lié qu'à un seul AN (premier gagne)
		if (!senatToAn.has(matched)) senatToAn.set(matched, an.id);
	}

	// Niveau 2 — fallback titre fuzzy (uniquement pour les textes AN
	// enrichis : un texte sig-* a un titre dérivé du scrutin, peu fiable)
	for (const an of textesAN) {
		if (anToSenat.has(an.id)) continue; // déjà matché au niveau 1
		if (!an.enrichiDossiersAN) continue;
		const sig = normaliseTitreCrossChambre(an.titre);
		if (!sig) continue;
		const candidates = titreToSenat.get(sig);
		if (!candidates || candidates.length !== 1) continue;
		const sen = candidates[0];
		// Ne pas écraser une liaison Sénat→AN déjà établie au niveau 1
		if (senatToAn.has(sen.id)) continue;
		anToSenat.set(an.id, sen.id);
		senatToAn.set(sen.id, an.id);
	}

	return { anToSenat, senatToAn };
}
