import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	TRIENNATS,
	getTriennat,
	isTriennatId,
	triennatOfDate,
	triennatOfSesann,
	sessionsOfTriennat,
	triennatsOfPeriode,
	triennatEnCours,
	libelleTriennat,
	libelleTriennatLong
} from './triennats.ts';

describe('triennats — table figée (ADR 0028)', () => {
	it('expose 7 triennats', () => {
		assert.equal(TRIENNATS.length, 7);
	});

	it('a un seul triennat tronqué (2006-2008)', () => {
		const tronques = TRIENNATS.filter((t) => t.tronque);
		assert.equal(tronques.length, 1);
		assert.equal(tronques[0].id, '2006-2008');
	});

	it('a un seul triennat en cours (2023-2026)', () => {
		const enCours = TRIENNATS.filter((t) => t.enCours);
		assert.equal(enCours.length, 1);
		assert.equal(enCours[0].id, '2023-2026');
	});

	it('triennats contigus : la fin de chacun est le début du suivant', () => {
		for (let i = 0; i < TRIENNATS.length - 1; i++) {
			assert.equal(
				TRIENNATS[i].dateFin,
				TRIENNATS[i + 1].dateDebut,
				`gap entre ${TRIENNATS[i].id} et ${TRIENNATS[i + 1].id}`
			);
		}
	});

	it('séries renouvelées alternent (sauf premier triennat tronqué)', () => {
		// 2008→2011 : série 1 puis 2
		// 2011→2014 : série 2 puis 1
		// etc.
		const expectedFin: Array<1 | 2> = [1, 2, 1, 2, 1, 2, 1];
		TRIENNATS.forEach((t, i) => {
			assert.equal(t.serieRenouveleeFin, expectedFin[i], `triennat ${t.id} série fin`);
		});
	});
});

describe('getTriennat / isTriennatId', () => {
	it('getTriennat trouve un triennat par id', () => {
		assert.equal(getTriennat('2023-2026')?.anneeDebut, 2023);
		assert.equal(getTriennat('2017-2020')?.anneeFin, 2020);
	});

	it('getTriennat retourne null pour un id inconnu', () => {
		assert.equal(getTriennat('1999-2002'), null);
		assert.equal(getTriennat('foo'), null);
	});

	it('isTriennatId valide les id existants', () => {
		assert.equal(isTriennatId('2023-2026'), true);
		assert.equal(isTriennatId('2006-2008'), true);
	});

	it('isTriennatId rejette les id de format invalide ou inconnu', () => {
		assert.equal(isTriennatId('1999-2002'), false); // format ok mais inconnu
		assert.equal(isTriennatId('2023-26'), false); // format ko
		assert.equal(isTriennatId('foo'), false);
		assert.equal(isTriennatId(''), false);
	});
});

describe('triennatOfDate', () => {
	it('rattache une date au bon triennat (cas standard)', () => {
		assert.equal(triennatOfDate('2024-06-15')?.id, '2023-2026');
		assert.equal(triennatOfDate('2019-03-10')?.id, '2017-2020');
		assert.equal(triennatOfDate('2007-12-25')?.id, '2006-2008');
	});

	it('borne `[debut, fin)` : la date de renouvellement appartient au triennat suivant', () => {
		// 2023-09-24 = renouv. série 2 → début triennat 2023-2026
		assert.equal(triennatOfDate('2023-09-24')?.id, '2023-2026');
		// 2023-09-23 = veille du renouv. → encore dans 2020-2023
		assert.equal(triennatOfDate('2023-09-23')?.id, '2020-2023');
	});

	it('retourne null pour une date hors fenêtre couverte', () => {
		assert.equal(triennatOfDate('2005-01-01'), null);
		assert.equal(triennatOfDate('2030-01-01'), null);
	});
});

describe('triennatOfSesann', () => {
	it('rattache une session annuelle au bon triennat', () => {
		// session 2024-2025 (oct 2024 → sept 2025) → 2023-2026
		assert.equal(triennatOfSesann(2024)?.id, '2023-2026');
		// session 2017-2018 (oct 2017 → sept 2018) → 2017-2020
		assert.equal(triennatOfSesann(2017)?.id, '2017-2020');
		// session 2006-2007 (oct 2006 → sept 2007) → 2006-2008
		assert.equal(triennatOfSesann(2006)?.id, '2006-2008');
	});

	it('aucune session ne chevauche deux triennats (renouv. en septembre)', () => {
		// pour chaque sesann couverte, on doit retomber sur exactement 1 triennat
		for (let s = 2006; s <= 2025; s++) {
			const t = triennatOfSesann(s);
			assert.ok(t, `session ${s} doit appartenir à un triennat`);
		}
	});
});

describe('sessionsOfTriennat', () => {
	it('triennat tronqué 2006-2008 contient 2 sessions [2006, 2007]', () => {
		assert.deepEqual(sessionsOfTriennat('2006-2008'), [2006, 2007]);
	});

	it('triennat complet 2017-2020 contient 3 sessions [2017, 2018, 2019]', () => {
		assert.deepEqual(sessionsOfTriennat('2017-2020'), [2017, 2018, 2019]);
	});

	it('triennat en cours 2023-2026 contient 3 sessions [2023, 2024, 2025]', () => {
		assert.deepEqual(sessionsOfTriennat('2023-2026'), [2023, 2024, 2025]);
	});

	it('id inconnu retourne []', () => {
		assert.deepEqual(sessionsOfTriennat('1999-2002'), []);
	});
});

describe('triennatsOfPeriode (mandats sénatoriaux)', () => {
	it('mandat complet 2017-09-24 → 2023-09-24 chevauche 2 triennats (cas canonique)', () => {
		const t = triennatsOfPeriode('2017-09-24', '2023-09-24');
		assert.deepEqual(
			t.map((x) => x.id),
			['2017-2020', '2020-2023']
		);
	});

	it('mandat fragmenté (suppléant 2019 → 2023) chevauche 2 triennats', () => {
		const t = triennatsOfPeriode('2019-06-01', '2023-09-24');
		assert.deepEqual(
			t.map((x) => x.id),
			['2017-2020', '2020-2023']
		);
	});

	it('mandat partiel court (2018-2019) chevauche 1 seul triennat', () => {
		const t = triennatsOfPeriode('2018-05-01', '2019-12-31');
		assert.deepEqual(
			t.map((x) => x.id),
			['2017-2020']
		);
	});

	it('mandat ouvert (sans fin) jusqu\'à aujourd\'hui couvre triennat en cours', () => {
		const t = triennatsOfPeriode('2020-09-27', null);
		const ids = t.map((x) => x.id);
		assert.ok(ids.includes('2020-2023'));
		assert.ok(ids.includes('2023-2026'));
	});

	it('cas extrême : un mandat couvrant 3 triennats consécutifs', () => {
		// imaginaire mais possible avec succession titulaire + suppléant + réélection
		const t = triennatsOfPeriode('2014-09-28', '2023-09-24');
		assert.deepEqual(
			t.map((x) => x.id),
			['2014-2017', '2017-2020', '2020-2023']
		);
	});
});

describe('triennatEnCours', () => {
	it('retourne le triennat en cours', () => {
		assert.equal(triennatEnCours()?.id, '2023-2026');
	});
});

describe('libellés', () => {
	it('libelleTriennat = id', () => {
		assert.equal(libelleTriennat('2023-2026'), '2023-2026');
	});

	it('libelleTriennatLong préfixe par "Triennat"', () => {
		assert.equal(libelleTriennatLong('2023-2026'), 'Triennat 2023-2026');
	});
});
