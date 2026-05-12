/**
 * Tests TDD pour `extractReunionRefs` : extrait tous les `reunionRef`
 * référencés dans l'arbre `actesLegislatifs` d'un dossier législatif Etalab.
 *
 * Méthode inspirée de Poligraph (https://github.com/ironlam/poligraph) :
 * croiser le `seanceRef` côté scrutin avec les `reunionRef` répertoriés
 * dans les actes d'un dossier permet de rattacher un scrutin à son texte
 * sans dépendre du champ `objet.dossierLegislatif.dossierRef` (peuplé à
 * 11% seulement par Etalab).
 *
 * Mesuré sur 6 530 scrutins 17ᵉ : 59,3% match unique + 24,3% après
 * désambiguïsation titre = 83,7% rattachés à un DLR officiel, contre 11%
 * avec l'ancienne méthode. Énorme gain pour l'enrichissement métadonnées.
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import { extractReunionRefs } from './dossiers-reunions.ts';

// ────────────────────────────────────────────────────────────────────────────

describe('extractReunionRefs', () => {
	test('Acte unique avec reunionRef direct', () => {
		const actes = {
			acteLegislatif: {
				'@xsi:type': 'DiscussionSeancePublique_Type',
				reunionRef: 'RUANR5L17S2026IDS30541'
			}
		};
		assert.deepEqual(extractReunionRefs(actes), new Set(['RUANR5L17S2026IDS30541']));
	});

	test("Acte sans reunionRef → ensemble vide", () => {
		const actes = {
			acteLegislatif: {
				'@xsi:type': 'DepotInitiative_Type',
				dateActe: '2025-12-02'
			}
		};
		assert.deepEqual(extractReunionRefs(actes), new Set());
	});

	test('Acte avec actesLegislatifs imbriqués', () => {
		const actes = {
			acteLegislatif: {
				'@xsi:type': 'Etape_Type',
				actesLegislatifs: {
					acteLegislatif: [
						{
							'@xsi:type': 'DiscussionSeancePublique_Type',
							reunionRef: 'RUANR5L17S2026IDS30541'
						},
						{
							'@xsi:type': 'DiscussionCommission_Type',
							reunionRef: 'RUANR5L17S2026IDC458018'
						}
					]
				}
			}
		};
		assert.deepEqual(
			extractReunionRefs(actes),
			new Set(['RUANR5L17S2026IDS30541', 'RUANR5L17S2026IDC458018'])
		);
	});

	test('Profondeur de récursion ≥ 3 niveaux', () => {
		const actes = {
			acteLegislatif: {
				'@xsi:type': 'Etape_Type',
				actesLegislatifs: {
					acteLegislatif: {
						'@xsi:type': 'Etape_Type',
						actesLegislatifs: {
							acteLegislatif: {
								'@xsi:type': 'DiscussionSeancePublique_Type',
								reunionRef: 'R-NESTED'
							}
						}
					}
				}
			}
		};
		assert.deepEqual(extractReunionRefs(actes), new Set(['R-NESTED']));
	});

	test('Plusieurs occurrences du même reunionRef → dédup', () => {
		const actes = {
			acteLegislatif: [
				{ '@xsi:type': 'X', reunionRef: 'RUANR_X' },
				{ '@xsi:type': 'Y', reunionRef: 'RUANR_X' }, // doublon
				{ '@xsi:type': 'Z', reunionRef: 'RUANR_Y' }
			]
		};
		const out = extractReunionRefs(actes);
		assert.equal(out.size, 2);
		assert.ok(out.has('RUANR_X'));
		assert.ok(out.has('RUANR_Y'));
	});

	test('reunionRef vide ou null ignorés', () => {
		const actes = {
			acteLegislatif: [
				{ '@xsi:type': 'X', reunionRef: '' },
				{ '@xsi:type': 'Y', reunionRef: null },
				{ '@xsi:type': 'Z', reunionRef: 'RUANR_OK' }
			]
		};
		assert.deepEqual(extractReunionRefs(actes), new Set(['RUANR_OK']));
	});

	test('Champs inconnus ignorés', () => {
		const actes = {
			acteLegislatif: {
				'@xsi:type': 'X',
				reunionRef: 'RUANR_OK',
				autreChamp: 'RUANR_FAKE_NOT_A_REF' // ne doit pas être collecté
			}
		};
		assert.deepEqual(extractReunionRefs(actes), new Set(['RUANR_OK']));
	});

	test('Input vide ou null → ensemble vide', () => {
		assert.deepEqual(extractReunionRefs(null), new Set());
		assert.deepEqual(extractReunionRefs(undefined), new Set());
		assert.deepEqual(extractReunionRefs({}), new Set());
	});
});
