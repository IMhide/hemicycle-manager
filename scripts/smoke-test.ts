/**
 * Smoke test pour valider l'output du pipeline Phase 1.
 * Lance après `npm run data:fetch`.
 *
 * Vérifie :
 *  - comptes globaux (personnes, mandats, groupes par leg, scrutins)
 *  - cas concrets connus (Habib, Vallaud, transfuges)
 *  - cohérence des stats (rate ∈ [0,1], denominator ≥ numerator)
 *  - détection NI-bridge correcte
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Personne, Groupe, LegislatureMeta, ScrutinIndex, BuildMeta } from '../src/lib/types.ts';

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

async function main() {
	console.log('🔬 Smoke test PolitiDex Phase 1\n');

	// ─── Meta + comptes globaux
	const meta = await loadJson<BuildMeta>('meta.json');
	console.log(`Meta : généré ${meta.generatedAt}, législatures ${meta.legislatures.join('+')}`);
	console.log(
		`Counts : ${meta.counts.personnes} personnes, ${meta.counts.mandats} mandats, ${meta.counts.groupes} groupes, ${meta.counts.scrutins} scrutins\n`
	);

	console.log('1. Comptes globaux');
	check('legislatures = [16, 17]', JSON.stringify(meta.legislatures) === '[16,17]');
	// Realité observée sur 16+17 : 830 personnes uniques, 1262 mandats.
	// Le surplus vs 577×2 vient des suppléants montés / démissions sur la durée
	// d'une législature (turnover ~10%/leg).
	check(
		'≈ 800-900 personnes uniques (577×2 - réélus, avec turnover)',
		meta.counts.personnes >= 750 && meta.counts.personnes <= 900,
		`got ${meta.counts.personnes}`
	);
	check(
		'≈ 1200-1300 mandats (un mandat = une personne × une législature)',
		meta.counts.mandats >= 1100 && meta.counts.mandats <= 1350,
		`got ${meta.counts.mandats}`
	);

	// ─── Légistlatures
	console.log('\n2. Légistlatures');
	const legislatures = await loadJson<LegislatureMeta[]>('legislatures.json');
	check('2 législatures dans legislatures.json', legislatures.length === 2);
	const leg16 = legislatures.find((l) => l.num === 16);
	const leg17 = legislatures.find((l) => l.num === 17);
	check('leg 16 présente', !!leg16);
	check('leg 17 présente', !!leg17);
	// 577 sièges + turnover (suppléants montés, démissions). On accepte 577..650.
	check(
		'leg 16 nbPersonnes ≈ 577-650',
		!!leg16 && leg16.nbPersonnes >= 577 && leg16.nbPersonnes <= 650,
		leg16 ? `got ${leg16.nbPersonnes}` : 'n/a'
	);
	check(
		'leg 17 nbPersonnes ≈ 577-650',
		!!leg17 && leg17.nbPersonnes >= 577 && leg17.nbPersonnes <= 650,
		leg17 ? `got ${leg17.nbPersonnes}` : 'n/a'
	);

	// ─── Groupes par législature
	console.log('\n3. Groupes par législature');
	const groupes16 = await loadJson<Groupe[]>('groupes/16.json');
	const groupes17 = await loadJson<Groupe[]>('groupes/17.json');
	check('groupes/16.json contient 12 groupes', groupes16.length === 12, `got ${groupes16.length}`);
	check('groupes/17.json contient 14 groupes', groupes17.length === 14, `got ${groupes17.length}`);
	check(
		'tous les groupes 16 ont legislature=16',
		groupes16.every((g) => g.legislature === 16)
	);
	check(
		'tous les groupes 16 ont une couleur',
		groupes16.every((g) => /^#[0-9A-Fa-f]{6}$/.test(g.couleur))
	);
	const ldGr16 = groupes16.find((g) => g.libelleAbrege.includes('LFI'));
	check('LFI-NUPES présent en 16', !!ldGr16);
	const epr17 = groupes17.find((g) => g.libelleAbrege === 'EPR');
	check('EPR présent en 17', !!epr17);

	// ─── Personnes : cas concrets
	console.log('\n4. Cas concrets');
	const personnes = await loadJson<Personne[]>('personnes.json');
	const habib = personnes.find((p) => p.id === 'PA1592');
	check('PA1592 (David Habib) présent', !!habib);
	if (habib) {
		const legs = habib.mandats.map((m) => m.legislature).sort();
		check('Habib a un mandat 16e + 17e', JSON.stringify(legs) === '[16,17]', `got ${legs.join(',')}`);
		check('Habib carriere.nbMandats = 2', habib.carriere.nbMandats === 2);
		check('Habib badge réélu', habib.carriere.badgesCarriere.includes('reelu'));
	}

	const vallaud = personnes.find((p) => p.id === 'PA719930');
	check('PA719930 (Boris Vallaud) présent', !!vallaud);
	if (vallaud) {
		const m16 = vallaud.mandats.find((m) => m.legislature === 16);
		check('Vallaud a un mandat 16e', !!m16);
		if (m16) {
			const stables = m16.appartenancesGroupe.filter((a) => !a.isTransitoireNI);
			const distincts = new Set(stables.map((a) => a.groupeId));
			check(
				'Vallaud 16e a 2 groupes stables (SOC → SOC nouveau)',
				distincts.size === 2,
				`got ${distincts.size}`
			);
		}
		check('Vallaud badge transfuge', vallaud.carriere.badgesCarriere.includes('transfuge'));
	}

	const lepen = personnes.find((p) => p.id === 'PA720614');
	check('PA720614 (Marine Le Pen) présente', !!lepen);
	if (lepen) {
		check('Le Pen badge réélu', lepen.carriere.badgesCarriere.includes('reelu'));
	}

	// ─── Cohérence stats
	console.log('\n5. Cohérence stats');
	let okPresence = true;
	let okPart = true;
	let okLoy = true;
	let nNI = 0;
	let nWithMandat17 = 0;
	for (const p of personnes) {
		for (const m of p.mandats) {
			if (m.stats.presence.rate < 0 || m.stats.presence.rate > 1) okPresence = false;
			if (m.stats.presence.numerator > m.stats.presence.denominator) okPresence = false;
			if (m.stats.participation.numerator > m.stats.participation.denominator) okPart = false;
			if (m.stats.loyaute.rate !== null && (m.stats.loyaute.rate < 0 || m.stats.loyaute.rate > 1))
				okLoy = false;
			if (m.legislature === 17) nWithMandat17++;
			for (const a of m.appartenancesGroupe) if (a.isTransitoireNI) nNI++;
		}
	}
	check('toutes les présences ∈ [0,1] et num ≤ denom', okPresence);
	check('toutes les participations num ≤ denom', okPart);
	check('toutes les loyautés ∈ [0,1]', okLoy);
	check(`NI-bridge filtrés ≥ 500 (517 attendus 16e + ~570 17e)`, nNI >= 500, `got ${nNI}`);

	// ─── Carrière agrégée
	console.log('\n6. Carrière agrégée (cumul pondéré, cf ADR 0017)');
	let okCarriere = true;
	for (const p of personnes) {
		const c = p.carriere;
		const sumNum = p.mandats.reduce((s, m) => s + m.stats.presence.numerator, 0);
		const sumDen = p.mandats.reduce((s, m) => s + m.stats.presence.denominator, 0);
		if (c.presence.numerator !== sumNum || c.presence.denominator !== sumDen) okCarriere = false;
	}
	check('carriere.presence = somme des mandat.presence (cumul pondéré)', okCarriere);

	// ─── Scrutins
	console.log('\n7. Scrutins');
	const scrutinsIdx = await loadJson<ScrutinIndex[]>('scrutins-index.json');
	const sc16 = scrutinsIdx.filter((s) => s.legislature === 16).length;
	const sc17 = scrutinsIdx.filter((s) => s.legislature === 17).length;
	check(`scrutins 16 ≥ 1500 (got ${sc16})`, sc16 >= 1500);
	check(`scrutins 17 ≥ 500 (got ${sc17})`, sc17 >= 500);
	check('toutes les entrées de scrutins-index.json ont un champ legislature', scrutinsIdx.every((s) => s.legislature === 16 || s.legislature === 17));

	console.log(`\n──────────────────`);
	console.log(`✅ ${pass} passed   ❌ ${fail} failed`);
	if (fail > 0) process.exit(1);
}

main().catch((e) => {
	console.error('💥', e);
	process.exit(1);
});
