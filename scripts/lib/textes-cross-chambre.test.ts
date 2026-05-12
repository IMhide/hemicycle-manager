/**
 * Tests TDD pour le matching cross-chambre AN ↔ Sénat (N3.c navette).
 *
 * Le module croise les textes AN (qui ont un `senatUrl` quand le dossier a une
 * version Sénat) avec les textes Sénat (identifiés par `loicod`).
 *
 * Cascade testée :
 *  1. Niveau 1 — `senatUrl` AN → slug (ex. `pjl24-035`) → loicod via index
 *     pré-construit `slug → Set<loicod>` (issu du chaînage texte.texurl →
 *     lecass → lecture → loi du dump dosleg).
 *  2. Niveau 2 — fallback titre fuzzy : signature normalisée (NFD + strip
 *     préfixe type) du titre AN matche celle d'un texte Sénat.
 *  3. Pas de match : `versionAutreChambre = null`.
 *
 * Couvre aussi :
 *  - Symétrie : un match AN → Sénat alimente aussi Sénat → AN
 *  - Pas d'écrasement : si déjà matché niveau 1, le niveau 2 n'écrase pas
 *  - Match ambigu titre (plusieurs candidats) → on s'abstient
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import {
	extractSenatSlug,
	normaliseTitreCrossChambre,
	matchTextesAnSenat,
	type TexteAnPourMatch,
	type TexteSenatPourMatch
} from './textes-cross-chambre.ts';

// ────────────────────────────────────────────────────────────────────────────
// extractSenatSlug
// ────────────────────────────────────────────────────────────────────────────

describe('extractSenatSlug — slug depuis une URL senat.fr', () => {
	test('URL standard avec dossier-legislatif', () => {
		assert.equal(extractSenatSlug('https://www.senat.fr/dossier-legislatif/pjl24-035.html'), 'pjl24-035');
		assert.equal(extractSenatSlug('http://www.senat.fr/dossier-legislatif/ppl23-720.html'), 'ppl23-720');
	});

	test('URL avec slug PLF/PLFSS (sans tiret-numéro)', () => {
		assert.equal(extractSenatSlug('https://www.senat.fr/dossier-legislatif/pjlf2025.html'), 'pjlf2025');
		assert.equal(extractSenatSlug('https://www.senat.fr/dossier-legislatif/plfss2025.html'), 'plfss2025');
	});

	test('URL avec slash final ou query string', () => {
		assert.equal(extractSenatSlug('https://www.senat.fr/dossier-legislatif/pjl24-035.html/'), 'pjl24-035');
		assert.equal(extractSenatSlug('https://www.senat.fr/dossier-legislatif/pjl24-035.html?foo=1'), 'pjl24-035');
	});

	test('Slug mis en minuscule pour matching stable', () => {
		assert.equal(extractSenatSlug('https://www.senat.fr/dossier-legislatif/PJL24-035.HTML'), 'pjl24-035');
	});

	test('URL non-Senat ou format inconnu → null', () => {
		assert.equal(extractSenatSlug('https://example.com/foo'), null);
		assert.equal(extractSenatSlug(''), null);
		assert.equal(extractSenatSlug(null as unknown as string), null);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// normaliseTitreCrossChambre
// ────────────────────────────────────────────────────────────────────────────

describe('normaliseTitreCrossChambre — signature stable pour matching titre', () => {
	test('Retire le préfixe "projet de loi" et la locution "pour"', () => {
		const a = normaliseTitreCrossChambre('Projet de loi de finances pour 2025');
		const b = normaliseTitreCrossChambre('projet de loi de finances pour 2025');
		assert.equal(a, b);
		assert.equal(a, '2025');
	});

	test('Retire le préfixe "proposition de loi" et la locution "visant à"', () => {
		const a = normaliseTitreCrossChambre('Proposition de loi visant à reconnaître la responsabilité de l\'État');
		assert.equal(a, 'reconnaitre la responsabilite de l etat');
		assert.ok(!a.includes('proposition'));
		assert.ok(!a.startsWith('visant'));
	});

	test('Retire les variantes "proposition de loi organique/constitutionnelle"', () => {
		assert.equal(
			normaliseTitreCrossChambre('Proposition de loi organique reformer X'),
			normaliseTitreCrossChambre('proposition de loi organique reformer X')
		);
		const a = normaliseTitreCrossChambre('Proposition de loi constitutionnelle modifier Y');
		assert.ok(!a.includes('constitutionnelle'));
	});

	test('Retire les variantes PLF/PLFSS verbeux', () => {
		const a = normaliseTitreCrossChambre('Projet de loi de finances de fin de gestion pour 2024');
		const b = normaliseTitreCrossChambre('Projet de loi de finances pour 2024');
		assert.ok(!a.includes('projet'));
		assert.ok(!b.includes('projet'));
	});

	test('Convergence entre titre AN canonique et titre Sénat verbeux (cas réel)', () => {
		// Cas réel pour le matching cross-chambre :
		//   AN dit  : "Démocratiser le sport en France"
		//   Sénat dit: "proposition de loi, adoptée par l'Assemblée nationale après engagement de la procédure accélérée, visant à démocratiser le sport en France"
		// → les deux doivent normaliser à "democratiser le sport en france".
		const an = normaliseTitreCrossChambre('Démocratiser le sport en France');
		const sen = normaliseTitreCrossChambre(
			"proposition de loi, adoptée par l'Assemblée nationale après engagement de la procédure accélérée, visant à démocratiser le sport en France"
		);
		assert.equal(an, 'democratiser le sport en france');
		assert.equal(sen, 'democratiser le sport en france');
		assert.equal(an, sen);
	});

	test('Vide → vide', () => {
		assert.equal(normaliseTitreCrossChambre(''), '');
		assert.equal(normaliseTitreCrossChambre('   '), '');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// matchTextesAnSenat — orchestration complète
// ────────────────────────────────────────────────────────────────────────────

function anTexte(id: string, titre: string, senatUrl: string | null, enrichi = true): TexteAnPourMatch {
	return { id, titre, senatUrl, enrichiDossiersAN: enrichi };
}

function senTexte(id: string, titre: string): TexteSenatPourMatch {
	return { id, titre };
}

describe('matchTextesAnSenat — cascade complète', () => {
	test('Niveau 1 — slug senatUrl direct trouve un loicod existant côté Sénat', () => {
		const an = [anTexte('DLR-A', 'Proposition de loi visant à X', 'https://www.senat.fr/dossier-legislatif/ppl24-100.html')];
		const sen = [senTexte('99999', 'Proposition de loi visant à X')];
		// Index slug → Set<loicod> pré-construit (équivalent à ce que ferait la lib dump)
		const slugToLoicod = new Map<string, Set<string>>([['ppl24-100', new Set(['99999'])]]);
		const { anToSenat, senatToAn } = matchTextesAnSenat(an, sen, slugToLoicod);
		assert.equal(anToSenat.get('DLR-A'), '99999');
		assert.equal(senatToAn.get('99999'), 'DLR-A');
	});

	test('Niveau 1 — slug match mais loicod absent du dataset Sénat → fallback titre', () => {
		// Le slug pointe vers un dossier dosleg, mais ce dossier n'a pas été retenu
		// dans textes.json Sénat (pas de scrutin Sénat). On rattrape par titre.
		const an = [anTexte('DLR-B', 'Proposition de loi sur la cyber-sécurité', 'https://www.senat.fr/dossier-legislatif/ppl24-200.html')];
		const sen = [senTexte('88888', 'Proposition de loi sur la cyber-sécurité')];
		const slugToLoicod = new Map<string, Set<string>>([['ppl24-200', new Set(['77777'])]]); // 77777 absent de sen
		const { anToSenat, senatToAn } = matchTextesAnSenat(an, sen, slugToLoicod);
		assert.equal(anToSenat.get('DLR-B'), '88888');
		assert.equal(senatToAn.get('88888'), 'DLR-B');
	});

	test('Niveau 2 — pas de senatUrl, match par titre fuzzy', () => {
		const an = [anTexte('DLR-C', 'Proposition de loi relative au sport', null)];
		const sen = [senTexte('11111', 'Proposition de loi relative au sport')];
		const { anToSenat, senatToAn } = matchTextesAnSenat(an, sen, new Map());
		assert.equal(anToSenat.get('DLR-C'), '11111');
		assert.equal(senatToAn.get('11111'), 'DLR-C');
	});

	test('Niveau 2 ambigu — plusieurs candidats Sénat même signature → no match (prudent)', () => {
		const an = [anTexte('DLR-D', 'Proposition de loi relative au climat', null)];
		const sen = [
			senTexte('22222', 'Proposition de loi relative au climat'),
			senTexte('33333', 'Proposition de loi relative au climat')
		];
		const { anToSenat } = matchTextesAnSenat(an, sen, new Map());
		assert.equal(anToSenat.get('DLR-D'), undefined, 'doit s\'abstenir si ambigu');
	});

	test('Pas de match → versionAutreChambre absent (= null implicite)', () => {
		const an = [anTexte('DLR-E', 'Proposition de loi unique AN', null)];
		const sen = [senTexte('44444', 'Proposition de loi unique Sénat')];
		const { anToSenat, senatToAn } = matchTextesAnSenat(an, sen, new Map());
		assert.equal(anToSenat.get('DLR-E'), undefined);
		assert.equal(senatToAn.get('44444'), undefined);
	});

	test('Texte AN non enrichi (sig-*) ignoré au matching titre (titre dérivé du scrutin)', () => {
		// Les textes sig-* AN ont des titres bruts du scrutin, pas canoniques.
		// On évite des faux positifs en les excluant du matching titre.
		const an = [anTexte('sig-foo', 'projet de loi visant à examiner', null, false)];
		const sen = [senTexte('55555', 'projet de loi visant à examiner')];
		const { anToSenat } = matchTextesAnSenat(an, sen, new Map());
		assert.equal(anToSenat.get('sig-foo'), undefined);
	});

	test('Symétrie complète : tout match anToSenat[x]=y implique senatToAn[y]=x', () => {
		const an = [
			anTexte('AN1', 'Proposition de loi relative au numérique', 'https://www.senat.fr/dossier-legislatif/ppl24-1.html'),
			anTexte('AN2', 'Proposition de loi relative aux transports', null)
		];
		const sen = [
			senTexte('S1', 'Proposition de loi relative au numérique'),
			senTexte('S2', 'Proposition de loi relative aux transports')
		];
		const slugToLoicod = new Map<string, Set<string>>([['ppl24-1', new Set(['S1'])]]);
		const { anToSenat, senatToAn } = matchTextesAnSenat(an, sen, slugToLoicod);
		for (const [anId, senId] of anToSenat) {
			assert.equal(senatToAn.get(senId), anId, `symétrie violée pour ${anId}↔${senId}`);
		}
	});

	test('Plusieurs loicod pour un slug (multi-lecture) → on garde le premier présent dans textes Sénat', () => {
		const an = [anTexte('DLR-X', 'titre indifférent', 'https://www.senat.fr/dossier-legislatif/ppl24-999.html')];
		const sen = [senTexte('111', 't'), senTexte('222', 't2')];
		const slugToLoicod = new Map<string, Set<string>>([['ppl24-999', new Set(['000', '111', '222'])]]);
		const { anToSenat } = matchTextesAnSenat(an, sen, slugToLoicod);
		// Le premier match (111 OU 222) doit être stable
		const got = anToSenat.get('DLR-X');
		assert.ok(got === '111' || got === '222', `got ${got}`);
	});
});
