/**
 * Extracteur de layout Sénat — à lancer **manuellement une seule fois**
 * (pas dans le `data:fetch` quotidien). Cf ADR 0026.
 *
 * Télécharge le `index.html` du projet open-source `Kurea/visu_senat` (MIT),
 * en extrait le tableau JS `layout` (9 couches concentriques × N groupes ×
 * N sièges), reproduit la trigonométrie de la fonction `buildHemicycle()` de
 * Kurea et sérialise les coordonnées des 348 sièges dans
 * `src/lib/generated/senat-seats.json` (commité, ~30 KB).
 *
 * Usage : `node --experimental-strip-types scripts/extract-senat-seats.ts`
 *
 * La logique pure (parsing du layout, calcul trigonométrique, correction des
 * anomalies du source Kurea) vit dans `scripts/lib/senat-layout.ts` et est
 * couverte par `scripts/lib/senat-layout.test.ts`. Ce script ne fait que l'I/O.
 */

import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeSenatSeats, senatViewBox } from './lib/senat-layout.ts';

const KUREA_INDEX_URL = 'https://raw.githubusercontent.com/Kurea/visu_senat/main/index.html';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = join(ROOT, 'src', 'lib', 'generated', 'senat-seats.json');

async function main() {
	console.log(`🪑 Extracting Sénat seats layout from ${KUREA_INDEX_URL}…`);

	// 1. Télécharger le HTML source de Kurea/visu_senat
	const res = await fetch(KUREA_INDEX_URL);
	if (!res.ok) {
		throw new Error(`Failed to fetch Kurea index.html: HTTP ${res.status}`);
	}
	const html = await res.text();
	console.log(`  ✓ Downloaded ${(html.length / 1024).toFixed(1)} KB`);

	// 2. Calculer les coordonnées via le module pur testé
	const seats = computeSenatSeats(html);
	const seatCount = Object.keys(seats).length;
	if (seatCount !== 348) {
		throw new Error(`Expected 348 seats, got ${seatCount}`);
	}
	console.log(`  ✓ Computed ${seatCount} seats over 9 concentric layers`);

	// 3. Sérialiser au format aligné sur seats.json AN
	const out = {
		source: 'Adapté de github.com/Kurea/visu_senat (MIT) — Copyright (c) 2025 Kurea',
		license: 'MIT',
		extractedAt: new Date().toISOString(),
		viewBox: senatViewBox(900),
		seats: Object.fromEntries(
			Object.entries(seats).map(([id, s]) => [
				id,
				{
					x: Math.round(s.x * 100) / 100,
					y: Math.round(s.y * 100) / 100,
					rotation: Math.round(s.rotation * 100) / 100
				}
			])
		)
	};

	// 4. mkdir -p src/lib/generated puis write JSON
	const { mkdir } = await import('node:fs/promises');
	await mkdir(dirname(OUT_PATH), { recursive: true });
	await writeFile(OUT_PATH, JSON.stringify(out, null, 2));
	console.log(`  ✓ Wrote ${OUT_PATH}`);
	console.log(`\n✅ Done — commit ${OUT_PATH} to lock the layout in.`);
}

main().catch((err) => {
	console.error('\n❌ Extraction failed:', err);
	process.exit(1);
});
