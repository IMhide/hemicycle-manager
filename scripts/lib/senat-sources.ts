/**
 * Lecture résiliente des sources Sénat. Le pipeline est conçu pour rester
 * fonctionnel même quand une source est indisponible ou corrompue (cf
 * ADR 0033). Le payload `api-senat/senateurs.json` peut renvoyer :
 *  - 200 OK + 0 octet (CDN qui régénère)
 *  - JSON invalide (caractères de contrôle nus dans certains champs)
 *  - JSON valide mais non-array
 *
 * On gère tous ces cas en retournant `[]` (avec log) plutôt que de crasher
 * le build complet.
 */

/** Sous-ensemble des champs API senat.fr utilisés par le pipeline. */
export interface ApiSenateurRaw {
	matricule: string;
	nom: string;
	prenom: string;
	civilite?: string;
	serie?: string;
	siege?: number;
	urlAvatar?: string;
	dateFin?: string | null;
	etat?: string;
	[k: string]: unknown;
}

/**
 * Lit le contenu brut de `api-senat/senateurs.json` (déjà téléchargé) et
 * retourne le tableau des sénateurs, ou `[]` si le payload est inutilisable.
 *
 * Trois sources d'inutilisabilité gérées :
 *  - vide (CDN en train de régénérer)
 *  - JSON invalide (caractères de contrôle nus dans une string, ex. ``
 *    dans le champ `twitter` mesuré 2026-05-13)
 *  - non-array (cas exotique)
 *
 * Nettoyage défensif : on retire les caractères de contrôle ASCII (0x00-0x08,
 * 0x0B-0x0C, 0x0E-0x1F, 0x7F) qui ne devraient jamais apparaître dans un JSON
 * valide. On préserve `\t` (0x09), `\n` (0x0A), `\r` (0x0D) qui sont des
 * whitespaces JSON acceptés entre tokens.
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
	const sanitised = stripJsonControlChars(trimmed);
	let parsed: unknown;
	try {
		parsed = JSON.parse(sanitised);
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

/** Retire les caractères de contrôle invalides en JSON (codes 0x00-0x08,
 *  0x0B-0x0C, 0x0E-0x1F, 0x7F). Préserve `\t \n \r` qui sont des whitespaces
 *  acceptés entre tokens. */
export function stripJsonControlChars(s: string): string {
	// eslint-disable-next-line no-control-regex
	return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}
