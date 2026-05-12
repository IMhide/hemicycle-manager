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
		seanceRef: null,
		typeVote: 'scrutin public ordinaire',
		sort: 'adopté',
		...opts
	};
}

const dossierVide: DossierAN[] = [];

function dossierFixture(id: string, titre: string, opts: Partial<DossierAN> = {}): DossierAN {
	return {
		id,
		legislature: 17,
		titre,
		titreChemin: null,
		senatUrl: null,
		procedure: { code: 'proposition-loi-ordinaire', libelle: 'Proposition de loi ordinaire' },
		initiateurs: [],
		timeline: { dateDepotAN: null, dateProcedureAccelere: null, datePromulgation: null },
		type: 'DossierLegislatif_Type',
		...opts
	};
}

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

	test('Texte enrichi avec senatUrl → propagé sur le Texte (N3.a navette)', () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-05-05', "l'ensemble de la proposition de loi pour la sécurité (première lecture).", 'DLR5L17N99999')
		];
		const dossiers: DossierAN[] = [
			dossierFixture('DLR5L17N99999', 'Sécurité publique', {
				senatUrl: 'https://www.senat.fr/dossier-legislatif/ppl25-597.html'
			})
		];
		const { textes } = aggregeTextesAN(scrutins, dossiers);
		assert.equal(textes.length, 1);
		assert.equal(textes[0].senatUrl, 'https://www.senat.fr/dossier-legislatif/ppl25-597.html');
	});

	test('Texte sans senatUrl (dossier sans navette) → senatUrl = null', () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-05-05', "l'ensemble de la proposition de loi A (première lecture).", 'DLR5L17N11111')
		];
		const dossiers: DossierAN[] = [
			dossierFixture('DLR5L17N11111', 'Texte resté à l\'AN', { senatUrl: null })
		];
		const { textes } = aggregeTextesAN(scrutins, dossiers);
		assert.equal(textes[0].senatUrl, null);
	});

	test('Texte signature (non enrichi) → senatUrl = null par défaut', () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-05-05', "l'ensemble de la proposition de loi visant à Y (première lecture).")
		];
		const { textes } = aggregeTextesAN(scrutins, dossierVide);
		assert.equal(textes[0].senatUrl, null);
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

// ────────────────────────────────────────────────────────────────────────────
// Cascade seanceRef → dossierRef → signature (méthode Poligraph)
// ────────────────────────────────────────────────────────────────────────────

describe('aggregeTextesAN — cascade seanceRef (méthode Poligraph)', () => {
	test('seanceRef match unique → id DLR, texte enrichi', () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-04-14', "l'amendement n° 5 à l'article 1 du projet de loi de finances pour 2026 (première lecture).", null, {
				seanceRef: 'RUANR5L17S2026IDS29850'
			})
		];
		const dossiers = [dossierFixture('DLR5L17N52428', 'Projet de loi de finances pour 2026', {
			procedure: { code: 'projet-loi-finances', libelle: "Projet de loi de finances de l'année" }
		})];
		const reunionMap = new Map([['RUANR5L17S2026IDS29850', new Set(['DLR5L17N52428'])]]);
		const { textes, scrutinToTexte } = aggregeTextesAN(scrutins, dossiers, reunionMap);
		assert.equal(textes.length, 1);
		assert.equal(textes[0].id, 'DLR5L17N52428');
		assert.equal(textes[0].titre, 'Projet de loi de finances pour 2026');
		assert.equal(textes[0].enrichiDossiersAN, true);
		assert.equal(scrutinToTexte.get('V1'), 'DLR5L17N52428');
	});

	test("seanceRef avec plusieurs candidats → désambiguïsation par signature titre (PLF gagne contre loi organique de report)", () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-04-14', "l'amendement n° 2390 après l'article 12 du projet de loi de finances pour 2026 (première lecture).", null, {
				seanceRef: 'RUANR5L17S2026IDS29850'
			})
		];
		const dossiers = [
			dossierFixture('DLR5L17N52428', 'Projet de loi de finances pour 2026', {
				procedure: { code: 'projet-loi-finances', libelle: "Projet de loi de finances de l'année" }
			}),
			dossierFixture('DLR5L17N52655', 'Proposition de loi organique visant à reporter le renouvellement général')
		];
		const reunionMap = new Map([
			['RUANR5L17S2026IDS29850', new Set(['DLR5L17N52428', 'DLR5L17N52655'])]
		]);
		const { textes } = aggregeTextesAN(scrutins, dossiers, reunionMap);
		assert.equal(textes.length, 1);
		assert.equal(textes[0].id, 'DLR5L17N52428'); // le PLF gagne, pas la loi organique
		assert.equal(textes[0].enrichiDossiersAN, true);
	});

	test("seanceRef multi-candidats sans correspondance titre → fallback dossierRef côté scrutin si présent", () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-04-14', "l'ensemble de la proposition de loi visant à instaurer X (première lecture).", 'DLR_FALLBACK', {
				seanceRef: 'RUANR-AMBIGU'
			})
		];
		const dossiers = [
			dossierFixture('DLR_OTHER_1', 'Texte complètement différent A'),
			dossierFixture('DLR_OTHER_2', 'Texte complètement différent B')
		];
		const reunionMap = new Map([['RUANR-AMBIGU', new Set(['DLR_OTHER_1', 'DLR_OTHER_2'])]]);
		const { textes } = aggregeTextesAN(scrutins, dossiers, reunionMap);
		assert.equal(textes.length, 1);
		assert.equal(textes[0].id, 'DLR_FALLBACK'); // fallback sur le dossierRef du scrutin
	});

	test("Pas de seanceRef, pas de dossierRef → fallback signature pure", () => {
		const scrutins: ScrutinPourAgreg[] = [
			scrutin('V1', '2026-04-14', "l'ensemble de la proposition de loi visant à Y (première lecture).", null, {
				seanceRef: null
			})
		];
		const { textes } = aggregeTextesAN(scrutins, [], new Map());
		assert.equal(textes.length, 1);
		assert.match(textes[0].id, /^sig-/);
		assert.equal(textes[0].enrichiDossiersAN, false);
	});

	test('seanceRef vide map (PLF tout entier 906 scrutins) → tous rattachés au même DLR', () => {
		const scrutins: ScrutinPourAgreg[] = Array.from({ length: 50 }, (_, i) =>
			scrutin(
				`V${i}`,
				`2025-10-${(i % 28) + 1}`.padEnd(10, '0'),
				`l'amendement n° ${i} à l'article ${(i % 10) + 1} du projet de loi de finances pour 2026 (première lecture).`,
				null,
				{ seanceRef: `RUANR-PLF-${i % 5}` } // 5 séances différentes
			)
		);
		const dossiers = [dossierFixture('DLR5L17N52428', 'Projet de loi de finances pour 2026', {
			procedure: { code: 'projet-loi-finances', libelle: "Projet de loi de finances de l'année" }
		})];
		const reunionMap = new Map(
			Array.from({ length: 5 }, (_, i) => [`RUANR-PLF-${i}`, new Set(['DLR5L17N52428'])])
		);
		const { textes, scrutinToTexte } = aggregeTextesAN(scrutins, dossiers, reunionMap);
		assert.equal(textes.length, 1);
		assert.equal(textes[0].id, 'DLR5L17N52428');
		assert.equal(textes[0].nbScrutins, 50);
		for (let i = 0; i < 50; i++) {
			assert.equal(scrutinToTexte.get(`V${i}`), 'DLR5L17N52428');
		}
	});
});
