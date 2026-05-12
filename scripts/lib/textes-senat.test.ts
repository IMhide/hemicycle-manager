/**
 * Tests TDD pour l'agrégation `TexteSenat` côté Sénat (N3.b navette).
 *
 * Le module croise deux sources :
 *  1. Scrutins Sénat (titre = `scr.scrint`, uid = `${sesann}-${scrnum}`)
 *  2. Dossiers `DossierSenat` extraits du dump dosleg (loicod, titre, type, etat)
 *
 * Stratégie de groupement :
 *  - Niveau 1 — matching par signature titre : `extractTexteSignature(scr.scrint)`
 *    → cherche un `DossierSenat` avec la même `signatureNomNormalise`.
 *    Si trouvé : id = `loicod`, texte enrichi.
 *  - Niveau 2 — fallback signature : si pas de dossier matché, on crée un texte
 *    `sig-<sesann>|<type>|<nom>`. Sert pour les motions, scrutins de procédure,
 *    textes dont le titre Sénat ne matche aucun loitit.
 *
 * Invariants testés :
 *  - Scrutins partageant la même signature → même texte
 *  - Match sur loitit → id = loicod trimmé, enrichiDosleg = true
 *  - Pas de match → id sig-…, enrichiDosleg = false
 *  - Motions/scrutins non textuels → texteId = null
 *  - Textes triés par dateDebut ascendant
 *  - Scrutins d'un texte triés chronologique
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import { aggregeTextesSenat, type ScrutinSenatPourAgreg } from './textes-senat.ts';
import { buildDossierSenatFromRow, type DossierSenat } from './dosleg-textes.ts';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function scrutin(
	uid: string,
	date: string,
	titre: string,
	opts: Partial<ScrutinSenatPourAgreg> = {}
): ScrutinSenatPourAgreg {
	const [sesann, scrnum] = uid.split('-').map(Number);
	return {
		uid,
		sesann,
		scrnum,
		date,
		titre,
		sort: 'adopté',
		...opts
	};
}

/** Construit un DossierSenat via la ligne brute, puis applique les overrides
 *  directement sur le résultat (utile pour ajuster etat/datePromulgation sans
 *  toucher aux codes etaloi/loidatjo). */
function dossier(
	loicod: string,
	type: string,
	titre: string,
	overrides: Partial<DossierSenat> = {}
): DossierSenat {
	const d = buildDossierSenatFromRow({
		loicod,
		typloicod: type,
		etaloicod: '01',
		loitit: titre,
		loiint: null,
		date_loi: null,
		loidatjo: null,
		loinumjo: null,
		url_jo: null,
		numero: null
	});
	return { ...d, ...overrides };
}

// ────────────────────────────────────────────────────────────────────────────
// Cas 1 — Signature seule (pas de dossiers)
// ────────────────────────────────────────────────────────────────────────────

describe('aggregeTextesSenat — signature seule (pas de dossiers)', () => {
	test('Deux scrutins même proposition de loi → 1 texte', () => {
		const scrutins = [
			scrutin('2024-100', '2024-11-01', "sur l'article 1er de la proposition de loi visant à reconnaître la responsabilité de l'État"),
			scrutin('2024-101', '2024-11-02', "sur l'ensemble de la proposition de loi visant à reconnaître la responsabilité de l'État")
		];
		const { textes, scrutinToTexte } = aggregeTextesSenat(scrutins, []);
		assert.equal(textes.length, 1);
		assert.equal(textes[0].nbScrutins, 2);
		assert.equal(textes[0].scrutins.length, 2);
		assert.equal(scrutinToTexte.get('2024-100'), textes[0].id);
		assert.equal(scrutinToTexte.get('2024-101'), textes[0].id);
		assert.equal(textes[0].enrichiDosleg, false);
		assert.match(textes[0].id, /^sig-/);
	});

	test('Trois scrutins différents → 3 textes', () => {
		const scrutins = [
			scrutin('2024-10', '2024-10-01', "sur l'ensemble de la proposition de loi A"),
			scrutin('2024-11', '2024-10-02', "sur l'ensemble de la proposition de loi B"),
			scrutin('2024-12', '2024-10-03', "sur l'ensemble de la proposition de loi C")
		];
		const { textes } = aggregeTextesSenat(scrutins, []);
		assert.equal(textes.length, 3);
	});

	test('Motion référendaire ou question préalable → texteId null', () => {
		const scrutins = [
			// Une motion référendaire n'est pas un texte législatif en soi
			scrutin('2024-50', '2024-05-01', 'sur la motion de censure déposée par M. X'),
			scrutin('2024-51', '2024-05-02', "sur l'ensemble de la proposition de loi visant à Y")
		];
		const { textes, scrutinToTexte } = aggregeTextesSenat(scrutins, []);
		assert.equal(textes.length, 1, '1 texte pour la PPL Y');
		assert.equal(scrutinToTexte.get('2024-50'), null, 'motion = null');
		assert.ok(scrutinToTexte.get('2024-51'), 'PPL = texte');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// Cas 2 — Matching signature → DossierSenat enrichi
// ────────────────────────────────────────────────────────────────────────────

describe('aggregeTextesSenat — enrichissement par signature dossier', () => {
	test('Scrutin avec signature matchant un loi.loitit → id = loicod', () => {
		const scrutins = [
			scrutin('2024-200', '2024-11-15',
				"sur l'ensemble de la proposition de loi organique visant à reporter le renouvellement général des membres du congrès et des assemblées de province de la Nouvelle-Calédonie")
		];
		const dossiers = [
			dossier(
				'74884       ',
				'pplo',
				'visant à reporter le renouvellement général des membres du congrès et des assemblées de province de la Nouvelle-Calédonie',
				{ etat: 'promulgue', datePromulgation: '2024-11-15', numeroLoi: '2024-1026' }
			)
		];
		const { textes } = aggregeTextesSenat(scrutins, dossiers);
		assert.equal(textes.length, 1);
		assert.equal(textes[0].id, '74884');
		assert.equal(textes[0].enrichiDosleg, true);
		assert.equal(textes[0].etat, 'promulgue');
		assert.equal(textes[0].numeroLoi, '2024-1026');
	});

	test('Pas de match dossier (texte exotique) → fallback sig-…', () => {
		const scrutins = [
			scrutin('2024-300', '2024-12-01', "sur l'ensemble de la proposition de loi visant à un sujet jamais déposé")
		];
		const dossiers = [
			dossier('11111       ', 'ppl', 'visant à un autre sujet')
		];
		const { textes } = aggregeTextesSenat(scrutins, dossiers);
		assert.equal(textes.length, 1);
		assert.equal(textes[0].enrichiDosleg, false);
		assert.match(textes[0].id, /^sig-/);
	});

	test('Plusieurs scrutins même texte enrichi → tous groupés sous loicod', () => {
		const scrutins = [
			scrutin('2024-400', '2024-10-15', "sur l'article 5 de la proposition de loi relative à la lutte contre les dérives sectaires"),
			scrutin('2024-401', '2024-10-16', "sur l'amendement n° 12 à l'article 7 de la proposition de loi relative à la lutte contre les dérives sectaires"),
			scrutin('2024-402', '2024-10-17', "sur l'ensemble de la proposition de loi relative à la lutte contre les dérives sectaires")
		];
		// loi.loitit côté Sénat est différent : "visant à renforcer la lutte contre les dérives sectaires"
		// → ne matchera pas. On crée un dossier qui matche exactement.
		const dossiers = [
			dossier('73326       ', 'ppl', 'relative à la lutte contre les dérives sectaires')
		];
		const { textes } = aggregeTextesSenat(scrutins, dossiers);
		assert.equal(textes.length, 1);
		assert.equal(textes[0].id, '73326');
		assert.equal(textes[0].nbScrutins, 3);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// Cas 3 — Tri et triennat
// ────────────────────────────────────────────────────────────────────────────

describe('aggregeTextesSenat — chronologie et triennat', () => {
	test('Scrutins d\'un texte triés ascendant', () => {
		const scrutins = [
			scrutin('2024-500', '2024-11-20', "sur l'amendement à la proposition de loi X"),
			scrutin('2024-501', '2024-11-01', "sur l'article 1 de la proposition de loi X"),
			scrutin('2024-502', '2024-12-01', "sur l'ensemble de la proposition de loi X")
		];
		const { textes } = aggregeTextesSenat(scrutins, []);
		const t = textes[0];
		assert.equal(t.scrutins[0], '2024-501');
		assert.equal(t.scrutins[1], '2024-500');
		assert.equal(t.scrutins[2], '2024-502');
		assert.equal(t.dateDebut, '2024-11-01');
		assert.equal(t.dateFin, '2024-12-01');
	});

	test('Triennat dérivé de la date du premier scrutin', () => {
		// triennat 2023-2026 commence 2023-09-24 (cf ADR 0028+0029)
		const scrutins = [
			scrutin('2024-600', '2024-11-15', "sur l'ensemble de la proposition de loi Z")
		];
		const { textes } = aggregeTextesSenat(scrutins, []);
		assert.equal(textes[0].triennat, '2023-2026');
	});

	test('Textes globalement triés par dateDebut ascendant', () => {
		const scrutins = [
			scrutin('2024-700', '2024-12-01', "sur l'ensemble de la proposition de loi B"),
			scrutin('2024-701', '2024-10-01', "sur l'ensemble de la proposition de loi A")
		];
		const { textes } = aggregeTextesSenat(scrutins, []);
		assert.equal(textes.length, 2);
		assert.equal(textes[0].dateDebut, '2024-10-01');
		assert.equal(textes[1].dateDebut, '2024-12-01');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// Cas 4 — Invariants généraux
// ────────────────────────────────────────────────────────────────────────────

describe('aggregeTextesSenat — invariants', () => {
	test('nbScrutins == scrutins.length pour tous les textes', () => {
		const scrutins = [
			scrutin('2024-800', '2024-10-01', "sur l'ensemble de la proposition de loi K"),
			scrutin('2024-801', '2024-10-02', "sur l'ensemble de la proposition de loi K"),
			scrutin('2024-802', '2024-10-03', "sur l'ensemble de la proposition de loi L")
		];
		const { textes } = aggregeTextesSenat(scrutins, []);
		for (const t of textes) assert.equal(t.nbScrutins, t.scrutins.length);
	});

	test('Tous les textes ont dateDebut ≤ dateFin', () => {
		const scrutins = [
			scrutin('2024-900', '2024-10-01', "sur l'ensemble de la proposition de loi M"),
			scrutin('2024-901', '2024-11-01', "sur l'ensemble de la proposition de loi M")
		];
		const { textes } = aggregeTextesSenat(scrutins, []);
		for (const t of textes) assert.ok(t.dateDebut <= t.dateFin);
	});

	test('id préfixé sig- est non enrichi, id loicod est enrichi', () => {
		const scrutins = [
			scrutin('2024-1000', '2024-10-01', "sur l'ensemble de la proposition de loi N"),
			scrutin('2024-1001', '2024-10-02', "sur l'ensemble de la proposition de loi visant à P")
		];
		const dossiers = [
			dossier('55555       ', 'ppl', 'visant à P')
		];
		const { textes } = aggregeTextesSenat(scrutins, dossiers);
		for (const t of textes) {
			if (t.id.startsWith('sig-')) {
				assert.equal(t.enrichiDosleg, false);
			} else {
				assert.equal(t.enrichiDosleg, true);
			}
		}
	});
});
