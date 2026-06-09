import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import {
	serializeJsonLd,
	senatSlug,
	officialAnUrl,
	officialSenatUrl,
	buildPersonLd,
	buildLegislationLd
} from './jsonld.ts';
import type { Elu } from './elus.ts';
import type { TexteUnifie } from './types.ts';

describe('serializeJsonLd', () => {
	test('échappe < pour neutraliser </script>', () => {
		const out = serializeJsonLd({ x: '</script><script>alert(1)</script>' });
		assert.ok(!out.includes('</script>'), 'aucun </script> littéral');
		assert.ok(out.includes('\\u003c'), 'le < est échappé en \\u003c');
	});

	test('reste du JSON valide après échappement', () => {
		const obj = { a: 'b<c', n: 3 };
		const out = serializeJsonLd(obj);
		assert.deepEqual(JSON.parse(out), obj);
	});
});

describe('URLs officielles (sameAs)', () => {
	test('AN : /dyn/deputes/{paId}', () => {
		assert.equal(officialAnUrl('PA1592'), 'https://www.assemblee-nationale.fr/dyn/deputes/PA1592');
	});

	test('senatSlug : {nom prenom} translittéré + matricule minuscule, sans séparateur', () => {
		assert.equal(senatSlug('Rossignol', 'Laurence', '11045K'), 'rossignol_laurence11045k');
		assert.equal(senatSlug('de Montgolfier', 'Albéric', '08011M'), 'de_montgolfier_alberic08011m');
	});

	test('officialSenatUrl complète', () => {
		assert.equal(
			officialSenatUrl('Rossignol', 'Laurence', '11045K'),
			'https://www.senat.fr/senateur/rossignol_laurence11045k.html'
		);
	});
});

function eluFixture(overrides: Partial<Elu> = {}): Elu {
	return {
		id: 'elu_abcd1234',
		slug: 'jean-test',
		prenom: 'Jean',
		nom: 'Test',
		civ: 'M.',
		sexe: 'M',
		dateNaissance: '1970-01-01',
		photoUrl: 'https://example.org/p.jpg',
		paId: 'PA1592',
		matricule: null,
		mandats: [
			{
				chambre: 'AN',
				legislature: 17,
				debut: '2024-07-01',
				fin: null,
				overall: 50,
				groupeId: 'PO1',
				groupeLibelleAbrege: 'LFI',
				groupeCouleur: '#f00',
				famille: null
			}
		],
		overallCarriere: 50,
		radarCarriere: { presence: 0.9, participation: 0.5, loyaute: 0.8, volume: 0.4, frondes: 0.1 },
		badgesCarriere: [],
		...overrides
	};
}

describe('buildPersonLd', () => {
	test('Person AN-seul → sameAs AN, jobTitle Député', () => {
		const ld = buildPersonLd(eluFixture());
		assert.equal(ld['@type'], 'Person');
		assert.equal(ld.name, 'Jean Test');
		assert.equal(ld.jobTitle, 'Député');
		assert.deepEqual(ld.sameAs, ['https://www.assemblee-nationale.fr/dyn/deputes/PA1592']);
		assert.equal(ld.gender, 'Male');
	});

	test('bicaméral → jobTitle Député / Sénateur + 2 sameAs', () => {
		const elu = eluFixture({
			matricule: '11045K',
			nom: 'Rossignol',
			prenom: 'Laurence',
			sexe: 'F',
			mandats: [
				{
					chambre: 'AN',
					legislature: 16,
					debut: '2022-06-01',
					fin: null,
					overall: 50,
					groupeId: 'PO1',
					groupeLibelleAbrege: 'SOC',
					groupeCouleur: '#f00',
					famille: null
				},
				{
					chambre: 'SENAT',
					triennat: '2023-2026',
					debut: '2023-10-01',
					fin: null,
					overall: 60,
					groupeCode: 'SER',
					groupeLibelleAbrege: 'SER',
					groupeCouleur: '#f00',
					famille: null
				}
			]
		});
		const ld = buildPersonLd(elu);
		assert.equal(ld.jobTitle, 'Député / Sénateur');
		assert.equal(ld.gender, 'Female');
		assert.equal((ld.sameAs as string[]).length, 2);
		assert.ok(
			(ld.sameAs as string[]).includes(
				'https://www.senat.fr/senateur/rossignol_laurence11045k.html'
			)
		);
	});

	test('sans dateNaissance/photo → champs omis', () => {
		const ld = buildPersonLd(eluFixture({ dateNaissance: null, photoUrl: '' }));
		assert.ok(!('birthDate' in ld));
		assert.ok(!('image' in ld));
	});
});

function texteFixture(overrides: Partial<TexteUnifie> = {}): TexteUnifie {
	return {
		id: 'DLR5L17N1',
		slug: 'loi-test-DLR5L17N1',
		titre: 'Loi de test',
		type: 'projet-loi',
		typeLibelle: 'Projet de loi',
		etat: 'promulgue',
		numeroLoi: '2025-1',
		datePromulgation: '2025-02-01',
		urlJO: 'https://www.legifrance.gouv.fr/jo/x',
		senatUrl: 'https://www.senat.fr/dossier/x.html',
		initiateurs: [],
		procedureLibelle: null,
		dateDebut: '2024-01-01',
		dateFin: '2025-02-01',
		nbScrutins: 3,
		bicameral: true,
		an: null,
		senat: null,
		timelineNavette: [],
		...overrides
	};
}

describe('buildLegislationLd', () => {
	test('Legislation promulguée → sameAs JO+Sénat, InForce, identifier', () => {
		const ld = buildLegislationLd(texteFixture());
		assert.equal(ld['@type'], 'Legislation');
		assert.equal(ld.name, 'Loi de test');
		assert.equal(ld.legislationDate, '2025-02-01');
		assert.equal(ld.legislationIdentifier, '2025-1');
		assert.equal(ld.legislationLegalForce, 'InForce');
		assert.deepEqual(ld.sameAs, [
			'https://www.legifrance.gouv.fr/jo/x',
			'https://www.senat.fr/dossier/x.html'
		]);
	});

	test('texte en cours sans JO → pas de sameAs vide, pas de InForce', () => {
		const ld = buildLegislationLd(
			texteFixture({ etat: 'en-cours', datePromulgation: null, numeroLoi: null, urlJO: null, senatUrl: null })
		);
		assert.ok(!('legislationLegalForce' in ld));
		assert.ok(!('sameAs' in ld));
		assert.ok(!('legislationDate' in ld));
	});
});
