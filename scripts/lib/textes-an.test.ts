/**
 * Tests TDD pour l'agrégation `Texte` côté AN.
 *
 * Le module croise trois sources :
 *  1. Scrutins (ScrutinDetail) avec leur dossierRef Etalab (~11% des scrutins)
 *  2. Parser de titres (texte-parser.ts) pour récupérer une signature stable
 *  3. Dump dossiers (dossiers-an.ts) pour enrichir avec titre officiel, etc.
 *
 * Le résultat : une liste de `Texte` plus un index `scrutinUid → texteId`
 * permettant d'injecter le `texteId` dans chaque ScrutinIndex.
 *
 * Invariants testés :
 *  - Tous les scrutins d'un même dossierRef sont rattachés au même Texte
 *  - Tous les scrutins d'une même signature titre sont rattachés au même Texte
 *  - Quand dossierRef et signature coexistent, c'est le dossierRef qui gagne
 *  - Les scrutins sans match (motions de censure) ont texteId = null
 *  - Les Textes sont ordonnés par dateDebut ascendant
 *  - Pour chaque Texte, la liste de scrutins est ordonnée chronologiquement
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import { aggregeTextesAN, type ScrutinPourAgreg } from './textes-an.ts';
import type { DossierAN } from './dossiers-an.ts';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function scrutin(
	uid: string,
	date: string,
	titre: string,
	dossierRef: string | null = null,
	opts: Partial<ScrutinPourAgreg> = {}
): ScrutinPourAgreg {
	return {
		uid,
		date,
		legislature: 17,
		titre,
		dossierRef,
		typeVote: 'scrutin public ordinaire',
		sort: 'adopté',
		...opts
	};
}

const dossierVide: DossierAN[] = [];

// ────────────────────────────────────────────────────────────────────────────
// Cas de base : agrégation simple par signature titre
// ────────────────────────────────────────────────────────────────────────────

describe('aggregeTextesAN — signature seule (pas de dossierRef)', () => {
	test('Deux scrutins même proposition de loi → 1 texte', () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-04-14', "l'amendement n° 5 à l'article premier de la proposition de loi visant à renforcer la sécurité (première lecture)."),
			scrutin('V2', '2026-05-05', "l'ensemble de la proposition de loi visant à renforcer la sécurité (première lecture).")
		];
		const { textes, scrutinToTexte } = aggregeTextesAN(scrutins, dossierVide);
		assert.equal(textes.length, 1);
		assert.equal(textes[0].nbScrutins, 2);
		assert.equal(textes[0].scrutins.length, 2);
		assert.equal(scrutinToTexte.get('V1'), textes[0].id);
		assert.equal(scrutinToTexte.get('V2'), textes[0].id);
	});

	test('Trois scrutins différents → 3 textes', () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-01-01', "l'ensemble de la proposition de loi A (première lecture)."),
			scrutin('V2', '2026-01-02', "l'ensemble de la proposition de loi B (première lecture)."),
			scrutin('V3', '2026-01-03', "l'ensemble de la proposition de loi C (première lecture).")
		];
		const { textes } = aggregeTextesAN(scrutins, dossierVide);
		assert.equal(textes.length, 3);
	});

	test('Motion de censure → scrutin ignoré, pas de texte créé', () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-01-01', "la motion de censure déposée par Mme Panot et 60 députés."),
			scrutin('V2', '2026-01-02', "l'ensemble de la proposition de loi X (première lecture).")
		];
		const { textes, scrutinToTexte } = aggregeTextesAN(scrutins, dossierVide);
		assert.equal(textes.length, 1);
		assert.equal(scrutinToTexte.get('V1'), null); // explicitement null
		assert.ok(scrutinToTexte.get('V2'));
	});
});

// ────────────────────────────────────────────────────────────────────────────
// Cas dossierRef : groupe basé sur l'identifiant Etalab officiel
// ────────────────────────────────────────────────────────────────────────────

describe('aggregeTextesAN — dossierRef prioritaire sur signature', () => {
	test('Deux scrutins même dossierRef → 1 texte avec id = dossierRef', () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-04-14', "l'amendement n° 5 à l'article premier de la proposition de loi visant à X (première lecture).", 'DLR5L17N12345'),
			scrutin('V2', '2026-05-05', "l'ensemble de la proposition de loi visant à X (première lecture).", 'DLR5L17N12345')
		];
		const { textes } = aggregeTextesAN(scrutins, dossierVide);
		assert.equal(textes.length, 1);
		assert.equal(textes[0].id, 'DLR5L17N12345');
	});

	test('Scrutins avec et sans dossierRef mais même signature → 1 seul texte avec id = dossierRef', () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-04-14', "l'amendement n° 5 à l'article 1 de la proposition de loi visant à X (première lecture).", null),
			scrutin('V2', '2026-05-05', "l'ensemble de la proposition de loi visant à X (première lecture).", 'DLR5L17N12345')
		];
		const { textes, scrutinToTexte } = aggregeTextesAN(scrutins, dossierVide);
		assert.equal(textes.length, 1);
		assert.equal(textes[0].id, 'DLR5L17N12345');
		assert.equal(scrutinToTexte.get('V1'), 'DLR5L17N12345');
		assert.equal(scrutinToTexte.get('V2'), 'DLR5L17N12345');
	});

	test("Deux dossierRef différents mais même signature → 2 textes (collision, on ne fusionne pas en silence)", () => {
		// Cas pathologique : ne devrait pas arriver d'après nos mesures sur la 17ᵉ,
		// mais on documente le comportement attendu (le dossierRef gagne, et les
		// scrutins se répartissent dans deux textes).
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-04-14', "l'ensemble de la proposition de loi visant à X (première lecture).", 'DLR5L17N1'),
			scrutin('V2', '2026-04-15', "l'ensemble de la proposition de loi visant à X (deuxième lecture).", 'DLR5L17N2')
		];
		const { textes } = aggregeTextesAN(scrutins, dossierVide);
		assert.equal(textes.length, 2);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// Enrichissement par le dump dossiers
// ────────────────────────────────────────────────────────────────────────────

describe('aggregeTextesAN — enrichissement via dump dossiers', () => {
	test('Texte avec dossierRef matché → titre officiel + procedure + initiateurs récupérés', () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-05-05', "l'ensemble de la proposition de loi visant à renforcer la sécurité (première lecture).", 'DLR5L17N53284')
		];
		const dossiers: DossierAN[] = [
			{
				id: 'DLR5L17N53284',
				legislature: 17,
				titre: 'Renforcer la sécurité, la rétention administrative et la prévention des risques d’attentat',
				titreChemin: 'retention_admin',
				senatUrl: null,
				procedure: { code: 'proposition-loi-ordinaire', libelle: 'Proposition de loi ordinaire' },
				initiateurs: ['PA795528'],
				timeline: { dateDepotAN: '2025-12-02', dateProcedureAccelere: '2026-03-23', datePromulgation: null },
				type: 'DossierLegislatif_Type'
			}
		];
		const { textes } = aggregeTextesAN(scrutins, dossiers);
		assert.equal(textes.length, 1);
		assert.equal(
			textes[0].titre,
			'Renforcer la sécurité, la rétention administrative et la prévention des risques d’attentat'
		);
		assert.equal(textes[0].procedureLibelle, 'Proposition de loi ordinaire');
		assert.deepEqual(textes[0].initiateurs, ['PA795528']);
		assert.equal(textes[0].enrichiDossiersAN, true);
	});

	test('Texte sans dossierRef matché → titre dérivé du titre du scrutin, pas enrichi', () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-05-05', "l'ensemble de la proposition de loi visant à X (première lecture).")
		];
		const { textes } = aggregeTextesAN(scrutins, dossierVide);
		assert.equal(textes.length, 1);
		assert.match(textes[0].titre, /visant à X/i);
		assert.equal(textes[0].procedureLibelle, null);
		assert.deepEqual(textes[0].initiateurs, []);
		assert.equal(textes[0].enrichiDossiersAN, false);
		// id préfixé par sig- pour distinguer des dossierRef
		assert.match(textes[0].id, /^sig-/);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// Tri et chronologie
// ────────────────────────────────────────────────────────────────────────────

describe('aggregeTextesAN — ordre chronologique', () => {
	test('Scrutins d\'un texte : ordre ascendant par date dans textes[].scrutins', () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V_late', '2026-05-05', "l'ensemble de la proposition de loi visant à X (première lecture)."),
			scrutin('V_early', '2026-04-14', "l'amendement n° 5 à la proposition de loi visant à X (première lecture)."),
			scrutin('V_mid', '2026-04-20', "l'article 3 de la proposition de loi visant à X (première lecture).")
		];
		const { textes } = aggregeTextesAN(scrutins, dossierVide);
		assert.equal(textes.length, 1);
		assert.deepEqual(textes[0].scrutins, ['V_early', 'V_mid', 'V_late']);
		assert.equal(textes[0].dateDebut, '2026-04-14');
		assert.equal(textes[0].dateFin, '2026-05-05');
	});

	test('Liste des textes triée par dateDebut ascendant', () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-05-01', "l'ensemble de la proposition de loi B (première lecture)."),
			scrutin('V2', '2026-01-01', "l'ensemble de la proposition de loi A (première lecture)."),
			scrutin('V3', '2026-03-01', "l'ensemble de la proposition de loi C (première lecture).")
		];
		const { textes } = aggregeTextesAN(scrutins, dossierVide);
		assert.equal(textes.length, 3);
		const dates = textes.map((t) => t.dateDebut);
		assert.deepEqual(dates, ['2026-01-01', '2026-03-01', '2026-05-01']);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// Comptage votes solennels et sort final
// ────────────────────────────────────────────────────────────────────────────

describe('aggregeTextesAN — votes solennels et sort final', () => {
	test('Comptage des votes solennels', () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-04-14', "l'amendement n° 5 à la proposition de loi X (première lecture).", null, { typeVote: 'scrutin public ordinaire' }),
			scrutin('V2', '2026-05-05', "l'ensemble de la proposition de loi X (première lecture).", null, { typeVote: 'scrutin public solennel' })
		];
		const { textes } = aggregeTextesAN(scrutins, dossierVide);
		assert.equal(textes[0].nbScrutins, 2);
		assert.equal(textes[0].nbVotesSolennels, 1);
	});

	test('Sort final = sort du dernier scrutin', () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-04-14', "l'amendement n° 5 à la proposition de loi X (première lecture).", null, { sort: 'rejeté' }),
			scrutin('V2', '2026-05-05', "l'ensemble de la proposition de loi X (première lecture).", null, { sort: 'adopté' })
		];
		const { textes } = aggregeTextesAN(scrutins, dossierVide);
		assert.equal(textes[0].sortFinal, 'adopté');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// Multi-législature
// ────────────────────────────────────────────────────────────────────────────

describe('aggregeTextesAN — multi-législature', () => {
	test('Texte de la 16ᵉ et texte de la 17ᵉ même titre → 2 textes distincts', () => {
		// Important : la signature inclut la législature pour éviter de fusionner
		// un texte 16ᵉ avec un texte 17ᵉ portant un nom similaire.
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V_16', '2023-05-01', "l'ensemble de la proposition de loi visant à X (première lecture).", null, { legislature: 16 }),
			scrutin('V_17', '2025-05-01', "l'ensemble de la proposition de loi visant à X (première lecture).", null, { legislature: 17 })
		];
		const { textes } = aggregeTextesAN(scrutins, dossierVide);
		assert.equal(textes.length, 2);
		const legs = textes.map((t) => t.legislature).sort();
		assert.deepEqual(legs, [16, 17]);
	});
});
