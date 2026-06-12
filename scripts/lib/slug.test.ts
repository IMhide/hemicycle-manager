/**
 * Tests TDD pour la slugification des URLs lisibles (cf ADR 0042).
 *
 * Objectif : adresser les fiches par un slug lisible (`/elus/prenom-nom`,
 * `/textes/titre-court-id`, groupes `/libelle`) plutôt que par un id opaque,
 * pour ranker sur le nom (cf §0bis du plan SEO). Le slug est calculé au
 * pipeline, stocké dans le manifest, déterministe et unique.
 *
 * Contraintes mesurées sur le dataset réel (2026-06-08) :
 *  - Élus : 1 seule collision `prenom-nom` sur 1856 (`jean-louis-masson`).
 *    Désambiguïsation par suffixe stable (paId/matricule), appliquée
 *    UNIQUEMENT aux entités en collision.
 *  - Textes : 35 collisions de titres + titres de 80+ caractères → slug =
 *    préfixe titre tronqué (frontière de mot) + id canonique (unicité garantie
 *    par l'id).
 *  - Groupes : déjà scopés par législature/triennat → pas de désambiguïsation.
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import { slugify, truncateOnWordBoundary, assignSlugs, texteSlug } from './slug.ts';

// ────────────────────────────────────────────────────────────────────────────
// slugify : minuscule, sans accents, [^a-z0-9] → '-', collapse, trim
// ────────────────────────────────────────────────────────────────────────────

describe('slugify', () => {
	test('minuscule simple', () => {
		assert.equal(slugify('Damien Abad'), 'damien-abad');
	});
	test('accents supprimés', () => {
		assert.equal(slugify('Stéphane Peu'), 'stephane-peu');
		assert.equal(slugify('Cédric Villani'), 'cedric-villani');
		assert.equal(slugify('François Ruffin'), 'francois-ruffin');
	});
	test('apostrophes, traits d’union et ponctuation → un seul tiret', () => {
		assert.equal(slugify("Marine Le Pen"), 'marine-le-pen');
		assert.equal(slugify('Jean-Luc Mélenchon'), 'jean-luc-melenchon');
		assert.equal(slugify("Nathalie Goulet-d'Arc"), 'nathalie-goulet-d-arc');
	});
	test('ç et œ', () => {
		assert.equal(slugify('Françoise'), 'francoise');
		assert.equal(slugify('Lætitia'), 'laetitia');
	});
	test('pas de tiret en tête/queue, pas de tirets doublés', () => {
		assert.equal(slugify('  Jean   Dupont  '), 'jean-dupont');
		assert.equal(slugify('—Jean—'), 'jean');
		assert.equal(slugify('A & B'), 'a-b');
	});
	test('chiffres conservés', () => {
		assert.equal(slugify('Loi 2024 bis'), 'loi-2024-bis');
	});
	test('déterministe (même entrée → même sortie)', () => {
		assert.equal(slugify('Élisabeth Borne'), slugify('Élisabeth Borne'));
	});
	test('chaîne vide ou non-alphanumérique → vide', () => {
		assert.equal(slugify(''), '');
		assert.equal(slugify('—  —'), '');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// truncateOnWordBoundary : coupe à <= max sur une frontière de tiret
// ────────────────────────────────────────────────────────────────────────────

describe('truncateOnWordBoundary', () => {
	test('chaîne courte renvoyée intacte', () => {
		assert.equal(truncateOnWordBoundary('loi-immigration', 50), 'loi-immigration');
	});
	test('coupe sur le dernier tiret avant max (pas au milieu d’un mot)', () => {
		const s = 'proposition-de-loi-organique-portant-actualisation-du-corps-electoral';
		const out = truncateOnWordBoundary(s, 40);
		assert.ok(out.length <= 40, `longueur ${out.length} > 40`);
		assert.ok(!out.endsWith('-'), 'ne doit pas finir par un tiret');
		// La coupe tombe sur une frontière de mot : le préfixe est une suite de
		// mots complets de l’original.
		assert.ok(s.startsWith(out), 'doit être un préfixe de l’original');
		assert.ok(s[out.length] === '-', 'la coupe tombe sur un tiret de l’original');
	});
	test('un seul mot plus long que max : coupe dure', () => {
		const out = truncateOnWordBoundary('anticonstitutionnellement', 10);
		assert.equal(out, 'anticonsti'); // slice(0,10), aucun tiret → coupe dure
		assert.ok(out.length <= 10);
		assert.ok(!out.endsWith('-'));
	});
});

// ────────────────────────────────────────────────────────────────────────────
// texteSlug : préfixe titre tronqué + id (unicité garantie par l’id)
// ────────────────────────────────────────────────────────────────────────────

describe('texteSlug', () => {
	test('titre court + id', () => {
		assert.equal(
			texteSlug("Proposition de loi visant à soutenir les collectivités", 'DLR5L17N51175'),
			'proposition-de-loi-visant-a-soutenir-les-collectivites-DLR5L17N51175'
		);
	});
	test('titre long tronqué sur frontière de mot, id préservé', () => {
		const titre =
			'Proposition de loi organique portant actualisation du corps électoral pour les élections au congrès et aux assemblées de province de la Nouvelle-Calédonie';
		const slug = texteSlug(titre, 'DLR5L17N99999');
		assert.ok(slug.endsWith('-DLR5L17N99999'), 'id préservé en fin');
		const prefix = slug.slice(0, -'-DLR5L17N99999'.length);
		assert.ok(prefix.length <= 60, `préfixe ${prefix.length} > 60`);
		assert.ok(!prefix.endsWith('-'), 'préfixe ne finit pas par un tiret');
	});
	test('id préservé tel quel (casse non altérée)', () => {
		const slug = texteSlug('Titre', 'DLR5L17N51175');
		assert.ok(slug.includes('DLR5L17N51175'), 'id en casse d’origine');
	});
	test('titre vide → slug = id seul (sans tiret de tête)', () => {
		assert.equal(texteSlug('', 'DLR5L17N51175'), 'DLR5L17N51175');
	});
	test('unicité même si titres identiques (35 collisions réelles)', () => {
		const a = texteSlug('Projet de loi de finances', 'PLF-2024');
		const b = texteSlug('Projet de loi de finances', 'PLF-2025');
		assert.notEqual(a, b);
	});
	test('id URL-safe court (DLR…) conservé tel quel', () => {
		const slug = texteSlug('Titre', 'DLR5L17N51175');
		assert.ok(slug.endsWith('-DLR5L17N51175'));
	});
	test('id signature long (sig-…|…|…) → suffixe haché borné, slug court', () => {
		// 231 textes réels ont un id = signature complète (jusqu’à 444 car.) :
		// `sig-2021|projet-loi|adopte par l assemblee…`. Le slug doit rester court.
		const sigId =
			'sig-2021|projet-loi|adopte par l assemblee nationale apres engagement de la procedure acceleree ratifiant l ordonnance n 2021-1234 du 1 janvier 2021 relative a quelque chose de tres long';
		const slug = texteSlug('Projet de loi ratifiant une ordonnance', sigId);
		assert.ok(slug.length <= 80, `slug ${slug.length} > 80`);
		assert.ok(!/[|\s]/.test(slug), 'aucun | ni espace dans le slug');
		// Déterministe : même id → même suffixe.
		assert.equal(slug, texteSlug('Projet de loi ratifiant une ordonnance', sigId));
		// Discriminant : deux signatures différentes → slugs différents.
		assert.notEqual(slug, texteSlug('Autre', sigId.replace('2021', '2099')));
	});
});

// ────────────────────────────────────────────────────────────────────────────
// assignSlugs : génère un slug unique par item ; ne désambiguïse QUE les
// collisions (suffixe stable). Déterministe et indépendant de l’ordre d’entrée.
// ────────────────────────────────────────────────────────────────────────────

describe('assignSlugs (élus)', () => {
	const mk = (id: string, prenom: string, nom: string) => ({ id, prenom, nom });

	test('cas sans collision : slug = prenom-nom, aucun suffixe', () => {
		const items = [mk('elu_a', 'Damien', 'Abad'), mk('elu_b', 'Stéphane', 'Peu')];
		const slugs = assignSlugs(items, {
			base: (e) => slugify(`${e.prenom} ${e.nom}`),
			disambiguator: (e) => e.id
		});
		assert.equal(slugs.get('elu_a'), 'damien-abad');
		assert.equal(slugs.get('elu_b'), 'stephane-peu');
	});

	test('collision réelle jean-louis-masson : les DEUX reçoivent le suffixe', () => {
		// Reproduit le seul cas réel : 2 personnes distinctes, même prenom-nom.
		const items = [
			mk('elu_17ccd011', 'Jean-Louis', 'Masson'),
			mk('elu_05f3f6dc', 'Jean-Louis', 'Masson')
		];
		const slugs = assignSlugs(items, {
			base: (e) => slugify(`${e.prenom} ${e.nom}`),
			disambiguator: (e) => e.id
		});
		// Aucun des deux ne garde le slug nu (sinon ambiguïté/collision).
		assert.notEqual(slugs.get('elu_17ccd011'), 'jean-louis-masson');
		assert.notEqual(slugs.get('elu_05f3f6dc'), 'jean-louis-masson');
		// Chacun préfixé par le slug de base + suffixe désambiguïsant.
		assert.ok(slugs.get('elu_17ccd011')!.startsWith('jean-louis-masson-'));
		assert.ok(slugs.get('elu_05f3f6dc')!.startsWith('jean-louis-masson-'));
		// Les deux slugs sont distincts.
		assert.notEqual(slugs.get('elu_17ccd011'), slugs.get('elu_05f3f6dc'));
	});

	test('tous les slugs produits sont uniques', () => {
		const items = [
			mk('1', 'Jean', 'Dupont'),
			mk('2', 'Jean', 'Dupont'),
			mk('3', 'Marie', 'Curie'),
			mk('4', 'Jean', 'Dupont')
		];
		const slugs = assignSlugs(items, {
			base: (e) => slugify(`${e.prenom} ${e.nom}`),
			disambiguator: (e) => e.id
		});
		const values = [...slugs.values()];
		assert.equal(new Set(values).size, values.length, 'collision de slug détectée');
	});

	test('déterministe : indépendant de l’ordre d’entrée', () => {
		const a = [mk('1', 'Jean', 'Dupont'), mk('2', 'Jean', 'Dupont')];
		const b = [mk('2', 'Jean', 'Dupont'), mk('1', 'Jean', 'Dupont')];
		const opt = { base: (e: { prenom: string; nom: string }) => slugify(`${e.prenom} ${e.nom}`), disambiguator: (e: { id: string }) => e.id };
		const sa = assignSlugs(a, opt);
		const sb = assignSlugs(b, opt);
		// Le slug d’une entité donnée ne dépend pas de la position dans la liste.
		assert.equal(sa.get('1'), sb.get('1'));
		assert.equal(sa.get('2'), sb.get('2'));
	});
});
