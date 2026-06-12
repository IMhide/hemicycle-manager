/**
 * Politique de tolérance aux erreurs HTTP du prerender SSG (cf ADR 0041, hotfix
 * PR #33).
 *
 * Contexte : un élu présent au manifest mais sans aucun vote enregistré (ex.
 * secrétaire d'État au mandat AN écourté pour entrer au gouvernement, suppléant
 * éphémère) n'a légitimement PAS de fichier `/data/historique/{paId}.json` — la
 * map `historiques` (scripts/fetch-data.ts) ne reçoit une entrée que si la
 * personne a ≥ 1 vote. La fiche `/elus/[slug]` gère déjà l'absence via
 * `.catch(() => [])`, mais le crawler SSG de SvelteKit remonte TOUT fetch 404
 * comme erreur fatale, même rattrapé par l'app → `npm run build` exit 1 → la
 * nouvelle version n'est jamais déployée.
 *
 * Décision : ignorer les 404 sous `/data/historique/` (un seul élu sans
 * historique ne doit JAMAIS casser tout le déploiement) et laisser fatales
 * TOUTES les autres erreurs (une 404 sur une vraie page, un asset, un autre
 * fichier data reste un bug à corriger, pas à masquer).
 *
 * Module pur en `.js` (et non `.ts`) pour être importable tel quel par
 * `svelte.config.js` sur n'importe quel Node — le Dockerfile build sur
 * node:22-alpine, sans `--experimental-strip-types`. Le prédicat réellement
 * déployé est donc exactement celui couvert par les tests (prerender-policy.test.ts).
 */

/** Préfixe des historiques de vote dénormalisés, dont l'absence est légitime. */
export const HISTORIQUE_PREFIX = '/data/historique/';

/**
 * Décide si une erreur HTTP rencontrée au prerender doit être ignorée
 * (tolérée, build continue) ou rester fatale (build échoue).
 *
 * @param {string} path chemin fetché ayant échoué (ex. `/data/historique/PA720242.json`)
 * @returns {boolean} `true` si l'erreur est tolérée (à ignorer), `false` si fatale.
 */
export function isToleratedPrerenderError(path) {
	return path.startsWith(HISTORIQUE_PREFIX);
}
