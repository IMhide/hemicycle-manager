/**
 * Tests pour scripts/lib/groupes-familles.ts (cf ADR 0034).
 *
 * Lance via : node --experimental-strip-types --test scripts/lib/groupes-familles.test.ts
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	buildFamillesIndex,
	familleAN,
	familleSenat,
	type FamillesManifest
} from './groupes-familles.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('buildFamillesIndex', () => {
	test('manifest minimal vide → index vides', () => {
		const m: FamillesManifest = { familles: {} };
		const idx = buildFamillesIndex(m);
		assert.equal(idx.an.size, 0);
		assert.equal(idx.senat.size, 0);
	});

	test('manifest avec une famille AN → index AN peuplé', () => {
		const m: FamillesManifest = {
			familles: {
				FAMILLE_LFI: {
					label: 'LFI',
					groupes: [
						{ chambre: 'AN', id: 'PO730958', libelle: 'FI' },
						{ chambre: 'AN', id: 'PO800490', libelle: 'LFI-NUPES' }
					]
				}
			}
		};
		const idx = buildFamillesIndex(m);
		assert.equal(idx.an.get('PO730958'), 'FAMILLE_LFI');
		assert.equal(idx.an.get('PO800490'), 'FAMILLE_LFI');
		assert.equal(idx.senat.size, 0);
	});

	test('manifest mixte AN + Sénat → indexes séparés', () => {
		const m: FamillesManifest = {
			familles: {
				FAMILLE_PS: {
					label: 'PS',
					groupes: [
						{ chambre: 'AN', id: 'PO758835', libelle: 'SOC AN' },
						{ chambre: 'SENAT', code: 'SOC', libelle: 'SOC Sénat' }
					]
				}
			}
		};
		const idx = buildFamillesIndex(m);
		assert.equal(idx.an.get('PO758835'), 'FAMILLE_PS');
		assert.equal(idx.senat.get('SOC'), 'FAMILLE_PS');
	});

	test('groupe AN mappé à deux familles → erreur claire', () => {
		const m: FamillesManifest = {
			familles: {
				FAMILLE_A: {
					label: 'A',
					groupes: [{ chambre: 'AN', id: 'PO123', libelle: 'A' }]
				},
				FAMILLE_B: {
					label: 'B',
					groupes: [{ chambre: 'AN', id: 'PO123', libelle: 'B' }]
				}
			}
		};
		assert.throws(() => buildFamillesIndex(m), /PO123 mappé à deux familles/);
	});

	test('groupe Sénat mappé à deux familles → erreur claire', () => {
		const m: FamillesManifest = {
			familles: {
				FAMILLE_A: {
					label: 'A',
					groupes: [{ chambre: 'SENAT', code: 'SOC', libelle: 'A' }]
				},
				FAMILLE_B: {
					label: 'B',
					groupes: [{ chambre: 'SENAT', code: 'SOC', libelle: 'B' }]
				}
			}
		};
		assert.throws(() => buildFamillesIndex(m), /SOC mappé à deux familles/);
	});
});

describe('familleAN', () => {
	const idx = buildFamillesIndex({
		familles: {
			FAMILLE_LFI: {
				label: 'LFI',
				groupes: [
					{ chambre: 'AN', id: 'PO800490', libelle: 'LFI-NUPES' },
					{ chambre: 'AN', id: 'PO845413', libelle: 'LFI-NFP' }
				]
			}
		}
	});

	test('groupe connu → familleId', () => {
		assert.equal(familleAN(idx, 'PO800490'), 'FAMILLE_LFI');
		assert.equal(familleAN(idx, 'PO845413'), 'FAMILLE_LFI');
	});

	test('groupe inconnu → groupeId brut (sa propre famille)', () => {
		assert.equal(familleAN(idx, 'PO999999'), 'PO999999');
	});

	test('deux groupes de la même famille comparent égaux', () => {
		assert.equal(familleAN(idx, 'PO800490'), familleAN(idx, 'PO845413'));
	});

	test('deux groupes inconnus différents comparent inégaux (pas de fusion implicite)', () => {
		assert.notEqual(familleAN(idx, 'PO111'), familleAN(idx, 'PO222'));
	});
});

describe('familleSenat', () => {
	const idx = buildFamillesIndex({
		familles: {
			FAMILLE_PS: {
				label: 'PS',
				groupes: [{ chambre: 'SENAT', code: 'SOC', libelle: 'SOC' }]
			}
		}
	});

	test('code connu → familleId', () => {
		assert.equal(familleSenat(idx, 'SOC'), 'FAMILLE_PS');
	});

	test('code inconnu → code brut', () => {
		assert.equal(familleSenat(idx, 'XYZ'), 'XYZ');
	});
});

describe('manifest réel groupes-familles.json', () => {
	test('charge sans erreur (intégrité du JSON commité)', async () => {
		const raw = await readFile(join(ROOT, 'static', 'data', 'groupes-familles.json'), 'utf8');
		const m = JSON.parse(raw) as FamillesManifest;
		const idx = buildFamillesIndex(m);
		assert.ok(idx.an.size > 0, 'au moins un groupe AN mappé');
		assert.ok(idx.senat.size > 0, 'au moins un groupe Sénat mappé');
	});

	test('Bompard cas canonique : LFI-NUPES (16ᵉ) ≡ LFI-NFP (17ᵉ)', async () => {
		const raw = await readFile(join(ROOT, 'static', 'data', 'groupes-familles.json'), 'utf8');
		const m = JSON.parse(raw) as FamillesManifest;
		const idx = buildFamillesIndex(m);
		assert.equal(familleAN(idx, 'PO800490'), 'FAMILLE_LFI');
		assert.equal(familleAN(idx, 'PO845413'), 'FAMILLE_LFI');
		assert.equal(
			familleAN(idx, 'PO800490'),
			familleAN(idx, 'PO845413'),
			'Bompard ne doit PAS avoir le badge recomposition'
		);
	});

	test('Macronie : LaREM (15ᵉ) ≡ RE (16ᵉ) ≡ EPR (17ᵉ)', async () => {
		const raw = await readFile(join(ROOT, 'static', 'data', 'groupes-familles.json'), 'utf8');
		const m = JSON.parse(raw) as FamillesManifest;
		const idx = buildFamillesIndex(m);
		assert.equal(familleAN(idx, 'PO730964'), 'FAMILLE_MACRONIE');
		assert.equal(familleAN(idx, 'PO800538'), 'FAMILLE_MACRONIE');
		assert.equal(familleAN(idx, 'PO845407'), 'FAMILLE_MACRONIE');
	});

	test('LR (15ᵉ/16ᵉ) ≡ DR (17ᵉ)', async () => {
		const raw = await readFile(join(ROOT, 'static', 'data', 'groupes-familles.json'), 'utf8');
		const m = JSON.parse(raw) as FamillesManifest;
		const idx = buildFamillesIndex(m);
		assert.equal(familleAN(idx, 'PO730934'), familleAN(idx, 'PO800508'));
		assert.equal(familleAN(idx, 'PO800508'), familleAN(idx, 'PO845425'));
	});

	test('LFI (AN) et CRC (Sénat) appartiennent à la même famille', async () => {
		const raw = await readFile(join(ROOT, 'static', 'data', 'groupes-familles.json'), 'utf8');
		const m = JSON.parse(raw) as FamillesManifest;
		const idx = buildFamillesIndex(m);
		assert.equal(familleAN(idx, 'PO800490'), familleSenat(idx, 'CRC'));
	});

	test('groupe NI (PO723569 etc.) absent de la table → traité comme sa propre famille', async () => {
		const raw = await readFile(join(ROOT, 'static', 'data', 'groupes-familles.json'), 'utf8');
		const m = JSON.parse(raw) as FamillesManifest;
		const idx = buildFamillesIndex(m);
		// Les NI de chaque législature ont des IDs différents — on veut qu'ils restent distincts
		// (un NI 16e vs NI 17e ne sont pas la même chose pour un mandat différent).
		assert.equal(familleAN(idx, 'PO723569'), 'PO723569');
		assert.equal(familleAN(idx, 'PO793087'), 'PO793087');
		assert.notEqual(familleAN(idx, 'PO723569'), familleAN(idx, 'PO793087'));
	});
});
