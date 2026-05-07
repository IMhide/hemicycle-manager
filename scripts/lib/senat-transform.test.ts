/**
 * Tests TDD pour les transformations métier du pipeline Sénat (cf ADR 0023..0025).
 *
 * Cible les fonctions pures qui assemblent les structures finales à partir des
 * sources brutes. Pas d'I/O — les inputs sont en mémoire.
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import {
	sessionsCovering,
	groupeAuVote,
	type RawAppartenanceGroupe
} from './senat-transform.ts';

// ────────────────────────────────────────────────────────────────────────────
// sessionsCovering : retourne les sessions parlementaires (sept N → sept N+1)
// chevauchant un intervalle de mandat [debut, fin].
//
// Une session de Sénat commence le 1er octobre N et se termine le 30 sept N+1
// (par convention parlementaire). Un mandat couvre les sessions dont
// l'intervalle de session intersecte l'intervalle [datePriseFonction, dateFinFonction].
// ────────────────────────────────────────────────────────────────────────────

describe('sessionsCovering', () => {
	test('mandat court intra-session → 1 session', () => {
		// Mandat du 2024-11-15 au 2025-03-20 → couvre uniquement la session 2024
		assert.deepEqual(sessionsCovering('2024-11-15', '2025-03-20'), [2024]);
	});
	test('mandat traversant 2 sessions', () => {
		// Du 2024-06-15 au 2025-12-15 → sessions 2023 (jusqu'à fin sept 2024),
		// 2024 (oct 2024 → sept 2025), 2025 (oct 2025 → ...)
		assert.deepEqual(sessionsCovering('2024-06-15', '2025-12-15'), [2023, 2024, 2025]);
	});
	test('mandat en cours (dateFinFonction null) → toutes sessions jusqu\'à aujourd\'hui', () => {
		// On utilise une date connue. Pour ne pas dépendre du temps réel, on passe
		// today explicitement (paramètre optionnel).
		assert.deepEqual(
			sessionsCovering('2023-10-01', null, '2026-05-06'),
			[2023, 2024, 2025]
		);
	});
	test('mandat commençant pile au 1er octobre → session N', () => {
		assert.deepEqual(sessionsCovering('2024-10-01', '2024-10-15'), [2024]);
	});
	test('mandat commençant en septembre N → session N-1 (avant le 1er oct)', () => {
		assert.deepEqual(sessionsCovering('2024-09-15', '2024-09-30'), [2023]);
	});
	test('mandat sur 6 ans = 6 sessions', () => {
		// Sénateur élu 2020-10-01, mandat 6 ans → 2020 à 2025 (6 sessions)
		assert.deepEqual(
			sessionsCovering('2020-10-01', '2026-09-30'),
			[2020, 2021, 2022, 2023, 2024, 2025]
		);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// groupeAuVote : retourne le code du groupe d'appartenance du sénateur à la
// date du scrutin (cf ADR 0016 transposée). Renvoie null si aucune
// appartenance ne couvre la date, ou si l'appartenance est NI/AUCUN
// (ces sénateurs n'ont pas de groupe pour la loyauté).
// ────────────────────────────────────────────────────────────────────────────

describe('groupeAuVote', () => {
	const apps: RawAppartenanceGroupe[] = [
		{ groupeCode: 'SOC', dateDebut: '2014-10-01', dateFin: '2017-09-30' },
		{ groupeCode: 'NI', dateDebut: '2017-10-01', dateFin: '2017-12-15' },
		{ groupeCode: 'LREM', dateDebut: '2017-12-16', dateFin: null }
	];

	test('date dans la 1ère appartenance → SOC', () => {
		assert.equal(groupeAuVote(apps, '2015-06-01'), 'SOC');
	});
	test('date dans la 2ème appartenance (NI) → null (NI n\'a pas de groupe)', () => {
		assert.equal(groupeAuVote(apps, '2017-11-01'), null);
	});
	test('date dans l\'appartenance ouverte (sans dateFin) → LREM', () => {
		assert.equal(groupeAuVote(apps, '2024-05-01'), 'LREM');
	});
	test('date avant toute appartenance → null', () => {
		assert.equal(groupeAuVote(apps, '2010-01-01'), null);
	});
	test('date AUCUN → null', () => {
		const aucunApps: RawAppartenanceGroupe[] = [
			{ groupeCode: 'AUCUN', dateDebut: '2023-10-01', dateFin: '2023-10-02' }
		];
		assert.equal(groupeAuVote(aucunApps, '2023-10-01'), null);
	});
	test('date pile au début d\'une appartenance', () => {
		// 2017-10-01 = pile début de NI → null (NI sans groupe)
		assert.equal(groupeAuVote(apps, '2017-10-01'), null);
	});
	test('liste d\'appartenances vide → null', () => {
		assert.equal(groupeAuVote([], '2024-01-01'), null);
	});
});
