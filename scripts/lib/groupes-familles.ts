/**
 * Familles politiques (cf ADR 0034).
 *
 * Source de vérité : `static/data/groupes-familles.json` (commité, exception
 * au gitignore static/data/). Une famille regroupe les variantes successives
 * d'un même parti politique dont l'ID/code Etalab change entre législatures
 * ou triennats (LFI/LFI-NUPES/LFI-NFP, LaREM/RE/EPR, MODEM/Dem, etc.).
 *
 * Utilisé par les pipelines AN et Sénat pour déterminer si deux mandats
 * successifs appartiennent à la même famille (badge `recomposition` éliminé)
 * ou à deux familles distinctes (badge `recomposition` conservé).
 *
 * Politique : un groupe absent de la table est traité comme **sa propre
 * famille**, identifiée par son ID/code brut. Pas de fusion implicite : seules
 * les équivalences explicitement listées sont reconnues. Cohérent avec la
 * rigueur sourçage de PolitiDex (un faux positif est moins grave qu'une
 * fusion silencieuse opaque).
 */

export interface GroupeAN {
	chambre: 'AN';
	id: string;
	libelle: string;
}

export interface GroupeSenat {
	chambre: 'SENAT';
	code: string;
	libelle: string;
}

export type GroupeRef = GroupeAN | GroupeSenat;

export interface FamilleDef {
	label: string;
	groupes: GroupeRef[];
}

export interface FamillesManifest {
	$schema?: string;
	familles: Record<string, FamilleDef>;
}

/** Construit deux index `groupeId|code → familleId` pour lookup O(1). */
export interface FamillesIndex {
	an: Map<string, string>;
	senat: Map<string, string>;
}

export function buildFamillesIndex(manifest: FamillesManifest): FamillesIndex {
	const an = new Map<string, string>();
	const senat = new Map<string, string>();
	for (const [familleId, def] of Object.entries(manifest.familles)) {
		for (const g of def.groupes) {
			if (g.chambre === 'AN') {
				if (an.has(g.id)) {
					throw new Error(
						`groupes-familles : groupe AN ${g.id} mappé à deux familles (${an.get(g.id)} et ${familleId})`
					);
				}
				an.set(g.id, familleId);
			} else if (g.chambre === 'SENAT') {
				if (senat.has(g.code)) {
					throw new Error(
						`groupes-familles : groupe Sénat ${g.code} mappé à deux familles (${senat.get(g.code)} et ${familleId})`
					);
				}
				senat.set(g.code, familleId);
			}
		}
	}
	return { an, senat };
}

/**
 * Renvoie l'identifiant de famille pour un groupe AN.
 * Si le groupe est absent de la table, renvoie le `groupeId` brut (le groupe
 * est sa propre famille, il n'est équivalent qu'à lui-même).
 */
export function familleAN(index: FamillesIndex, groupeId: string): string {
	return index.an.get(groupeId) ?? groupeId;
}

/**
 * Renvoie l'identifiant de famille pour un groupe Sénat.
 * Si le groupe est absent de la table, renvoie le `groupeCode` brut.
 */
export function familleSenat(index: FamillesIndex, groupeCode: string): string {
	return index.senat.get(groupeCode) ?? groupeCode;
}
