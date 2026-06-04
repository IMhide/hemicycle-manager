/**
 * Geometry of the French National Assembly hémicycle.
 *
 * Each deputy has an official seat number (1..650, with ~68 unused numbers
 * → 582 actual seats). The numbering is **sectoral**, not row-by-row:
 *  - low numbers (1-100)   → physical right (RN bench, vu depuis le perchoir)
 *  - mid numbers (~250-330)→ centre (EPR / Renaissance)
 *  - high numbers (500+)   → physical left (LFI / écolos / GDR)
 *
 * We never compute these positions ourselves. Instead we ship the official
 * coordinates extracted from the Assembly's own SVG (via the open-source
 * Serrulien/hemicycle-france project, MIT licensed). See
 * scripts/extract-seats.ts for the extraction pipeline.
 */

import seatsData from '$lib/generated/seats.json';

interface SeatsFile {
	source: string;
	viewBox: { x: number; y: number; width: number; height: number };
	seats: Record<string, { x: number; y: number }>;
}

const data = seatsData as SeatsFile;

export const HEMICYCLE_VIEWBOX = data.viewBox;

export interface SeatPosition {
	place: number;
	x: number;
	y: number;
}

// Build the lookup map once at module init.
const SEAT_MAP_INTERNAL = new Map<number, SeatPosition>();
for (const [k, v] of Object.entries(data.seats)) {
	const num = parseInt(k, 10);
	SEAT_MAP_INTERNAL.set(num, { place: num, x: v.x, y: v.y });
}

export const SEAT_MAP: ReadonlyMap<number, SeatPosition> = SEAT_MAP_INTERNAL;
export const TOTAL_SEATS = SEAT_MAP_INTERNAL.size;

/** Seat marker radius in source SVG units. The Serrulien SVG uses ~10×10
 *  hexagons; circles of r=5.5 fill the cell without overlap. */
export const SEAT_RADIUS = 5.5;

/** Color palette for vote positions.
 *  Aligné sur les tokens sémantiques du design system (cf MASTER.md §2) : les
 *  valeurs sont des `var(--vote-*)` qui s'adaptent au thème Light/Dark. Ces
 *  chaînes sont injectées dans des attributs SVG `fill` / des `style` CSS, où
 *  `var()` est résolu nativement. `nonVotant` n'a pas de token dédié : il
 *  réutilise `--vote-absent` (même sémantique « pas d'expression de vote »). */
export const VOTE_COLORS = {
	pour: 'var(--vote-pour)',
	contre: 'var(--vote-contre)',
	abstention: 'var(--vote-abstention)',
	nonVotant: 'var(--vote-absent)',
	absent: 'var(--vote-absent)'
} as const;
