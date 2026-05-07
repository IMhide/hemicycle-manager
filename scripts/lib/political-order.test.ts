/**
 * Tests pour src/lib/political-order.ts.
 *
 * Couvre principalement les ajouts Phase 3 Sénat (cf ADR 0023..0025) sans
 * régresser sur le mapping AN existant (15ᵉ + 16ᵉ + 17ᵉ).
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import {
	POLITICAL_ORDER,
	rankOf,
	gradientColorFor,
	blocOf,
	BLOCS
} from '../../src/lib/political-order.ts';

describe('POLITICAL_ORDER — mapping AN existant (non-régression)', () => {
	test('LFI-NFP rank=2 (extrême gauche)', () => {
		assert.equal(POLITICAL_ORDER['LFI-NFP'].rank, 2);
	});
	test('EPR rank=7 (centre macroniste)', () => {
		assert.equal(POLITICAL_ORDER.EPR.rank, 7);
	});
	test('RN rank=11 (extrême droite)', () => {
		assert.equal(POLITICAL_ORDER.RN.rank, 11);
	});
	test('NI rank=12', () => {
		assert.equal(POLITICAL_ORDER.NI.rank, 12);
	});
});

describe('POLITICAL_ORDER — codes Sénat ajoutés (Phase 3)', () => {
	test('CRC = communiste (rank 1)', () => {
		assert.equal(POLITICAL_ORDER.CRC.rank, 1);
		assert.equal(POLITICAL_ORDER.CRC.chesScore, 1.73);
	});
	test('GEST = écologiste (rank 3)', () => {
		assert.equal(POLITICAL_ORDER.GEST.rank, 3);
	});
	test('ECO = ancien code écologiste (rank 3, même couleur que GEST)', () => {
		assert.equal(POLITICAL_ORDER.ECO.rank, 3);
		assert.equal(POLITICAL_ORDER.ECO.gradientColor, POLITICAL_ORDER.GEST.gradientColor);
	});
	test('SOC est partagé AN/Sénat — pas de surcharge accidentelle', () => {
		// SOC est défini une seule fois côté AN (rank=4) et le Sénat le réutilise.
		assert.equal(POLITICAL_ORDER.SOC.rank, 4);
		assert.equal(POLITICAL_ORDER.SOC.chesScore, 3.45);
	});
	test('RDSE = radical centre-gauche (rank 5)', () => {
		assert.equal(POLITICAL_ORDER.RDSE.rank, 5);
	});
	test('UC = Union Centriste (rank 6)', () => {
		assert.equal(POLITICAL_ORDER.UC.rank, 6);
		assert.equal(POLITICAL_ORDER.UC.chesScore, 5.36);
	});
	test('LREM partagé AN/Sénat — non écrasé par l\'ajout Sénat', () => {
		// Le code LREM existait déjà côté AN (15ᵉ alias). On le réutilise pour
		// le groupe RDPI Sénat — même rank, même couleur. Vérifier la valeur.
		assert.equal(POLITICAL_ORDER.LREM.rank, 7);
		assert.equal(POLITICAL_ORDER.LREM.chesScore, 6.27);
	});
	test('RTLI = Indépendants Sénat (rank 8, Horizons-like)', () => {
		assert.equal(POLITICAL_ORDER.RTLI.rank, 8);
		assert.equal(POLITICAL_ORDER.RTLI.chesScore, 6.6);
	});
	test('UMP = Les Républicains Sénat (rank 9, code historique)', () => {
		assert.equal(POLITICAL_ORDER.UMP.rank, 9);
		assert.equal(POLITICAL_ORDER.UMP.chesScore, 7.73);
	});
	test('AUCUN = alias NI (rank 12, sans CHES)', () => {
		assert.equal(POLITICAL_ORDER.AUCUN.rank, 12);
		assert.equal(POLITICAL_ORDER.AUCUN.chesScore, null);
		assert.equal(POLITICAL_ORDER.AUCUN.gradientColor, POLITICAL_ORDER.NI.gradientColor);
	});
	test('Variantes historiques (UMP-A, UMP-R, RDSE-A, RI, GD) toutes mappées', () => {
		for (const code of ['UMP-A', 'UMP-R', 'RDSE-A', 'RI', 'GD']) {
			assert.ok(POLITICAL_ORDER[code], `code ${code} doit être présent`);
			assert.ok(POLITICAL_ORDER[code].rank >= 1 && POLITICAL_ORDER[code].rank <= 12);
		}
	});
});

describe('rankOf', () => {
	test('null/undefined → rank 12 (NI fallback)', () => {
		assert.equal(rankOf(null), 12);
	});
	test('code inconnu → rank 12 (NI fallback)', () => {
		assert.equal(rankOf('XYZ-INEXISTANT'), 12);
	});
	test('CRC → rank 1', () => {
		assert.equal(rankOf('CRC'), 1);
	});
	test('UMP → rank 9', () => {
		assert.equal(rankOf('UMP'), 9);
	});
});

describe('gradientColorFor', () => {
	test('null → couleur NI', () => {
		assert.equal(gradientColorFor(null), POLITICAL_ORDER.NI.gradientColor);
	});
	test('CRC et GDR partagent la couleur d\'extrême gauche', () => {
		assert.equal(gradientColorFor('CRC'), gradientColorFor('GDR'));
	});
	test('AUCUN partage la couleur NI', () => {
		assert.equal(gradientColorFor('AUCUN'), gradientColorFor('NI'));
	});
});

describe('blocOf — découpage en 5 blocs', () => {
	test('CRC → extrême gauche (CHES 1.73)', () => {
		assert.equal(blocOf('CRC'), 'extreme-gauche');
	});
	test('SOC → gauche (CHES 3.45)', () => {
		assert.equal(blocOf('SOC'), 'gauche');
	});
	test('UC → centre (CHES 5.36)', () => {
		assert.equal(blocOf('UC'), 'centre');
	});
	test('UMP → droite (CHES 7.73)', () => {
		assert.equal(blocOf('UMP'), 'droite');
	});
	test('RN → extrême droite (CHES 8.82)', () => {
		assert.equal(blocOf('RN'), 'extreme-droite');
	});
	test('NI → ni', () => {
		assert.equal(blocOf('NI'), 'ni');
	});
	test('AUCUN → ni', () => {
		assert.equal(blocOf('AUCUN'), 'ni');
	});
	test('RDSE (CHES 3.5) → gauche (juste dans la borne)', () => {
		// RDSE.chesScore = 3.5 ; gauche = [2.5, 4.5[ donc 3.5 est dans gauche
		assert.equal(blocOf('RDSE'), 'gauche');
	});
});

describe('Cohérence globale', () => {
	test('Tous les groupes en exercice Sénat 2024-2025 sont mappés', () => {
		// Sondage api-senat 2024-2025 : CRC, GEST, LREM, NI, RDSE, RTLI, SOC, UC, UMP
		const codesEnExercice = ['CRC', 'GEST', 'LREM', 'NI', 'RDSE', 'RTLI', 'SOC', 'UC', 'UMP'];
		for (const code of codesEnExercice) {
			assert.ok(POLITICAL_ORDER[code], `Code Sénat en exercice manquant : ${code}`);
		}
	});
	test('5 blocs définis dans BLOCS', () => {
		assert.equal(BLOCS.length, 6); // 5 blocs politiques + NI
	});
});
