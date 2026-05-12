/**
 * Tests pour le builder du manifest `acteurs-noms.json`.
 *
 * Ce manifest expose le nom de TOUS les acteurs Etalab (députés, sénateurs,
 * ministres, anciens, etc.) — utile pour afficher les initiateurs de
 * dossiers législatifs (cf ADR 0035) qui ne sont pas tous députés (ex.
 * ministres déposant un projet de loi).
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import { extractActeurId, parseActeurNom } from './acteurs-noms.ts';

// ────────────────────────────────────────────────────────────────────────────
// extractActeurId : tolérance string vs {#text}
// ────────────────────────────────────────────────────────────────────────────

describe('extractActeurId', () => {
	test('uid string direct', () => {
		assert.equal(extractActeurId('PA643210'), 'PA643210');
	});
	test('uid object avec #text', () => {
		assert.equal(extractActeurId({ '#text': 'PA643210' }), 'PA643210');
	});
	test('uid object sans #text → null', () => {
		assert.equal(extractActeurId({ foo: 'bar' }), null);
	});
	test('uid null → null', () => {
		assert.equal(extractActeurId(null), null);
	});
	test('uid undefined → null', () => {
		assert.equal(extractActeurId(undefined), null);
	});
	test('uid string vide → null', () => {
		assert.equal(extractActeurId(''), null);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// parseActeurNom : extraction depuis acteur Etalab
// ────────────────────────────────────────────────────────────────────────────

describe('parseActeurNom', () => {
	test('Acteur valide complet', () => {
		const raw = {
			acteur: {
				uid: { '#text': 'PA643210' },
				etatCivil: {
					ident: { civ: 'M.', prenom: 'Sébastien', nom: 'Lecornu' }
				}
			}
		};
		assert.deepEqual(parseActeurNom(raw), {
			id: 'PA643210',
			civ: 'M.',
			prenom: 'Sébastien',
			nom: 'Lecornu'
		});
	});

	test('Acteur avec uid string', () => {
		const raw = {
			acteur: {
				uid: 'PA12345',
				etatCivil: { ident: { civ: 'Mme', prenom: 'Amélie', nom: 'de Montchalin' } }
			}
		};
		assert.deepEqual(parseActeurNom(raw), {
			id: 'PA12345',
			civ: 'Mme',
			prenom: 'Amélie',
			nom: 'de Montchalin'
		});
	});

	test('Acteur sans civ → champ vide gardé', () => {
		const raw = {
			acteur: {
				uid: { '#text': 'PA1' },
				etatCivil: { ident: { prenom: 'X', nom: 'Y' } }
			}
		};
		assert.deepEqual(parseActeurNom(raw), { id: 'PA1', civ: '', prenom: 'X', nom: 'Y' });
	});

	test('Acteur sans nom complet → null', () => {
		const raw = {
			acteur: {
				uid: { '#text': 'PA1' },
				etatCivil: { ident: {} }
			}
		};
		assert.equal(parseActeurNom(raw), null);
	});

	test('Acteur sans uid → null', () => {
		const raw = {
			acteur: {
				etatCivil: { ident: { prenom: 'X', nom: 'Y' } }
			}
		};
		assert.equal(parseActeurNom(raw), null);
	});

	test('Input vide → null', () => {
		assert.equal(parseActeurNom(undefined), null);
		assert.equal(parseActeurNom({}), null);
	});

	test('Acteur avec juste un nom (cas ancien parlementaire historique)', () => {
		const raw = {
			acteur: {
				uid: { '#text': 'PA999' },
				etatCivil: { ident: { nom: 'Dupont' } }
			}
		};
		// On garde car au moins le nom est là
		assert.deepEqual(parseActeurNom(raw), { id: 'PA999', civ: '', prenom: '', nom: 'Dupont' });
	});
});
