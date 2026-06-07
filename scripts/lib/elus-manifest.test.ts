/**
 * Tests TDD pour le builder du manifest bicaméral `elus.json` (cf ADR 0031).
 *
 * Les fonctions pures testées ici sont les briques du pipeline cross-chambre :
 *  - `normaliseKey` : génère la clé déterministe (prénom + nom + dateNaissance)
 *  - `eluId` : hash sha256-8 de la clé → identifiant `elu_<8 hex>`
 *  - `buildElusManifest` : croise `Personne[]` AN + `Senateur[]` Sénat avec
 *    overrides → `EluManifest` (matching strict + warnings + badges + carrière)
 *
 * Toute déviation de ces fonctions impacte la stabilité des URL `/elus/[eluId]`.
 * Tests à passer AVANT toute optimisation de matching.
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import {
	normaliseKey,
	eluId,
	buildElusManifest,
	type Personne,
	type Senateur,
	type EluOverrides
} from './elus-manifest.ts';

// ────────────────────────────────────────────────────────────────────────────
// Helpers de fabrique pour les tests (Personne et Senateur minimaux valides)
// ────────────────────────────────────────────────────────────────────────────

function makePersonne(opts: {
	id: string;
	prenom: string;
	nom: string;
	dateNaissance: string | null;
	mandats?: Array<{
		legislature: number;
		debut: string;
		fin: string | null;
		overall?: number;
		stats?: Partial<Personne['mandats'][0]['stats']>;
	}>;
	carriereOverall?: number;
}): Personne {
	const mandats = (opts.mandats ?? [{ legislature: 17, debut: '2024-07-08', fin: null }]).map(
		(m) => ({
			legislature: m.legislature,
			datePriseFonction: m.debut,
			dateFinFonction: m.fin,
			stats: {
				overall: m.overall ?? 50,
				presence: { numerator: 0, denominator: 1, rate: 0.5 },
				participation: { numerator: 0, denominator: 1, rate: 0.5 },
				loyaute: { numerator: 0, denominator: 1, rate: 0.5 },
				frondes: { count: 0, rate: 0 },
				volume: 0.5,
				...(m.stats ?? {})
			},
			appartenancesGroupe: []
		})
	);
	return {
		id: opts.id,
		identite: {
			prenom: opts.prenom,
			nom: opts.nom,
			dateNaissance: opts.dateNaissance,
			civ: 'M.',
			sexe: 'M',
			villeNaissance: null,
			photoUrl: '',
			professionDeclaree: null
		},
		mandats,
		carriere: {
			overall: opts.carriereOverall ?? 50,
			presence: { numerator: 0, denominator: 1, rate: 0.5 },
			participation: { numerator: 0, denominator: 1, rate: 0.5 },
			loyaute: { numerator: 0, denominator: 1, rate: 0.5 },
			frondes: { count: 0, rate: 0 },
			volume: 0.5,
			nbMandats: mandats.length,
			legislatures: mandats.map((m) => m.legislature),
			badgesCarriere: []
		}
	};
}

function makeSenateur(opts: {
	id: string;
	prenom: string;
	nom: string;
	dateNaissance: string | null;
	mandats?: Array<{
		triennat: string;
		debut: string;
		fin: string | null;
		overall?: number;
	}>;
	carriereOverall?: number;
	carriereTriennats?: string[];
}): Senateur {
	const mandats = (
		opts.mandats ?? [{ triennat: '2023-2026', debut: '2023-09-24', fin: null }]
	).map((m) => ({
		datePriseFonction: m.debut,
		dateFinFonction: m.fin,
		appartenancesGroupe: [],
		triennats: [
			{
				triennat: m.triennat,
				stats: {
					overall: m.overall ?? 50,
					presence: { numerator: 0, denominator: 1, rate: 0.5 },
					participation: { numerator: 0, denominator: 1, rate: 0.5 },
					loyaute: { numerator: 0, denominator: 1, rate: 0.5 },
					frondes: { count: 0, rate: 0 },
					volume: 0.5
				}
			}
		]
	}));
	return {
		id: opts.id,
		identite: {
			prenom: opts.prenom,
			nom: opts.nom,
			dateNaissance: opts.dateNaissance,
			civ: 'M.',
			sexe: 'M',
			dateDeces: null,
			villeNaissance: null,
			photoUrl: '',
			professionDeclaree: null,
			categorieProfessionnelle: null,
			etat: 'ACTIF'
		},
		mandats,
		carriere: {
			overall: opts.carriereOverall ?? 50,
			presence: { numerator: 0, denominator: 1, rate: 0.5 },
			participation: { numerator: 0, denominator: 1, rate: 0.5 },
			loyaute: { numerator: 0, denominator: 1, rate: 0.5 },
			frondes: { count: 0, rate: 0 },
			volume: 0.5,
			nbMandats: mandats.length,
			sessions: [],
			triennats: opts.carriereTriennats ?? mandats.map((m) => m.triennat),
			badgesCarriere: []
		}
	};
}

const EMPTY_OVERRIDES: EluOverrides = { forceFusion: [], forceSeparation: [] };

// ────────────────────────────────────────────────────────────────────────────
// normaliseKey
// ────────────────────────────────────────────────────────────────────────────

describe('normaliseKey', () => {
	test('cas simple lowercase + dateNaissance', () => {
		assert.equal(normaliseKey('Gérard', 'Larcher', '1949-09-14'), 'gerard|larcher|1949-09-14');
	});

	test('accents dépouillés (NFD + diacritiques)', () => {
		assert.equal(normaliseKey('Hélène', 'Cœur', '1970-01-01'), 'helene|coeur|1970-01-01');
	});

	test('casse mixte normalisée en lowercase', () => {
		assert.equal(normaliseKey('JEAN', 'DURAND', '1960-01-01'), 'jean|durand|1960-01-01');
	});

	test('trim + collapse whitespace + particule `du` → `_`', () => {
		// "Du Pont" → "du pont" (lowercase) → particule `du` remplacée par `_`,
		// espace entre tokens conservé → "_ pont".
		assert.equal(
			normaliseKey('  Marie ', '  Du Pont  ', '1970-01-01'),
			'marie|_ pont|1970-01-01'
		);
	});

	test('apostrophes et tirets remplacés par espaces, particules `de/du/des/le/la` deviennent `_`', () => {
		// "de la Mare" → "_ _ mare" → "_ _ mare" (les particules deviennent des `_`, espaces conservés)
		assert.equal(
			normaliseKey('Anne', "de la Mare", '1980-05-15'),
			'anne|_ _ mare|1980-05-15'
		);
	});

	test('apostrophe française dans le nom', () => {
		// Une apostrophe est traitée comme espace.
		assert.equal(
			normaliseKey('Pierre', "D'Artois", '1955-03-10'),
			'pierre|d artois|1955-03-10'
		);
	});

	test('tiret dans nom composé', () => {
		assert.equal(
			normaliseKey('Anne', 'Pic-Marquet', '1955-03-10'),
			'anne|pic marquet|1955-03-10'
		);
	});

	test('dateNaissance manquante → suffixe NA', () => {
		assert.equal(normaliseKey('Jean', 'Durand', null), 'jean|durand|NA');
	});

	test('caractères spéciaux unicode (œ, ç) gérés', () => {
		assert.equal(normaliseKey('François', 'Lebœuf', '1950-01-01'), 'francois|leboeuf|1950-01-01');
	});

	test('idempotence : normaliseKey est déterministe', () => {
		const k1 = normaliseKey('Gérard', 'Larcher', '1949-09-14');
		const k2 = normaliseKey('Gérard', 'Larcher', '1949-09-14');
		assert.equal(k1, k2);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// eluId
// ────────────────────────────────────────────────────────────────────────────

describe('eluId', () => {
	test('format `elu_<8 hex>`', () => {
		const id = eluId('gerard|larcher|1949-09-14');
		assert.match(id, /^elu_[0-9a-f]{8}$/);
	});

	test('déterministe : même clé → même id', () => {
		const a = eluId('gerard|larcher|1949-09-14');
		const b = eluId('gerard|larcher|1949-09-14');
		assert.equal(a, b);
	});

	test('clés différentes → ids différents (collision improbable sur 32 bits du sha256)', () => {
		const a = eluId('gerard|larcher|1949-09-14');
		const b = eluId('serge|larcher|1945-10-17');
		assert.notEqual(a, b);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// buildElusManifest — match strict
// ────────────────────────────────────────────────────────────────────────────

describe('buildElusManifest — match strict', () => {
	test('1 personne AN seule → 1 Elu mono-chambre', () => {
		const personnes = [
			makePersonne({
				id: 'PA111',
				prenom: 'Pierre',
				nom: 'Mono',
				dateNaissance: '1970-01-01'
			})
		];
		const out = buildElusManifest(personnes, [], EMPTY_OVERRIDES);
		assert.equal(out.elus.length, 1);
		assert.equal(out.elus[0].paId, 'PA111');
		assert.equal(out.elus[0].matricule, null);
		assert.equal(out.elus[0].mandats.length, 1);
		assert.equal(out.elus[0].mandats[0].chambre, 'AN');
		assert.equal(out.count, 1);
		assert.equal(out.countBicameral, 0);
	});

	test('1 sénateur seul → 1 Elu mono-chambre Sénat', () => {
		const senateurs = [
			makeSenateur({
				id: '00001A',
				prenom: 'Sophie',
				nom: 'SoloSenat',
				dateNaissance: '1965-04-04'
			})
		];
		const out = buildElusManifest([], senateurs, EMPTY_OVERRIDES);
		assert.equal(out.elus.length, 1);
		assert.equal(out.elus[0].paId, null);
		assert.equal(out.elus[0].matricule, '00001A');
		assert.equal(out.elus[0].mandats[0].chambre, 'SENAT');
	});

	test('match strict : PA + matricule avec mêmes prénom/nom/dateNaissance → 1 Elu bicaméral', () => {
		const personnes = [
			makePersonne({
				id: 'PA222',
				prenom: 'Claire',
				nom: 'Bicam',
				dateNaissance: '1960-06-06'
			})
		];
		const senateurs = [
			makeSenateur({
				id: '00002A',
				prenom: 'Claire',
				nom: 'Bicam',
				dateNaissance: '1960-06-06'
			})
		];
		const out = buildElusManifest(personnes, senateurs, EMPTY_OVERRIDES);
		assert.equal(out.elus.length, 1);
		assert.equal(out.elus[0].paId, 'PA222');
		assert.equal(out.elus[0].matricule, '00002A');
		assert.equal(out.elus[0].mandats.length, 2);
		assert.equal(out.countBicameral, 1);
		assert.deepEqual(out.elus[0].badgesCarriere.sort(), ['Bicameral'].sort());
	});

	test('match strict avec accents/cas différents : "Gérard" AN ↔ "GERARD" Sénat → 1 Elu', () => {
		const personnes = [
			makePersonne({
				id: 'PA333',
				prenom: 'Gérard',
				nom: 'Larcher',
				dateNaissance: '1949-09-14'
			})
		];
		const senateurs = [
			makeSenateur({
				id: '86034E',
				prenom: 'GERARD',
				nom: 'LARCHER',
				dateNaissance: '1949-09-14'
			})
		];
		const out = buildElusManifest(personnes, senateurs, EMPTY_OVERRIDES);
		assert.equal(out.elus.length, 1);
		assert.equal(out.elus[0].paId, 'PA333');
		assert.equal(out.elus[0].matricule, '86034E');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// buildElusManifest — slugs lisibles (cf ADR 0042)
// ────────────────────────────────────────────────────────────────────────────

describe('buildElusManifest — slugs (ADR 0042)', () => {
	test('slug = prenom-nom sans collision', () => {
		const out = buildElusManifest(
			[makePersonne({ id: 'PA1', prenom: 'Stéphane', nom: 'Peu', dateNaissance: '1962-07-24' })],
			[],
			EMPTY_OVERRIDES
		);
		assert.equal(out.elus[0].slug, 'stephane-peu');
	});

	test('collision prenom-nom → les deux désambiguïsés par suffixe stable, slugs uniques', () => {
		// Reproduit le cas réel jean-louis-masson : 2 personnes distinctes
		// (dates de naissance différentes → pas de fusion).
		const out = buildElusManifest(
			[
				makePersonne({ id: 'PA10', prenom: 'Jean-Louis', nom: 'Masson', dateNaissance: '1954-02-05' }),
				makePersonne({ id: 'PA11', prenom: 'Jean-Louis', nom: 'Masson', dateNaissance: '1947-03-25' })
			],
			[],
			EMPTY_OVERRIDES
		);
		assert.equal(out.elus.length, 2);
		const bySlug = out.elus.map((e) => e.slug);
		// Aucun ne garde le slug nu, tous préfixés, et distincts.
		assert.ok(bySlug.every((s) => s.startsWith('jean-louis-masson-')));
		assert.equal(new Set(bySlug).size, 2);
	});

	test('tous les slugs du manifest sont uniques et non vides', () => {
		const out = buildElusManifest(
			[
				makePersonne({ id: 'PA1', prenom: 'Jean', nom: 'Dupont', dateNaissance: '1970-01-01' }),
				makePersonne({ id: 'PA2', prenom: 'Marie', nom: 'Curie', dateNaissance: '1980-02-02' })
			],
			[
				makeSenateur({ id: '00001A', prenom: 'Paul', nom: 'Durand', dateNaissance: '1960-03-03' })
			],
			EMPTY_OVERRIDES
		);
		const slugs = out.elus.map((e) => e.slug);
		assert.ok(slugs.every((s) => s.length > 0), 'aucun slug vide');
		assert.equal(new Set(slugs).size, slugs.length, 'collision de slug');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// buildElusManifest — matching ambigu
// ────────────────────────────────────────────────────────────────────────────

describe('buildElusManifest — matching ambigu', () => {
	test('dateNaissance manquante d\'un côté → 2 Elu distincts (pas de fusion par défaut)', () => {
		const personnes = [
			makePersonne({
				id: 'PA444',
				prenom: 'Inconnu',
				nom: 'Date',
				dateNaissance: null
			})
		];
		const senateurs = [
			makeSenateur({
				id: '00004A',
				prenom: 'Inconnu',
				nom: 'Date',
				dateNaissance: '1970-01-01'
			})
		];
		const out = buildElusManifest(personnes, senateurs, EMPTY_OVERRIDES);
		assert.equal(out.elus.length, 2);
		assert.equal(out.countBicameral, 0);
		// Au moins un warning loggué dans `out.warnings`
		assert.ok(
			out.warnings.some((w) => w.includes('PA444') || w.includes('00004A')),
			'attend un warning sur le matching ambigu'
		);
	});

	test('homonymes parfaits (même prénom/nom/dateNaissance) AN seul → 1ère gardée + warning', () => {
		const personnes = [
			makePersonne({
				id: 'PA501',
				prenom: 'Jean',
				nom: 'Durand',
				dateNaissance: '1960-01-01'
			}),
			makePersonne({
				id: 'PA502',
				prenom: 'Jean',
				nom: 'Durand',
				dateNaissance: '1960-01-01'
			})
		];
		const out = buildElusManifest(personnes, [], EMPTY_OVERRIDES);
		assert.equal(out.elus.length, 1);
		assert.ok(out.warnings.some((w) => w.includes('PA502') || w.includes('homonyme')));
	});
});

// ────────────────────────────────────────────────────────────────────────────
// buildElusManifest — overrides
// ────────────────────────────────────────────────────────────────────────────

describe('buildElusManifest — overrides', () => {
	test('forceFusion : fusionne deux personnes même si keys diffèrent', () => {
		const personnes = [
			makePersonne({
				id: 'PA600',
				prenom: 'Marlène',
				nom: 'Schiappa',
				dateNaissance: '1982-11-18'
			})
		];
		const senateurs = [
			makeSenateur({
				id: '00600A',
				prenom: 'Marlène',
				nom: 'Schiappa-Bruguière', // nom marital, ne match pas naturellement
				dateNaissance: '1982-11-18'
			})
		];
		const out = buildElusManifest(personnes, senateurs, {
			forceFusion: [{ paId: 'PA600', matricule: '00600A', comment: 'nom marital' }],
			forceSeparation: []
		});
		assert.equal(out.elus.length, 1);
		assert.equal(out.elus[0].paId, 'PA600');
		assert.equal(out.elus[0].matricule, '00600A');
	});

	test('forceSeparation : empêche la fusion auto même si keys identiques', () => {
		const personnes = [
			makePersonne({
				id: 'PA700',
				prenom: 'Homonyme',
				nom: 'Cas',
				dateNaissance: '1970-07-07'
			})
		];
		const senateurs = [
			makeSenateur({
				id: '00700A',
				prenom: 'Homonyme',
				nom: 'Cas',
				dateNaissance: '1970-07-07'
			})
		];
		const out = buildElusManifest(personnes, senateurs, {
			forceFusion: [],
			forceSeparation: [
				{ paId: 'PA700', matricule: '00700A', comment: 'cas réel : 2 personnes différentes' }
			]
		});
		assert.equal(out.elus.length, 2);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// buildElusManifest — sémantique carrière (ADR 0032)
// ────────────────────────────────────────────────────────────────────────────

describe('buildElusManifest — carrière cross-chambre (moyenne simple)', () => {
	test('overallCarriere = moyenne arithmétique non pondérée des overalls de chaque mandat', () => {
		const personnes = [
			makePersonne({
				id: 'PA800',
				prenom: 'Multi',
				nom: 'AN',
				dateNaissance: '1960-01-01',
				mandats: [
					{ legislature: 16, debut: '2022-06-22', fin: '2024-06-09', overall: 60 },
					{ legislature: 17, debut: '2024-07-08', fin: null, overall: 80 }
				]
			})
		];
		const out = buildElusManifest(personnes, [], EMPTY_OVERRIDES);
		assert.equal(out.elus.length, 1);
		// Moyenne simple : (60 + 80) / 2 = 70
		assert.equal(out.elus[0].overallCarriere, 70);
	});

	test('élu mono-mandat : overallCarriere == overall du mandat unique', () => {
		const personnes = [
			makePersonne({
				id: 'PA801',
				prenom: 'Mono',
				nom: 'Mandat',
				dateNaissance: '1970-01-01',
				mandats: [{ legislature: 17, debut: '2024-07-08', fin: null, overall: 42 }]
			})
		];
		const out = buildElusManifest(personnes, [], EMPTY_OVERRIDES);
		assert.equal(out.elus[0].overallCarriere, 42);
	});

	test('élu Sénat 3 triennats : moyenne des 3 overalls', () => {
		const senateurs = [
			makeSenateur({
				id: '00802A',
				prenom: 'Tri',
				nom: 'Trien',
				dateNaissance: '1950-01-01',
				mandats: [
					{ triennat: '2017-2020', debut: '2017-09-24', fin: '2020-09-26', overall: 30 },
					{ triennat: '2020-2023', debut: '2020-09-27', fin: '2023-09-23', overall: 60 },
					{ triennat: '2023-2026', debut: '2023-09-24', fin: null, overall: 90 }
				]
			})
		];
		const out = buildElusManifest([], senateurs, EMPTY_OVERRIDES);
		// (30 + 60 + 90) / 3 = 60
		assert.equal(out.elus[0].overallCarriere, 60);
	});

	test('radarCarriere : moyenne arithmétique des 5 axes', () => {
		const personnes = [
			makePersonne({
				id: 'PA803',
				prenom: 'Radar',
				nom: 'Test',
				dateNaissance: '1960-01-01',
				mandats: [
					{
						legislature: 16,
						debut: '2022-06-22',
						fin: '2024-06-09',
						overall: 50,
						stats: {
							presence: { numerator: 0, denominator: 1, rate: 0.4 },
							participation: { numerator: 0, denominator: 1, rate: 0.6 },
							loyaute: { numerator: 0, denominator: 1, rate: 0.8 },
							volume: 0.3,
							frondes: { count: 0, rate: 0.1 }
						}
					},
					{
						legislature: 17,
						debut: '2024-07-08',
						fin: null,
						overall: 50,
						stats: {
							presence: { numerator: 0, denominator: 1, rate: 0.6 },
							participation: { numerator: 0, denominator: 1, rate: 0.8 },
							loyaute: { numerator: 0, denominator: 1, rate: 1.0 },
							volume: 0.7,
							frondes: { count: 0, rate: 0.3 }
						}
					}
				]
			})
		];
		const out = buildElusManifest(personnes, [], EMPTY_OVERRIDES);
		const r = out.elus[0].radarCarriere;
		assert.equal(r.presence, 0.5);
		assert.equal(r.participation, 0.7);
		assert.equal(r.loyaute, 0.9);
		assert.equal(r.volume, 0.5);
		assert.equal(r.frondes, 0.2);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// buildElusManifest — badges carrière (ADR 0032)
// ────────────────────────────────────────────────────────────────────────────

describe('buildElusManifest — badges carrière', () => {
	test('badge `Bicameral` (tier legend) : ≥1 mandat AN ET ≥1 mandat Sénat', () => {
		const personnes = [
			makePersonne({
				id: 'PA900',
				prenom: 'Bica',
				nom: 'Meral',
				dateNaissance: '1960-01-01'
			})
		];
		const senateurs = [
			makeSenateur({
				id: '00900A',
				prenom: 'Bica',
				nom: 'Meral',
				dateNaissance: '1960-01-01'
			})
		];
		const out = buildElusManifest(personnes, senateurs, EMPTY_OVERRIDES);
		assert.ok(out.elus[0].badgesCarriere.includes('Bicameral'));
	});

	test('élu mono-chambre : pas de badge `Bicameral`', () => {
		const personnes = [
			makePersonne({
				id: 'PA901',
				prenom: 'Mono',
				nom: 'AN',
				dateNaissance: '1960-01-01'
			})
		];
		const out = buildElusManifest(personnes, [], EMPTY_OVERRIDES);
		assert.ok(!out.elus[0].badgesCarriere.includes('Bicameral'));
	});

	test('badge `Veteran` : ≥3 mandats toutes chambres confondues', () => {
		const personnes = [
			makePersonne({
				id: 'PA902',
				prenom: 'Vété',
				nom: 'Ran',
				dateNaissance: '1950-01-01',
				mandats: [
					{ legislature: 15, debut: '2017-06-21', fin: '2022-06-21', overall: 50 },
					{ legislature: 16, debut: '2022-06-22', fin: '2024-06-09', overall: 50 },
					{ legislature: 17, debut: '2024-07-08', fin: null, overall: 50 }
				]
			})
		];
		const out = buildElusManifest(personnes, [], EMPTY_OVERRIDES);
		assert.ok(out.elus[0].badgesCarriere.includes('Veteran'));
	});

	test('badge `Veteran` cross-chambre : 2 AN + 1 Sénat = 3 mandats → veteran', () => {
		const personnes = [
			makePersonne({
				id: 'PA903',
				prenom: 'CrossVet',
				nom: 'Bica',
				dateNaissance: '1955-01-01',
				mandats: [
					{ legislature: 15, debut: '2017-06-21', fin: '2022-06-21', overall: 50 },
					{ legislature: 16, debut: '2022-06-22', fin: '2024-06-09', overall: 50 }
				]
			})
		];
		const senateurs = [
			makeSenateur({
				id: '00903A',
				prenom: 'CrossVet',
				nom: 'Bica',
				dateNaissance: '1955-01-01'
			})
		];
		const out = buildElusManifest(personnes, senateurs, EMPTY_OVERRIDES);
		assert.ok(out.elus[0].badgesCarriere.includes('Veteran'));
		assert.ok(out.elus[0].badgesCarriere.includes('Bicameral'));
	});

	test('badge `Reelu` : 2 mandats consécutifs MÊME chambre', () => {
		const personnes = [
			makePersonne({
				id: 'PA904',
				prenom: 'Reelu',
				nom: 'AN',
				dateNaissance: '1960-01-01',
				mandats: [
					{ legislature: 16, debut: '2022-06-22', fin: '2024-06-09', overall: 50 },
					{ legislature: 17, debut: '2024-07-08', fin: null, overall: 50 }
				]
			})
		];
		const out = buildElusManifest(personnes, [], EMPTY_OVERRIDES);
		assert.ok(out.elus[0].badgesCarriere.includes('Reelu'));
	});

	test('1 mandat AN puis 1 mandat Sénat (consécutifs) ≠ Reelu (chambres différentes)', () => {
		const personnes = [
			makePersonne({
				id: 'PA905',
				prenom: 'NotRe',
				nom: 'Elu',
				dateNaissance: '1960-01-01',
				mandats: [{ legislature: 16, debut: '2022-06-22', fin: '2024-06-09', overall: 50 }]
			})
		];
		const senateurs = [
			makeSenateur({
				id: '00905A',
				prenom: 'NotRe',
				nom: 'Elu',
				dateNaissance: '1960-01-01'
			})
		];
		const out = buildElusManifest(personnes, senateurs, EMPTY_OVERRIDES);
		// Pas de "Reelu" : 1 mandat AN + 1 mandat Sénat ≠ réélu (cf ADR 0032)
		assert.ok(!out.elus[0].badgesCarriere.includes('Reelu'));
		// Mais Bicameral oui
		assert.ok(out.elus[0].badgesCarriere.includes('Bicameral'));
	});
});

// ────────────────────────────────────────────────────────────────────────────
// buildElusManifest — invariants généraux
// ────────────────────────────────────────────────────────────────────────────

describe('buildElusManifest — invariants', () => {
	test('tous les eluId matchent /^elu_[0-9a-f]{8}$/', () => {
		const personnes = [
			makePersonne({
				id: 'PA1001',
				prenom: 'Alpha',
				nom: 'Beta',
				dateNaissance: '1970-01-01'
			})
		];
		const senateurs = [
			makeSenateur({
				id: '01001A',
				prenom: 'Gamma',
				nom: 'Delta',
				dateNaissance: '1980-01-01'
			})
		];
		const out = buildElusManifest(personnes, senateurs, EMPTY_OVERRIDES);
		for (const e of out.elus) {
			assert.match(e.id, /^elu_[0-9a-f]{8}$/);
		}
	});

	test('aucun Elu n\'a 0 mandat', () => {
		const personnes = [
			makePersonne({
				id: 'PA1100',
				prenom: 'Mando',
				nom: 'Test',
				dateNaissance: '1970-01-01'
			})
		];
		const out = buildElusManifest(personnes, [], EMPTY_OVERRIDES);
		for (const e of out.elus) {
			assert.ok(e.mandats.length >= 1, `Elu ${e.id} a ${e.mandats.length} mandat(s)`);
		}
	});

	test('mandats triés chronologiquement asc', () => {
		const personnes = [
			makePersonne({
				id: 'PA1200',
				prenom: 'Chrono',
				nom: 'Test',
				dateNaissance: '1960-01-01',
				mandats: [
					{ legislature: 17, debut: '2024-07-08', fin: null, overall: 50 },
					{ legislature: 15, debut: '2017-06-21', fin: '2022-06-21', overall: 50 },
					{ legislature: 16, debut: '2022-06-22', fin: '2024-06-09', overall: 50 }
				]
			})
		];
		const out = buildElusManifest(personnes, [], EMPTY_OVERRIDES);
		const mandats = out.elus[0].mandats;
		for (let i = 1; i < mandats.length; i++) {
			assert.ok(
				mandats[i].debut >= mandats[i - 1].debut,
				`Mandat ${i} (${mandats[i].debut}) doit suivre mandat ${i - 1} (${mandats[i - 1].debut})`
			);
		}
	});

	test('count == elus.length, countBicameral == nombre d\'élus avec ≥1 mandat AN ET ≥1 Sénat', () => {
		const personnes = [
			makePersonne({
				id: 'PA1301',
				prenom: 'A',
				nom: 'X',
				dateNaissance: '1960-01-01'
			}),
			makePersonne({
				id: 'PA1302',
				prenom: 'B',
				nom: 'Y',
				dateNaissance: '1960-01-01'
			})
		];
		const senateurs = [
			makeSenateur({
				id: '01301A',
				prenom: 'A',
				nom: 'X',
				dateNaissance: '1960-01-01'
			}),
			makeSenateur({
				id: '01303A',
				prenom: 'C',
				nom: 'Z',
				dateNaissance: '1960-01-01'
			})
		];
		const out = buildElusManifest(personnes, senateurs, EMPTY_OVERRIDES);
		// Elus dédupliqués : A bicaméral, B AN seul, C Sénat seul = 3
		assert.equal(out.count, 3);
		assert.equal(out.elus.length, 3);
		// 1 bicaméral
		assert.equal(out.countBicameral, 1);
	});
});
