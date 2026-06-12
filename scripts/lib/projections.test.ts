/**
 * Tests TDD pour les projections lite + dénormalisation historique (ADR 0041).
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import {
	scrutinMetaIndex,
	denormaliseHistorique,
	recentScrutinsParLegislature
} from './projections.ts';
import type { ScrutinIndex, VoteHistoryItem } from '../../src/lib/types.ts';

function scrutin(over: Partial<ScrutinIndex> & { uid: string }): ScrutinIndex {
	return {
		uid: over.uid,
		legislature: over.legislature ?? 17,
		numero: over.numero ?? 1,
		date: over.date ?? '2026-01-01',
		titre: over.titre ?? 'Titre',
		sort: over.sort ?? 'adopté',
		pour: over.pour ?? 0,
		contre: over.contre ?? 0,
		abstention: over.abstention ?? 0,
		demandeur: over.demandeur ?? null,
		texteId: over.texteId ?? null
	};
}

// ────────────────────────────────────────────────────────────────────────────
// denormaliseHistorique — option A (tuple enrichi)
// ────────────────────────────────────────────────────────────────────────────

describe('denormaliseHistorique', () => {
	test('ajoute la meta du scrutin en 5e position', () => {
		const idx = scrutinMetaIndex([
			scrutin({ uid: 'V1', numero: 10, titre: 'Article 10', date: '2026-05-22', sort: 'adopté', texteId: 'DLR1', pour: 45, contre: 21, abstention: 8 })
		]);
		const hist: VoteHistoryItem[] = [['V1', 'pour', 0, 17]];
		const out = denormaliseHistorique(hist, idx);
		assert.equal(out[0].length, 5);
		const meta = out[0][4]!;
		assert.deepEqual(meta, {
			titre: 'Article 10',
			date: '2026-05-22',
			sort: 'adopté',
			numero: 10,
			texteId: 'DLR1',
			pour: 45,
			contre: 21,
			abstention: 8
		});
	});

	test('préserve les 4 premiers éléments (uid, position, fronde, leg)', () => {
		const idx = scrutinMetaIndex([scrutin({ uid: 'V2' })]);
		const out = denormaliseHistorique([['V2', 'contre', 1, 16]], idx);
		assert.equal(out[0][0], 'V2');
		assert.equal(out[0][1], 'contre');
		assert.equal(out[0][2], 1);
		assert.equal(out[0][3], 16);
	});

	test('uid inconnu de l’index → tuple laissé à 4 éléments (robustesse)', () => {
		const out = denormaliseHistorique([['V404', 'pour', 0, 17]], new Map());
		assert.equal(out[0].length, 4);
	});

	test('la meta porte numero mais PAS demandeur (champ lourd/inutile)', () => {
		const idx = scrutinMetaIndex([scrutin({ uid: 'V3', demandeur: 'un très long demandeur…', numero: 6899 })]);
		const out = denormaliseHistorique([['V3', 'pour', 0, 17]], idx);
		const meta = out[0][4]! as Record<string, unknown>;
		assert.ok(!('demandeur' in meta), 'demandeur exclu (verbeux)');
		assert.equal(meta.numero, 6899, 'numero présent (affiché n°XXXX)');
	});

	test('Sénat : scrnum est normalisé vers numero dans la meta', () => {
		// ScrutinSenatIndex n'a pas `numero` mais `scrnum`.
		const idx = scrutinMetaIndex([
			{ uid: '2024-58', titre: 'T', date: '2024-01-01', sort: 'adopté', texteId: null, pour: 1, contre: 0, abstention: 0, scrnum: 58 }
		]);
		const out = denormaliseHistorique([['2024-58', 'pour', 0, 2024]], idx);
		assert.equal((out[0][4]! as { numero: number }).numero, 58);
	});
});

// ────────────────────────────────────────────────────────────────────────────
// recentScrutinsParLegislature
// ────────────────────────────────────────────────────────────────────────────

describe('recentScrutinsParLegislature', () => {
	test('garde les scrutins dans la fenêtre de N jours', () => {
		const scrutins = [
			scrutin({ uid: 'A', legislature: 17, date: '2026-05-20' }),
			scrutin({ uid: 'B', legislature: 17, date: '2026-05-10' }),
			scrutin({ uid: 'C', legislature: 17, date: '2026-01-01' }) // hors fenêtre
		];
		const out = recentScrutinsParLegislature(scrutins, '2026-05-22', { joursRecents: 30, minParLeg: 8 });
		const uids = out.map((s) => s.uid);
		assert.ok(uids.includes('A'));
		assert.ok(uids.includes('B'));
		assert.ok(!uids.includes('C'), 'C hors fenêtre 30j');
	});

	test('plancher minParLeg quand la fenêtre est vide', () => {
		const scrutins = [
			scrutin({ uid: 'X', legislature: 15, date: '2018-01-03' }),
			scrutin({ uid: 'Y', legislature: 15, date: '2018-01-02' }),
			scrutin({ uid: 'Z', legislature: 15, date: '2018-01-01' })
		];
		const out = recentScrutinsParLegislature(scrutins, '2026-05-22', { joursRecents: 30, minParLeg: 2 });
		assert.equal(out.length, 2, 'plancher = 2 les plus récents');
		assert.deepEqual(out.map((s) => s.uid), ['X', 'Y']);
	});

	test('sépare par législature', () => {
		const scrutins = [
			scrutin({ uid: 'A17', legislature: 17, date: '2026-05-20' }),
			scrutin({ uid: 'A16', legislature: 16, date: '2024-01-01' })
		];
		const out = recentScrutinsParLegislature(scrutins, '2026-05-22', { joursRecents: 30, minParLeg: 8 });
		// 17 a un scrutin dans la fenêtre ; 16 retombe sur le plancher (1 dispo).
		assert.ok(out.some((s) => s.uid === 'A17'));
		assert.ok(out.some((s) => s.uid === 'A16'));
	});

	test('beaucoup plus petit que l’index complet', () => {
		// 1000 scrutins anciens + 3 récents → on ne garde que les 3 récents.
		const old = Array.from({ length: 1000 }, (_, i) =>
			scrutin({ uid: `old${i}`, legislature: 17, date: '2020-01-01' })
		);
		const recent = [
			scrutin({ uid: 'r1', legislature: 17, date: '2026-05-21' }),
			scrutin({ uid: 'r2', legislature: 17, date: '2026-05-20' })
		];
		// Entrée triée récent→ancien.
		const out = recentScrutinsParLegislature([...recent, ...old], '2026-05-22', { joursRecents: 30 });
		assert.equal(out.length, 2);
	});
});
