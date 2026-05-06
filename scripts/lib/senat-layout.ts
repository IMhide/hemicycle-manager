/**
 * Layout de l'hémicycle Sénat 348 sièges, adapté de Kurea/visu_senat (MIT).
 * Cf ADR 0026.
 *
 * Le projet Kurea reconstitue le placement réel des 348 sénateurs sur 9
 * couches concentriques. Ce module :
 *  1. Parse le tableau JS `layout` depuis le `index.html` Kurea (extrait via
 *     `parseLayoutFromKureaHtml`)
 *  2. Reproduit en TypeScript la trigonométrie de la fonction `buildHemicycle()`
 *     de Kurea (lignes 200-255 du commit du 2026-05-06) pour calculer les
 *     coordonnées finales de chaque siège
 *  3. Corrige une anomalie connue du layout source (siège 16 absent, 15 dupliqué)
 *
 * NOTE : pas d'I/O dans ce module, c'est une logique pure testable. L'I/O
 * (download Kurea, write JSON) est dans `scripts/extract-senat-seats.ts`.
 */

export interface SenatSeat {
	x: number;
	y: number;
	rotation: number; // degrés
}

export type SenatLayout = number[][][]; // 9 couches × N groupes × N sièges

/**
 * Extrait le tableau `const layout = [ ... ]` depuis le code source de
 * Kurea/visu_senat/index.html. Le parsing est strict : il jette si la
 * structure attendue n'est pas trouvée.
 */
export function parseLayoutFromKureaHtml(html: string): SenatLayout {
	// On cherche l'occurrence de `const layout = [` puis on tente de lire
	// jusqu'au `];` correspondant (avec balance de crochets).
	const startMarker = /const\s+layout\s*=\s*\[/;
	const startMatch = html.match(startMarker);
	if (!startMatch || startMatch.index === undefined) {
		throw new Error('parseLayoutFromKureaHtml: tableau `layout` introuvable dans le HTML source');
	}
	const startIdx = startMatch.index + startMatch[0].length - 1; // pointe sur le `[` ouvrant

	// Parcours brace-balanced.
	let depth = 0;
	let endIdx = -1;
	for (let i = startIdx; i < html.length; i++) {
		const c = html[i];
		if (c === '[') depth++;
		else if (c === ']') {
			depth--;
			if (depth === 0) {
				endIdx = i;
				break;
			}
		}
	}
	if (endIdx === -1) {
		throw new Error('parseLayoutFromKureaHtml: fin du tableau `layout` introuvable');
	}

	const arrayLiteral = html.slice(startIdx, endIdx + 1);

	// Le littéral est du JSON-compatible (uniquement des nombres et des
	// crochets). On parse en JSON après normalisation des espaces.
	let parsed: unknown;
	try {
		parsed = JSON.parse(arrayLiteral);
	} catch (err) {
		throw new Error(`parseLayoutFromKureaHtml: JSON.parse a échoué — ${(err as Error).message}`);
	}

	if (!Array.isArray(parsed)) {
		throw new Error('parseLayoutFromKureaHtml: la valeur extraite n\'est pas un tableau');
	}
	return parsed as SenatLayout;
}

/**
 * Corrige les anomalies du layout source Kurea avant calcul des coordonnées.
 * Anomalie connue (commit 2026-05-06 du Kurea/visu_senat) :
 *   - couche 1, groupe 0 : `[14, 15, 15, 17, 18, 19, 20]` — le siège 16 est
 *     absent et 15 dupliqué. On remplace la 2ᵉ occurrence de 15 par 16.
 */
function fixLayoutAnomalies(layout: SenatLayout): SenatLayout {
	// On clone puis on patch.
	const fixed: SenatLayout = layout.map((row) => row.map((group) => [...group]));
	const layer1Group0 = fixed[1]?.[0];
	if (
		layer1Group0 &&
		layer1Group0.length === 7 &&
		layer1Group0[0] === 14 &&
		layer1Group0[1] === 15 &&
		layer1Group0[2] === 15 &&
		layer1Group0[3] === 17
	) {
		layer1Group0[2] = 16;
	}
	return fixed;
}

/**
 * Reproduit la trigonométrie de `buildHemicycle()` de Kurea (commit 2026-05-06).
 * Hypothèses (par défaut, comme dans le source Kurea) :
 *  - containerWidth = 900px → centerX = 450, baseRadius = 135
 *  - radiusStep = 28px par couche
 *  - Arc de 180° à 360° (demi-cercle bas, perchoir en haut)
 *  - alleyWidthInSeats = 1, littleAlley = 0.7 (largeurs d'allées en unités siège)
 *
 * Renvoie un dict { [seatId: number]: { x, y, rotation } }. Les sièges 0
 * (placeholders dans le layout Kurea) sont ignorés. Les rotations sont en
 * degrés (radians × 180/π) compatibles `transform: rotate(Xdeg)` côté SVG/CSS.
 */
export function computeSenatSeats(htmlSource: string, opts?: { containerWidth?: number }) {
	const containerWidth = opts?.containerWidth ?? 900;
	const layout = fixLayoutAnomalies(parseLayoutFromKureaHtml(htmlSource));

	const centerX = containerWidth / 2;
	const baseRadius = containerWidth * 0.15;
	const radiusStep = 28;
	const maxRadius = baseRadius + (layout.length - 1) * radiusStep;
	const startAngle = 180;
	const endAngle = 360;
	const angleRange = endAngle - startAngle;
	const alleyWidthInSeats = 1;
	const littleAlley = 0.7;

	const seats: Record<number, SenatSeat> = {};

	layout.forEach((row, rowIndex) => {
		const currentRadius = baseRadius + rowIndex * radiusStep;
		const numSeatsInRow = row.flat().length;
		const numAlleys = row.length > 1 ? row.length - 1 : 0;
		const addSeat =
			numAlleys === 3
				? numAlleys * alleyWidthInSeats
				: 3 * alleyWidthInSeats + (numAlleys - 3) * littleAlley;
		const totalUnits = numSeatsInRow + addSeat;
		const anglePerUnit = angleRange / (totalUnits - 1);
		let currentUnit = 0;

		row.forEach((group, groupIndex) => {
			group.forEach((seatId) => {
				const angleDeg = startAngle + currentUnit * anglePerUnit;
				const angleRad = angleDeg * (Math.PI / 180);
				const x = centerX + currentRadius * Math.cos(angleRad);
				const y = maxRadius * 1.05 + currentRadius * Math.sin(angleRad);
				const rotation = angleDeg - 90;
				if (seatId !== 0) {
					seats[seatId] = { x, y, rotation };
				}
				currentUnit++;
			});
			if (groupIndex < row.length - 1) {
				if (numAlleys === 3) {
					currentUnit += alleyWidthInSeats;
				} else {
					currentUnit += groupIndex % 2 === 1 ? alleyWidthInSeats : littleAlley;
				}
			}
		});
	});

	return seats;
}

/**
 * Renvoie la viewBox SVG recommandée pour rendre le layout (basé sur
 * containerWidth=900). À utiliser comme `viewBox="…"` dans le composant
 * `HemicycleSenat.svelte`.
 */
export function senatViewBox(containerWidth = 900): string {
	const baseRadius = containerWidth * 0.15;
	const radiusStep = 28;
	const numLayers = 9;
	const maxRadius = baseRadius + (numLayers - 1) * radiusStep;
	const height = maxRadius * 1.2;
	return `0 0 ${containerWidth} ${height}`;
}
