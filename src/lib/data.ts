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
	VoteHistoryItem,
	Senateur,
	GroupeSenat,
	SessionMeta,
	ScrutinSenatIndex,
	ScrutinSenatDetail,
	BuildMetaSenat,
	VoteHistoryItemSenat
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

// ════════════════════════════════════════════════════════════════════════════
// SÉNAT (Phase 3, cf ADR 0023..0027) — loaders parallèles aux loaders AN.
// Les datasets vivent sous static/data/senat/ (isolés du dossier AN).
// ════════════════════════════════════════════════════════════════════════════

const BASE_SENAT = '/data/senat';

async function fetchJsonSenat<T>(fetchFn: typeof fetch, path: string): Promise<T> {
	const res = await fetchFn(`${BASE_SENAT}${path}`);
	if (!res.ok) throw new Error(`Failed to load senat${path}: ${res.status}`);
	return res.json() as Promise<T>;
}

// ─────────────────── Sénateurs ───────────────────

export function loadSenateurs(fetchFn: typeof fetch) {
	return fetchJsonSenat<Senateur[]>(fetchFn, '/senateurs.json');
}

export async function loadSenateur(
	fetchFn: typeof fetch,
	matricule: string
): Promise<Senateur | null> {
	const all = await loadSenateurs(fetchFn);
	return all.find((s) => s.id === matricule) ?? null;
}

export function loadHistoriqueSenat(fetchFn: typeof fetch, matricule: string) {
	return fetchJsonSenat<VoteHistoryItemSenat[]>(fetchFn, `/historique/${matricule}.json`);
}

// ─────────────────── Groupes (scopés par session) ───────────────────

export function loadGroupesSenat(fetchFn: typeof fetch, sesann: number) {
	return fetchJsonSenat<GroupeSenat[]>(fetchFn, `/groupes/${sesann}.json`);
}

// ─────────────────── Sessions ───────────────────

export function loadSessions(fetchFn: typeof fetch) {
	return fetchJsonSenat<SessionMeta[]>(fetchFn, '/sessions.json');
}

// ─────────────────── Scrutins ───────────────────

export function loadScrutinsSenatIndex(fetchFn: typeof fetch) {
	return fetchJsonSenat<ScrutinSenatIndex[]>(fetchFn, '/scrutins-index.json');
}

export function loadScrutinSenatDetail(fetchFn: typeof fetch, uid: string) {
	return fetchJsonSenat<ScrutinSenatDetail>(fetchFn, `/scrutins/${uid}.json`);
}

// ─────────────────── Meta Sénat ───────────────────

export function loadMetaSenat(fetchFn: typeof fetch) {
	return fetchJsonSenat<BuildMetaSenat>(fetchFn, '/meta.json');
}
