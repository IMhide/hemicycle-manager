/**
 * Tests pour scripts/lib/senat-sources.ts.
 *
 * Couvre la lecture défensive de `senateurs-api.json` introduite après l'incident
 * du 2026-05-07 (CDN senat.fr renvoyant 200 OK + 0 octet pendant régénération).
 *
 * Lance via : node --experimental-strip-types --test scripts/lib/senat-sources.test.ts
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import { readApiSenateursOrEmpty } from './senat-sources.ts';

describe('readApiSenateursOrEmpty', () => {
	test('chaîne vide → [] + warning', () => {
		const logs: string[] = [];
		const res = readApiSenateursOrEmpty('', (m) => logs.push(m));
		assert.deepEqual(res, []);
		assert.equal(logs.length, 1);
		assert.match(logs[0], /api-senat\/senateurs\.json vide/);
		assert.match(logs[0], /fallback ODSEN\+dosleg/);
	});

	test('chaîne avec uniquement des blancs/sauts de ligne → [] + warning', () => {
		const logs: string[] = [];
		const res = readApiSenateursOrEmpty('   \n\t  \n', (m) => logs.push(m));
		assert.deepEqual(res, []);
		assert.equal(logs.length, 1);
		assert.match(logs[0], /vide/);
	});

	test('JSON invalide → [] + warning avec message d\'erreur', () => {
		const logs: string[] = [];
		const res = readApiSenateursOrEmpty('{not valid json', (m) => logs.push(m));
		assert.deepEqual(res, []);
		assert.equal(logs.length, 1);
		assert.match(logs[0], /JSON invalide/);
		assert.match(logs[0], /fallback/);
	});

	test('JSON valide mais objet (pas tableau) → [] + warning', () => {
		const logs: string[] = [];
		// Cloudflare ou page d'erreur peut renvoyer un objet
		const res = readApiSenateursOrEmpty(
			JSON.stringify({ error: 'rate-limited' }),
			(m) => logs.push(m)
		);
		assert.deepEqual(res, []);
		assert.equal(logs.length, 1);
		assert.match(logs[0], /non-tableau/);
	});

	test('JSON tableau vide → [] sans warning', () => {
		const logs: string[] = [];
		const res = readApiSenateursOrEmpty('[]', (m) => logs.push(m));
		assert.deepEqual(res, []);
		assert.equal(logs.length, 0, 'pas de warning : tableau vide est syntaxiquement valide');
	});

	test('JSON tableau avec sénateurs → renvoie le tableau intact, pas de warning', () => {
		const logs: string[] = [];
		const sample = [
			{
				matricule: '08061X',
				nom: 'LARCHER',
				prenom: 'Gérard',
				civilite: 'M.',
				siege: 1,
				serie: '2',
				urlAvatar: '/senimg/larcher_gerard08061x_carre.jpg',
				groupe: { code: 'LR', libelle: 'Les Républicains', ordre: 1 },
				circonscription: { code: '78', libelle: 'Yvelines' }
			}
		];
		const res = readApiSenateursOrEmpty(JSON.stringify(sample), (m) => logs.push(m));
		assert.deepEqual(res, sample);
		assert.equal(logs.length, 0);
	});

	test('JSON valide avec champs manquants → renvoyé tel quel (pas de validation strict)', () => {
		// Le pipeline downstream gère les champs optionnels via `??`. La fonction
		// ne doit donc pas filtrer/rejeter les entrées partielles ici.
		const logs: string[] = [];
		const minimal = [{ matricule: 'XXX', nom: 'X', prenom: 'X', civilite: 'M.' }];
		const res = readApiSenateursOrEmpty(JSON.stringify(minimal), (m) => logs.push(m));
		assert.equal(res.length, 1);
		assert.equal(res[0].matricule, 'XXX');
		assert.equal(logs.length, 0);
	});

	test('par défaut, log via console.log si non fourni', () => {
		// Smoke : ne doit pas planter sans logger custom
		const res = readApiSenateursOrEmpty('[]');
		assert.deepEqual(res, []);
	});
});
