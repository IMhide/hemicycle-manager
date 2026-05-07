/**
 * Loaders et helpers pour le manifest bicaméral `elus.json` (cf ADR 0031 + ADR 0032).
 *
 * Le manifest est généré par `scripts/build-elus-manifest.ts` à partir de
 * `personnes.json` (AN) et `senat/senateurs.json` (Sénat). Côté front, on
 * expose un type `Elu` aligné avec le schéma de sortie + des fetchers et
 * lookups utilisés par les routes `/elus/*` et la réécriture des liens
 * internes (cf ADR 0030).
 *
 * Aucune logique métier ici — juste fetch + lookup. Les agrégations carrière
 * (overall moyen, radar moyenné, badges) sont calculées dans le pipeline.
 */

export type EluMandatRef =
	| {
			chambre: 'AN';
			legislature: number;
			debut: string;
			fin: string | null;
			overall: number;
	  }
	| {
			chambre: 'SENAT';
			triennat: string;
			debut: string;
			fin: string | null;
			overall: number;
	  };

export type BadgeCarriereCross =
	| 'Recomposition'
	| 'Transfuge'
	| 'Veteran'
	| 'Reelu'
	| 'Bicameral';

export interface EluRadar {
	presence: number;
	participation: number;
	loyaute: number;
	volume: number;
	frondes: number;
}

export interface Elu {
	id: string; // elu_<8 hex>
	prenom: string;
	nom: string;
	civ: string;
	sexe: string;
	dateNaissance: string | null;
	photoUrl: string;
	paId: string | null;
	matricule: string | null;
	mandats: EluMandatRef[];
	overallCarriere: number;
	radarCarriere: EluRadar;
	badgesCarriere: BadgeCarriereCross[];
}

export interface EluManifest {
	generatedAt: string;
	count: number;
	countBicameral: number;
	elus: Elu[];
	warnings: string[];
}

type FetchFn = typeof fetch;

let _cached: EluManifest | null = null;
let _byPaId = new Map<string, Elu>();
let _byMatricule = new Map<string, Elu>();
let _byEluId = new Map<string, Elu>();

function rebuildIndexes(manifest: EluManifest) {
	_byPaId = new Map();
	_byMatricule = new Map();
	_byEluId = new Map();
	for (const e of manifest.elus) {
		if (e.paId) _byPaId.set(e.paId, e);
		if (e.matricule) _byMatricule.set(e.matricule, e);
		_byEluId.set(e.id, e);
	}
}

/** Charge l'intégralité du manifest `elus.json`. Cache mémoire (idempotent). */
export async function loadElusManifest(fetchFn: FetchFn): Promise<EluManifest> {
	if (_cached) return _cached;
	const res = await fetchFn('/data/elus.json');
	if (!res.ok) {
		throw new Error(`Impossible de charger /data/elus.json (${res.status})`);
	}
	const manifest = (await res.json()) as EluManifest;
	_cached = manifest;
	rebuildIndexes(manifest);
	return manifest;
}

/**
 * Lookup direct sur le cache module (chargé via `loadElusManifest` dans
 * `+layout.ts`). Permet aux composants `lib/components/*` de résoudre
 * `paId → eluId` sans recevoir `elus[]` en prop. Retourne `null` tant que
 * le manifest n'a pas été chargé (cas CI placeholder ou page sans layout
 * data).
 */
export function lookupEluByPaId(paId: string): Elu | null {
	return _byPaId.get(paId) ?? null;
}

export function lookupEluByMatricule(matricule: string): Elu | null {
	return _byMatricule.get(matricule) ?? null;
}

export function lookupEluByEluId(eluId: string): Elu | null {
	return _byEluId.get(eluId) ?? null;
}

/**
 * URL fiche Élu pour un PA-id + une législature (mandat AN). Tombe sur
 * `null` si le manifest n'est pas chargé ou si le PA-id n'a pas d'Elu —
 * dans ce cas le caller affiche soit un fallback, soit cache le lien.
 */
export function lookupEluUrlForPaIdLeg(paId: string, leg: number): string | null {
	const elu = lookupEluByPaId(paId);
	if (!elu) return null;
	return `/elus/${elu.id}?tab=an-${leg}`;
}

export function lookupEluUrlForMatriculeTriennat(
	matricule: string,
	periode: string
): string | null {
	const elu = lookupEluByMatricule(matricule);
	if (!elu) return null;
	return `/elus/${elu.id}?tab=senat-${periode}`;
}

/** URL Carrière par PA-id (sans législature spécifique). */
export function lookupEluUrlCarriereForPaId(paId: string): string | null {
	const elu = lookupEluByPaId(paId);
	if (!elu) return null;
	return `/elus/${elu.id}?tab=carriere`;
}

export function lookupEluUrlCarriereForMatricule(matricule: string): string | null {
	const elu = lookupEluByMatricule(matricule);
	if (!elu) return null;
	return `/elus/${elu.id}?tab=carriere`;
}

/** Charge un Elu par son `eluId`. Retourne `null` si inconnu. */
export async function loadElu(fetchFn: FetchFn, eluId: string): Promise<Elu | null> {
	const manifest = await loadElusManifest(fetchFn);
	return manifest.elus.find((e) => e.id === eluId) ?? null;
}

/** Trouve l'Elu correspondant à un PA-id AN. */
export function findEluByPaId(elus: Elu[], paId: string): Elu | null {
	return elus.find((e) => e.paId === paId) ?? null;
}

/** Trouve l'Elu correspondant à un matricule Sénat. */
export function findEluByMatricule(elus: Elu[], matricule: string): Elu | null {
	return elus.find((e) => e.matricule === matricule) ?? null;
}

/**
 * Construit l'URL d'un mandat AN sur la fiche Élu :
 * `/elus/[eluId]?tab=an-{leg}`. Si `paId` n'a pas d'Elu correspondant
 * (manifest absent en CI placeholders), retourne `null`.
 */
export function eluUrlForPaIdLeg(elus: Elu[], paId: string, leg: number): string | null {
	const elu = findEluByPaId(elus, paId);
	if (!elu) return null;
	return `/elus/${elu.id}?tab=an-${leg}`;
}

/** Construit l'URL `/elus/[eluId]?tab=senat-{periode}`. */
export function eluUrlForMatriculeTriennat(
	elus: Elu[],
	matricule: string,
	periode: string
): string | null {
	const elu = findEluByMatricule(elus, matricule);
	if (!elu) return null;
	return `/elus/${elu.id}?tab=senat-${periode}`;
}

/** URL de base d'un Elu (vue Carrière par défaut). */
export function eluUrlCarriere(eluId: string): string {
	return `/elus/${eluId}?tab=carriere`;
}

/** Catégorise un Elu : 'an' (AN seul), 'senat' (Sénat seul), 'bicameral'. */
export function eluCategorie(elu: Elu): 'an' | 'senat' | 'bicameral' {
	const hasAN = elu.mandats.some((m) => m.chambre === 'AN');
	const hasSenat = elu.mandats.some((m) => m.chambre === 'SENAT');
	if (hasAN && hasSenat) return 'bicameral';
	if (hasAN) return 'an';
	return 'senat';
}
