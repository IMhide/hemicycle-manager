/**
 * Geometry of the French Senate hémicycle (348 seats, 9 concentric layers).
 *
 * Layout adapted from the open-source Kurea/visu_senat project (MIT) — see
 * scripts/extract-senat-seats.ts for the extraction pipeline and ADR 0026
 * for the rationale.
 *
 * Seat numbering (1..348) matches `siege` in the live api-senat feed.
 */

import seatsData from '$lib/generated/senat-seats.json';

interface SeatsFileSenat {
	source: string;
	license: string;
	extractedAt: string;
	viewBox: string; // SVG-native string ("0 0 900 430.8")
	seats: Record<string, { x: number; y: number; rotation: number }>;
}

const data = seatsData as SeatsFileSenat;

function parseViewBox(s: string): { x: number; y: number; width: number; height: number } {
	const [x, y, width, height] = s.split(/\s+/).map(Number);
	return { x, y, width, height };
}

export const HEMICYCLE_VIEWBOX_SENAT = parseViewBox(data.viewBox);

export interface SeatPositionSenat {
	place: number;
	x: number;
	y: number;
	rotation: number;
}

const SEAT_MAP_INTERNAL = new Map<number, SeatPositionSenat>();
for (const [k, v] of Object.entries(data.seats)) {
	const num = parseInt(k, 10);
	SEAT_MAP_INTERNAL.set(num, { place: num, x: v.x, y: v.y, rotation: v.rotation });
}

export const SEAT_MAP_SENAT: ReadonlyMap<number, SeatPositionSenat> = SEAT_MAP_INTERNAL;
export const TOTAL_SEATS_SENAT = SEAT_MAP_INTERNAL.size;

/** Seat marker radius. Kurea's layout spreads 348 seats over a 900×430 viewBox;
 *  r=7 keeps cells visually distinct without overlap. */
export const SEAT_RADIUS_SENAT = 7;
