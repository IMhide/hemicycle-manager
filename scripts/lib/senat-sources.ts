/**
 * Helpers de lecture défensive des sources Sénat.
 *
 * Encapsule la cascade ADR 0025 : api-senat (live) > ODSEN_* > dosleg.
 * api-senat est ici **optionnel** : sa seule plus-value est `siege`/`serie`/photo
 * /groupe live des sénateurs en exercice. Si la ressource est inutilisable, le
 * pipeline doit continuer avec ODSEN+dosleg (identité historique + scrutins).
 *
 * Cas observé 2026-05-07 : senat.fr/api-senat/senateurs.json a renvoyé
 * 200 OK + 0 octet pendant ~1 h, plantant les déploiements Coolify. Cette
 * fonction transforme ce mode de panne en fallback gracieux.
 */

export interface ApiSenateurRaw {
	matricule: string;
	nom: string;
	prenom: string;
	civilite: string;
	siege: number | null;
	serie: '1' | '2' | null;
	urlAvatar: string;
	groupe?: { code: string; libelle: string; ordre: number };
	circonscription?: { code: string; libelle: string };
	categorieProfessionnelle?: { code: string; libelle: string };
}

/**
 * Parse le contenu brut de `senateurs-api.json` en mode tolérant.
 *
 * Renvoie `[]` (avec warning sur stderr-like via `log`) dans 4 cas :
 *  - chaîne vide / blancs uniquement (200 OK + 0 octet côté CDN)
 *  - JSON syntaxiquement invalide
 *  - JSON valide mais pas un tableau (objet d'erreur Cloudflare, etc.)
 *  - JSON tableau vide → renvoie `[]` sans warning (cas legit improbable mais valide)
 *
 * @param raw  Contenu brut du fichier
 * @param log  Logger optionnel (tests : `() => {}`, prod : `console.log`)
 */
export function readApiSenateursOrEmpty(
	raw: string,
	log: (msg: string) => void = console.log
): ApiSenateurRaw[] {
	const trimmed = raw.trim();
	if (trimmed.length === 0) {
		log(
			'    ⚠ api-senat/senateurs.json vide — fallback ODSEN+dosleg (siege/serie/photo seront null ce build)'
		);
		return [];
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch (err) {
		log(
			`    ⚠ api-senat/senateurs.json JSON invalide (${(err as Error).message}) — fallback ODSEN+dosleg`
		);
		return [];
	}
	if (!Array.isArray(parsed)) {
		log(
			'    ⚠ api-senat/senateurs.json non-tableau — fallback ODSEN+dosleg (siege/serie/photo seront null ce build)'
		);
		return [];
	}
	return parsed as ApiSenateurRaw[];
}
