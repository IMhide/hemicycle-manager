/**
 * Smoke test pour valider l'output du pipeline Sénat (Phase 3, cf ADR 0023..0027).
 * Lance après `npm run data:fetch:senat`.
 *
 * Vérifie :
 *  - comptes globaux (sénateurs, mandats, scrutins, votes nominatifs)
 *  - sessions et groupes par session
 *  - cas concrets (Patriat siège 1 LREM, Larcher siège 9 UMP)
 *  - cohérence des stats (rate ∈ [0, 1], denominator ≥ numerator)
 *  - vétérans cross-session, transfuges, distribution overalls
 *  - hémicycle (place ∈ [1, 348], serie ∈ {1, 2})
 *  - garde anti-fusion AN/Sénat
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
	Senateur,
	GroupeSenat,
	SessionMeta,
	ScrutinSenatIndex,
	BuildMetaSenat,
	Personne
} from '../src/lib/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'static', 'data', 'senat');
const DATA_AN = join(ROOT, 'static', 'data');

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
	console.log('🔬 Smoke test PolitiDex Sénat\n');

	// ─── A. Comptes globaux
	const meta = await loadJson<BuildMetaSenat>('meta.json');
	console.log(`Meta : généré ${meta.generatedAt}, ${meta.sessions.length} sessions avec scrutins`);
	console.log(
		`Counts : ${meta.counts.senateurs} sénateurs, ${meta.counts.mandats} mandats, ${meta.counts.scrutins} scrutins, ${meta.counts.votesNominatifs} votes nominatifs\n`
	);

	console.log('A. Comptes globaux');
	check('meta.json existe et est valide', !!meta.generatedAt);
	// Réalité empirique observée : ~1847 sénateurs avec mandat ELUSEN (filtre pipeline).
	// On accepte une marge large pour absorber les évolutions futures.
	check(
		'1500-2500 sénateurs (avec mandat connu)',
		meta.counts.senateurs >= 1500 && meta.counts.senateurs <= 2500,
		`got ${meta.counts.senateurs}`
	);
	check(
		'≥ 4400 scrutins (depuis 2006)',
		meta.counts.scrutins >= 4400,
		`got ${meta.counts.scrutins}`
	);
	check(
		'≥ 1.5M votes nominatifs',
		meta.counts.votesNominatifs >= 1_500_000,
		`got ${meta.counts.votesNominatifs}`
	);
	check(
		'≥ 19 sessions avec scrutins (2006-2007 → 2025-2026)',
		meta.counts.sessions >= 19,
		`got ${meta.counts.sessions}`
	);

	// ─── B. Sessions
	console.log('\nB. Sessions');
	const sessions = await loadJson<SessionMeta[]>('sessions.json');
	check('≥ 19 sessions', sessions.length >= 19);
	const sess2024 = sessions.find((s) => s.sesann === 2024);
	check('Session 2024 présente', !!sess2024);
	if (sess2024) {
		check(
			'Session 2024 dateDebut commence par 2024-10',
			sess2024.dateDebut.startsWith('2024-10'),
			sess2024.dateDebut
		);
		check(
			'Session 2024 nbSenateursActifs ∈ [320, 380]',
			sess2024.nbSenateursActifs >= 320 && sess2024.nbSenateursActifs <= 380,
			`got ${sess2024.nbSenateursActifs}`
		);
		check(
			'Session 2024 nbScrutins ≥ 100',
			sess2024.nbScrutins >= 100,
			`got ${sess2024.nbScrutins}`
		);
		check(
			'Session 2024 libelle "2024-2025"',
			sess2024.libelle.includes('2024') && sess2024.libelle.includes('2025'),
			sess2024.libelle
		);
	}

	// ─── C. Groupes par session
	console.log('\nC. Groupes par session');
	const groupes2024 = await loadJson<GroupeSenat[]>('groupes/2024.json');
	check('groupes/2024.json contient ≥ 8 groupes', groupes2024.length >= 8, `got ${groupes2024.length}`);
	// Codes en exercice 2024-2025 attendus : CRC, GEST, LREM, RDSE, RTLI, SOC, UC, UMP.
	// AUCUN/NI peuvent être absents si l'effectif final est 0.
	const codes2024 = new Set(groupes2024.map((g) => g.code));
	for (const c of ['SOC', 'UMP', 'UC', 'CRC', 'GEST', 'RDSE', 'LREM', 'RTLI']) {
		check(`code ${c} présent en 2024`, codes2024.has(c));
	}
	check(
		'tous les groupes 2024 ont une couleur hex',
		groupes2024.every((g) => /^#[0-9a-fA-F]{6}$/.test(g.couleur))
	);
	const totalEff2024 = groupes2024.reduce((s, g) => s + g.effectifFin, 0);
	check(
		'somme des effectifs 2024 ∈ [320, 380]',
		totalEff2024 >= 320 && totalEff2024 <= 380,
		`got ${totalEff2024}`
	);

	// Vérifier qu'au moins 1 groupe historique disparu apparaît dans une session ancienne
	const groupes2006 = await loadJson<GroupeSenat[]>('groupes/2006.json').catch(() => null);
	if (groupes2006) {
		const codes2006 = new Set(groupes2006.map((g) => g.code));
		const hasHistoricalCode = ['UMP', 'UC', 'SOC', 'RDSE'].some((c) => codes2006.has(c));
		check('groupes/2006.json contient des codes historiques', hasHistoricalCode);
	}

	// ─── D. Cas concrets (api-senat confirmé en début de session)
	console.log('\nD. Cas concrets');
	const senateurs = await loadJson<Senateur[]>('senateurs.json');
	const patriat = senateurs.find((s) => s.id === '08061X');
	check('matricule 08061X (Patriat) présent', !!patriat);
	if (patriat) {
		check('Patriat nom = "Patriat"', patriat.identite.nom === 'Patriat');
		const activeMandat = patriat.mandats.find((m) => m.dateFinFonction === null);
		check('Patriat a un mandat actif', !!activeMandat);
		if (activeMandat) {
			check('Patriat siege = 1', activeMandat.place === 1, `got ${activeMandat.place}`);
			check('Patriat serie ∈ {1, 2}', activeMandat.serie === 1 || activeMandat.serie === 2);
			const courantApp = activeMandat.appartenancesGroupe.find(
				(a) => a.dateFin === null || a.dateFin >= '2024-01-01'
			);
			check('Patriat appartenance LREM courante', courantApp?.groupeCode === 'LREM');
		}
	}

	const larcher = senateurs.find((s) => s.id === '86034E');
	check('matricule 86034E (Larcher) présent', !!larcher);
	if (larcher) {
		const activeMandat = larcher.mandats.find((m) => m.dateFinFonction === null);
		if (activeMandat) {
			check('Larcher siege = 9', activeMandat.place === 9, `got ${activeMandat.place}`);
		}
		check(
			'Larcher badgesCarriere contient "veteran"',
			larcher.carriere.badgesCarriere.includes('veteran')
		);
	}

	// Au moins 1 ancien sénateur de 2006 doit être présent
	const anciens = senateurs.filter((s) => s.identite.etat === 'ANCIEN');
	check('≥ 100 sénateurs anciens', anciens.length >= 100, `got ${anciens.length}`);

	// ─── E. Cohérence stats
	console.log('\nE. Cohérence stats');
	let badRate = 0;
	let badDenom = 0;
	let badEligible = 0;
	for (const s of senateurs) {
		for (const m of s.mandats) {
			for (const ss of m.sessions) {
				const st = ss.stats;
				if (
					st.presence.rate < 0 ||
					st.presence.rate > 1 ||
					st.participation.rate < 0 ||
					st.participation.rate > 1
				)
					badRate++;
				if (
					st.presence.numerator > st.presence.denominator ||
					st.participation.numerator > st.participation.denominator
				)
					badDenom++;
				if (st.participation.numerator > ss.scrutinsEligibles) badEligible++;
			}
		}
	}
	check('tous les rates ∈ [0, 1]', badRate === 0, badRate ? `${badRate} mauvaises sessions` : '');
	check(
		'denominator ≥ numerator partout',
		badDenom === 0,
		badDenom ? `${badDenom} mauvaises sessions` : ''
	);
	check(
		'scrutinsEligibles ≥ participation.numerator partout',
		badEligible === 0,
		badEligible ? `${badEligible} mauvaises sessions` : ''
	);

	// Cumul carriere = somme des sessions du mandat (au moins pour ceux ayant ≥ 1 vote)
	if (patriat) {
		const totalSessions = patriat.mandats.flatMap((m) => m.sessions);
		const sumElig = totalSessions.reduce((s, ss) => s + ss.scrutinsEligibles, 0);
		check(
			'Patriat carriere.presence.denominator == Σ session.scrutinsEligibles',
			patriat.carriere.presence.denominator === sumElig,
			`carriere=${patriat.carriere.presence.denominator} vs sum=${sumElig}`
		);
	}

	// ─── F. Vétérans cross-session
	console.log('\nF. Vétérans');
	const veterans = senateurs.filter((s) => s.carriere.sessions.length >= 5);
	check(
		'≥ 50 sénateurs vétérans (≥ 5 sessions)',
		veterans.length >= 50,
		`got ${veterans.length}`
	);
	const veteransTagged = veterans.filter((s) => s.carriere.badgesCarriere.includes('veteran'));
	check(
		'tous les vétérans ont badge "veteran"',
		veteransTagged.length === veterans.length,
		`${veteransTagged.length}/${veterans.length}`
	);

	// ─── G. Transfuges (≥ 2 appartenances stables dans un même mandat)
	console.log('\nG. Transfuges');
	const transfuges = senateurs.filter((s) => s.carriere.badgesCarriere.includes('transfuge'));
	check('≥ 1 transfuge dans le dataset', transfuges.length >= 1, `got ${transfuges.length}`);

	// ─── H. Distribution overalls
	console.log('\nH. Distribution overalls');
	const overallsActifs = senateurs
		.filter((s) => s.identite.etat === 'ACTIF')
		.map((s) => s.carriere.overall);
	if (overallsActifs.length > 0) {
		const moy =
			overallsActifs.reduce((s, v) => s + v, 0) / overallsActifs.length;
		// Réalité Sénat : la moyenne overall des actifs est très haute (~80) parce
		// que la cohorte est presque uniquement des sénateurs effectivement en
		// séance. Pas comparable à l'AN qui mélange ministres / présidents très
		// souvent absents.
		check(
			'moyenne overall actifs ∈ [50, 95]',
			moy >= 50 && moy <= 95,
			`got moyenne=${moy.toFixed(1)}`
		);
	}
	const allOverallsValid = senateurs.every((s) => s.carriere.overall >= 0 && s.carriere.overall <= 99);
	check('tous les overalls carrière ∈ [0, 99]', allOverallsValid);
	// Distribution : il doit y avoir de la variance (pas tous identiques)
	const distinctOveralls = new Set(senateurs.map((s) => s.carriere.overall));
	check(
		'distribution overalls ≥ 30 valeurs distinctes',
		distinctOveralls.size >= 30,
		`got ${distinctOveralls.size}`
	);

	// ─── I. Hémicycle
	console.log('\nI. Hémicycle');
	let badPlace = 0;
	let badSerie = 0;
	for (const s of senateurs) {
		for (const m of s.mandats) {
			if (m.place !== null && (m.place < 1 || m.place > 348)) badPlace++;
			if (m.place !== null && (m.serie !== 1 && m.serie !== 2)) badSerie++;
		}
	}
	check('toutes les places ∈ {1..348} ou null', badPlace === 0, badPlace ? `${badPlace} bad` : '');
	check(
		'serie cohérente quand place définie',
		badSerie === 0,
		badSerie ? `${badSerie} mandats avec place mais sans serie 1|2` : ''
	);
	const placesActives = senateurs
		.flatMap((s) => s.mandats)
		.filter((m) => m.place !== null).length;
	check(
		'≥ 300 mandats actifs avec place définie (≈ 348)',
		placesActives >= 300,
		`got ${placesActives}`
	);

	// ─── J. Garde anti-fusion AN/Sénat (cf ADR 0023)
	console.log('\nJ. Garde anti-fusion AN/Sénat');
	if (existsSync(join(DATA_AN, 'personnes.json'))) {
		const personnesAN = JSON.parse(
			await readFile(join(DATA_AN, 'personnes.json'), 'utf8')
		) as Personne[];
		const idsAN = new Set(personnesAN.map((p) => p.id));
		const idsSenat = new Set(senateurs.map((s) => s.id));
		// Aucun PA-id AN ne doit apparaître dans les matricules Sénat (et vice-versa)
		let collisions = 0;
		for (const id of idsSenat) if (idsAN.has(id)) collisions++;
		check(
			'aucune collision id PA-id AN ↔ matricule Sénat',
			collisions === 0,
			collisions ? `${collisions} collisions` : ''
		);
	} else {
		console.log('  ⊘ personnes.json AN absent — assertion fusion skippée');
	}

	// ─── K. Bilan
	console.log('\n' + '═'.repeat(60));
	console.log(`  ${pass} pass / ${fail} fail (total ${pass + fail})`);
	if (fail > 0) {
		console.log('  ❌ Smoke-test échoué');
		process.exit(1);
	} else {
		console.log('  ✅ Smoke-test 100% vert');
	}
}

main().catch((err) => {
	console.error('\n❌ Smoke-test crash :', err);
	process.exit(1);
});
