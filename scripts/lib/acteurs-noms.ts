/**
 * Manifest léger des noms de TOUS les acteurs Etalab (députés, sénateurs,
 * ministres, suppléants, anciens, etc.).
 *
 * Construit depuis le dump AMO30 historique (cf ADR 0018). Permet d'afficher
 * le nom d'un acteur référencé dans un dossier législatif comme initiateur
 * ou déposant, même quand cet acteur n'a pas de mandat parlementaire dans
 * notre périmètre (cas typique : ministre déposant un projet de loi).
 *
 * Sortie : `static/data/acteurs-noms.json` (~1 MB pour ~15k entrées).
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ActeurNom } from '../../src/lib/types.ts';

export type { ActeurNom };

interface RawActeurMinimal {
	uid?: { '#text'?: string } | string;
	etatCivil?: {
		ident?: {
			civ?: string;
			prenom?: string;
			nom?: string;
		};
	};
}

/** Extrait l'id PA d'un champ `uid` qui peut être soit string soit `{ "#text": "PA…" }`. */
export function extractActeurId(uid: unknown): string | null {
	if (typeof uid === 'string') return uid || null;
	if (uid && typeof uid === 'object' && '#text' in uid) {
		const v = (uid as { '#text'?: unknown })['#text'];
		return typeof v === 'string' && v.length > 0 ? v : null;
	}
	return null;
}

/** Lit un fichier acteur Etalab et en extrait le nom minimal, ou null si invalide. */
export function parseActeurNom(raw: { acteur?: RawActeurMinimal } | undefined): ActeurNom | null {
	const a = raw?.acteur;
	if (!a) return null;
	const id = extractActeurId(a.uid);
	if (!id) return null;
	const ident = a.etatCivil?.ident ?? {};
	const prenom = ident.prenom ?? '';
	const nom = ident.nom ?? '';
	if (!prenom && !nom) return null; // nom complètement absent → on ne garde pas
	return {
		id,
		civ: ident.civ ?? '',
		prenom,
		nom
	};
}

/**
 * Parcourt le dossier d'extraction AMO30 et construit la liste exhaustive
 * des noms d'acteurs. Trié par id pour un output déterministe (diffs git).
 */
export async function buildActeursNoms(acteurDir: string): Promise<ActeurNom[]> {
	const files = await readdir(acteurDir);
	const out: ActeurNom[] = [];
	for (const f of files) {
		if (!f.endsWith('.json')) continue;
		const raw = JSON.parse(await readFile(join(acteurDir, f), 'utf8'));
		const nom = parseActeurNom(raw);
		if (nom) out.push(nom);
	}
	out.sort((a, b) => a.id.localeCompare(b.id));
	return out;
}

export async function writeActeursNoms(outPath: string, acteurs: ActeurNom[]): Promise<void> {
	await writeFile(outPath, JSON.stringify(acteurs));
}
