/**
 * Utilitaires partagés entre les pipelines data AN et Sénat.
 *
 * Fournit :
 *  - `downloadZip` / `downloadFile` : téléchargement avec cache HTTP conditionnel
 *    (HEAD `Last-Modified` + `ETag` + `Content-Length`), cf ADR 0021
 *  - `extractIfNeeded` : extraction ZIP idempotente via marqueur `size+mtime`
 *  - `ensureDir` / `asArray` / `daysBetween` : utilitaires purs
 *
 * Refacto isofonctionnel de `scripts/fetch-data.ts` (lignes 108-340 d'origine)
 * pour permettre la réutilisation par `scripts/fetch-data-senat.ts` sans
 * duplication. La logique est strictement préservée.
 */

import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

// ────────────────────────────────────────────────────────────────────────────
// Cache HTTP conditionnel (cf ADR 0021)
// ────────────────────────────────────────────────────────────────────────────

export interface CacheMeta {
	url: string;
	contentLength: number | null;
	lastModified: string | null;
	etag: string | null;
	fetchedAt: string;
}

export interface RemoteHead {
	contentLength: number | null;
	lastModified: string | null;
	etag: string | null;
}

export async function readCacheMeta(metaPath: string): Promise<CacheMeta | null> {
	if (!existsSync(metaPath)) return null;
	try {
		return JSON.parse(await readFile(metaPath, 'utf8')) as CacheMeta;
	} catch {
		return null;
	}
}

export async function writeCacheMeta(metaPath: string, meta: CacheMeta) {
	await writeFile(metaPath, JSON.stringify(meta, null, 2));
}

export async function remoteHead(url: string): Promise<RemoteHead | null> {
	try {
		const res = await fetch(url, { method: 'HEAD' });
		if (!res.ok) return null;
		const cl = res.headers.get('content-length');
		return {
			contentLength: cl ? parseInt(cl, 10) : null,
			lastModified: res.headers.get('last-modified'),
			etag: res.headers.get('etag')
		};
	} catch {
		return null;
	}
}

/**
 * Télécharge un fichier (ZIP ou non) via `curl` avec cache HTTP conditionnel.
 *
 * Stratégie :
 * 1. **HEAD conditionnel** — récupère `Last-Modified`, `ETag` et `Content-Length`
 *    distants et compare à `<target>.meta.json` du dernier run.
 *    Si tous matchent → cache hit complet, 0 byte téléchargé.
 * 2. **Fresh download** sinon. Pas de `curl -C -` (resume) parce que les CDN
 *    parlementaires re-publient parfois le même fichier avec des bytes
 *    différents et la même taille.
 * 3. **Garde anti-payload-vide** : si la source répond `Content-Length: 0` (ou
 *    si le download donne un fichier vide), on **refuse d'écraser** un cache
 *    local valide (taille > 0). Si aucun cache n'existe, le download vide est
 *    conservé et `meta.json` n'est **pas écrit** — un éventuel cache local plus
 *    ancien (BuildKit cache mount) reste donc intact pour le run suivant.
 *    Cas concret : `senat.fr/api-senat/senateurs.json` peut renvoyer 200 OK +
 *    0 octet pendant une régénération côté CDN (cf incident 2026-05-07).
 *
 * `FORCE_CACHE=1` court-circuite la vérification HEAD (utile en dev).
 */
export async function downloadFile(url: string, target: string): Promise<void> {
	const metaPath = `${target}.meta.json`;
	const fs = await import('node:fs');

	if (process.env.FORCE_CACHE === '1' && existsSync(target)) {
		const localSize = fs.statSync(target).size;
		console.log(`  ↻ cache hit (forcé): ${target} (${(localSize / 1024 / 1024).toFixed(1)} MB)`);
		return;
	}

	const remote = await remoteHead(url);
	const cached = await readCacheMeta(metaPath);

	if (
		remote &&
		cached &&
		existsSync(target) &&
		fs.statSync(target).size === remote.contentLength &&
		((remote.lastModified !== null && remote.lastModified === cached.lastModified) ||
			(remote.etag !== null && remote.etag === cached.etag) ||
			(remote.lastModified === null &&
				remote.etag === null &&
				cached.contentLength === remote.contentLength))
	) {
		const sizeMb = (remote.contentLength! / 1024 / 1024).toFixed(1);
		const lm = remote.lastModified ? ` (Last-Modified: ${remote.lastModified})` : '';
		console.log(`  ↻ cache hit: ${target} ${sizeMb} MB${lm}`);
		return;
	}

	// Garde anti-payload-vide AVANT le download : si HEAD distant répond 0 octet
	// et qu'on a déjà un cache local valide, on conserve le cache.
	if (
		remote &&
		remote.contentLength === 0 &&
		existsSync(target) &&
		fs.statSync(target).size > 0
	) {
		const localSize = fs.statSync(target).size;
		console.log(
			`  ⚠ source répond Content-Length: 0 — cache local conservé (${(localSize / 1024).toFixed(1)} KB) : ${target}`
		);
		return;
	}

	if (existsSync(target)) fs.unlinkSync(target);
	if (existsSync(metaPath)) fs.unlinkSync(metaPath);
	console.log(`  ⬇ ${url}`);

	const { spawn } = await import('node:child_process');
	const MAX_OUTER_RETRIES = 3;
	for (let attempt = 1; attempt <= MAX_OUTER_RETRIES; attempt++) {
		try {
			await new Promise<void>((resolve, reject) => {
				const c = spawn(
					'curl',
					[
						'-L',
						'--retry',
						'5',
						'--retry-delay',
						'5',
						'--max-time',
						'1800',
						'--progress-bar',
						'-o',
						target,
						url
					],
					{ stdio: ['ignore', 'inherit', 'inherit'] }
				);
				c.on('error', reject);
				c.on('exit', (code) => {
					if (code === 0) resolve();
					else reject(new Error(`curl exited ${code}`));
				});
			});
			break;
		} catch (err) {
			if (attempt === MAX_OUTER_RETRIES) {
				throw new Error(`curl failed ${attempt}× for ${url}: ${(err as Error).message}`);
			}
			console.log(`  ⚠ tentative ${attempt}/${MAX_OUTER_RETRIES} échouée…`);
			if (existsSync(target)) fs.unlinkSync(target);
			await new Promise((r) => setTimeout(r, 5000));
		}
	}

	const stats = fs.statSync(target);
	console.log(`  ✓ ${(stats.size / 1024 / 1024).toFixed(1)} MB → ${target}`);

	// Garde post-download : un fichier vide (curl ok mais 0 octet) ne doit pas
	// être marqué comme valide via meta.json. Sans cette garde, le run suivant
	// considère le cache comme "frais" et le pipeline parse 0 octet.
	if (stats.size === 0) {
		console.log(
			`  ⚠ téléchargement vide (0 octet) — meta.json non écrit, cache laissé invalide : ${target}`
		);
		return;
	}

	const finalRemote = remote ?? (await remoteHead(url));
	if (finalRemote) {
		await writeCacheMeta(metaPath, {
			url,
			contentLength: finalRemote.contentLength,
			lastModified: finalRemote.lastModified,
			etag: finalRemote.etag,
			fetchedAt: new Date().toISOString()
		});
	}
}

/**
 * Alias historique : `downloadZip` est strictement équivalent à `downloadFile`.
 * On garde le nom pour clarté côté pipeline AN (cf fetch-data.ts) où il est
 * appelé sur des `.zip` exclusivement.
 */
export const downloadZip = downloadFile;

// ────────────────────────────────────────────────────────────────────────────
// Extraction ZIP idempotente
// ────────────────────────────────────────────────────────────────────────────

async function unzip(zipPath: string, destDir: string) {
	await ensureDir(destDir);
	console.log(`  ⇢ ${zipPath} → ${destDir}`);
	try {
		await execFile('bsdtar', ['-xf', zipPath, '-C', destDir]);
	} catch (errBsd) {
		try {
			await execFile('unzip', ['-q', '-o', zipPath, '-d', destDir]);
		} catch (errUnzip) {
			throw new Error(
				`unzip failed (bsdtar: ${(errBsd as Error).message} / unzip: ${(errUnzip as Error).message})`
			);
		}
	}
}

/**
 * Extrait `zipPath` dans `destDir` si nécessaire. Le marqueur `<destDir>.zip-meta`
 * stocke `size+mtime` du ZIP source à la dernière extraction : si l'un ou
 * l'autre a changé, on purge et on ré-extrait.
 *
 * `sentinelRelPath` : chemin relatif d'un fichier/dossier qui doit exister
 * après extraction réussie (détecte une extraction interrompue).
 * `minEntries` : si > 0, vérifie aussi qu'il y a au moins N entrées dans la
 * sentinelle (utile pour les ZIP de scrutins).
 */
export async function extractIfNeeded(
	zipPath: string,
	destDir: string,
	sentinelRelPath: string,
	minEntries = 0,
	label = ''
): Promise<void> {
	const fs = await import('node:fs');
	const markerPath = `${destDir}.zip-meta`;
	const zipStat = fs.statSync(zipPath);
	const fingerprint = `${zipStat.size}|${zipStat.mtimeMs}`;
	const sentinelFull = join(destDir, sentinelRelPath);

	const sentinelOk =
		existsSync(sentinelFull) &&
		(minEntries === 0 || fs.readdirSync(sentinelFull).length >= minEntries);

	let markerOk = false;
	if (existsSync(markerPath)) {
		try {
			markerOk = (await readFile(markerPath, 'utf8')).trim() === fingerprint;
		} catch {
			markerOk = false;
		}
	}

	if (sentinelOk && markerOk) {
		console.log(`  ↻ déjà extrait : ${label || destDir}`);
		return;
	}

	await rm(destDir, { recursive: true, force: true });
	await unzip(zipPath, destDir);
	await writeFile(markerPath, fingerprint);
}

// ────────────────────────────────────────────────────────────────────────────
// Utilitaires purs
// ────────────────────────────────────────────────────────────────────────────

export async function ensureDir(path: string) {
	await mkdir(path, { recursive: true });
}

export function asArray<T>(v: T | T[] | null | undefined): T[] {
	if (v == null) return [];
	return Array.isArray(v) ? v : [v];
}

export function daysBetween(a: string, b: string): number {
	const da = new Date(a).getTime();
	const db = new Date(b).getTime();
	return Math.round((db - da) / (1000 * 60 * 60 * 24));
}
