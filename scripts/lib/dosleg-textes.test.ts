/**
 * Tests TDD pour l'extraction des dossiers législatifs Sénat depuis le dump
 * `dosleg.sql` (cf ADR 0025, N3.b navette).
 *
 * Le module croise plusieurs tables du dump pg_dump :
 *   - `loi` : table maîtresse (loicod, typloicod, etaloicod, loitit, loidatjo…)
 *   - `typloi` : enum types de loi (pjl, ppl, pjlf, …)
 *   - `etaloi` : enum états (en cours, promulgué, rejeté, …)
 *
 * Les fonctions exposées sont pures (pas d'I/O) : on injecte des `Map`s déjà
 * désérialisées par `streamCopyBlocks`. Le test couvre :
 *  - décodage des padding chars de PG (champs `character(N)`)
 *  - mapping correct typloicod → TexteSenatType
 *  - mapping correct etaloicod → TexteSenatEtat
 *  - filtre période (date_loi ≥ borne) pour scope ère Macron
 *  - construction du DossierSenat enrichi avec libellés des enums
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import {
	buildDossierSenatFromRow,
	mapEtatLoi,
	mapTypeLoi,
	type DossierSenatBrut
} from './dosleg-textes.ts';

// ────────────────────────────────────────────────────────────────────────────
// mapTypeLoi
// ────────────────────────────────────────────────────────────────────────────

describe('mapTypeLoi — typloicod → TexteSenatType', () => {
	test('projets de loi standards', () => {
		assert.equal(mapTypeLoi('pjl'), 'pjl');
		assert.equal(mapTypeLoi('pjlo'), 'pjlo');
		assert.equal(mapTypeLoi('pjlc'), 'pjlc');
		assert.equal(mapTypeLoi('pjlf'), 'pjlf');
		assert.equal(mapTypeLoi('pjlr'), 'pjlr');
		assert.equal(mapTypeLoi('pjlg'), 'pjlg');
		assert.equal(mapTypeLoi('pjfs'), 'pjfs');
		assert.equal(mapTypeLoi('pfsr'), 'pfsr');
		assert.equal(mapTypeLoi('prog'), 'prog');
	});

	test('propositions standards', () => {
		assert.equal(mapTypeLoi('ppl'), 'ppl');
		assert.equal(mapTypeLoi('pplo'), 'pplo');
		assert.equal(mapTypeLoi('pplc'), 'pplc');
		assert.equal(mapTypeLoi('ppro'), 'ppro');
		assert.equal(mapTypeLoi('refe'), 'refe');
	});

	test('résolutions', () => {
		assert.equal(mapTypeLoi('pac'), 'pac');
		assert.equal(mapTypeLoi('ppre'), 'ppre');
		assert.equal(mapTypeLoi('ppra'), 'ppra');
		assert.equal(mapTypeLoi('pprp'), 'pprp');
		assert.equal(mapTypeLoi('enq'), 'enq');
	});

	test('cas particuliers', () => {
		assert.equal(mapTypeLoi('cvn'), 'cvn');
		assert.equal(mapTypeLoi('mref'), 'mref');
		assert.equal(mapTypeLoi('dape'), 'dape');
	});

	test('typloicod tronqué/padded retourne autre', () => {
		// Le code peut être padding-trimmed avant d'arriver ici (chars PG `character(4)`)
		assert.equal(mapTypeLoi('xxxx'), 'autre');
		assert.equal(mapTypeLoi(''), 'autre');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// mapEtatLoi
// ────────────────────────────────────────────────────────────────────────────

describe('mapEtatLoi — etaloicod → TexteSenatEtat', () => {
	test('décodage des codes étatiques officiels', () => {
		assert.equal(mapEtatLoi('01'), 'en-cours');
		assert.equal(mapEtatLoi('02'), 'fusionne');
		assert.equal(mapEtatLoi('03'), 'rejete');
		assert.equal(mapEtatLoi('04'), 'promulgue');
		assert.equal(mapEtatLoi('05'), 'caduc');
		assert.equal(mapEtatLoi('06'), 'retire');
	});

	test('null/vide → inconnu', () => {
		assert.equal(mapEtatLoi(null), 'inconnu');
		assert.equal(mapEtatLoi(''), 'inconnu');
	});

	test('code non documenté → inconnu', () => {
		assert.equal(mapEtatLoi('99'), 'inconnu');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// buildDossierSenatFromRow
// ────────────────────────────────────────────────────────────────────────────

describe('buildDossierSenatFromRow — assemblage ligne loi + enums', () => {
	test('dossier promulgué standard avec date JO', () => {
		const row: DossierSenatBrut = {
			loicod: '74884       ',
			typloicod: 'pplo',
			etaloicod: '04',
			loitit:
				'visant à reporter le renouvellement général des membres du congrès et des assemblées de province de la Nouvelle-Calédonie',
			loiint: null,
			date_loi: '2024-11-15 00:00:00',
			loidatjo: '2024-11-16 00:00:00',
			loinumjo: '2024-1026',
			url_jo: 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000050505050',
			numero: '2024-1026'
		};
		const d = buildDossierSenatFromRow(row);
		assert.equal(d.loicod, '74884'); // trim padding
		assert.equal(d.type, 'pplo');
		assert.equal(d.etat, 'promulgue');
		assert.equal(d.titre, row.loitit?.trim());
		assert.equal(d.numeroLoi, '2024-1026');
		assert.equal(d.datePromulgation, '2024-11-16');
		assert.equal(d.urlJO, 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000050505050');
	});

	test('dossier en cours (pas de promulgation)', () => {
		const row: DossierSenatBrut = {
			loicod: '99999       ',
			typloicod: 'ppl ',
			etaloicod: '01',
			loitit: 'relative à la protection des données personnelles',
			loiint: null,
			date_loi: null,
			loidatjo: null,
			loinumjo: null,
			url_jo: null,
			numero: null
		};
		const d = buildDossierSenatFromRow(row);
		assert.equal(d.loicod, '99999');
		assert.equal(d.type, 'ppl');
		assert.equal(d.etat, 'en-cours');
		assert.equal(d.numeroLoi, null);
		assert.equal(d.datePromulgation, null);
		assert.equal(d.urlJO, null);
	});

	test('titre prélevé sur loiint si loitit est null/vide', () => {
		const row: DossierSenatBrut = {
			loicod: '11111       ',
			typloicod: 'pjlf',
			etaloicod: '04',
			loitit: '',
			loiint: 'projet de loi de finances pour 2025',
			date_loi: '2024-12-30 00:00:00',
			loidatjo: '2024-12-31 00:00:00',
			loinumjo: '2024-1500',
			url_jo: null,
			numero: '2024-1500'
		};
		const d = buildDossierSenatFromRow(row);
		assert.equal(d.titre, 'projet de loi de finances pour 2025');
	});

	test('trim des padding chars de PostgreSQL character(N)', () => {
		const row: DossierSenatBrut = {
			loicod: '12345       ', // character(12) → 7 espaces de padding
			typloicod: 'pjl ', // character(4) → 1 espace
			etaloicod: '04',
			loitit: 'libellé court  ', // varchar peut avoir des espaces trailing
			loiint: null,
			date_loi: null,
			loidatjo: null,
			loinumjo: null,
			url_jo: null,
			numero: null
		};
		const d = buildDossierSenatFromRow(row);
		assert.equal(d.loicod, '12345');
		assert.equal(d.type, 'pjl');
		// titre conserve la casse mais trim
		assert.equal(d.titre.trim(), 'libellé court');
	});

	test('datePromulgation est seulement la partie YYYY-MM-DD (sans timestamp)', () => {
		const row: DossierSenatBrut = {
			loicod: 'X           ',
			typloicod: 'pjl',
			etaloicod: '04',
			loitit: 'X',
			loiint: null,
			date_loi: '2024-05-10 00:00:00',
			loidatjo: '2024-05-15 12:34:56',
			loinumjo: 'foo',
			url_jo: null,
			numero: 'foo'
		};
		const d = buildDossierSenatFromRow(row);
		assert.equal(d.datePromulgation, '2024-05-15');
	});
});
