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

/** Charge l'intégralité du manifest `elus.json`. Cache mémoire (idempotent). */
export async function loadElusManifest(fetchFn: FetchFn): Promise<EluManifest> {
	if (_cached) return _cached;
	const res = await fetchFn('/data/elus.json');
	if (!res.ok) {
		throw new Error(`Impossible de charger /data/elus.json (${res.status})`);
	}
	const manifest = (await res.json()) as EluManifest;
	_cached = manifest;
	return manifest;
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
