/**
 * Smoke test du manifest bicaméral `elus.json` (cf ADR 0031 + ADR 0032).
 * Lance après `npm run data:build:elus` (ou `npm run data:fetch` qui chaîne).
 *
 * Vérifie :
 *  - existence + structure générale du manifest (count, countBicameral)
 *  - format `eluId` (`/^elu_[0-9a-f]{8}$/`)
 *  - aucun élu n'a 0 mandat
 *  - cas concrets : René Pilato (PA817211, AN seul), Gérard Larcher (86034E, Sénat seul)
 *  - cohérence des références : tout `paId` cité existe dans `personnes.json`,
 *    tout `matricule` cité existe dans `senateurs.json`
 *  - au moins 1 bicaméral détecté avec badge `Bicameral`
 *  - moyenne simple : `overallCarriere` ≈ moyenne des `mandats[].overall`
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EluManifest } from '../src/lib/elus.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'static', 'data');

async function loadJson<T>(rel: string): Promise<T> {
	return JSON.parse(await readFile(join(DATA, rel), 'utf8')) as T;
}

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail?: string) {
	if (ok) {
		pass++;
		console.log(`  ✓ ${label}`);
	} else {
		fail++;
		console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
	}
}

interface Personne {
	id: string;
	identite: { prenom: string; nom: string; dateNaissance: string | null };
}

interface Senateur {
	id: string;
	identite: { prenom: string; nom: string; dateNaissance: string | null };
}

async function main() {
	console.log('🔬 Smoke test elus.json (manifest bicaméral, ADR 0031)\n');

	const elusPath = join(DATA, 'elus.json');
	if (!existsSync(elusPath)) {
		console.log('  ✗ static/data/elus.json introuvable — lance `npm run data:build:elus`');
		process.exit(1);
	}

	const manifest = await loadJson<EluManifest>('elus.json');
	console.log(
		`Manifest : ${manifest.count} élus dont ${manifest.countBicameral} bicaméraux, généré ${manifest.generatedAt}\n`
	);

	// ─── 1. Structure générale
	console.log('1. Structure générale');
	check('count > 1500', manifest.count > 1500, `got ${manifest.count}`);
	check('countBicameral > 0', manifest.countBicameral > 0, `got ${manifest.countBicameral}`);
	check(
		'count == elus.length (cohérence)',
		manifest.count === manifest.elus.length,
		`count=${manifest.count} vs elus.length=${manifest.elus.length}`
	);

	// ─── 2. Format eluId
	console.log('\n2. Format eluId');
	const idRegex = /^elu_[0-9a-f]{8}$/;
	const badIds = manifest.elus.filter((e) => !idRegex.test(e.id));
	check(
		`tous les eluId matchent /^elu_[0-9a-f]{8}$/`,
		badIds.length === 0,
		badIds.length > 0 ? `${badIds.length} ids invalides : ${badIds.slice(0, 3).map((e) => e.id).join(',')}` : ''
	);
	const uniqueIds = new Set(manifest.elus.map((e) => e.id));
	check(
		'tous les eluId sont uniques',
		uniqueIds.size === manifest.elus.length,
		`${manifest.elus.length - uniqueIds.size} doublon(s) détecté(s)`
	);

	// ─── 3. Mandats
	console.log('\n3. Mandats');
	const noMandat = manifest.elus.filter((e) => e.mandats.length === 0);
	check(
		`aucun élu n'a 0 mandat`,
		noMandat.length === 0,
		`${noMandat.length} élus à 0 mandat`
	);

	// Tri chrono asc
	const malTries = manifest.elus.filter((e) => {
		for (let i = 1; i < e.mandats.length; i++) {
			if (e.mandats[i].debut < e.mandats[i - 1].debut) return true;
		}
		return false;
	});
	check(`mandats triés chrono asc`, malTries.length === 0, `${malTries.length} en désordre`);

	// ─── 4. Cohérence avec sources
	console.log('\n4. Cohérence avec sources');
	const personnes = await loadJson<Personne[]>('personnes.json');
	const senateurs = await loadJson<Senateur[]>('senat/senateurs.json');
	const paIds = new Set(personnes.map((p) => p.id));
	const matIds = new Set(senateurs.map((s) => s.id));
	const orphanPa = manifest.elus
		.filter((e) => e.paId !== null)
		.filter((e) => !paIds.has(e.paId!));
	check(
		`tous les paId cités existent dans personnes.json`,
		orphanPa.length === 0,
		orphanPa.length > 0 ? `${orphanPa.length} orphelins (ex. ${orphanPa[0].paId})` : ''
	);
	const orphanMat = manifest.elus
		.filter((e) => e.matricule !== null)
		.filter((e) => !matIds.has(e.matricule!));
	check(
		`tous les matricules cités existent dans senateurs.json`,
		orphanMat.length === 0,
		orphanMat.length > 0 ? `${orphanMat.length} orphelins (ex. ${orphanMat[0].matricule})` : ''
	);

	// ─── 5. Cas concrets
	console.log('\n5. Cas concrets');

	// Pilato : PA817211, AN seul (16ᵉ + 17ᵉ AN, pas de mandat Sénat)
	const pilato = manifest.elus.find((e) => e.paId === 'PA817211');
	check(`René Pilato (PA817211) présent`, pilato !== undefined);
	if (pilato) {
		check(
			`Pilato a au moins 1 mandat AN`,
			pilato.mandats.filter((m) => m.chambre === 'AN').length >= 1
		);
		check(`Pilato n'a pas de mandat Sénat`, pilato.matricule === null);
		check(`Pilato pas de badge Bicameral`, !pilato.badgesCarriere.includes('Bicameral'));
	}

	// Larcher : matricule 86034E (Gérard, sénateur, 3 triennats ère Macron)
	const larcher = manifest.elus.find((e) => e.matricule === '86034E');
	check(`Gérard Larcher (matricule 86034E) présent`, larcher !== undefined);
	if (larcher) {
		const mandatsSen = larcher.mandats.filter((m) => m.chambre === 'SENAT');
		check(
			`Larcher a 3 mandats Sénat (3 triennats ère Macron)`,
			mandatsSen.length === 3,
			`got ${mandatsSen.length}`
		);
		check(
			`Larcher n'a pas de mandat AN dans ère Macron (donc pas Bicameral)`,
			!larcher.badgesCarriere.includes('Bicameral'),
			larcher.badgesCarriere.includes('Bicameral')
				? 'badge Bicameral inattendu'
				: ''
		);
	}

	// ─── 6. Au moins 1 bicaméral avec badge Bicameral
	console.log('\n6. Bicaméraux');
	const bicams = manifest.elus.filter((e) => e.badgesCarriere.includes('Bicameral'));
	check(
		`au moins 1 élu a le badge Bicameral`,
		bicams.length >= 1,
		`got ${bicams.length}`
	);
	check(
		`countBicameral cohérent avec nb d'élus AN+Sénat`,
		manifest.countBicameral === bicams.length,
		`countBicameral=${manifest.countBicameral} vs badges=${bicams.length}`
	);

	// Tous les Bicameral ont paId ET matricule
	const bicamBadIdent = bicams.filter((e) => !e.paId || !e.matricule);
	check(
		`tous les Bicameral ont paId ET matricule`,
		bicamBadIdent.length === 0,
		`${bicamBadIdent.length} bicaméraux mal identifiés`
	);

	// ─── 7. Moyenne simple — overallCarriere
	console.log('\n7. Sémantique carrière (ADR 0032)');
	let countMoyenneOk = 0;
	let countMoyenneKo = 0;
	for (const e of manifest.elus) {
		if (e.mandats.length === 0) continue;
		const expected = Math.round(
			e.mandats.reduce((acc, m) => acc + m.overall, 0) / e.mandats.length
		);
		// Tolérance ±1 (arrondis flottants — moyenne simple devrait être exacte mais
		// le pipeline calcule lui-même la moyenne, on autorise une marge).
		if (Math.abs(e.overallCarriere - expected) <= 1) {
			countMoyenneOk++;
		} else {
			countMoyenneKo++;
		}
	}
	check(
		`overallCarriere = moyenne simple des mandats (tolérance ±1)`,
		countMoyenneKo === 0,
		`${countMoyenneKo} cas hors tolérance sur ${countMoyenneOk + countMoyenneKo}`
	);

	console.log(`\n──────────────────`);
	console.log(`✅ ${pass} passed   ❌ ${fail} failed`);
	if (fail > 0) process.exit(1);
}

main().catch((e) => {
	console.error('💥', e);
	process.exit(1);
});
