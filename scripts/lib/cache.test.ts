/**
 * Tests pour scripts/lib/cache.ts.
 *
 * Vise deux objectifs :
 * 1. Isofonctionnalité du refacto extrait de fetch-data.ts (lignes 108-340 d'origine)
 * 2. Couverture des utilitaires partagés avant qu'ils ne soient consommés par
 *    fetch-data-senat.ts (TDD-friendly pour la PR Sénat).
 *
 * Lance via : node --experimental-strip-types --test scripts/lib/cache.test.ts
 */

import { test, describe, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, rm, writeFile, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
	asArray,
	daysBetween,
	ensureDir,
	extractIfNeeded,
	readCacheMeta,
	writeCacheMeta,
	type CacheMeta
} from './cache.ts';

let TMP: string;

before(async () => {
	TMP = await mkdtemp(join(tmpdir(), 'politidex-cache-test-'));
});

after(async () => {
	await rm(TMP, { recursive: true, force: true });
});

// ────────────────────────────────────────────────────────────────────────────
// Utilitaires purs
// ────────────────────────────────────────────────────────────────────────────

describe('asArray', () => {
	test('null → []', () => {
		assert.deepEqual(asArray(null), []);
	});
	test('undefined → []', () => {
		assert.deepEqual(asArray(undefined), []);
	});
	test('valeur seule → [valeur]', () => {
		assert.deepEqual(asArray(42), [42]);
		assert.deepEqual(asArray('x'), ['x']);
	});
	test('tableau → tableau (passe-plat)', () => {
		assert.deepEqual(asArray([1, 2, 3]), [1, 2, 3]);
		assert.deepEqual(asArray<number>([]), []);
	});
});

describe('daysBetween', () => {
	test('même jour = 0', () => {
		assert.equal(daysBetween('2026-01-01', '2026-01-01'), 0);
	});
	test('jour suivant = 1', () => {
		assert.equal(daysBetween('2026-01-01', '2026-01-02'), 1);
	});
	test('21 jours pile', () => {
		assert.equal(daysBetween('2024-07-08', '2024-07-29'), 21);
	});
	test('valeur négative si b avant a', () => {
		assert.equal(daysBetween('2026-01-10', '2026-01-01'), -9);
	});
	test('arrondi sur DST (heure d\'été)', () => {
		// Le passage à l'heure d'été crée 23h. Round() évite -0.96 au lieu de -1.
		assert.equal(daysBetween('2024-03-30', '2024-03-31'), 1);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// Cache HTTP — readCacheMeta / writeCacheMeta (sans I/O réseau)
// ────────────────────────────────────────────────────────────────────────────

describe('readCacheMeta / writeCacheMeta', () => {
	test('readCacheMeta retourne null si fichier absent', async () => {
		const path = join(TMP, 'absent.meta.json');
		assert.equal(await readCacheMeta(path), null);
	});

	test('writeCacheMeta puis readCacheMeta = round-trip identique', async () => {
		const path = join(TMP, 'roundtrip.meta.json');
		const meta: CacheMeta = {
			url: 'https://example.com/data.zip',
			contentLength: 123456,
			lastModified: 'Wed, 06 May 2026 02:29:44 GMT',
			etag: '"289b-ef2f3c-6511c012e2740"',
			fetchedAt: '2026-05-06T09:00:00.000Z'
		};
		await writeCacheMeta(path, meta);
		const read = await readCacheMeta(path);
		assert.deepEqual(read, meta);
	});

	test('readCacheMeta retourne null si JSON corrompu', async () => {
		const path = join(TMP, 'corrupt.meta.json');
		await writeFile(path, '{not valid json');
		assert.equal(await readCacheMeta(path), null);
	});

	test('preserve les champs null dans le round-trip', async () => {
		const path = join(TMP, 'nulls.meta.json');
		const meta: CacheMeta = {
			url: 'https://example.com/foo',
			contentLength: null,
			lastModified: null,
			etag: null,
			fetchedAt: '2026-05-06T09:00:00.000Z'
		};
		await writeCacheMeta(path, meta);
		assert.deepEqual(await readCacheMeta(path), meta);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// ensureDir
// ────────────────────────────────────────────────────────────────────────────

describe('ensureDir', () => {
	test('crée un dossier nouveau', async () => {
		const dir = join(TMP, 'nouveau');
		await ensureDir(dir);
		const s = await stat(dir);
		assert.ok(s.isDirectory());
	});

	test('idempotent : OK si le dossier existe déjà', async () => {
		const dir = join(TMP, 'existant');
		await ensureDir(dir);
		// Re-call doit ne pas jeter
		await ensureDir(dir);
		const s = await stat(dir);
		assert.ok(s.isDirectory());
	});

	test('crée des parents en cascade (recursive)', async () => {
		const dir = join(TMP, 'a', 'b', 'c');
		await ensureDir(dir);
		const s = await stat(dir);
		assert.ok(s.isDirectory());
	});
});

// ────────────────────────────────────────────────────────────────────────────
// extractIfNeeded — sentinelle + marqueur idempotents
// ────────────────────────────────────────────────────────────────────────────

describe('extractIfNeeded', () => {
	test('extrait un ZIP simple, puis skip au 2ᵉ appel', async () => {
		// Préparer un ZIP minimal in-tmp via bsdtar (présent sur macOS et alpine)
		const srcDir = join(TMP, 'src');
		await ensureDir(srcDir);
		await writeFile(join(srcDir, 'hello.txt'), 'world');

		const zipPath = join(TMP, 'sample.zip');
		const { execFile: execFileCb } = await import('node:child_process');
		const { promisify } = await import('node:util');
		const execFile = promisify(execFileCb);
		await execFile('bsdtar', ['-cf', zipPath, '-C', srcDir, '.']);

		const destDir = join(TMP, 'extracted');

		// Première extraction : doit créer le dest et la sentinelle
		await extractIfNeeded(zipPath, destDir, 'hello.txt');
		assert.ok(existsSync(join(destDir, 'hello.txt')));
		assert.ok(existsSync(`${destDir}.zip-meta`));

		// Deuxième extraction : doit être idempotente (le marker matche)
		// On capture le mtime de hello.txt pour vérifier qu'il ne bouge pas.
		const before = (await stat(join(destDir, 'hello.txt'))).mtimeMs;
		await new Promise((r) => setTimeout(r, 50));  // marge d'horloge fs
		await extractIfNeeded(zipPath, destDir, 'hello.txt');
		const after = (await stat(join(destDir, 'hello.txt'))).mtimeMs;
		assert.equal(before, after, 'le fichier ne doit pas être ré-extrait');
	});

	test('ré-extrait si le ZIP source a changé (size+mtime)', async () => {
		const srcDir = join(TMP, 'src2');
		await ensureDir(srcDir);
		await writeFile(join(srcDir, 'data.txt'), 'v1');

		const zipPath = join(TMP, 'changing.zip');
		const { execFile: execFileCb } = await import('node:child_process');
		const { promisify } = await import('node:util');
		const execFile = promisify(execFileCb);
		await execFile('bsdtar', ['-cf', zipPath, '-C', srcDir, '.']);

		const destDir = join(TMP, 'extracted2');
		await extractIfNeeded(zipPath, destDir, 'data.txt');
		assert.equal(await readFile(join(destDir, 'data.txt'), 'utf8'), 'v1');

		// Modifier le ZIP source
		await new Promise((r) => setTimeout(r, 50));
		await writeFile(join(srcDir, 'data.txt'), 'v2-much-longer-content-here');
		await execFile('bsdtar', ['-cf', zipPath, '-C', srcDir, '.']);

		await extractIfNeeded(zipPath, destDir, 'data.txt');
		assert.equal(
			await readFile(join(destDir, 'data.txt'), 'utf8'),
			'v2-much-longer-content-here',
			'le fichier doit être mis à jour'
		);
	});

	test('ré-extrait si la sentinelle est absente (extraction interrompue)', async () => {
		const srcDir = join(TMP, 'src3');
		await ensureDir(srcDir);
		await writeFile(join(srcDir, 'sentinel.txt'), 'present');

		const zipPath = join(TMP, 'sentinel.zip');
		const { execFile: execFileCb } = await import('node:child_process');
		const { promisify } = await import('node:util');
		const execFile = promisify(execFileCb);
		await execFile('bsdtar', ['-cf', zipPath, '-C', srcDir, '.']);

		const destDir = join(TMP, 'extracted3');
		await extractIfNeeded(zipPath, destDir, 'sentinel.txt');
		assert.ok(existsSync(join(destDir, 'sentinel.txt')));

		// Simuler une extraction interrompue : on supprime juste la sentinelle
		// mais on laisse le marker
		const fs = await import('node:fs/promises');
		await fs.unlink(join(destDir, 'sentinel.txt'));

		// Re-call doit ré-extraire (sentinelle absente)
		await extractIfNeeded(zipPath, destDir, 'sentinel.txt');
		assert.ok(existsSync(join(destDir, 'sentinel.txt')));
	});
});
