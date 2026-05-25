import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isVoteActe, mainLeveeSuffix } from './main-levee.ts';
import type { TimelineActe } from './types.ts';

function acte(partial: Partial<TimelineActe> & { code: string; date: string }): TimelineActe {
	return {
		date: partial.date,
		code: partial.code,
		chambre: partial.chambre ?? 'AN',
		phase: partial.phase ?? 'autre',
		label: partial.label ?? partial.code,
		scrutinUid: partial.scrutinUid ?? null,
		scrutinChambre: partial.scrutinChambre ?? null
	};
}

describe('isVoteActe', () => {
	it('reconnaît les votes en séance toutes lectures', () => {
		assert.equal(isVoteActe({ code: 'AN1-DEBATS-DEC' }), true);
		assert.equal(isVoteActe({ code: 'SN1-DEBATS-DEC' }), true);
		assert.equal(isVoteActe({ code: 'AN2-DEBATS-DEC' }), true);
		assert.equal(isVoteActe({ code: 'ANNLEC-DEBATS-DEC' }), true);
		assert.equal(isVoteActe({ code: 'ANLDEF-DEBATS-DEC' }), true);
		assert.equal(isVoteActe({ code: 'ANLUNI-DEBATS-DEC' }), true);
	});

	it('reconnaît les votes CMP en séance', () => {
		assert.equal(isVoteActe({ code: 'CMP-DEBATS-AN-DEC' }), true);
		assert.equal(isVoteActe({ code: 'CMP-DEBATS-SN-DEC' }), true);
	});

	it('reconnaît les motions de censure', () => {
		assert.equal(isVoteActe({ code: 'AN1-MOTION-VOTE' }), true);
	});

	it('rejette les dépôts, conclusions CMP, saisines, promulgation', () => {
		assert.equal(isVoteActe({ code: 'AN1-DEPOT' }), false);
		assert.equal(isVoteActe({ code: 'SN1-DEPOT' }), false);
		assert.equal(isVoteActe({ code: 'CMP-DEPOT' }), false);
		assert.equal(isVoteActe({ code: 'CMP-DEC' }), false); // conclusion CMP, pas un vote
		assert.equal(isVoteActe({ code: 'CC-SAISIE-PM' }), false);
		assert.equal(isVoteActe({ code: 'CC-CONCLUSION' }), false);
		assert.equal(isVoteActe({ code: 'PROM-PUB' }), false);
	});
});

describe('mainLeveeSuffix', () => {
	it('retourne vide quand un scrutinUid existe', () => {
		const timeline = [acte({ code: 'AN1-DEBATS-DEC', date: '2025-01-01', scrutinUid: 'VTAN-123' })];
		assert.equal(mainLeveeSuffix(timeline[0], 0, timeline, null), '');
	});

	it('retourne vide pour un dépôt ou une saisine', () => {
		const timeline = [
			acte({ code: 'AN1-DEPOT', date: '2025-01-01' }),
			acte({ code: 'CC-SAISIE-PM', date: '2025-02-01' })
		];
		assert.equal(mainLeveeSuffix(timeline[0], 0, timeline, null), '');
		assert.equal(mainLeveeSuffix(timeline[1], 1, timeline, null), '');
	});

	it('retourne "à main levée" pour une motion de censure (sort neutre)', () => {
		const t = acte({ code: 'AN1-MOTION-VOTE', date: '2025-03-01' });
		// Même promulgation ne suffit pas à présumer le sort d'une motion
		assert.equal(mainLeveeSuffix(t, 0, [t], '2025-04-01'), 'à main levée');
	});

	it('déduit "adopté à main levée" quand un acte ultérieur existe', () => {
		const timeline = [
			acte({ code: 'SN1-DEBATS-DEC', date: '2026-01-28' }),
			acte({ code: 'AN1-DEPOT', date: '2026-01-29' }) // suite de navette
		];
		assert.equal(mainLeveeSuffix(timeline[0], 0, timeline, null), 'adopté à main levée');
	});

	it('déduit "adopté à main levée" quand le texte est promulgué', () => {
		const timeline = [acte({ code: 'CMP-DEBATS-SN-DEC', date: '2026-05-07' })];
		assert.equal(mainLeveeSuffix(timeline[0], 0, timeline, '2026-05-09'), 'adopté à main levée');
	});

	it('reste sur "à main levée" si pas de suite ni promulgation', () => {
		const timeline = [acte({ code: 'AN1-DEBATS-DEC', date: '2025-06-01' })];
		assert.equal(mainLeveeSuffix(timeline[0], 0, timeline, null), 'à main levée');
	});

	it('reste sur "à main levée" si les actes suivants sont antérieurs (timeline malformée)', () => {
		// Cas pathologique : un seul acte de vote en fin de timeline, suivi de
		// rien — la garde `other.date >= acte.date && j > idx` doit tenir.
		const timeline = [
			acte({ code: 'SN1-DEPOT', date: '2025-01-01' }),
			acte({ code: 'AN1-DEBATS-DEC', date: '2025-06-01' })
		];
		assert.equal(mainLeveeSuffix(timeline[1], 1, timeline, null), 'à main levée');
	});

	it('cas réel — restitution biens culturels (3 actes main levée intercalés)', () => {
		// Reproduction simplifiée de DLR5L17N52635 (promulgué 2026-05-09)
		const timeline = [
			acte({ code: 'SN1-DEPOT', date: '2025-07-30' }),
			acte({ code: 'SN1-DEBATS-DEC', date: '2026-01-28' }), // main levée
			acte({ code: 'AN1-DEPOT', date: '2026-01-29' }),
			acte({ code: 'AN1-DEBATS-DEC', date: '2026-04-13', scrutinUid: 'VTAN-6180' }),
			acte({ code: 'CMP-DEPOT', date: '2026-04-14' }),
			acte({ code: 'CMP-DEC', date: '2026-04-30' }), // pas un vote
			acte({ code: 'CMP-DEBATS-AN-DEC', date: '2026-05-06', scrutinUid: 'VTAN-6346' }),
			acte({ code: 'CMP-DEBATS-SN-DEC', date: '2026-05-07' }), // main levée
			acte({ code: 'PROM-PUB', date: '2026-05-09' })
		];
		const prom = '2026-05-09';
		assert.equal(mainLeveeSuffix(timeline[1], 1, timeline, prom), 'adopté à main levée');
		assert.equal(mainLeveeSuffix(timeline[5], 5, timeline, prom), ''); // CMP-DEC pas un vote
		assert.equal(mainLeveeSuffix(timeline[7], 7, timeline, prom), 'adopté à main levée');
	});
});
