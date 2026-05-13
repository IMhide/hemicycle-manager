/**
 * Tests TDD pour l'extraction de la timeline navette depuis l'arbre
 * `actesLegislatifs` du dump dossiers AN (cf ADR 0037).
 *
 * Le module est purement transformationnel : prend un noeud d'arbre Etalab
 * et produit un tableau ordonné de `TimelineActe[]` filtré sur les codes
 * "remarquables".
 *
 * Couvre :
 *  - Parsing récursif (acteLegislatif peut être un objet ou un tableau)
 *  - Filtre des codes "remarquables" (rejette commissions, rapports, etc.)
 *  - Mapping code → chambre / phase / label
 *  - Tri chronologique stable
 *  - Détection de la bicaméralité
 *  - Croisement avec scrutins nominaux (résolution scrutinUid)
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import {
	extractTimelineNavette,
	codeToPhase,
	codeToChambre,
	codeToLabel,
	isCodeRemarquable,
	hasSenatActe,
	resolveScrutinUid,
	type ActeRaw,
	type ScrutinSolennelIndex
} from './timeline-navette.ts';

// ────────────────────────────────────────────────────────────────────────────
// isCodeRemarquable
// ────────────────────────────────────────────────────────────────────────────

describe('isCodeRemarquable — filtre des codes UI', () => {
	test('Codes retenus : dépôts, votes en séance, CMP, CC, promulgation', () => {
		assert.equal(isCodeRemarquable('AN1-DEPOT'), true);
		assert.equal(isCodeRemarquable('SN1-DEPOT'), true);
		assert.equal(isCodeRemarquable('AN1-DEBATS-DEC'), true);
		assert.equal(isCodeRemarquable('SN1-DEBATS-DEC'), true);
		assert.equal(isCodeRemarquable('AN2-DEBATS-DEC'), true);
		assert.equal(isCodeRemarquable('SN2-DEBATS-DEC'), true);
		assert.equal(isCodeRemarquable('ANLUNI-DEBATS-DEC'), true);
		assert.equal(isCodeRemarquable('ANNLEC-DEBATS-DEC'), true);
		assert.equal(isCodeRemarquable('CMP-DEPOT'), true);
		assert.equal(isCodeRemarquable('CMP-DEC'), true);
		assert.equal(isCodeRemarquable('CMP-DEBATS-AN-DEC'), true);
		assert.equal(isCodeRemarquable('CMP-DEBATS-SN-DEC'), true);
		assert.equal(isCodeRemarquable('CC-SAISIE-AN'), true);
		assert.equal(isCodeRemarquable('CC-CONCLUSION'), true);
		assert.equal(isCodeRemarquable('PROM-PUB'), true);
		assert.equal(isCodeRemarquable('AN21-MOTION-VOTE'), true);
		assert.equal(isCodeRemarquable('AN21-DGVT'), true);
		assert.equal(isCodeRemarquable('AN1-RTRINI'), true);
	});

	test('Codes ignorés : procédure interne, commissions, rapports', () => {
		assert.equal(isCodeRemarquable('AN1'), false); // racine
		assert.equal(isCodeRemarquable('AN1-COM'), false);
		assert.equal(isCodeRemarquable('AN1-COM-FOND'), false);
		assert.equal(isCodeRemarquable('AN1-COM-FOND-SAISIE'), false);
		assert.equal(isCodeRemarquable('AN1-COM-FOND-NOMIN'), false);
		assert.equal(isCodeRemarquable('AN1-COM-FOND-REUNION'), false);
		assert.equal(isCodeRemarquable('AN1-COM-FOND-RAPPORT'), false);
		assert.equal(isCodeRemarquable('AN1-DEBATS'), false); // mais AN1-DEBATS-DEC ok
		assert.equal(isCodeRemarquable('AN1-DEBATS-SEANCE'), false); // mais DEC ok
		assert.equal(isCodeRemarquable('AN1-PROCACC'), false);
		assert.equal(isCodeRemarquable('AN20-RAPPORT'), false);
		assert.equal(isCodeRemarquable('AN20-MISINF-CREA'), false);
	});

	test('Codes inconnus : false', () => {
		assert.equal(isCodeRemarquable('XYZ-INCONNU'), false);
		assert.equal(isCodeRemarquable(''), false);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// codeToChambre
// ────────────────────────────────────────────────────────────────────────────

describe('codeToChambre — détermine la chambre/instance', () => {
	test('AN', () => {
		assert.equal(codeToChambre('AN1-DEPOT'), 'AN');
		assert.equal(codeToChambre('AN1-DEBATS-DEC'), 'AN');
		assert.equal(codeToChambre('AN2-DEBATS-DEC'), 'AN');
		assert.equal(codeToChambre('ANLUNI-DEBATS-DEC'), 'AN');
		assert.equal(codeToChambre('ANNLEC-DEBATS-SEANCE'), 'AN');
		assert.equal(codeToChambre('ANLDEF-COM-FOND-REUNION'), 'AN');
		assert.equal(codeToChambre('AN21-MOTION-VOTE'), 'AN');
		assert.equal(codeToChambre('AN21-DGVT'), 'AN');
		assert.equal(codeToChambre('AN1-RTRINI'), 'AN');
	});

	test('SEN', () => {
		assert.equal(codeToChambre('SN1-DEPOT'), 'SEN');
		assert.equal(codeToChambre('SN1-DEBATS-DEC'), 'SEN');
		assert.equal(codeToChambre('SN2-DEBATS-DEC'), 'SEN');
	});

	test('CMP — DEBATS-AN/SN sont attribués à la chambre correspondante', () => {
		assert.equal(codeToChambre('CMP-DEPOT'), 'CMP');
		assert.equal(codeToChambre('CMP-DEC'), 'CMP');
		assert.equal(codeToChambre('CMP-DEBATS-AN-DEC'), 'AN');
		assert.equal(codeToChambre('CMP-DEBATS-SN-DEC'), 'SEN');
	});

	test('CC', () => {
		assert.equal(codeToChambre('CC-SAISIE-AN'), 'CC');
		assert.equal(codeToChambre('CC-CONCLUSION'), 'CC');
	});

	test('JO — promulgation', () => {
		assert.equal(codeToChambre('PROM-PUB'), 'JO');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// codeToPhase
// ────────────────────────────────────────────────────────────────────────────

describe('codeToPhase — classification éditoriale', () => {
	test('depot', () => {
		assert.equal(codeToPhase('AN1-DEPOT'), 'depot');
		assert.equal(codeToPhase('SN1-DEPOT'), 'depot');
	});

	test('premiere-lecture', () => {
		assert.equal(codeToPhase('AN1-DEBATS-DEC'), 'premiere-lecture');
		assert.equal(codeToPhase('SN1-DEBATS-DEC'), 'premiere-lecture');
	});

	test('deuxieme-lecture', () => {
		assert.equal(codeToPhase('AN2-DEBATS-DEC'), 'deuxieme-lecture');
		assert.equal(codeToPhase('SN2-DEBATS-DEC'), 'deuxieme-lecture');
	});

	test('lecture-unique', () => {
		assert.equal(codeToPhase('ANLUNI-DEBATS-DEC'), 'lecture-unique');
	});

	test('nouvelle-lecture', () => {
		assert.equal(codeToPhase('ANNLEC-DEBATS-DEC'), 'nouvelle-lecture');
	});

	test('cmp', () => {
		assert.equal(codeToPhase('CMP-DEPOT'), 'cmp');
		assert.equal(codeToPhase('CMP-DEC'), 'cmp');
		assert.equal(codeToPhase('CMP-DEBATS-AN-DEC'), 'cmp');
		assert.equal(codeToPhase('CMP-DEBATS-SN-DEC'), 'cmp');
	});

	test('conseil-constitutionnel', () => {
		assert.equal(codeToPhase('CC-SAISIE-AN'), 'conseil-constitutionnel');
		assert.equal(codeToPhase('CC-CONCLUSION'), 'conseil-constitutionnel');
	});

	test('promulgation', () => {
		assert.equal(codeToPhase('PROM-PUB'), 'promulgation');
	});

	test('engagement-responsabilite (49.3)', () => {
		assert.equal(codeToPhase('AN21-DGVT'), 'engagement-responsabilite');
		assert.equal(codeToPhase('ANNLEC-DGVT'), 'engagement-responsabilite');
		assert.equal(codeToPhase('ANLDEF-DGVT'), 'engagement-responsabilite');
	});

	test('motion-censure', () => {
		assert.equal(codeToPhase('AN21-MOTION-VOTE'), 'motion-censure');
		assert.equal(codeToPhase('ANNLEC-MOTION-VOTE'), 'motion-censure');
	});

	test('retrait', () => {
		assert.equal(codeToPhase('AN1-RTRINI'), 'retrait');
		assert.equal(codeToPhase('ANLUNI-RTRINI'), 'retrait');
	});

	test('autre', () => {
		assert.equal(codeToPhase('UNKNOWN'), 'autre');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// codeToLabel
// ────────────────────────────────────────────────────────────────────────────

describe('codeToLabel — libellé UI lisible', () => {
	test('dépôts mentionnent la chambre', () => {
		assert.match(codeToLabel('AN1-DEPOT'), /[Dd]épôt.*Assembl|[Dd]épôt.*AN/);
		assert.match(codeToLabel('SN1-DEPOT'), /[Dd]épôt.*S[ée]nat/);
	});

	test('votes en séance', () => {
		assert.match(codeToLabel('AN1-DEBATS-DEC'), /lecture/i);
		assert.match(codeToLabel('SN1-DEBATS-DEC'), /lecture/i);
	});

	test('CMP', () => {
		assert.match(codeToLabel('CMP-DEC'), /CMP|paritaire/i);
	});

	test('promulgation', () => {
		assert.match(codeToLabel('PROM-PUB'), /[Pp]romulg/);
	});

	test('49.3', () => {
		assert.match(codeToLabel('AN21-DGVT'), /49\.3|responsabilit/i);
	});

	test('motion de censure', () => {
		assert.match(codeToLabel('AN21-MOTION-VOTE'), /motion.*censure/i);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// extractTimelineNavette — parsing récursif et filtrage
// ────────────────────────────────────────────────────────────────────────────

function noeud(code: string, date: string | null, children: ActeRaw[] = []): ActeRaw {
	return {
		codeActe: code,
		dateActe: date ? `${date}T00:00:00.000+01:00` : null,
		actesLegislatifs: children.length ? { acteLegislatif: children } : undefined
	};
}

describe('extractTimelineNavette — parsing récursif', () => {
	test('Arbre simple : un seul acte remarquable au niveau racine', () => {
		const tree: ActeRaw[] = [noeud('AN1-DEPOT', '2025-01-08')];
		const timeline = extractTimelineNavette(tree);
		assert.equal(timeline.length, 1);
		assert.equal(timeline[0].code, 'AN1-DEPOT');
		assert.equal(timeline[0].date, '2025-01-08');
	});

	test('Arbre profond : descend dans actesLegislatifs.acteLegislatif récursivement', () => {
		const tree: ActeRaw[] = [
			noeud('AN1', null, [
				noeud('AN1-DEPOT', '2025-01-08'),
				noeud('AN1-COM', null, [noeud('AN1-COM-FOND', null, [noeud('AN1-COM-FOND-SAISIE', '2025-01-09')])]),
				noeud('AN1-DEBATS', null, [noeud('AN1-DEBATS-DEC', '2025-01-22')])
			])
		];
		const timeline = extractTimelineNavette(tree);
		// Seuls AN1-DEPOT et AN1-DEBATS-DEC sont remarquables
		assert.equal(timeline.length, 2);
		assert.equal(timeline[0].code, 'AN1-DEPOT');
		assert.equal(timeline[1].code, 'AN1-DEBATS-DEC');
	});

	test('Cas PJL Mayotte : timeline complète avec CMP', () => {
		const tree: ActeRaw[] = [
			noeud('AN1', null, [
				noeud('AN1-DEPOT', '2025-01-08'),
				noeud('AN1-DEBATS', null, [noeud('AN1-DEBATS-DEC', '2025-01-22')])
			]),
			noeud('SN1', null, [
				noeud('SN1-DEPOT', '2025-01-22'),
				noeud('SN1-DEBATS', null, [noeud('SN1-DEBATS-DEC', '2025-02-04')])
			]),
			noeud('CMP', null, [
				noeud('CMP-DEPOT', '2025-02-05'),
				noeud('CMP-DEC', '2025-02-10'),
				noeud('CMP-DEBATS-AN', null, [noeud('CMP-DEBATS-AN-DEC', '2025-02-12')]),
				noeud('CMP-DEBATS-SN', null, [noeud('CMP-DEBATS-SN-DEC', '2025-02-13')])
			]),
			noeud('PROM', null, [noeud('PROM-PUB', '2025-02-24')])
		];
		const timeline = extractTimelineNavette(tree);
		assert.equal(timeline.length, 9);
		const codes = timeline.map((t) => t.code);
		assert.deepEqual(codes, [
			'AN1-DEPOT',
			'AN1-DEBATS-DEC',
			'SN1-DEPOT',
			'SN1-DEBATS-DEC',
			'CMP-DEPOT',
			'CMP-DEC',
			'CMP-DEBATS-AN-DEC',
			'CMP-DEBATS-SN-DEC',
			'PROM-PUB'
		]);
	});

	test('Tri chronologique stable (deux actes même date conservent leur ordre)', () => {
		const tree: ActeRaw[] = [
			noeud('AN1-DEPOT', '2025-01-15'),
			noeud('PROM-PUB', '2025-01-01'),
			noeud('AN1-DEBATS-DEC', '2025-01-15')
		];
		const timeline = extractTimelineNavette(tree);
		assert.equal(timeline.length, 3);
		assert.equal(timeline[0].code, 'PROM-PUB'); // plus ancien d'abord
		assert.equal(timeline[1].code, 'AN1-DEPOT'); // même date, ordre source préservé
		assert.equal(timeline[2].code, 'AN1-DEBATS-DEC');
	});

	test('acteLegislatif peut être un objet seul (pas un tableau)', () => {
		// Etalab encode parfois un acte unique comme objet, sinon comme tableau
		const tree = {
			acteLegislatif: noeud('AN1-DEPOT', '2025-01-01')
		};
		// On accepte les deux formes en entrée
		const timeline = extractTimelineNavette(tree);
		assert.equal(timeline.length, 1);
		assert.equal(timeline[0].code, 'AN1-DEPOT');
	});

	test('Arbre vide / undefined → tableau vide', () => {
		assert.deepEqual(extractTimelineNavette(undefined), []);
		assert.deepEqual(extractTimelineNavette([]), []);
		assert.deepEqual(extractTimelineNavette({ acteLegislatif: undefined }), []);
	});

	test('Acte sans dateActe est ignoré (impossible de placer chrono)', () => {
		const tree: ActeRaw[] = [noeud('AN1-DEPOT', null), noeud('AN1-DEBATS-DEC', '2025-01-01')];
		const timeline = extractTimelineNavette(tree);
		assert.equal(timeline.length, 1);
		assert.equal(timeline[0].code, 'AN1-DEBATS-DEC');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// hasSenatActe — bicaméralité refondue (ADR 0037)
// ────────────────────────────────────────────────────────────────────────────

describe('hasSenatActe — détection bicaméralité fiable', () => {
	test('Timeline avec acte SN1-DEBATS-DEC → bicaméral', () => {
		const tree: ActeRaw[] = [
			noeud('AN1-DEPOT', '2025-01-01'),
			noeud('SN1-DEBATS-DEC', '2025-02-01')
		];
		const timeline = extractTimelineNavette(tree);
		assert.equal(hasSenatActe(timeline), true);
	});

	test('Timeline avec uniquement SN1-DEPOT (transmis Sénat, pas voté) → bicaméral', () => {
		// Cas du PJL transmis Sénat mais pas encore voté
		const tree: ActeRaw[] = [
			noeud('AN1-DEBATS-DEC', '2025-01-22'),
			noeud('SN1-DEPOT', '2025-01-22')
		];
		const timeline = extractTimelineNavette(tree);
		assert.equal(hasSenatActe(timeline), true, 'le dépôt Sénat compte comme passage');
	});

	test('Timeline AN-seul (pas de SN) → mono', () => {
		const tree: ActeRaw[] = [
			noeud('AN1-DEPOT', '2025-01-01'),
			noeud('AN1-DEBATS-DEC', '2025-01-15')
		];
		const timeline = extractTimelineNavette(tree);
		assert.equal(hasSenatActe(timeline), false);
	});

	test('CMP-DEBATS-SN-DEC compte aussi (chambre SEN attribuée)', () => {
		const tree: ActeRaw[] = [
			noeud('AN1-DEPOT', '2025-01-01'),
			noeud('CMP-DEBATS-SN-DEC', '2025-02-01')
		];
		const timeline = extractTimelineNavette(tree);
		assert.equal(hasSenatActe(timeline), true);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// resolveScrutinUid — croisement timeline ↔ scrutins nominaux
// ────────────────────────────────────────────────────────────────────────────

describe('resolveScrutinUid — matching avec scrutins solennels', () => {
	test('Acte AN1-DEBATS-DEC croisé avec scrutin AN solennel même date → uid trouvé', () => {
		const scrutinsAN: ScrutinSolennelIndex[] = [
			{ uid: 'V1', date: '2025-01-22', typeVote: 'scrutin public solennel', titre: "l'ensemble..." }
		];
		const acte: TimelineActe = {
			date: '2025-01-22',
			code: 'AN1-DEBATS-DEC',
			chambre: 'AN',
			phase: 'premiere-lecture',
			label: '...',
			scrutinUid: null,
			scrutinChambre: null
		};
		const res = resolveScrutinUid(acte, scrutinsAN, [], new Set(['V1']));
		assert.equal(res, 'V1');
	});

	test('Acte sans scrutin nominal à la même date → null (vote main levée)', () => {
		const acte: TimelineActe = {
			date: '2025-03-01',
			code: 'AN1-DEBATS-DEC',
			chambre: 'AN',
			phase: 'premiere-lecture',
			label: '...',
			scrutinUid: null,
			scrutinChambre: null
		};
		const res = resolveScrutinUid(acte, [], [], new Set());
		assert.equal(res, null);
	});

	test('Acte chambre SEN → cherche dans scrutins Sénat, pas AN', () => {
		const scrutinsAN: ScrutinSolennelIndex[] = [
			{ uid: 'AN-1', date: '2025-02-04', typeVote: 'scrutin public solennel', titre: '...' }
		];
		const scrutinsSEN: ScrutinSolennelIndex[] = [
			{ uid: '2024-58', date: '2025-02-04', typeVote: 'scrutin public solennel', titre: '...' }
		];
		const acte: TimelineActe = {
			date: '2025-02-04',
			code: 'SN1-DEBATS-DEC',
			chambre: 'SEN',
			phase: 'premiere-lecture',
			label: '...',
			scrutinUid: null,
			scrutinChambre: null
		};
		const res = resolveScrutinUid(acte, scrutinsAN, scrutinsSEN, new Set(['2024-58']));
		assert.equal(res, '2024-58');
	});

	test("Croise uniquement avec les scrutins du texte (filtre par scrutinsDuTexte)", () => {
		// Plusieurs scrutins même date mais un seul appartient au texte
		const scrutinsAN: ScrutinSolennelIndex[] = [
			{ uid: 'V1', date: '2025-01-22', typeVote: 'scrutin public solennel', titre: '...' },
			{ uid: 'V2', date: '2025-01-22', typeVote: 'scrutin public solennel', titre: '...' }
		];
		const acte: TimelineActe = {
			date: '2025-01-22',
			code: 'AN1-DEBATS-DEC',
			chambre: 'AN',
			phase: 'premiere-lecture',
			label: '...',
			scrutinUid: null,
			scrutinChambre: null
		};
		const res = resolveScrutinUid(acte, scrutinsAN, [], new Set(['V2']));
		assert.equal(res, 'V2', 'on retient le scrutin qui est dans le texte');
	});

	test('Acte CMP-DEBATS-AN-DEC est résolu côté AN (chambre AN attribuée)', () => {
		const scrutinsAN: ScrutinSolennelIndex[] = [
			{ uid: 'V-CMP', date: '2025-02-12', typeVote: 'scrutin public solennel', titre: '...' }
		];
		const acte: TimelineActe = {
			date: '2025-02-12',
			code: 'CMP-DEBATS-AN-DEC',
			chambre: 'AN',
			phase: 'cmp',
			label: '...',
			scrutinUid: null,
			scrutinChambre: null
		};
		const res = resolveScrutinUid(acte, scrutinsAN, [], new Set(['V-CMP']));
		assert.equal(res, 'V-CMP');
	});
});
