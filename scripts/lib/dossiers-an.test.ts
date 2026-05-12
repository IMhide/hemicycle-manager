/**
 * Tests TDD pour le parser de dossiers législatifs AN (Etalab).
 *
 * Couvre les fonctions pures de transformation :
 *  - normaliseProcedureCode : map code procédure → enum
 *  - extractTimeline : extrait les actes datés clés d'un dossier
 *  - extractInitiateurs : récupère les PA-ids déposants (acteur unique ou tableau)
 *  - shouldKeepDossier : filtre legis/type
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import {
	normaliseProcedureCode,
	extractTimeline,
	extractInitiateurs,
	shouldKeepDossier
} from './dossiers-an.ts';

// ────────────────────────────────────────────────────────────────────────────
// normaliseProcedureCode
// ────────────────────────────────────────────────────────────────────────────

describe('normaliseProcedureCode', () => {
	test('code 1 → projet-loi-ordinaire', () => {
		assert.equal(normaliseProcedureCode('1'), 'projet-loi-ordinaire');
	});
	test('code 2 → proposition-loi-ordinaire', () => {
		assert.equal(normaliseProcedureCode('2'), 'proposition-loi-ordinaire');
	});
	test('code 3 → projet-loi-finances (PLF)', () => {
		assert.equal(normaliseProcedureCode('3'), 'projet-loi-finances');
	});
	test('code 4 → projet-loi-financement-ss (PLFSS)', () => {
		assert.equal(normaliseProcedureCode('4'), 'projet-loi-financement-ss');
	});
	test('code 5 → loi-organique (projet OU proposition, indifférencié côté Etalab)', () => {
		assert.equal(normaliseProcedureCode('5'), 'loi-organique');
	});
	test('code 7 → loi-constitutionnelle', () => {
		assert.equal(normaliseProcedureCode('7'), 'loi-constitutionnelle');
	});
	test('code 21 → projet-loi-finances-rectificative', () => {
		assert.equal(normaliseProcedureCode('21'), 'projet-loi-finances-rectificative');
	});
	test('code 23 → proposition-loi-article-11', () => {
		assert.equal(normaliseProcedureCode('23'), 'proposition-loi-article-11');
	});
	test("code inconnu → 'autre'", () => {
		assert.equal(normaliseProcedureCode('999'), 'autre');
	});
	test('null → autre', () => {
		assert.equal(normaliseProcedureCode(null), 'autre');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// extractInitiateurs : tolérance acteur unique vs tableau
// ────────────────────────────────────────────────────────────────────────────

describe('extractInitiateurs', () => {
	test('acteur unique → tableau à 1 élément', () => {
		const initiateur = {
			acteurs: { acteur: { acteurRef: 'PA795528', mandatRef: 'PM843455' } }
		};
		assert.deepEqual(extractInitiateurs(initiateur), ['PA795528']);
	});
	test('plusieurs acteurs → tableau', () => {
		const initiateur = {
			acteurs: {
				acteur: [
					{ acteurRef: 'PA643210', mandatRef: 'PM873637' },
					{ acteurRef: 'PA721134', mandatRef: 'PM873687' }
				]
			}
		};
		assert.deepEqual(extractInitiateurs(initiateur), ['PA643210', 'PA721134']);
	});
	test('initiateur null → tableau vide', () => {
		assert.deepEqual(extractInitiateurs(null), []);
	});
	test('initiateur sans acteurs → tableau vide', () => {
		assert.deepEqual(extractInitiateurs({}), []);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// extractTimeline : extraction des dates clés du dossier
// ────────────────────────────────────────────────────────────────────────────

describe('extractTimeline', () => {
	test('Récupère le 1er dépôt AN', () => {
		const actes = {
			acteLegislatif: {
				'@xsi:type': 'Etape_Type',
				codeActe: 'AN1',
				actesLegislatifs: {
					acteLegislatif: {
						'@xsi:type': 'DepotInitiative_Type',
						codeActe: 'AN1-DEPOT',
						dateActe: '2025-12-02T00:00:00.000+02:00'
					}
				}
			}
		};
		const tl = extractTimeline(actes);
		assert.equal(tl.dateDepotAN, '2025-12-02');
	});
	test('Récupère procédure accélérée', () => {
		const actes = {
			acteLegislatif: [
				{
					'@xsi:type': 'DepotInitiative_Type',
					codeActe: 'AN1-DEPOT',
					dateActe: '2025-12-02T00:00:00.000+02:00'
				},
				{
					'@xsi:type': 'ProcedureAccelere_Type',
					codeActe: 'AN1-PROCACC',
					dateActe: '2026-03-23T00:00:00.000+02:00'
				}
			]
		};
		const tl = extractTimeline(actes);
		assert.equal(tl.dateProcedureAccelere, '2026-03-23');
	});
	test('Récupère promulgation', () => {
		const actes = {
			acteLegislatif: {
				'@xsi:type': 'Promulgation_Type',
				dateActe: '2026-06-15T00:00:00.000+02:00'
			}
		};
		const tl = extractTimeline(actes);
		assert.equal(tl.datePromulgation, '2026-06-15');
	});
	test('Actes vides → timeline vide', () => {
		const tl = extractTimeline({});
		assert.equal(tl.dateDepotAN, null);
		assert.equal(tl.dateProcedureAccelere, null);
		assert.equal(tl.datePromulgation, null);
	});
	test('Dates avec timezone européenne tronquées à YYYY-MM-DD', () => {
		const tl = extractTimeline({
			acteLegislatif: {
				'@xsi:type': 'DepotInitiative_Type',
				codeActe: 'AN1-DEPOT',
				dateActe: '2025-10-14T00:00:00.000+02:00'
			}
		});
		assert.equal(tl.dateDepotAN, '2025-10-14');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// shouldKeepDossier : filtre legis + type
// ────────────────────────────────────────────────────────────────────────────

describe('shouldKeepDossier', () => {
	test('Dossier législatif 17ᵉ → conservé', () => {
		assert.equal(
			shouldKeepDossier(
				{ legislature: '17', '@xsi:type': 'DossierLegislatif_Type' },
				new Set([17])
			),
			true
		);
	});
	test('Dossier mission contrôle 17ᵉ → rejeté', () => {
		assert.equal(
			shouldKeepDossier(
				{ legislature: '17', '@xsi:type': 'DossierMissionControle_Type' },
				new Set([17])
			),
			false
		);
	});
	test('Dossier législatif 16ᵉ avec legis {15,16,17} → conservé', () => {
		assert.equal(
			shouldKeepDossier(
				{ legislature: '16', '@xsi:type': 'DossierLegislatif_Type' },
				new Set([15, 16, 17])
			),
			true
		);
	});
	test('Dossier législatif 14ᵉ → rejeté', () => {
		assert.equal(
			shouldKeepDossier(
				{ legislature: '14', '@xsi:type': 'DossierLegislatif_Type' },
				new Set([15, 16, 17])
			),
			false
		);
	});
	test('Pas de @xsi:type → rejeté', () => {
		assert.equal(shouldKeepDossier({ legislature: '17' }, new Set([17])), false);
	});
	test('Résolution AN 17ᵉ → conservée (NB: type sans suffixe _Type côté Etalab)', () => {
		assert.equal(
			shouldKeepDossier(
				{ legislature: '17', '@xsi:type': 'DossierResolutionAN' },
				new Set([17])
			),
			true
		);
	});
});
