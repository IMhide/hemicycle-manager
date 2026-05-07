/**
 * Tests TDD pour le parser dosleg/ODSEN (cf ADR 0025).
 *
 * Couvre les fonctions pures critiques du pipeline Sénat :
 *  - decodePostgresLiteral : conversion des littéraux `COPY` PG (`\N`, `\t`, …)
 *  - splitCsvLine : mini-parser CSV respectant les guillemets
 *  - parseOdsenCsv : parser ODSEN_*.csv complet (ISO-8859-1, préambule `%`)
 *  - streamCopyBlocks : extracteur de blocs `COPY <table> ... FROM stdin`
 *
 * Ces fonctions sont les zones de plus haut risque de bug du pipeline et
 * justifient un TDD strict (tests avant implémentation).
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
	decodePostgresLiteral,
	splitCsvLine,
	parseOdsenCsv,
	streamCopyBlocks
} from './dosleg-parser.ts';

// ────────────────────────────────────────────────────────────────────────────
// decodePostgresLiteral
// ────────────────────────────────────────────────────────────────────────────

describe('decodePostgresLiteral', () => {
	test('\\N → null', () => {
		assert.equal(decodePostgresLiteral('\\N'), null);
	});
	test('valeur simple → string brute', () => {
		assert.equal(decodePostgresLiteral('hello'), 'hello');
	});
	test('valeur vide → string vide', () => {
		assert.equal(decodePostgresLiteral(''), '');
	});
	test('\\t → tab littéral', () => {
		assert.equal(decodePostgresLiteral('a\\tb'), 'a\tb');
	});
	test('\\n → newline littéral', () => {
		assert.equal(decodePostgresLiteral('a\\nb'), 'a\nb');
	});
	test('\\r → carriage return', () => {
		assert.equal(decodePostgresLiteral('a\\rb'), 'a\rb');
	});
	test('\\\\ → backslash unique', () => {
		assert.equal(decodePostgresLiteral('a\\\\b'), 'a\\b');
	});
	test('Décodage multiple sur une même valeur', () => {
		assert.equal(decodePostgresLiteral('a\\tb\\nc'), 'a\tb\nc');
	});
	test('Caractères français préservés (UTF-8)', () => {
		assert.equal(decodePostgresLiteral('Pétain'), 'Pétain');
		assert.equal(decodePostgresLiteral('Cœur'), 'Cœur');
	});
	test('Backslash devant caractère inconnu → caractère brut', () => {
		// Convention PG : `\X` non documenté est juste X
		assert.equal(decodePostgresLiteral('a\\Xb'), 'aXb');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// splitCsvLine
// ────────────────────────────────────────────────────────────────────────────

describe('splitCsvLine', () => {
	test('ligne simple sans guillemets', () => {
		assert.deepEqual(splitCsvLine('a,b,c'), ['a', 'b', 'c']);
	});
	test('ligne vide', () => {
		assert.deepEqual(splitCsvLine(''), ['']);
	});
	test('valeur vide entre virgules', () => {
		assert.deepEqual(splitCsvLine('a,,c'), ['a', '', 'c']);
	});
	test('valeur entre guillemets contenant une virgule', () => {
		assert.deepEqual(splitCsvLine('a,"hello, world",c'), ['a', 'hello, world', 'c']);
	});
	test('ligne ODSEN typique avec guillemets', () => {
		// Cas réel HISTOGROUPES :
		// 11076S,2292,2566,Aïchi,Leila,SOC,"Groupe Socialiste, Écologiste et Républicain",2011-10-01 00:00:00.0,2012-01-10 00:00:00.0,Membre,2011-10-01 00:00:00.0,2012-01-10 00:00:00.0
		const line =
			'11076S,2292,2566,Aïchi,Leila,SOC,"Groupe Socialiste, Écologiste et Républicain",2011-10-01,2012-01-10,Membre,2011-10-01,2012-01-10';
		const parts = splitCsvLine(line);
		assert.equal(parts.length, 12);
		assert.equal(parts[0], '11076S');
		assert.equal(parts[6], 'Groupe Socialiste, Écologiste et Républicain');
	});
	test('guillemets échappés (RFC 4180 : "" → ")', () => {
		assert.deepEqual(splitCsvLine('a,"He said ""hi""",b'), ['a', 'He said "hi"', 'b']);
	});
	test('valeur finale vide', () => {
		assert.deepEqual(splitCsvLine('a,b,'), ['a', 'b', '']);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// parseOdsenCsv (avec fixtures écrites en ISO-8859-1)
// ────────────────────────────────────────────────────────────────────────────

describe('parseOdsenCsv', () => {
	test('parse un buffer ODSEN avec préambule % et header', () => {
		// Simule le format ODSEN : préambule % puis header puis data
		const text = [
			'% Requête : SELECT ...',
			'% from sen s',
			'% 3 ligne(s) de résultat',
			'Matricule,Nom,Prenom',
			'08061X,Patriat,François',
			'86034E,Larcher,Gérard'
		].join('\r\n');
		// Encoder en ISO-8859-1 (les caractères français passent sur 1 byte chacun)
		const buf = encodeIso88591(text);
		const rows = parseOdsenCsv(buf);
		assert.equal(rows.length, 2);
		assert.equal(rows[0].Matricule, '08061X');
		assert.equal(rows[0].Nom, 'Patriat');
		assert.equal(rows[0].Prenom, 'François');
		assert.equal(rows[1].Matricule, '86034E');
	});

	test('skip les lignes vides en plus du préambule', () => {
		const text = ['% header comment', '', 'A,B', '1,2', '', '3,4'].join('\r\n');
		const buf = encodeIso88591(text);
		const rows = parseOdsenCsv(buf);
		assert.equal(rows.length, 2);
		assert.deepEqual(rows[0], { A: '1', B: '2' });
		assert.deepEqual(rows[1], { A: '3', B: '4' });
	});

	test('encodage ISO-8859-1 préserve les accents français', () => {
		// "François Mitterrand" en ISO-8859-1 : le ç est 0xE7
		const text = ['Matricule,Prenom', '12345,François'].join('\n');
		const buf = encodeIso88591(text);
		const rows = parseOdsenCsv(buf);
		assert.equal(rows[0].Prenom, 'François');
	});

	test('gère les guillemets dans les valeurs (ex. libellé groupe avec virgule)', () => {
		const text = [
			'Matricule,Nom,Groupe',
			'12345,Dupont,"Groupe Socialiste, Écologiste et Républicain"'
		].join('\n');
		const buf = encodeIso88591(text);
		const rows = parseOdsenCsv(buf);
		assert.equal(rows[0].Groupe, 'Groupe Socialiste, Écologiste et Républicain');
	});

	test('header avec caractères français', () => {
		const text = ['Matricule,Qualité,Nom usuel', '12345,M.,Dupont'].join('\n');
		const buf = encodeIso88591(text);
		const rows = parseOdsenCsv(buf);
		assert.equal(rows[0]['Qualité'], 'M.');
		assert.equal(rows[0]['Nom usuel'], 'Dupont');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// streamCopyBlocks (test sur fichier fixture)
// ────────────────────────────────────────────────────────────────────────────

describe('streamCopyBlocks', () => {
	test('extrait un bloc COPY simple, format TSV', async () => {
		const tmp = await mkdtemp(join(tmpdir(), 'streamcopy-test-'));
		try {
			const sqlPath = join(tmp, 'sample.sql');
			const sql = [
				'-- Some PostgreSQL dump',
				'SET statement_timeout = 0;',
				'',
				'COPY public.foo (id, name, deleted_at) FROM stdin;',
				'1\tAlice\t\\N',
				'2\tBob\t2024-01-01 00:00:00',
				'3\tCharlie\\\\Z\t\\N',
				'\\.',
				'',
				'COPY public.bar (a, b) FROM stdin;',
				'42\thello',
				'\\.',
				''
			].join('\n');
			await writeFile(sqlPath, sql);

			const rows: Array<{ table: string; cols: string[]; values: (string | null)[] }> = [];
			await streamCopyBlocks(
				sqlPath,
				new Set(['foo', 'bar']),
				(table, cols, values) => {
					rows.push({ table, cols, values });
				}
			);

			assert.equal(rows.length, 4);
			assert.equal(rows[0].table, 'foo');
			assert.deepEqual(rows[0].cols, ['id', 'name', 'deleted_at']);
			assert.deepEqual(rows[0].values, ['1', 'Alice', null]);
			assert.deepEqual(rows[1].values, ['2', 'Bob', '2024-01-01 00:00:00']);
			// La 3ᵉ ligne contient un \\Z → décodé en \Z (le backslash devient un seul)
			assert.deepEqual(rows[2].values, ['3', 'Charlie\\Z', null]);
			assert.equal(rows[3].table, 'bar');
			assert.deepEqual(rows[3].values, ['42', 'hello']);
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	});

	test('skip les tables non whitelisted', async () => {
		const tmp = await mkdtemp(join(tmpdir(), 'streamcopy-test-'));
		try {
			const sqlPath = join(tmp, 'sample.sql');
			const sql = [
				'COPY public.wanted (id) FROM stdin;',
				'1',
				'\\.',
				'COPY public.skipme (id) FROM stdin;',
				'2',
				'3',
				'\\.'
			].join('\n');
			await writeFile(sqlPath, sql);

			const rows: number[] = [];
			await streamCopyBlocks(sqlPath, new Set(['wanted']), (_t, _c, values) => {
				rows.push(parseInt(values[0]!, 10));
			});

			assert.deepEqual(rows, [1]);
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	});

	test('gère les noms de tables sans schema (COPY foo …)', async () => {
		const tmp = await mkdtemp(join(tmpdir(), 'streamcopy-test-'));
		try {
			const sqlPath = join(tmp, 'sample.sql');
			const sql = ['COPY foo (a) FROM stdin;', 'x', '\\.'].join('\n');
			await writeFile(sqlPath, sql);

			const rows: string[] = [];
			await streamCopyBlocks(sqlPath, new Set(['foo']), (_t, _c, values) => {
				rows.push(values[0]!);
			});
			assert.deepEqual(rows, ['x']);
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	});

	test('values avec champs vides préservés', async () => {
		const tmp = await mkdtemp(join(tmpdir(), 'streamcopy-test-'));
		try {
			const sqlPath = join(tmp, 'sample.sql');
			// Note: empty TSV field = empty string, vs \N = null
			const sql = ['COPY foo (a, b, c) FROM stdin;', '1\t\t3', '\\.'].join('\n');
			await writeFile(sqlPath, sql);

			const rows: (string | null)[][] = [];
			await streamCopyBlocks(sqlPath, new Set(['foo']), (_t, _c, values) => {
				rows.push(values);
			});
			assert.deepEqual(rows[0], ['1', '', '3']);
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	});
});

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Encode une string UTF-8 en buffer ISO-8859-1 (Latin-1).
 *  Note : on perd les caractères non-Latin-1 (ex. emoji), mais c'est OK pour
 *  les tests avec des accents français. */
function encodeIso88591(text: string): Buffer {
	const bytes = new Uint8Array(text.length);
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		bytes[i] = code <= 0xff ? code : 0x3f; // '?' pour non-Latin-1
	}
	return Buffer.from(bytes);
}
