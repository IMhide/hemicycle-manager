import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	findActeFinal,
	findScrutinFinalUid,
	findScrutinFinalUidForTexte,
	findScrutinSurEnsemble,
	isTitreVoteSurEnsemble
} from './vote-final.ts';
import type { ScrutinIndex, TimelineActe } from './types.ts';

function scrutin(uid: string, titre: string, date = '2024-01-01'): ScrutinIndex {
	return {
		uid,
		legislature: 16,
		numero: 1,
		date,
		titre,
		sort: 'adopté',
		pour: 100,
		contre: 50,
		abstention: 10,
		demandeur: null,
		texteId: 't1'
	};
}

function acte(code: string, scrutinUid: string | null = null, date = '2024-01-01'): TimelineActe {
	return {
		date,
		code,
		chambre: 'AN',
		phase: 'autre',
		label: code,
		scrutinUid,
		scrutinChambre: scrutinUid ? 'AN' : null
	};
}

describe('findActeFinal', () => {
	it('retourne null sur timeline vide', () => {
		assert.equal(findActeFinal([]), null);
	});

	it('retourne null si aucun code AN final présent', () => {
		const tl = [acte('AN1-DEPOT'), acte('SN1-DEBATS-DEC', 's1')];
		assert.equal(findActeFinal(tl), null);
	});

	it('priorité ANLDEF > CMP-DEBATS-AN-DEC', () => {
		const tl = [
			acte('AN1-DEBATS-DEC', 's1'),
			acte('CMP-DEBATS-AN-DEC', 's2'),
			acte('ANLDEF-DEBATS-DEC', 's3')
		];
		assert.equal(findActeFinal(tl)?.code, 'ANLDEF-DEBATS-DEC');
	});

	it('priorité CMP-DEBATS-AN-DEC > ANNLEC', () => {
		const tl = [
			acte('AN1-DEBATS-DEC', 's1'),
			acte('ANNLEC-DEBATS-DEC', 's2'),
			acte('CMP-DEBATS-AN-DEC', 's3')
		];
		assert.equal(findActeFinal(tl)?.code, 'CMP-DEBATS-AN-DEC');
	});

	it('fallback AN1-DEBATS-DEC quand aucune lecture ultérieure', () => {
		const tl = [acte('AN1-DEPOT'), acte('AN1-DEBATS-DEC', 's1')];
		assert.equal(findActeFinal(tl)?.code, 'AN1-DEBATS-DEC');
	});

	it('lecture unique reconnue', () => {
		const tl = [acte('AN1-DEPOT'), acte('ANLUNI-DEBATS-DEC', 's1')];
		assert.equal(findActeFinal(tl)?.code, 'ANLUNI-DEBATS-DEC');
	});

	it('ignore les votes Sénat purs', () => {
		const tl = [acte('SN1-DEBATS-DEC', 's1'), acte('SN2-DEBATS-DEC', 's2')];
		assert.equal(findActeFinal(tl), null);
	});

	it('saute un acte prioritaire SANS scrutinUid au profit d\'un acte moins prioritaire AVEC scrutinUid', () => {
		// Cas réel : loi souveraineté agricole DLR5L16N49726
		// CMP-DEBATS-AN-DEC à main levée (pas de scrutinUid), AN1-DEBATS-DEC nominal
		const tl = [
			acte('AN1-DEBATS-DEC', 's3966'),
			acte('CMP-DEBATS-AN-DEC', null) // vote à main levée
		];
		const found = findActeFinal(tl);
		assert.equal(found?.code, 'AN1-DEBATS-DEC');
		assert.equal(found?.scrutinUid, 's3966');
	});

	it('retombe sur l\'acte prioritaire sans scrutin si aucun acte n\'a de scrutinUid', () => {
		const tl = [acte('AN1-DEBATS-DEC', null), acte('CMP-DEBATS-AN-DEC', null)];
		// Cascade : CMP prioritaire, donc on retombe sur lui même sans scrutin
		assert.equal(findActeFinal(tl)?.code, 'CMP-DEBATS-AN-DEC');
	});
});

describe('findScrutinFinalUid', () => {
	it('retourne le scrutinUid de l\'acte prioritaire', () => {
		const tl = [
			acte('AN1-DEBATS-DEC', 's1'),
			acte('CMP-DEBATS-AN-DEC', 's2'),
			acte('ANLDEF-DEBATS-DEC', 's3')
		];
		assert.equal(findScrutinFinalUid(tl), 's3');
	});

	it('retourne null si l\'acte final est sans scrutin (vote à main levée)', () => {
		const tl = [acte('AN1-DEBATS-DEC', null)];
		assert.equal(findScrutinFinalUid(tl), null);
	});

	it('retourne null si pas d\'acte final', () => {
		assert.equal(findScrutinFinalUid([]), null);
	});
});

describe('isTitreVoteSurEnsemble', () => {
	it('matche projet de loi', () => {
		assert.ok(isTitreVoteSurEnsemble("l'ensemble du projet de loi d'orientation pour la souveraineté"));
	});
	it('matche proposition de loi', () => {
		assert.ok(isTitreVoteSurEnsemble("l'ensemble de la proposition de loi visant à protéger"));
	});
	it('matche projet de loi organique', () => {
		assert.ok(isTitreVoteSurEnsemble("l'ensemble du projet de loi organique modifiant"));
	});
	it('matche apostrophe typographique', () => {
		assert.ok(isTitreVoteSurEnsemble('l’ensemble du projet de loi'));
	});
	it('rejette amendement', () => {
		assert.equal(isTitreVoteSurEnsemble("l'amendement n° 916 à l'article 3"), false);
	});
	it('rejette article', () => {
		assert.equal(isTitreVoteSurEnsemble("l'article 5 du projet de loi"), false);
	});
	it('rejette motion', () => {
		assert.equal(isTitreVoteSurEnsemble('la motion de rejet préalable'), false);
	});
});

describe('findScrutinSurEnsemble', () => {
	it('retourne le plus récent quand plusieurs lectures', () => {
		const list = [
			scrutin('s1', "l'ensemble du projet de loi", '2024-01-10'),
			scrutin('s2', "l'ensemble du projet de loi", '2024-06-20'),
			scrutin('s3', "l'amendement n° 5", '2024-08-01')
		];
		assert.equal(findScrutinSurEnsemble(list)?.uid, 's2');
	});
	it('retourne null si aucun match', () => {
		const list = [scrutin('s1', "l'amendement n° 1"), scrutin('s2', "l'article 3")];
		assert.equal(findScrutinSurEnsemble(list), null);
	});
});

describe('findScrutinFinalUidForTexte', () => {
	it('privilégie la timeline quand disponible', () => {
		const tl = [acte('ANLDEF-DEBATS-DEC', 'timeline-uid')];
		const sc = [scrutin('fallback-uid', "l'ensemble du projet de loi")];
		assert.equal(findScrutinFinalUidForTexte(tl, sc), 'timeline-uid');
	});
	it('utilise le fallback titre si timeline vide', () => {
		const sc = [scrutin('fb-uid', "l'ensemble du projet de loi")];
		assert.equal(findScrutinFinalUidForTexte([], sc), 'fb-uid');
	});
	it('utilise le fallback si timeline présente mais sans acte final reconnu', () => {
		const tl = [acte('SN1-DEBATS-DEC', 'sn-uid')]; // Sénat pur, ignoré côté AN
		const sc = [scrutin('fb-uid', "l'ensemble du projet de loi")];
		assert.equal(findScrutinFinalUidForTexte(tl, sc), 'fb-uid');
	});
	it('retourne null si ni timeline AN ni titre ensemble', () => {
		const sc = [scrutin('s1', "l'amendement n° 1")];
		assert.equal(findScrutinFinalUidForTexte([], sc), null);
	});
});
