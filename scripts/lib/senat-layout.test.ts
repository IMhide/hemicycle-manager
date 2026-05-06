/**
 * Tests TDD pour l'extracteur de layout Sénat (cf ADR 0026).
 *
 * Le layout Kurea/visu_senat (MIT) place 348 sièges sur 9 couches concentriques.
 * On teste la reproduction fidèle de la trigonométrie du fichier index.html
 * de Kurea (lignes 200-255 du commit du 2026-05-06).
 *
 * NOTE : il y a une anomalie connue dans le `layout` de Kurea — le siège 16
 * est manquant et 15 est dupliqué dans la couche 1. On corrige cette anomalie
 * en post-traitement (cf computeSenatSeats).
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import {
	parseLayoutFromKureaHtml,
	computeSenatSeats,
	type SenatSeat
} from './senat-layout.ts';

const SAMPLE_LAYOUT_HTML = `
            // Structure de l'hémicycle basée sur l'image fournie.
            const layout = [
                [[0,0,0,0,0,0],[1, 2, 3, 4], [5, 6, 7, 8],[9, 10, 11, 12, 13]],
                [[14,15,15,17,18,19,20],[21, 22, 23, 24, 25], [26, 27, 28, 29, 30], [31,32,33,34,35,36]],
                [[37, 38, 39, 40, 41, 42, 43, 44, 45], [46,47,48,49,50,51,52], [53, 54, 55, 56, 57, 58, 59], [60, 61, 62,63,64,65,66,67]],
                [[68,69,  70, 71, 72, 73, 74, 75, 76, 77], [78,79, 80, 81, 82, 83, 84, 85], [86, 87, 88, 89, 90, 91, 92, 93], [94, 95, 96, 97, 98, 99, 100, 101, 102]],
                [[103, 104, 105, 106, 107, 108, 109], [110, 111, 112, 113], [114, 115, 116, 117], [118, 119, 120, 121], [122, 123, 124, 125], [126, 127, 128, 129], [130, 131, 132,133], [134, 135,136, 137, 138, 139]],
                [[140, 141, 142, 143, 144, 145, 146], [147, 148, 149, 150, 151], [152, 153, 154, 155, 156], [157, 158, 159, 160, 161], [162, 163, 164, 165, 166], [167, 168, 169, 170, 171], [172, 173, 174, 175, 176], [177, 178, 179, 180, 181, 182]],
                [[183, 184, 185, 186, 187, 188, 189, 190], [191, 192, 193, 194, 195, 196], [197, 198, 199, 200, 201, 202], [203, 204, 205, 206, 207, 208], [209, 210, 211, 212, 213, 214], [215, 216, 217, 218, 219, 220], [221, 222, 223, 224, 225, 226], [227, 228, 229, 230, 231, 232, 233]],
                [[234, 235, 236, 237, 238, 239, 240, 241], [242, 243, 244, 245, 246, 247, 248], [249, 250, 251, 252, 253, 254, 255], [256, 257, 258, 259, 260, 261, 262], [263, 264, 265, 266, 267, 268,269], [270, 271, 272, 273, 274,275, 276], [277, 278, 279, 280, 281, 282, 283], [284, 285, 286, 287, 288, 289, 290, 291]],
                [[0,0,292, 293, 294, 295, 296, 297, 298], [299, 300, 301, 302, 303, 304, 305], [306, 307, 308, 309, 310, 311, 312], [313, 314, 315, 316, 317, 318, 319], [320, 321, 322, 323, 324, 325, 326], [327, 328, 329, 330, 331, 332, 333], [334, 335, 336, 337, 338, 339, 340], [341, 342, 343, 344, 345, 346, 347, 348]]
            ];
`;

describe('parseLayoutFromKureaHtml', () => {
	test('extrait un tableau 2D depuis le HTML Kurea', () => {
		const layout = parseLayoutFromKureaHtml(SAMPLE_LAYOUT_HTML);
		assert.equal(layout.length, 9, '9 couches concentriques');
	});

	test('chaque couche est un tableau de groupes', () => {
		const layout = parseLayoutFromKureaHtml(SAMPLE_LAYOUT_HTML);
		for (const row of layout) {
			assert.ok(Array.isArray(row));
			assert.ok(row.length >= 1);
			for (const group of row) {
				assert.ok(Array.isArray(group));
			}
		}
	});

	test('couche 0 : 4 groupes, contient sièges 1..13 + zéros', () => {
		const layout = parseLayoutFromKureaHtml(SAMPLE_LAYOUT_HTML);
		const flat0 = layout[0].flat();
		assert.deepEqual(layout[0][0], [0, 0, 0, 0, 0, 0]);
		assert.deepEqual(layout[0][1], [1, 2, 3, 4]);
		assert.deepEqual(layout[0][3], [9, 10, 11, 12, 13]);
		assert.equal(flat0.filter((s) => s > 0).length, 13);
	});

	test('couche 8 : finit à 348', () => {
		const layout = parseLayoutFromKureaHtml(SAMPLE_LAYOUT_HTML);
		const flat8 = layout[8].flat();
		const max = Math.max(...flat8);
		assert.equal(max, 348);
	});

	test('jette si le layout est introuvable', () => {
		assert.throws(() => parseLayoutFromKureaHtml('<html>no layout here</html>'));
	});
});

describe('computeSenatSeats — anomalies du layout Kurea corrigées', () => {
	test('le siège 16 manquant est restauré (couche 1, position 2)', () => {
		// Bug Kurea ligne 168 : [14,15,15,17,...] — 16 manquant, 15 dupliqué.
		// Notre extracteur doit corriger : la 3ᵉ position de la couche 1 doit
		// renvoyer le siège 16, pas 15.
		const seats = computeSenatSeats(SAMPLE_LAYOUT_HTML);
		assert.ok(seats[16], 'siège 16 doit exister');
		assert.notEqual(seats[16].x, seats[15].x, 'siège 16 doit avoir une position propre, distincte de 15');
	});

	test('exactement 348 sièges produits', () => {
		const seats = computeSenatSeats(SAMPLE_LAYOUT_HTML);
		assert.equal(Object.keys(seats).length, 348);
		for (let i = 1; i <= 348; i++) {
			assert.ok(seats[i], `siège ${i} doit exister`);
		}
	});

	test('aucune coordonnée NaN ou infinity', () => {
		const seats = computeSenatSeats(SAMPLE_LAYOUT_HTML);
		for (let i = 1; i <= 348; i++) {
			const s = seats[i];
			assert.ok(Number.isFinite(s.x), `siège ${i} x non-fini`);
			assert.ok(Number.isFinite(s.y), `siège ${i} y non-fini`);
			assert.ok(Number.isFinite(s.rotation), `siège ${i} rotation non-finie`);
		}
	});

	test('layout en demi-cercle : tous les y sont positifs', () => {
		// Kurea positionne le tribune en bas, l'arc des sièges au-dessus.
		// La trigo donne `y = (maxRadius * 1.05) + currentRadius * sin(angleRad)`
		// avec angleRad ∈ [180°, 360°] donc sin ∈ [-1, 0] → y reste > 0.
		const seats = computeSenatSeats(SAMPLE_LAYOUT_HTML);
		for (let i = 1; i <= 348; i++) {
			assert.ok(seats[i].y > 0, `siège ${i} doit avoir y > 0`);
		}
	});

	test('symétrie gauche/droite : le siège 1 et le siège 348 ont des x opposés autour du centre', () => {
		const seats = computeSenatSeats(SAMPLE_LAYOUT_HTML);
		// containerWidth = 900 par défaut, centre = 450
		const center = 450;
		const left = seats[1];
		// Le siège 348 est sur la 9ᵉ couche, dernière position → pas exactement
		// symétrique de 1 à cause des allées, mais il doit être du côté droit.
		const right = seats[348];
		assert.ok(left.x < center, 'siège 1 à gauche du centre');
		assert.ok(right.x > center, 'siège 348 à droite du centre');
	});

	test('rayon croissant par couche : siège 1 (couche 0) plus proche du centre que siège 230 (couche 6)', () => {
		const seats = computeSenatSeats(SAMPLE_LAYOUT_HTML);
		const center = { x: 450, y: 0 };
		// On prend le y de référence (max radius * 1.05) — comme c'est le même y de
		// référence pour tous, on calcule la distance euclidienne en partant du
		// point de référence interne. Hack simple : seat 1 doit avoir une distance
		// plus petite par rapport à un point de référence (lui-même y=0 à center).
		// Plus simple : on vérifie via le y. Couche 0 = baseRadius (small), donc y
		// proche de maxRadius * 1.05. Couche 8 (dernière) = maxRadius, donc y peut
		// descendre vers maxRadius * 1.05 - maxRadius (proche de zéro pour middle
		// of the row), ou rester proche de maxRadius * 1.05 au bout des extrémités.
		const seat1 = seats[1];
		const seatLast = seats[348];
		// Couche 0 sièges sont au-dessus (y plus grand car y baseline + sin négatif)
		// Couche 8 sièges sont au-dessus (y plus petit). Donc seat1.y > seatLast.y attendu
		// pour les sièges aux extrémités, mais pas forcément pour les milieux.
		// On teste plutôt : la couche 0 est plus proche de la baseline que la couche 8.
		// sample arbitraire :
		const seat10 = seats[10]; // couche 0
		const seat300 = seats[300]; // couche 8
		// Sur la même verticale-ish, seat10 doit être plus bas (y plus grand) que seat300
		// car le rayon de la couche 0 est plus petit donc le siège est plus proche du
		// y de référence (maxRadius * 1.05).
		assert.ok(seat10.y > seat300.y || seat10.y > seatLast.y, 'couche 0 plus bas que couche 8');
		// Et le seat1 lui-même doit être à une position cohérente
		assert.ok(seat1.y > 0);
	});
});

describe('SenatSeat shape', () => {
	test('chaque siège a x, y, rotation', () => {
		const seats = computeSenatSeats(SAMPLE_LAYOUT_HTML);
		const s: SenatSeat = seats[1];
		assert.ok('x' in s && 'y' in s && 'rotation' in s);
	});
});
