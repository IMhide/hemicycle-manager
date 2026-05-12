/**
 * Smoke test pour valider l'output du pipeline Sénat (Phase 3, cf ADR 0023..0029).
 * Lance après `npm run data:fetch:senat`.
 *
 * Scope : ère Macron (depuis 2017-09-24, cf ADR 0029). 3 triennats, 9 sessions,
 * ~672 sénateurs (cohorte cumulée sur les 3 triennats), ~2029 scrutins,
 * ~705k votes nominatifs.
 *
 * Vérifie :
 *  - comptes globaux (sénateurs, mandats, scrutins, votes nominatifs)
 *  - sessions (brique data) et triennats (unité UI, cf ADR 0028)
 *  - groupes par triennat
 *  - cas concrets (Patriat siège 1 LREM, Larcher siège 9 UMP)
 *  - cohérence des stats (rate ∈ [0, 1], denominator ≥ numerator)
 *  - vétérans cross-session, transfuges, distribution overalls
 *  - hémicycle (place ∈ [1, 348], serie ∈ {1, 2})
 *  - garde anti-fusion AN/Sénat
 *  - garde anti-régression triennats (cf ADR 0028 § "Garde anti-régression")
 *  - garde scope ère Macron (cf ADR 0029)
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
	Senateur,
	GroupeSenat,
	SessionMeta,
	TriennatMeta,
	ScrutinSenatIndex,
	BuildMetaSenat,
	Personne,
	TexteSenat
} from '../src/lib/types.ts';
import { TRIENNATS, triennatOfDate } from '../src/lib/triennats.ts';

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
	// Scope ère Macron (ADR 0029) : ~672 sénateurs cumulés sur 3 triennats.
	check(
		'500-900 sénateurs ère Macron (cohorte cumulée 3 triennats)',
		meta.counts.senateurs >= 500 && meta.counts.senateurs <= 900,
		`got ${meta.counts.senateurs}`
	);
	check(
		'≥ 1800 scrutins (depuis 2017-09-24)',
		meta.counts.scrutins >= 1800,
		`got ${meta.counts.scrutins}`
	);
	check(
		'≥ 600k votes nominatifs',
		meta.counts.votesNominatifs >= 600_000,
		`got ${meta.counts.votesNominatifs}`
	);
	check(
		'≥ 8 sessions avec scrutins (2017-2018 → 2025-2026)',
		meta.counts.sessions >= 8,
		`got ${meta.counts.sessions}`
	);
	check(
		'3 triennats avec scrutins (cf ADR 0029)',
		(meta.counts.triennats ?? 0) === 3,
		`got ${meta.counts.triennats ?? 0}`
	);

	// ─── B. Sessions
	console.log('\nB. Sessions');
	const sessions = await loadJson<SessionMeta[]>('sessions.json');
	check('≥ 8 sessions (scope ère Macron)', sessions.length >= 8);
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

	// ─── C. Groupes par triennat (cf ADR 0028)
	console.log('\nC. Groupes par triennat');
	const groupes23_26 = await loadJson<GroupeSenat[]>('groupes/2023-2026.json');
	check(
		'groupes/2023-2026.json contient ≥ 8 groupes',
		groupes23_26.length >= 8,
		`got ${groupes23_26.length}`
	);
	const codes23_26 = new Set(groupes23_26.map((g) => g.code));
	for (const c of ['SOC', 'UMP', 'UC', 'CRC', 'GEST', 'RDSE', 'LREM', 'RTLI']) {
		check(`code ${c} présent en 2023-2026`, codes23_26.has(c));
	}
	check(
		'tous les groupes 2023-2026 ont une couleur hex',
		groupes23_26.every((g) => /^#[0-9a-fA-F]{6}$/.test(g.couleur))
	);
	const totalEff23_26 = groupes23_26.reduce((s, g) => s + g.effectifFin, 0);
	// Note : sur 3 ans, les effectifs cumulent les sénateurs ayant siégé (incl. successions)
	// → la somme dépasse 348 (nombre instantané de sièges). Bornes larges.
	check(
		'somme des effectifs 2023-2026 ∈ [320, 600]',
		totalEff23_26 >= 320 && totalEff23_26 <= 600,
		`got ${totalEff23_26}`
	);
	check(
		'tous les groupes 2023-2026 ont triennat = "2023-2026"',
		groupes23_26.every((g) => g.triennat === '2023-2026')
	);

	// Vérifier qu'au moins 1 groupe historique apparaît dans le premier triennat de l'ère Macron
	const groupes17_20 = await loadJson<GroupeSenat[]>('groupes/2017-2020.json').catch(() => null);
	if (groupes17_20) {
		const codes17_20 = new Set(groupes17_20.map((g) => g.code));
		const hasHistoricalCode = ['UMP', 'UC', 'SOC', 'RDSE'].some((c) => codes17_20.has(c));
		check('groupes/2017-2020.json contient des codes historiques', hasHistoricalCode);
	}

	// Garde scope (ADR 0029) : aucun fichier groupes/ pour les triennats hors scope
	for (const oldId of ['2006-2008', '2008-2011', '2011-2014', '2014-2017']) {
		const exists = existsSync(join(DATA, 'groupes', `${oldId}.json`));
		check(`groupes/${oldId}.json absent (hors scope ère Macron)`, !exists);
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

	// ─── J. Garde anti-régression Triennats (cf ADR 0028)
	console.log('\nJ. Garde anti-régression Triennats');
	const triennatsMeta = await loadJson<TriennatMeta[]>('triennats.json');
	check('triennats.json existe et n\'est pas vide', triennatsMeta.length > 0);
	const triennatIds = triennatsMeta.map((t) => t.id);
	check(
		'triennats.json = exactement 3 triennats ère Macron (cf ADR 0029)',
		triennatIds.length === 3 &&
			['2017-2020', '2020-2023', '2023-2026'].every((id) => triennatIds.includes(id)),
		`got [${triennatIds.join(', ')}]`
	);
	check(
		'triennats.json ⊆ table figée TRIENNATS',
		triennatIds.every((id) => TRIENNATS.some((t) => t.id === id)),
		`got ${triennatIds.join(', ')}`
	);
	check(
		'triennat 2023-2026 présent (en cours)',
		triennatIds.includes('2023-2026')
	);
	check(
		'triennat 2023-2026 marqué enCours',
		triennatsMeta.find((t) => t.id === '2023-2026')?.enCours === true
	);
	check(
		'aucun triennat hors scope (2006-2008, 2008-2011, 2011-2014, 2014-2017)',
		!triennatIds.some((id) =>
			['2006-2008', '2008-2011', '2011-2014', '2014-2017'].includes(id)
		)
	);
	const tri23_26 = triennatsMeta.find((t) => t.id === '2023-2026');
	if (tri23_26) {
		check(
			'triennat 2023-2026 sessions ⊆ [2023, 2024, 2025]',
			tri23_26.sessions.every((s) => s >= 2023 && s <= 2025),
			`got [${tri23_26.sessions.join(', ')}]`
		);
		check(
			'triennat 2023-2026 nbSenateursActifs ∈ [320, 450]',
			tri23_26.nbSenateursActifs >= 320 && tri23_26.nbSenateursActifs <= 450,
			`got ${tri23_26.nbSenateursActifs}`
		);
	}

	// Mandat 2017-2023 (Patriat, élu 2017 série 2 jusqu'à fin 2023) doit avoir 2 entrées triennat
	if (patriat) {
		const m17 = patriat.mandats.find(
			(m) => m.datePriseFonction.startsWith('2017') && m.dateFinFonction?.startsWith('2023')
		);
		if (m17) {
			const triIds = m17.triennats.map((t) => t.triennat).sort();
			check(
				'Patriat mandat 2017-2023 a 2 entrées triennats : 2017-2020 + 2020-2023',
				triIds.includes('2017-2020') && triIds.includes('2020-2023'),
				`got [${triIds.join(', ')}]`
			);
		}
	}

	// Vérifier qu'aucun mandat n'a un triennat hors table figée
	let badTriennats = 0;
	for (const s of senateurs) {
		for (const m of s.mandats) {
			for (const t of m.triennats) {
				if (!TRIENNATS.some((tr) => tr.id === t.triennat)) badTriennats++;
			}
		}
	}
	check(
		'aucun mandat n\'a un triennat hors table figée',
		badTriennats === 0,
		badTriennats ? `${badTriennats} bad` : ''
	);

	// Cohérence stats triennat : rate ∈ [0,1], denominator ≥ numerator
	let badTriRate = 0;
	let badTriDenom = 0;
	for (const s of senateurs) {
		for (const m of s.mandats) {
			for (const t of m.triennats) {
				const st = t.stats;
				if (
					st.presence.rate < 0 ||
					st.presence.rate > 1 ||
					st.participation.rate < 0 ||
					st.participation.rate > 1
				)
					badTriRate++;
				if (
					st.presence.numerator > st.presence.denominator ||
					st.participation.numerator > st.participation.denominator
				)
					badTriDenom++;
			}
		}
	}
	check('rates triennat ∈ [0, 1] partout', badTriRate === 0, badTriRate ? `${badTriRate} bad` : '');
	check(
		'denominator ≥ numerator triennat partout',
		badTriDenom === 0,
		badTriDenom ? `${badTriDenom} bad` : ''
	);

	// Cohérence carriere.triennats = union des m.triennats
	let badCarriereTri = 0;
	for (const s of senateurs) {
		const expected = new Set<string>();
		for (const m of s.mandats) for (const t of m.triennats) expected.add(t.triennat);
		const got = new Set(s.carriere.triennats);
		if (expected.size !== got.size || [...expected].some((id) => !got.has(id))) badCarriereTri++;
	}
	check(
		'carriere.triennats = union des m.triennats',
		badCarriereTri === 0,
		badCarriereTri ? `${badCarriereTri} bad` : ''
	);

	// Borne `[debut, fin)` : un scrutin pile à la date de renouvellement appartient au triennat suivant
	check(
		'triennatOfDate("2023-09-24") = 2023-2026 (renouv. série 2)',
		triennatOfDate('2023-09-24')?.id === '2023-2026'
	);
	check(
		'triennatOfDate("2023-09-23") = 2020-2023 (veille du renouv.)',
		triennatOfDate('2023-09-23')?.id === '2020-2023'
	);

	// ─── K. Garde anti-fusion AN/Sénat (cf ADR 0023)
	console.log('\nK. Garde anti-fusion AN/Sénat');
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

	// ─── L. Textes législatifs Sénat (N3.b navette)
	console.log('\nL. Textes législatifs Sénat');
	const textes = await loadJson<TexteSenat[]>('textes.json');
	check(
		'textes.json non vide',
		textes.length > 0,
		`got ${textes.length}`
	);
	check(
		'≈ 400-800 textes Sénat ère Macron (3 triennats)',
		textes.length >= 400 && textes.length <= 800,
		`got ${textes.length}`
	);

	// Cas canonique : couverture matching dosleg
	const enrichis = textes.filter((t) => t.enrichiDosleg);
	const enrichiePct = enrichis.length / textes.length;
	check(
		'≥ 40% des textes Sénat enrichis via dosleg (matching titre)',
		enrichiePct >= 0.4,
		`got ${(enrichiePct * 100).toFixed(1)}% (${enrichis.length}/${textes.length})`
	);

	// Cas canonique : id discipline
	const dlrNonEnrichi = textes.filter((t) => !t.id.startsWith('sig-') && !t.enrichiDosleg);
	check(
		'Tous les textes id=loicod sont enrichis',
		dlrNonEnrichi.length === 0,
		`${dlrNonEnrichi.length} avec id loicod mais non enrichi`
	);
	const sigEnrichi = textes.filter((t) => t.id.startsWith('sig-') && t.enrichiDosleg);
	check(
		"Aucun texte id=sig-* n'est marqué enrichi",
		sigEnrichi.length === 0,
		`${sigEnrichi.length} avec id sig- mais enrichi`
	);

	// Cas canonique : chronologie
	const datesIncoherentes = textes.filter((t) => t.dateDebut > t.dateFin);
	check(
		'Tous les textes ont dateDebut ≤ dateFin',
		datesIncoherentes.length === 0,
		`${datesIncoherentes.length} incohérents`
	);

	// Cas canonique : nbScrutins == scrutins.length
	const tailleIncoherente = textes.filter((t) => t.nbScrutins !== t.scrutins.length);
	check(
		'Tous les textes ont nbScrutins == scrutins.length',
		tailleIncoherente.length === 0,
		`${tailleIncoherente.length} incohérents`
	);

	// Cas canonique : triennat valide (parmi 3 connus)
	const triennatsValides = new Set(['2017-2020', '2020-2023', '2023-2026']);
	const triennatIncoherent = textes.filter((t) => !triennatsValides.has(t.triennat));
	check(
		'Tous les textes ont un triennat valide (ère Macron)',
		triennatIncoherent.length === 0,
		`${triennatIncoherent.length} hors triennat`
	);

	// Cas canonique : promulgués avec date JO
	const promulgues = textes.filter((t) => t.etat === 'promulgue');
	check(
		'≥ 100 textes Sénat promulgués sur 3 triennats',
		promulgues.length >= 100,
		`got ${promulgues.length}`
	);
	// Certains dossiers `loi.etaloicod=04` n'ont pas de `loi.loidatjo` (saisie
	// incomplète côté Sénat) — on tolère jusqu'à 15% d'absence.
	const promulguesSansDate = promulgues.filter((t) => !t.datePromulgation);
	const pctSansDate = promulgues.length === 0 ? 0 : promulguesSansDate.length / promulgues.length;
	check(
		'≥ 85% des textes promulgués ont une datePromulgation',
		pctSansDate <= 0.15,
		`${promulguesSansDate.length}/${promulgues.length} sans date (${(pctSansDate * 100).toFixed(1)}%)`
	);

	// Cas canonique : scrutins-index a un texteId sur chaque entrée
	const scrutinsIdx = await loadJson<ScrutinSenatIndex[]>('scrutins-index.json');
	check(
		'scrutins-index.json a un champ texteId sur chaque entrée',
		scrutinsIdx.every((s) => 'texteId' in s)
	);
	const scAvec = scrutinsIdx.filter((s) => s.texteId);
	check(
		'≥ 95% des scrutins Sénat ont un texteId (cible ~100%)',
		scAvec.length / scrutinsIdx.length >= 0.95,
		`got ${((scAvec.length / scrutinsIdx.length) * 100).toFixed(1)}%`
	);

	// ─── M. Bilan
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
