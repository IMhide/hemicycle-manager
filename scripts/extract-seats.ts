/**
 * Extract official seat positions from Serrulien/hemicycle-france.
 *
 * Parses the core.js file (which contains SVG paths copied from the official
 * Assemblée nationale website) and computes the centroid of each seat path,
 * producing a static JSON map { seatNumber: { x, y, row } } that we use to
 * render our own SVG hémicycle.
 *
 * The paths are in Raphael format using relative SVG path commands ("m" then
 * a series of relative line segments). We sum the relative offsets to derive
 * the four seat corners, then average them to get the center.
 *
 * Source: https://github.com/Serrulien/hemicycle-france/blob/master/js/hemi/core.js
 * License: MIT (Serrulien)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = '/tmp/hemicycle-france/js/hemi/core.js';
const OUT = join(ROOT, 'src', 'lib', 'generated', 'seats.json');

interface SeatPosition {
	num: number;
	x: number; // centroid X in source SVG coordinates
	y: number; // centroid Y in source SVG coordinates
}

/**
 * Parse a Raphael path string and return its centroid.
 * Format: "m X,Y dx1,dy1 dx2,dy2 ... z" where m is "moveto" (absolute),
 * subsequent pairs are relative line segments.
 */
function pathCentroid(path: string): { x: number; y: number } | null {
	// Strip the trailing "z" and normalize whitespace.
	const cleaned = path.replace(/z\s*$/i, '').trim();
	// First token must be "m" (lowercase = relative; for the first command,
	// SVG treats it as absolute moveto regardless).
	const m = cleaned.match(/^m\s+([-0-9.eE]+)[ ,]([-0-9.eE]+)\s*(.*)$/);
	if (!m) return null;
	const startX = parseFloat(m[1]);
	const startY = parseFloat(m[2]);
	const rest = m[3];

	// Extract all "dx,dy" pairs (relative segments after the moveto).
	const pairs = rest.match(/-?\d+(?:\.\d+)?(?:[eE]-?\d+)?[ ,]-?\d+(?:\.\d+)?(?:[eE]-?\d+)?/g) ?? [];
	let x = startX;
	let y = startY;
	const xs = [x];
	const ys = [y];
	for (const pair of pairs) {
		const [dxs, dys] = pair.split(/[ ,]/);
		x += parseFloat(dxs);
		y += parseFloat(dys);
		xs.push(x);
		ys.push(y);
	}
	return {
		x: xs.reduce((a, b) => a + b, 0) / xs.length,
		y: ys.reduce((a, b) => a + b, 0) / ys.length
	};
}

async function main() {
	console.log('🪑 Extraction des positions de sièges officielles');
	console.log(`   Source : ${SRC}\n`);

	const src = await readFile(SRC, 'utf8');

	const re = /association\.s(\d+)\s*=\s*conteneur\.path\("([^"]+)"\)/g;
	const seats: SeatPosition[] = [];
	let match: RegExpExecArray | null;
	while ((match = re.exec(src)) !== null) {
		const num = parseInt(match[1], 10);
		const path = match[2];
		const centroid = pathCentroid(path);
		if (!centroid) {
			console.warn(`  ⚠ siège ${num}: path non parsé`);
			continue;
		}
		seats.push({ num, x: centroid.x, y: centroid.y });
	}

	console.log(`✓ ${seats.length} sièges extraits`);

	// Compute bounding box for sanity.
	const xs = seats.map((s) => s.x);
	const ys = seats.map((s) => s.y);
	const bb = {
		minX: Math.min(...xs),
		maxX: Math.max(...xs),
		minY: Math.min(...ys),
		maxY: Math.max(...ys)
	};
	console.log(
		`  bbox source : x [${bb.minX.toFixed(0)}, ${bb.maxX.toFixed(0)}], y [${bb.minY.toFixed(0)}, ${bb.maxY.toFixed(0)}]`
	);

	// Quick sanity check using the empirical anchors from the research.
	const anchors: Array<{ num: number; group: string }> = [
		{ num: 36, group: 'RN (Le Pen)' },
		{ num: 267, group: 'EPR (Attal)' },
		{ num: 539, group: 'LFI (Bompard)' },
		{ num: 593, group: 'GDR (Faucillon)' }
	];
	console.log('\nVérification (ordre attendu : seat 36 RN à droite → seat 593 GDR à gauche):');
	for (const a of anchors) {
		const seat = seats.find((s) => s.num === a.num);
		if (seat) {
			console.log(`  s${a.num.toString().padStart(3)} ${a.group.padEnd(18)} → x=${seat.x.toFixed(0)}, y=${seat.y.toFixed(0)}`);
		}
	}

	const output = {
		source: 'https://github.com/Serrulien/hemicycle-france (MIT)',
		viewBox: { x: bb.minX - 10, y: bb.minY - 10, width: bb.maxX - bb.minX + 20, height: bb.maxY - bb.minY + 20 },
		seats: Object.fromEntries(seats.map((s) => [s.num, { x: s.x, y: s.y }]))
	};

	await writeFile(OUT, JSON.stringify(output));
	console.log(`\n✅ Écrit : ${OUT}`);
}

main().catch((err) => {
	console.error('❌', err);
	process.exit(1);
});
