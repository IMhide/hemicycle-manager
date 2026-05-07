/**
 * Loader léger pour `static/data/groupes-familles.json` (cf ADR 0034).
 *
 * Le front a besoin de :
 *  - la liste des familles politiques pour alimenter le filtre multi-OR
 *  - le label lisible d'une famille (`FAMILLE_LFI` → "La France insoumise")
 *
 * La résolution `groupeId/Code → familleId` est déjà pré-calculée par le
 * pipeline et écrite dans `mandat.famille`. Le front n'a qu'à faire le
 * mapping inverse familleId → label pour l'UI.
 */

export interface FamilleDef {
	id: string;
	label: string;
}

export interface FamillesManifest {
	familles: Record<
		string,
		{
			label: string;
			groupes: Array<
				| { chambre: 'AN'; id: string; libelle?: string }
				| { chambre: 'SENAT'; code: string; libelle?: string }
			>;
		}
	>;
}

export interface FamillesData {
	list: FamilleDef[];
	byGroupeIdAN: Record<string, string>;
	byGroupeCodeSenat: Record<string, string>;
}

let _cached: FamillesData | null = null;
let _byId: Map<string, FamilleDef> = new Map();

type FetchFn = typeof fetch;

export async function loadFamilles(fetchFn: FetchFn): Promise<FamillesData> {
	if (_cached) return _cached;
	const res = await fetchFn('/data/groupes-familles.json');
	if (!res.ok) {
		_cached = { list: [], byGroupeIdAN: {}, byGroupeCodeSenat: {} };
		_byId = new Map();
		return _cached;
	}
	const manifest = (await res.json()) as FamillesManifest;
	const list: FamilleDef[] = Object.entries(manifest.familles).map(([id, def]) => ({
		id,
		label: def.label
	}));
	list.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
	const byGroupeIdAN: Record<string, string> = {};
	const byGroupeCodeSenat: Record<string, string> = {};
	for (const [familleId, def] of Object.entries(manifest.familles)) {
		for (const g of def.groupes) {
			if (g.chambre === 'AN') byGroupeIdAN[g.id] = familleId;
			else if (g.chambre === 'SENAT') byGroupeCodeSenat[g.code] = familleId;
		}
	}
	_cached = { list, byGroupeIdAN, byGroupeCodeSenat };
	_byId = new Map(list.map((f) => [f.id, f]));
	return _cached;
}

/** Renvoie le label d'une famille, ou l'ID brut si non trouvée (cf ADR 0034 fallback). */
export function familleLabel(familleId: string | null): string {
	if (!familleId) return 'Sans groupe';
	return _byId.get(familleId)?.label ?? familleId;
}

/** Liste synchrone des familles (après `loadFamilles`). */
export function listFamilles(): FamilleDef[] {
	return _cached?.list ?? [];
}
