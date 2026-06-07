/**
 * Slugification des URLs lisibles (cf ADR 0042).
 *
 * Le slug remplace l'id opaque (`elu_9409de12`, `DLR5L17N51175`) dans les URLs
 * de fiches pour ranker sur le nom/l'entité. Calculé au pipeline, stocké dans
 * le manifest, déterministe et unique. Module pur, testé en TDD strict
 * (`slug.test.ts`).
 *
 * Règles par type (cf ADR 0042) :
 *  - Élus    : `prenom-nom` ; désambiguïsation par suffixe stable (paId/
 *              matricule) UNIQUEMENT en cas de collision (1 cas réel sur 1856).
 *  - Textes  : préfixe titre tronqué (frontière de mot) + id canonique
 *              (l'id garantit l'unicité ; 35 collisions de titres).
 *  - Groupes : `libelle` slugifié, déjà désambiguïsé par législature/triennat.
 */

import { createHash } from 'node:crypto';

/**
 * Normalise une chaîne en slug URL : minuscules, accents supprimés (NFD),
 * tout caractère non `[a-z0-9]` réduit à un tiret, tirets collapsés, sans
 * tiret en tête/queue.
 */
export function slugify(input: string): string {
	return input
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '') // diacritiques
		.toLowerCase()
		// Ligatures que NFD ne décompose pas (présentes dans des prénoms FR :
		// Lætitia, Œuvre…) — translittérées explicitement avant le filtre.
		.replace(/æ/g, 'ae')
		.replace(/œ/g, 'oe')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Tronque un slug à `max` caractères sur une frontière de mot (un tiret) quand
 * c'est possible, sans laisser de tiret final. Si le premier mot dépasse déjà
 * `max`, coupe dur.
 */
export function truncateOnWordBoundary(slug: string, max: number): string {
	if (slug.length <= max) return slug;
	const hard = slug.slice(0, max);
	const lastDash = hard.lastIndexOf('-');
	// Coupe sur le dernier tiret si on en a un (≠ position 0) → mots complets.
	const cut = lastDash > 0 ? hard.slice(0, lastDash) : hard;
	return cut.replace(/-+$/, '');
}

/** Longueur max du préfixe-titre d'un slug de texte (avant l'id). */
const TEXTE_TITLE_MAX = 60;

/**
 * Suffixe URL-safe pour un id de texte.
 * - Id déjà court et URL-safe (`DLR5L17N51175`, nombres) → conservé tel quel
 *   (casse comprise) : c'est un identifiant stable et lisible.
 * - Id « signature » long / non URL-safe (231 textes réels, jusqu'à 444 car.,
 *   `sig-2021|projet-loi|…`, cf ADR 0035) → haché en un token court et stable
 *   préfixé `sig-`, pour borner la longueur de l'URL sans perdre l'unicité.
 */
function texteIdSuffix(id: string): string {
	const urlSafe = /^[A-Za-z0-9_-]+$/.test(id);
	if (urlSafe && id.length <= 24) return id;
	// Hash déterministe (sha1-8) — même convention courte que les eluId.
	const hash = createHash('sha1').update(id).digest('hex').slice(0, 8);
	return `sig-${hash}`;
}

/**
 * Slug d'un texte législatif : préfixe de titre lisible + suffixe d'id.
 * Le suffixe (id court conservé, ou hash court pour les ids signature)
 * garantit l'unicité même quand deux textes partagent le même titre, tout en
 * bornant la longueur de l'URL.
 */
export function texteSlug(titre: string, id: string): string {
	const prefix = truncateOnWordBoundary(slugify(titre), TEXTE_TITLE_MAX);
	const suffix = texteIdSuffix(id);
	return prefix ? `${prefix}-${suffix}` : suffix;
}

export interface AssignSlugsOptions<T> {
	/** Slug de base (avant désambiguïsation), p.ex. `slugify(prenom+' '+nom)`. */
	base: (item: T) => string;
	/**
	 * Suffixe stable utilisé uniquement en cas de collision sur le slug de base
	 * (p.ex. l'id / paId / matricule). Doit être unique par item.
	 */
	disambiguator: (item: T) => string;
	/** Extrait la clé d'identité de l'item (défaut : propriété `id`). */
	key?: (item: T) => string;
}

/**
 * Assigne un slug unique à chaque item d'une collection.
 *
 * - Si le slug de base est unique dans la collection → utilisé tel quel.
 * - Si plusieurs items partagent le même slug de base → **tous** reçoivent le
 *   suffixe désambiguïsant (`base-disambiguator`), pour qu'aucune entité ne
 *   conserve un slug ambigu et que les URLs soient stables.
 *
 * Déterministe et indépendant de l'ordre d'entrée : le slug d'une entité ne
 * dépend que de ses propres champs et de l'existence (ou non) d'une collision.
 *
 * @returns Map `key(item)` → slug final.
 */
export function assignSlugs<T>(items: T[], opt: AssignSlugsOptions<T>): Map<string, string> {
	const key = opt.key ?? ((item: T) => (item as { id: string }).id);

	// 1) Compter les occurrences de chaque slug de base.
	const baseCounts = new Map<string, number>();
	for (const item of items) {
		const b = opt.base(item);
		baseCounts.set(b, (baseCounts.get(b) ?? 0) + 1);
	}

	// 2) Slug nu si unique, sinon base + suffixe stable pour TOUS les colliding.
	const out = new Map<string, string>();
	for (const item of items) {
		const b = opt.base(item);
		const slug = baseCounts.get(b)! > 1 ? `${b}-${slugify(opt.disambiguator(item))}` : b;
		out.set(key(item), slug);
	}
	return out;
}
