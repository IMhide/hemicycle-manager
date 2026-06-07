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
	Texte,
	ActeurNom,
	BuildMeta,
	VoteHistoryItem,
	Senateur,
	GroupeSenat,
	SessionMeta,
	TriennatMeta,
	ScrutinSenatIndex,
	ScrutinSenatDetail,
	BuildMetaSenat,
	VoteHistoryItemSenat,
	TexteSenat,
	TexteUnifie
} from './types';
import type { TriennatId } from './triennats';

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

/** Scrutins récents (N derniers/législature) pour la home — projection légère
 *  (~30-50 Ko) au lieu de l'index complet (6,1 Mo). Cf ADR 0041. */
export function loadScrutinsRecent(fetchFn: typeof fetch) {
	return fetchJson<ScrutinIndex[]>(fetchFn, '/scrutins-recent.json');
}

export function loadScrutinDetail(fetchFn: typeof fetch, uid: string) {
	return fetchJson<ScrutinDetail>(fetchFn, `/scrutins/${uid}.json`);
}

// ─────────────────── Textes législatifs (cf ADR 0035) ───────────────────

export function loadTextes(fetchFn: typeof fetch) {
	return fetchJson<Texte[]>(fetchFn, '/textes.json');
}

export async function loadTexte(fetchFn: typeof fetch, id: string): Promise<Texte | null> {
	const all = await loadTextes(fetchFn);
	return all.find((t) => t.id === id) ?? null;
}

// ─────────────────── Textes unifiés cross-chambre (N3.d, ADR 0036) ───────────

export function loadTextesUnifies(fetchFn: typeof fetch) {
	return fetchJson<TexteUnifie[]>(fetchFn, '/textes-unifies.json');
}

export async function loadTexteUnifie(
	fetchFn: typeof fetch,
	id: string
): Promise<TexteUnifie | null> {
	const all = await loadTextesUnifies(fetchFn);
	return all.find((t) => t.id === id) ?? null;
}

/** Résout un TexteUnifie par son slug URL (cf ADR 0042). Route `/textes/[slug]`. */
export async function loadTexteUnifieBySlug(
	fetchFn: typeof fetch,
	slug: string
): Promise<TexteUnifie | null> {
	const all = await loadTextesUnifies(fetchFn);
	return all.find((t) => t.slug === slug) ?? null;
}

/**
 * Construit un résolveur `texteId natif → slug` (cf ADR 0042). Un lien depuis un
 * scrutin ou un groupe de vote ne dispose que d'un texteId brut (id canonique,
 * id AN, ou id Sénat) ; ce résolveur le mappe vers le slug de la fiche unifiée.
 * Renvoie une fonction synchrone après chargement du manifest.
 */
export async function loadTexteSlugResolver(
	fetchFn: typeof fetch
): Promise<(texteId: string) => string | null> {
	const all = await loadTextesUnifies(fetchFn);
	const byId = new Map<string, string>();
	for (const t of all) {
		byId.set(t.id, t.slug); // id canonique (AN si présent, sinon Sénat)
		if (t.an) byId.set(t.an.texteId, t.slug);
		if (t.senat) byId.set(t.senat.texteId, t.slug);
	}
	return (texteId: string) => byId.get(texteId) ?? null;
}

// ─────────────────── Acteurs (noms uniquement) ───────────────────
// Manifest léger contenant le nom de TOUS les acteurs Etalab (députés,
// sénateurs, ministres, etc.) pour afficher les initiateurs de textes
// (cf ADR 0035). Distinct de personnes.json qui ne contient que les députés.

export function loadActeursNoms(fetchFn: typeof fetch) {
	return fetchJson<ActeurNom[]>(fetchFn, '/acteurs-noms.json');
}

// ─────────────────── Meta ───────────────────

export function loadMeta(fetchFn: typeof fetch) {
	return fetchJson<BuildMeta>(fetchFn, '/meta.json');
}

// ════════════════════════════════════════════════════════════════════════════
// SÉNAT (Phase 3, cf ADR 0023..0028) — loaders parallèles aux loaders AN.
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

// ─────────────────── Groupes (scopés par triennat, cf ADR 0028) ───────────────────

export function loadGroupesSenat(fetchFn: typeof fetch, triennat: TriennatId) {
	return fetchJsonSenat<GroupeSenat[]>(fetchFn, `/groupes/${triennat}.json`);
}

// ─────────────────── Triennats (unité de regroupement principale, cf ADR 0028) ─

export function loadTriennats(fetchFn: typeof fetch) {
	return fetchJsonSenat<TriennatMeta[]>(fetchFn, '/triennats.json');
}

// ─────────────────── Sessions (brique data, cf ADR 0028) ───────────────────

export function loadSessions(fetchFn: typeof fetch) {
	return fetchJsonSenat<SessionMeta[]>(fetchFn, '/sessions.json');
}

// ─────────────────── Scrutins ───────────────────

export function loadScrutinsSenatIndex(fetchFn: typeof fetch) {
	return fetchJsonSenat<ScrutinSenatIndex[]>(fetchFn, '/scrutins-index.json');
}

/** Scrutins Sénat récents (N derniers/session) pour la home — projection légère
 *  au lieu de l'index complet (~1 Mo). Cf ADR 0041. */
export function loadScrutinsSenatRecent(fetchFn: typeof fetch) {
	return fetchJsonSenat<ScrutinSenatIndex[]>(fetchFn, '/scrutins-recent.json');
}

export function loadScrutinSenatDetail(fetchFn: typeof fetch, uid: string) {
	return fetchJsonSenat<ScrutinSenatDetail>(fetchFn, `/scrutins/${uid}.json`);
}

// ─────────────────── Textes législatifs Sénat (N3.b navette) ───────────────────

export function loadTextesSenat(fetchFn: typeof fetch) {
	return fetchJsonSenat<TexteSenat[]>(fetchFn, '/textes.json');
}

export async function loadTexteSenat(fetchFn: typeof fetch, id: string): Promise<TexteSenat | null> {
	const all = await loadTextesSenat(fetchFn);
	return all.find((t) => t.id === id) ?? null;
}

// ─────────────────── Meta Sénat ───────────────────

export function loadMetaSenat(fetchFn: typeof fetch) {
	return fetchJsonSenat<BuildMetaSenat>(fetchFn, '/meta.json');
}
