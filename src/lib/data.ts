/**
 * Data access layer. Tous les datasets sont des JSON statiques sous static/data/,
 * fetchés au build (prerender) ou au runtime en dev.
 *
 * Modèle Phase 1 : Personne unique cross-législature avec mandats[] (cf ADR 0015).
 * Les groupes sont scopés par législature (cf ADR 0016).
 */

import type {
	Personne,
	Groupe,
	LegislatureMeta,
	ScrutinIndex,
	ScrutinDetail,
	BuildMeta,
	VoteHistoryItem
} from './types';

const BASE = '/data';

async function fetchJson<T>(fetchFn: typeof fetch, path: string): Promise<T> {
	const res = await fetchFn(`${BASE}${path}`);
	if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
	return res.json() as Promise<T>;
}

// ─────────────────── Personnes ───────────────────

export function loadPersonnes(fetchFn: typeof fetch) {
	return fetchJson<Personne[]>(fetchFn, '/personnes.json');
}

export async function loadPersonne(fetchFn: typeof fetch, id: string): Promise<Personne | null> {
	const all = await loadPersonnes(fetchFn);
	return all.find((p) => p.id === id) ?? null;
}

export function loadHistorique(fetchFn: typeof fetch, paId: string) {
	return fetchJson<VoteHistoryItem[]>(fetchFn, `/historique/${paId}.json`);
}

// ─────────────────── Groupes (scopés par législature) ───────────────────

export function loadGroupes(fetchFn: typeof fetch, legislature: number) {
	return fetchJson<Groupe[]>(fetchFn, `/groupes/${legislature}.json`);
}

// ─────────────────── Législatures ───────────────────

export function loadLegislatures(fetchFn: typeof fetch) {
	return fetchJson<LegislatureMeta[]>(fetchFn, '/legislatures.json');
}

// ─────────────────── Scrutins ───────────────────

export function loadScrutinsIndex(fetchFn: typeof fetch) {
	return fetchJson<ScrutinIndex[]>(fetchFn, '/scrutins-index.json');
}

export function loadScrutinDetail(fetchFn: typeof fetch, uid: string) {
	return fetchJson<ScrutinDetail>(fetchFn, `/scrutins/${uid}.json`);
}

// ─────────────────── Meta ───────────────────

export function loadMeta(fetchFn: typeof fetch) {
	return fetchJson<BuildMeta>(fetchFn, '/meta.json');
}
