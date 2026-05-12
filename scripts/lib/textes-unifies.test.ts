/**
 * Tests TDD pour la fusion cross-chambre AN+Sénat → TexteUnifie[] (N3.d).
 *
 * Le module croise les Texte[] AN (ADR 0035, déjà mutés en N3.c avec
 * versionAutreChambre) et les TexteSenat[] (N3.b) pour produire un manifest
 * unifié consommé par `/textes/` et `/textes/[id]`.
 *
 * Cas testés :
 *  - Texte AN-seul (~70% des textes) → entrée TexteUnifie avec `senat: null`
 *  - Texte Sénat-seul (~20%) → entrée avec `an: null`
 *  - Texte bicaméral (~10%) → entrée avec `an` et `senat` remplis, id AN canonique
 *  - Sources d'autorité par champ (titre, type, promulgation, JO, etc.)
 *  - Cascade etatGlobal (promulgue > rejete > retire/caduc > en-cours)
 *  - Dates : min(débuts) / max(fins)
 *  - Pas de double comptage si AN et Sénat ont chacun un côté
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import { fusionneTextesUnifies, type TexteAnInput, type TexteSenatInput } from './textes-unifies.ts';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function textAN(
	id: string,
	overrides: Partial<TexteAnInput> = {}
): TexteAnInput {
	return {
		id,
		legislature: 17,
		titre: 'Texte AN',
		type: 'proposition-loi',
		procedureLibelle: 'Proposition de loi ordinaire',
		initiateurs: [],
		dateDebut: '2024-01-01',
		dateFin: '2024-02-01',
		datePromulgation: null,
		sortFinal: 'adopté',
		nbScrutins: 5,
		nbVotesSolennels: 1,
		enrichiDossiersAN: true,
		senatUrl: null,
		versionAutreChambre: null,
		...overrides
	};
}

function textSenat(id: string, overrides: Partial<TexteSenatInput> = {}): TexteSenatInput {
	return {
		id,
		triennat: '2023-2026',
		titre: 'proposition de loi visant à X',
		type: 'ppl',
		typeLibelle: 'Proposition de loi',
		etat: 'en-cours',
		numeroLoi: null,
		datePromulgation: null,
		urlJO: null,
		dateDebut: '2024-01-05',
		dateFin: '2024-01-15',
		sortFinal: 'adopté',
		nbScrutins: 3,
		enrichiDosleg: true,
		versionAutreChambre: null,
		...overrides
	};
}

// ────────────────────────────────────────────────────────────────────────────
// Cas 1 — Mono-chambre
// ────────────────────────────────────────────────────────────────────────────

describe('fusionneTextesUnifies — textes mono-chambre', () => {
	test('Texte AN sans version Sénat → an: rempli, senat: null', () => {
		const result = fusionneTextesUnifies([textAN('DLR-A')], []);
		assert.equal(result.length, 1);
		const t = result[0];
		assert.equal(t.id, 'DLR-A');
		assert.ok(t.an);
		assert.equal(t.an!.texteId, 'DLR-A');
		assert.equal(t.senat, null);
		assert.equal(t.bicameral, false);
	});

	test('Texte Sénat sans version AN → senat: rempli, an: null, id = loicod', () => {
		const result = fusionneTextesUnifies([], [textSenat('77777')]);
		assert.equal(result.length, 1);
		const t = result[0];
		assert.equal(t.id, '77777');
		assert.equal(t.an, null);
		assert.ok(t.senat);
		assert.equal(t.senat!.texteId, '77777');
		assert.equal(t.bicameral, false);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// Cas 2 — Bicaméral (match via versionAutreChambre)
// ────────────────────────────────────────────────────────────────────────────

describe('fusionneTextesUnifies — textes bicaméraux', () => {
	test('AN + Sénat matchés → 1 entrée bicaméral, id canonique AN', () => {
		const an = textAN('DLR-X', {
			versionAutreChambre: { texteSenatId: '99999', matchedVia: 'slug' }
		});
		const sen = textSenat('99999', {
			versionAutreChambre: { texteAnId: 'DLR-X', matchedVia: 'slug' }
		});
		const result = fusionneTextesUnifies([an], [sen]);
		assert.equal(result.length, 1);
		const t = result[0];
		assert.equal(t.id, 'DLR-X');
		assert.equal(t.bicameral, true);
		assert.ok(t.an && t.senat);
		assert.equal(t.an!.texteId, 'DLR-X');
		assert.equal(t.senat!.texteId, '99999');
	});

	test('AN + Sénat matchés : titre = AN, promul = Sénat (ADR 0036)', () => {
		const an = textAN('DLR-Y', {
			titre: 'Démocratiser le sport en France',
			versionAutreChambre: { texteSenatId: '88888', matchedVia: 'slug' }
		});
		const sen = textSenat('88888', {
			titre: 'proposition de loi, adoptée par AN, visant à démocratiser le sport en France',
			etat: 'promulgue',
			datePromulgation: '2024-11-15',
			urlJO: 'https://www.legifrance.gouv.fr/eli/loi/2024/11/15/JO',
			numeroLoi: '2024-1026',
			versionAutreChambre: { texteAnId: 'DLR-Y', matchedVia: 'slug' }
		});
		const result = fusionneTextesUnifies([an], [sen]);
		const t = result[0];
		assert.equal(t.titre, 'Démocratiser le sport en France', 'titre = AN');
		assert.equal(t.datePromulgation, '2024-11-15', 'promul = Sénat');
		assert.equal(t.urlJO, 'https://www.legifrance.gouv.fr/eli/loi/2024/11/15/JO');
		assert.equal(t.numeroLoi, '2024-1026');
		assert.equal(t.etat, 'promulgue');
	});

	test('AN + Sénat matchés : dates = min(débuts) et max(fins)', () => {
		const an = textAN('DLR-Z', {
			dateDebut: '2024-03-01',
			dateFin: '2024-05-01',
			versionAutreChambre: { texteSenatId: 'X', matchedVia: 'slug' }
		});
		const sen = textSenat('X', {
			dateDebut: '2024-01-15',
			dateFin: '2024-04-15',
			versionAutreChambre: { texteAnId: 'DLR-Z', matchedVia: 'slug' }
		});
		const result = fusionneTextesUnifies([an], [sen]);
		const t = result[0];
		assert.equal(t.dateDebut, '2024-01-15', 'min des deux débuts');
		assert.equal(t.dateFin, '2024-05-01', 'max des deux fins');
	});

	test('Pas de double comptage : sen.versionAutreChambre seul ne crée pas 2 entrées', () => {
		// Cas réel : matching peut être asymétrique si l'un des deux côtés n'a
		// pas été muté correctement. On déduplique sur l'id Sénat.
		const an = textAN('DLR-W', {
			versionAutreChambre: { texteSenatId: '55555', matchedVia: 'titre' }
		});
		const sen = textSenat('55555', { versionAutreChambre: null });
		const result = fusionneTextesUnifies([an], [sen]);
		assert.equal(result.length, 1, '1 seule entrée, pas 2');
		assert.equal(result[0].bicameral, true);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// Cas 3 — Cascade etatGlobal
// ────────────────────────────────────────────────────────────────────────────

describe('fusionneTextesUnifies — cascade etatGlobal', () => {
	test('Promulgation côté Sénat → état promulgue', () => {
		const result = fusionneTextesUnifies([], [textSenat('A', { etat: 'promulgue' })]);
		assert.equal(result[0].etat, 'promulgue');
	});

	test('Promulgation côté AN (datePromulgation) → état promulgue', () => {
		const result = fusionneTextesUnifies(
			[textAN('B', { datePromulgation: '2024-06-01' })],
			[]
		);
		assert.equal(result[0].etat, 'promulgue');
	});

	test("sortFinal AN === 'rejeté' (sans promulgation) → état rejete", () => {
		const result = fusionneTextesUnifies(
			[textAN('C', { sortFinal: 'rejeté', datePromulgation: null })],
			[]
		);
		assert.equal(result[0].etat, 'rejete');
	});

	test('Sénat etat=rejete + AN sans promul → état rejete', () => {
		const an = textAN('D', { versionAutreChambre: { texteSenatId: 'D2', matchedVia: 'slug' } });
		const sen = textSenat('D2', {
			etat: 'rejete',
			versionAutreChambre: { texteAnId: 'D', matchedVia: 'slug' }
		});
		const result = fusionneTextesUnifies([an], [sen]);
		assert.equal(result[0].etat, 'rejete');
	});

	test('Promul prime sur tout', () => {
		// Cas où AN dit "rejeté" mais Sénat dit "promulgué" — on prend promulgué
		const an = textAN('E', {
			sortFinal: 'rejeté',
			versionAutreChambre: { texteSenatId: 'E2', matchedVia: 'slug' }
		});
		const sen = textSenat('E2', {
			etat: 'promulgue',
			datePromulgation: '2024-07-01',
			versionAutreChambre: { texteAnId: 'E', matchedVia: 'slug' }
		});
		const result = fusionneTextesUnifies([an], [sen]);
		assert.equal(result[0].etat, 'promulgue');
	});

	test('Texte mono Sénat caduc → état caduc', () => {
		const result = fusionneTextesUnifies([], [textSenat('F', { etat: 'caduc' })]);
		assert.equal(result[0].etat, 'caduc');
	});

	test('Default → en-cours pour AN sans promul ni rejet explicite', () => {
		const result = fusionneTextesUnifies(
			[textAN('G', { sortFinal: 'adopté', datePromulgation: null })],
			[]
		);
		assert.equal(result[0].etat, 'en-cours');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// Cas 4 — Source d'autorité par champ (mono-chambre)
// ────────────────────────────────────────────────────────────────────────────

describe('fusionneTextesUnifies — sources d\'autorité', () => {
	test('Texte mono-AN : numéro loi et urlJO restent null (AN ne les expose pas)', () => {
		const result = fusionneTextesUnifies([textAN('H')], []);
		assert.equal(result[0].numeroLoi, null);
		assert.equal(result[0].urlJO, null);
	});

	test('Texte mono-Sénat : initiateurs vide (Sénat ne les expose pas)', () => {
		const result = fusionneTextesUnifies([], [textSenat('I')]);
		assert.deepEqual(result[0].initiateurs, []);
	});

	test('Texte bicaméral : initiateurs = AN', () => {
		const an = textAN('J', {
			initiateurs: ['PA12345'],
			versionAutreChambre: { texteSenatId: 'J2', matchedVia: 'slug' }
		});
		const sen = textSenat('J2', {
			versionAutreChambre: { texteAnId: 'J', matchedVia: 'slug' }
		});
		const result = fusionneTextesUnifies([an], [sen]);
		assert.deepEqual(result[0].initiateurs, ['PA12345']);
	});

	test('Texte bicaméral : senatUrl prélevé côté AN', () => {
		const an = textAN('K', {
			senatUrl: 'https://www.senat.fr/dossier-legislatif/ppl24-100.html',
			versionAutreChambre: { texteSenatId: 'K2', matchedVia: 'slug' }
		});
		const sen = textSenat('K2', {
			versionAutreChambre: { texteAnId: 'K', matchedVia: 'slug' }
		});
		const result = fusionneTextesUnifies([an], [sen]);
		assert.equal(result[0].senatUrl, 'https://www.senat.fr/dossier-legislatif/ppl24-100.html');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// Cas 5 — Comptes globaux et invariants
// ────────────────────────────────────────────────────────────────────────────

describe('fusionneTextesUnifies — invariants', () => {
	test('nbScrutins = somme AN + Sénat pour bicaméraux', () => {
		const an = textAN('L', {
			nbScrutins: 10,
			versionAutreChambre: { texteSenatId: 'L2', matchedVia: 'slug' }
		});
		const sen = textSenat('L2', {
			nbScrutins: 5,
			versionAutreChambre: { texteAnId: 'L', matchedVia: 'slug' }
		});
		const result = fusionneTextesUnifies([an], [sen]);
		assert.equal(result[0].nbScrutins, 15);
	});

	test('Total = #AN-only + #Sénat-only + #bicaméraux (sans double compte)', () => {
		const an = [
			textAN('a1'),
			textAN('a2', { versionAutreChambre: { texteSenatId: 's1', matchedVia: 'slug' } })
		];
		const sen = [
			textSenat('s1', { versionAutreChambre: { texteAnId: 'a2', matchedVia: 'slug' } }),
			textSenat('s2')
		];
		const result = fusionneTextesUnifies(an, sen);
		// 1 AN-only (a1) + 1 bicaméral (a2/s1) + 1 Sénat-only (s2) = 3
		assert.equal(result.length, 3);
	});

	test('Trié par dateDebut décroissante (plus récent en premier)', () => {
		const an = [
			textAN('old', { dateDebut: '2020-01-01', dateFin: '2020-06-01' }),
			textAN('new', { dateDebut: '2025-01-01', dateFin: '2025-06-01' }),
			textAN('mid', { dateDebut: '2023-01-01', dateFin: '2023-06-01' })
		];
		const result = fusionneTextesUnifies(an, []);
		assert.equal(result[0].id, 'new');
		assert.equal(result[1].id, 'mid');
		assert.equal(result[2].id, 'old');
	});
});
