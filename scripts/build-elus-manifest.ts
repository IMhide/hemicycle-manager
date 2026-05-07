#!/usr/bin/env node --experimental-strip-types
/**
 * Driver — produit `static/data/elus.json` à partir de `personnes.json` (AN)
 * et `senat/senateurs.json` (Sénat). Cf ADR 0031 + ADR 0032.
 *
 * Module pur dans `scripts/lib/elus-manifest.ts`. Ce script se contente de :
 *  1. Charger les inputs (JSON déjà produits par fetch-data.ts + fetch-data-senat.ts)
 *  2. Charger `static/data/elus-overrides.json` (commité, exception au gitignore)
 *  3. Appeler `buildElusManifest`
 *  4. Écrire `static/data/elus.json`
 *  5. Logger un récap (counts, bicameraux, warnings)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
	buildElusManifest,
	type Personne,
	type Senateur,
	type EluOverrides
} from './lib/elus-manifest.ts';

const ROOT = process.cwd();
const STATIC_DATA = join(ROOT, 'static', 'data');

async function readJson<T>(path: string): Promise<T> {
	const raw = await readFile(path, 'utf-8');
	return JSON.parse(raw) as T;
}

async function readOverrides(path: string): Promise<EluOverrides> {
	if (!existsSync(path)) {
		console.warn(`⚠️  ${path} introuvable — overrides vides`);
		return { forceFusion: [], forceSeparation: [] };
	}
	return readJson<EluOverrides>(path);
}

async function main() {
	const t0 = Date.now();

	const personnesPath = join(STATIC_DATA, 'personnes.json');
	const senateursPath = join(STATIC_DATA, 'senat', 'senateurs.json');
	const overridesPath = join(STATIC_DATA, 'elus-overrides.json');
	const outPath = join(STATIC_DATA, 'elus.json');

	if (!existsSync(personnesPath)) {
		console.error(`❌ ${personnesPath} introuvable — lance d'abord npm run data:fetch:an`);
		process.exit(1);
	}
	if (!existsSync(senateursPath)) {
		console.error(`❌ ${senateursPath} introuvable — lance d'abord npm run data:fetch:senat`);
		process.exit(1);
	}

	console.log(`📥 Lecture personnes.json…`);
	const personnes = await readJson<Personne[]>(personnesPath);

	console.log(`📥 Lecture senat/senateurs.json…`);
	const senateurs = await readJson<Senateur[]>(senateursPath);

	console.log(`📥 Lecture elus-overrides.json…`);
	const overrides = await readOverrides(overridesPath);

	console.log(`🔨 Build manifest cross-chambre…`);
	const manifest = buildElusManifest(personnes, senateurs, overrides);

	await writeFile(outPath, JSON.stringify(manifest), 'utf-8');

	const dt = ((Date.now() - t0) / 1000).toFixed(2);
	console.log(`✅ ${outPath}`);
	console.log(`   ${manifest.count} élus (${manifest.countBicameral} bicaméraux)`);
	console.log(
		`   sources : ${personnes.length} personnes AN + ${senateurs.length} sénateurs Sénat`
	);
	console.log(`   ${manifest.warnings.length} warning(s) de matching`);
	if (manifest.warnings.length > 0 && manifest.warnings.length <= 20) {
		for (const w of manifest.warnings) console.log(`   ⚠️  ${w}`);
	} else if (manifest.warnings.length > 20) {
		for (const w of manifest.warnings.slice(0, 10)) console.log(`   ⚠️  ${w}`);
		console.log(`   …et ${manifest.warnings.length - 10} autres`);
	}
	console.log(`⏱  ${dt}s`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
