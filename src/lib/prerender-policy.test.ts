import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isToleratedPrerenderError, HISTORIQUE_PREFIX } from './prerender-policy.js';

/**
 * Régression du build Coolify (PR #33) : le prerender SSG échouait sur un 404
 * `/data/historique/PA720242.json` (Bérangère Abba, fiche /elus/berangere-abba/),
 * cassant TOUT le déploiement. La politique `handleHttpError` (svelte.config.js)
 * tolère ces 404 d'historique légitimement absents et laisse fatales les autres.
 *
 * Ces tests verrouillent le prédicat *réellement déployé* (importé par la config)
 * pour qu'aucune régression future ne reréintroduise le crash ni n'élargisse le
 * trou à des erreurs qui devraient rester fatales.
 */
describe('isToleratedPrerenderError', () => {
	describe('toléré : historiques de vote légitimement absents', () => {
		test('le cas exact de la régression (Bérangère Abba, PA720242)', () => {
			// Élu au manifest mais 0 vote → pas de fichier historique. Ne doit JAMAIS
			// casser le build.
			assert.equal(isToleratedPrerenderError('/data/historique/PA720242.json'), true);
		});

		test('autre paId AN sans historique', () => {
			assert.equal(isToleratedPrerenderError('/data/historique/PA1832.json'), true);
		});

		test('matricule sénateur sans historique', () => {
			// Même route /data/historique/, côté Sénat (matricule au lieu de paId).
			assert.equal(isToleratedPrerenderError('/data/historique/12345H.json'), true);
		});

		test('tout chemin sous le préfixe, quelle que soit la suite', () => {
			assert.equal(isToleratedPrerenderError(`${HISTORIQUE_PREFIX}n-importe-quoi`), true);
		});
	});

	describe('fatal : tout le reste doit casser le build (vrai bug, pas à masquer)', () => {
		test('404 sur une vraie page (ex. fiche élu)', () => {
			assert.equal(isToleratedPrerenderError('/elus/berangere-abba/'), false);
		});

		test('404 sur un autre fichier data (personnes, textes, scrutins…)', () => {
			assert.equal(isToleratedPrerenderError('/data/personnes.json'), false);
			assert.equal(isToleratedPrerenderError('/data/textes.json'), false);
			assert.equal(isToleratedPrerenderError('/data/scrutins/VTANR5L17V1.json'), false);
			assert.equal(isToleratedPrerenderError('/data/elus.json'), false);
		});

		test('404 sur un asset (image, css, js)', () => {
			assert.equal(isToleratedPrerenderError('/favicon.png'), false);
			assert.equal(isToleratedPrerenderError('/photos/720242.jpg'), false);
		});

		test('ne se déclenche PAS sur une simple sous-chaîne (anti-élargissement)', () => {
			// Le préfixe doit ancrer au début : un chemin qui *contient* mais ne
			// *commence pas par* /data/historique/ reste fatal.
			assert.equal(
				isToleratedPrerenderError('/data/autre/data/historique/x.json'),
				false
			);
			assert.equal(isToleratedPrerenderError('/historique/PA720242.json'), false);
		});
	});
});
