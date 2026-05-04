/**
 * Data access layer. All datasets are static JSON shipped under static/data/,
 * so we just fetch them at build time (prerender) or at runtime in dev.
 */

import type {
	Depute,
	Groupe,
	ScrutinIndex,
	ScrutinDetail,
	BuildMeta,
	DeputeStats,
	GroupeStats,
	VoteHistoryItem
} from './types';

const BASE = '/data';

async function fetchJson<T>(fetchFn: typeof fetch, path: string): Promise<T> {
	const res = await fetchFn(`${BASE}${path}`);
	if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
	return res.json() as Promise<T>;
}

export function loadDeputes(fetchFn: typeof fetch) {
	return fetchJson<Depute[]>(fetchFn, '/deputes.json');
}

export function loadGroupes(fetchFn: typeof fetch) {
	return fetchJson<Groupe[]>(fetchFn, '/groupes.json');
}

export function loadScrutinsIndex(fetchFn: typeof fetch) {
	return fetchJson<ScrutinIndex[]>(fetchFn, '/scrutins-index.json');
}

export function loadScrutinDetail(fetchFn: typeof fetch, uid: string) {
	return fetchJson<ScrutinDetail>(fetchFn, `/scrutins/${uid}.json`);
}

export function loadMeta(fetchFn: typeof fetch) {
	return fetchJson<BuildMeta>(fetchFn, '/meta.json');
}

export function loadDeputeStats(fetchFn: typeof fetch) {
	return fetchJson<DeputeStats[]>(fetchFn, '/stats-deputes.json');
}

export function loadGroupeStats(fetchFn: typeof fetch) {
	return fetchJson<GroupeStats[]>(fetchFn, '/stats-groupes.json');
}

export function loadDeputeHistorique(fetchFn: typeof fetch, deputeId: string) {
	return fetchJson<VoteHistoryItem[]>(fetchFn, `/historique/${deputeId}.json`);
}
