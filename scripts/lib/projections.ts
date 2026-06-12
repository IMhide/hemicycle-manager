/**
 * Projections « lite » et dénormalisation pour le prerender (cf ADR 0041).
 *
 * Objectif : permettre de prérendre ~2421 fiches en HTML statique sans inliner
 * les gros datasets. Trois transformations pures, testées en TDD :
 *  - `scrutinMetaIndex` : `uid → meta` pour dénormaliser l'historique.
 *  - `denormaliseHistorique` : ajoute la 5e case (meta scrutin) aux tuples,
 *    pour que la fiche élu n'ait plus à charger `scrutins-index.json` (6,1 Mo).
 *  - `recentScrutinsParLegislature` : N derniers scrutins par législature, pour
 *    la home (qui n'en affiche que ~8) au lieu de l'index complet.
 *
 * Module pur (aucune I/O) — le driver `fetch-data.ts` lit/écrit les fichiers.
 */

import type {
	ScrutinIndex,
	VoteHistoryItem,
	VoteHistoryScrutinMeta
} from '../../src/lib/types.ts';

/** Champs minimaux d'un scrutin (AN ou Sénat) pour la projection meta.
 *  Le numéro de scrutin s'appelle `numero` côté AN et `scrnum` côté Sénat ;
 *  on accepte les deux et on normalise vers `numero` dans la meta. */
type ScrutinMetaSource = {
	uid: string;
	titre: string;
	date: string;
	sort: string;
	texteId: string | null;
	pour: number;
	contre: number;
	abstention: number;
	numero?: number;
	scrnum?: number;
};

/** Construit l'index `uid → meta scrutin` (champs d'affichage uniquement).
 *  Chamber-agnostic : marche pour ScrutinIndex (AN) comme ScrutinSenatIndex. */
export function scrutinMetaIndex(
	scrutins: ScrutinMetaSource[]
): Map<string, VoteHistoryScrutinMeta> {
	const m = new Map<string, VoteHistoryScrutinMeta>();
	for (const s of scrutins) {
		m.set(s.uid, {
			titre: s.titre,
			date: s.date,
			sort: s.sort,
			numero: s.numero ?? s.scrnum ?? 0,
			texteId: s.texteId,
			pour: s.pour,
			contre: s.contre,
			abstention: s.abstention
		});
	}
	return m;
}

/**
 * Dénormalise une liste d'historique : ajoute la meta du scrutin en 5e position
 * de chaque tuple (ADR 0041, option A — tuple enrichi rétro-compatible).
 * Un uid absent de l'index est laissé tel quel (tuple à 4 éléments) plutôt que
 * de planter — robustesse sur données partielles. Marche pour AN et Sénat
 * (tuples structurellement identiques `[uid, position, isFronde, clé]`).
 */
export function denormaliseHistorique(
	historique: VoteHistoryItem[],
	metaIndex: Map<string, VoteHistoryScrutinMeta>
): VoteHistoryItem[] {
	return historique.map((item) => {
		const [uid, position, isFronde, cle] = item;
		const meta = metaIndex.get(uid);
		return meta ? [uid, position, isFronde, cle, meta] : [uid, position, isFronde, cle];
	});
}

/**
 * Sélectionne les scrutins récents par groupe (législature AN, ou session
 * Sénat) pour la home : ceux des `joursRecents` derniers jours, avec un
 * plancher de `minParGroupe` (les plus récents) si la fenêtre est vide. Les
 * scrutins doivent être triés du plus récent au plus ancien en entrée.
 *
 * Chamber-agnostic via `groupKey` (par défaut : champ `legislature` côté AN ;
 * passer `s => s.sesann` côté Sénat).
 *
 * @param scrutins index global (trié récent→ancien)
 * @param refDate  date de référence ISO `YYYY-MM-DD` — passée explicitement
 *                 pour rester déterministe/testable.
 */
export function recentScrutinsParGroupe<T extends { date: string }>(
	scrutins: T[],
	refDate: string,
	opts: { joursRecents?: number; minParGroupe?: number; groupKey?: (s: T) => number | string } = {}
): T[] {
	const joursRecents = opts.joursRecents ?? 30;
	const minParGroupe = opts.minParGroupe ?? 8;
	const groupKey = opts.groupKey ?? ((s: T) => (s as { legislature: number }).legislature);

	const cutoff = isoMinusDays(refDate, joursRecents);
	const parGroupe = new Map<number | string, T[]>();
	for (const s of scrutins) {
		const k = groupKey(s);
		const arr = parGroupe.get(k) ?? [];
		arr.push(s);
		parGroupe.set(k, arr);
	}

	const out: T[] = [];
	for (const [, arr] of parGroupe) {
		// arr est déjà récent→ancien (sous-suite de l'index trié).
		const recent = arr.filter((s) => s.date >= cutoff);
		out.push(...(recent.length > 0 ? recent : arr.slice(0, minParGroupe)));
	}
	return out;
}

/** Alias rétro-compatible AN (groupe = législature). */
export function recentScrutinsParLegislature(
	scrutins: ScrutinIndex[],
	refDate: string,
	opts: { joursRecents?: number; minParLeg?: number } = {}
): ScrutinIndex[] {
	return recentScrutinsParGroupe(scrutins, refDate, {
		joursRecents: opts.joursRecents,
		minParGroupe: opts.minParLeg,
		groupKey: (s) => s.legislature
	});
}

/** Soustrait `days` jours d'une date ISO `YYYY-MM-DD`, renvoie `YYYY-MM-DD`. */
function isoMinusDays(iso: string, days: number): string {
	const d = new Date(`${iso}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() - days);
	return d.toISOString().slice(0, 10);
}
