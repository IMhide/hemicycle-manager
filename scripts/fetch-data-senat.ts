/**
 * PolitiDex — pipeline data Sénat (Phase 3, cf ADR 0023..0028).
 *
 * Outputs (sous static/data/senat/) :
 *  - senateurs.json                : Senateur[] avec mandats[] et carriere
 *  - triennats.json                : TriennatMeta[] (3 triennats ère Macron, cf ADR 0028 + 0029)
 *  - sessions.json                 : SessionMeta[] (brique data sous-jacente)
 *  - groupes/{periode}.json        : GroupeSenat[] par triennat (ex. "2023-2026.json")
 *  - scrutins-index.json           : ScrutinSenatIndex[] global
 *  - scrutins/{sesann}-{scrnum}.json : ScrutinSenatDetail
 *  - historique/{matricule}.json   : VoteHistoryItemSenat[] tous mandats confondus
 *  - meta.json                     : BuildMetaSenat
 *
 * Sources (cf ADR 0025) :
 *  1. senat.fr/api-senat/senateurs.json (live, siege/serie)
 *  2. data.senat.fr ODSEN_*.csv (identité historique + appartenances + mandats)
 *  3. data.senat.fr dosleg.zip (scrutins + fallback identité)
 *
 * Logique pure factorisée dans scripts/lib/{cache,dosleg-parser,senat-transform}.ts
 * et src/lib/triennats.ts, couverte par des tests unitaires (`npm run test:unit`).
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import type {
	Senateur,
	SenateurIdentite,
	MandatSenat,
	SessionStats,
	TriennatStats,
	AppartenanceGroupeSenat,
	CarriereSenatAggregee,
	GroupeSenat,
	SessionMeta,
	TriennatMeta,
	ScrutinSenatIndex,
	ScrutinSenatDetail,
	VoteHistoryItemSenat,
	BuildMetaSenat,
	MandatStats,
	MandatRangs,
	VotePosition,
	BadgeMandat,
	BadgeCarriere
} from '../src/lib/types.ts';
import { POLITICAL_ORDER } from '../src/lib/political-order.ts';
import {
	TRIENNATS,
	type TriennatId,
	triennatOfDate,
	triennatsOfPeriode
} from '../src/lib/triennats.ts';
import { downloadFile, downloadZip, ensureDir, extractIfNeeded } from './lib/cache.ts';
import { parseOdsenCsv, streamCopyBlocks } from './lib/dosleg-parser.ts';
import { sessionsCovering, groupeAuVote } from './lib/senat-transform.ts';
import { readApiSenateursOrEmpty, type ApiSenateurRaw } from './lib/senat-sources.ts';
import {
	buildFamillesIndex,
	familleSenat,
	type FamillesIndex,
	type FamillesManifest
} from './lib/groupes-familles.ts';
import { buildDossierSenatFromRow, type DossierSenat } from './lib/dosleg-textes.ts';
import { aggregeTextesSenat, type ScrutinSenatPourAgreg } from './lib/textes-senat.ts';
import type { TexteSenat } from '../src/lib/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'static', 'data', 'senat');
const CACHE_DIR = join(tmpdir(), 'politidex-cache-senat');

const SOURCES = {
	apiLive: 'https://www.senat.fr/api-senat/senateurs.json',
	odsenGeneral: 'https://data.senat.fr/data/senateurs/ODSEN_GENERAL.json',
	odsenHistog: 'https://data.senat.fr/data/senateurs/ODSEN_HISTOGROUPES.csv',
	odsenElusen: 'https://data.senat.fr/data/senateurs/ODSEN_ELUSEN.csv',
	dosleg: 'https://data.senat.fr/data/dosleg/dosleg.zip'
} as const;

/**
 * Borne temporelle "ère Macron" (cf ADR 0029) : on ne traite que les scrutins
 * et mandats effectifs à partir du 24 septembre 2017 (renouvellement série 2,
 * début du triennat 2017-2020).
 */
const SCOPE_DATE_DEBUT = TRIENNATS[0].dateDebut; // '2017-09-24'

// ────────────────────────────────────────────────────────────────────────────
// Types raw (intermédiaires, scopés à ce script)
// ────────────────────────────────────────────────────────────────────────────

type ApiSenateur = ApiSenateurRaw;

interface OdsenGeneralRow {
	Matricule: string;
	Qualite: string; // "M." ou "Mme"
	Nom_usuel: string;
	Prenom_usuel: string;
	Etat: 'ACTIF' | 'ANCIEN';
	Date_naissance: string | null;
	Date_de_deces: string | null;
	Groupe_politique: string | null;
	Type_d_app_au_grp_politique: string | null;
	Commission_permanente: string | null;
	Circonscription: string | null;
	Fonction_au_Bureau_du_Senat: string | null;
	PCS_INSEE: string | null;
	Categorie_professionnelle: string | null;
	Description_de_la_profession: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Étape principale
// ────────────────────────────────────────────────────────────────────────────

async function main() {
	console.log('🏛️  PolitiDex Sénat — pipeline data\n');

	await ensureDir(CACHE_DIR);
	await ensureDir(OUT_DIR);
	await ensureDir(join(OUT_DIR, 'scrutins'));
	await ensureDir(join(OUT_DIR, 'groupes'));
	await ensureDir(join(OUT_DIR, 'historique'));

	// Table de familles politiques (cf ADR 0034) — utilisée par computeCarriere
	// pour neutraliser les renommages de groupes.
	const famillesPath = join(ROOT, 'static', 'data', 'groupes-familles.json');
	const famillesManifest = JSON.parse(
		await readFile(famillesPath, 'utf8')
	) as FamillesManifest;
	const famillesIdx = buildFamillesIndex(famillesManifest);
	console.log(
		`   Familles politiques : ${Object.keys(famillesManifest.familles).length} familles, ${famillesIdx.senat.size} groupes Sénat mappés\n`
	);

	// ═══ 1/5 Téléchargement
	console.log('1/5  Téléchargement des sources Sénat');
	const apiPath = join(CACHE_DIR, 'senateurs-api.json');
	const odsenGeneralPath = join(CACHE_DIR, 'odsen-general.json');
	const odsenHistogPath = join(CACHE_DIR, 'odsen-histogroupes.csv');
	const odsenElusenPath = join(CACHE_DIR, 'odsen-elusen.csv');
	const doslegPath = join(CACHE_DIR, 'dosleg.zip');

	await Promise.all([
		downloadFile(SOURCES.apiLive, apiPath),
		downloadFile(SOURCES.odsenGeneral, odsenGeneralPath),
		downloadFile(SOURCES.odsenHistog, odsenHistogPath),
		downloadFile(SOURCES.odsenElusen, odsenElusenPath)
	]);
	await downloadZip(SOURCES.dosleg, doslegPath);

	// ═══ 2/5 Extraction
	console.log('\n2/5  Extraction du dump dosleg');
	const doslegDir = join(CACHE_DIR, 'dosleg-extracted');
	await extractIfNeeded(doslegPath, doslegDir, 'dosleg.sql', 0, 'dosleg');
	const doslegSql = join(doslegDir, 'dosleg.sql');

	// ═══ 3/5 Parsing
	console.log('\n3/5  Parsing des sources');

	console.log('  • api-senat/senateurs.json…');
	// Source api-senat = enrichissement (siege/serie/photo/groupe live), cf ADR 0025.
	// Si le CDN senat.fr renvoie un payload vide ou invalide (cas observé 2026-05-07 :
	// 200 OK + 0 octet pendant régénération CDN), on bascule sur ODSEN+dosleg pour
	// l'identité et les mandats — `siege`/`serie` seront simplement `null` ce build.
	const apiActive = readApiSenateursOrEmpty(await readFile(apiPath, 'utf8'));
	const apiByMat = new Map(apiActive.map((s) => [s.matricule, s]));
	console.log(`    → ${apiActive.length} sénateurs en exercice`);

	console.log('  • ODSEN_GENERAL.json…');
	const odsenRaw = JSON.parse(await readFile(odsenGeneralPath, 'utf8')) as {
		results: OdsenGeneralRow[];
	};
	const odsenByMat = new Map(odsenRaw.results.map((r) => [r.Matricule, r]));
	console.log(`    → ${odsenRaw.results.length} sénateurs (ACTIF + ANCIEN)`);

	console.log('  • ODSEN_HISTOGROUPES.csv…');
	const histogRows = parseOdsenCsv(await readFile(odsenHistogPath));
	const histogByMat = groupBy(histogRows, (r) => r.Matricule);
	console.log(`    → ${histogRows.length} appartenances groupe historiques`);

	console.log('  • ODSEN_ELUSEN.csv…');
	const elusenRows = parseOdsenCsv(await readFile(odsenElusenPath));
	const elusenByMat = groupBy(elusenRows, (r) => r.Matricule);
	console.log(`    → ${elusenRows.length} mandats sénatoriaux`);

	console.log('  • dosleg.sql (streaming)…');
	const t0 = Date.now();
	const auteurByMat = new Map<string, Record<string, string | null>>();
	const scrRows: Record<string, string | null>[] = [];
	const votsenByScrutin = new Map<string, Array<{ senmat: string; posvotcod: string }>>();
	const sesLib = new Map<number, string>();
	// N3.b navette : on collecte aussi les dossiers `loi` (sans filtre) pour
	// pouvoir matcher les scrutins ère Macron par signature titre. Le filtrage
	// "ère Macron" est sans intérêt côté dossier puisqu'un dossier ancien peut
	// avoir des scrutins récents (réintroduction, reprise).
	const loiRows: Record<string, string | null>[] = [];

	await streamCopyBlocks(
		doslegSql,
		new Set(['scr', 'votsen', 'auteur', 'ses', 'loi']),
		(table, cols, values) => {
			const row = makeRow(cols, values);
			switch (table) {
				case 'auteur': {
					if (row.autmat) auteurByMat.set(row.autmat, row);
					break;
				}
				case 'scr':
					scrRows.push(row);
					break;
				case 'votsen': {
					const uid = `${row.sesann}-${row.scrnum}`;
					const arr = votsenByScrutin.get(uid) ?? [];
					arr.push({ senmat: row.senmat as string, posvotcod: row.posvotcod as string });
					votsenByScrutin.set(uid, arr);
					break;
				}
				case 'ses':
					sesLib.set(Number(row.sesann), (row.seslib ?? '').trim());
					break;
				case 'loi':
					loiRows.push(row);
					break;
			}
		}
	);
	const dtParse = ((Date.now() - t0) / 1000).toFixed(1);
	console.log(
		`    → ${scrRows.length} scrutins, ${[...votsenByScrutin.values()].reduce((s, a) => s + a.length, 0)} votes nominatifs, ${auteurByMat.size} auteurs, ${sesLib.size} sessions (${dtParse}s)`
	);

	// Filtrage scope ère Macron (ADR 0029) : scrutins antérieurs au 2017-09-24 exclus
	const scrRowsBeforeFilter = scrRows.length;
	const scrRowsFiltered = scrRows.filter((r) => {
		const date = (r.scrdat ?? '').slice(0, 10);
		return date >= SCOPE_DATE_DEBUT;
	});
	const droppedUids = new Set(
		scrRows
			.filter((r) => (r.scrdat ?? '').slice(0, 10) < SCOPE_DATE_DEBUT)
			.map((r) => `${r.sesann}-${r.scrnum}`)
	);
	for (const uid of droppedUids) votsenByScrutin.delete(uid);
	scrRows.length = 0;
	scrRows.push(...scrRowsFiltered);
	console.log(
		`    → scope ère Macron : ${scrRows.length} scrutins conservés (${scrRowsBeforeFilter - scrRows.length} drop avant ${SCOPE_DATE_DEBUT})`
	);

	// ═══ 4/5 Transformations
	console.log('\n4/5  Construction des structures');

	// 4.1 Sénateurs (cascade priorité ADR 0025)
	console.log('  • Sénateurs (cascade ADR 0025)…');
	const senateursAll = buildSenateurs({
		apiByMat,
		odsenByMat,
		auteurByMat,
		histogByMat,
		elusenByMat
	});
	// Filtrage scope ère Macron (ADR 0029) : on ne garde que les sénateurs avec
	// au moins un mandat encore actif le 2017-09-24 (dateFinFonction null ou >= scope).
	const senateurs = senateursAll
		.map((s) => ({
			...s,
			mandats: s.mandats.filter(
				(m) => m.dateFinFonction === null || m.dateFinFonction >= SCOPE_DATE_DEBUT
			)
		}))
		.filter((s) => s.mandats.length > 0);
	console.log(
		`    → ${senateurs.length} sénateurs dans le scope (${senateursAll.length - senateurs.length} drop pré-${SCOPE_DATE_DEBUT})`
	);

	// 4.2 Scrutins (index + détails)
	console.log('  • Scrutins…');
	const { scrutinsIndex, scrutinsDetails } = buildScrutins(scrRows, votsenByScrutin, senateurs);
	console.log(`    → ${scrutinsIndex.length} scrutins (vue index + ${scrutinsDetails.size} détails)`);

	// 4.2 bis Textes législatifs Sénat (N3.b navette, cf textes-senat.ts)
	console.log('  • Textes législatifs (matching scrutin↔loi par signature titre)…');
	const dossiersSenat: DossierSenat[] = loiRows.map(buildDossierSenatFromRow);
	const scrutinsPourAgreg: ScrutinSenatPourAgreg[] = scrutinsIndex.map((s) => ({
		uid: s.uid,
		sesann: s.sesann,
		scrnum: s.scrnum,
		date: s.date,
		titre: s.titre,
		sort: s.sort
	}));
	const { textes: textesSenat, scrutinToTexte: scrutinToTexteSenat } = aggregeTextesSenat(
		scrutinsPourAgreg,
		dossiersSenat
	);
	// Mutation des index + détails pour propager le texteId
	for (const s of scrutinsIndex) s.texteId = scrutinToTexteSenat.get(s.uid) ?? null;
	for (const [, d] of scrutinsDetails) d.texteId = scrutinToTexteSenat.get(d.uid) ?? null;
	const enrichisCount = textesSenat.filter((t) => t.enrichiDosleg).length;
	console.log(
		`    → ${textesSenat.length} textes Sénat (${enrichisCount} enrichis via dosleg, ${textesSenat.length - enrichisCount} signature)`
	);

	// 4.3 Stats par session
	console.log('  • Stats Présence/Participation/Loyauté/Frondes par session…');
	const t1 = Date.now();
	computeStatsAllSessions(senateurs, scrutinsIndex, scrutinsDetails);
	console.log(`    → calcul terminé (${((Date.now() - t1) / 1000).toFixed(1)}s)`);

	// 4.4 Rangs et badges par triennat, overalls par triennat (cf ADR 0028)
	console.log('  • Rangs, badges, overalls par triennat…');
	const allSesanns = collectAllSesanns(senateurs);
	const allTriennats = collectAllTriennats(senateurs);
	for (const triennatId of allTriennats) {
		computeRangsForTriennat(triennatId, senateurs);
		computeBadgesForTriennat(triennatId, senateurs);
		computeOverallsForTriennat(triennatId, senateurs);
	}

	// 4.5 Cumuls mandat + carrière
	console.log('  • Cumul mandat + carrière + overall carrière…');
	for (const s of senateurs) {
		for (const m of s.mandats) computeMandatCumul(m);
		computeCarriere(s, famillesIdx);
	}
	computeOverallsCarriere(senateurs);

	// 4.6 Groupes par triennat — uniquement pour les triennats avec scrutins
	console.log('  • Groupes par triennat…');
	const triennatsWithScrutins = new Set<TriennatId>();
	for (const s of scrutinsIndex) {
		const t = triennatOfDate(s.date);
		if (t) triennatsWithScrutins.add(t.id);
	}
	const triennatIdsForGroupes = allTriennats.filter((t) => triennatsWithScrutins.has(t));
	const groupesByTriennat = buildGroupesByTriennat(senateurs, triennatIdsForGroupes, apiByMat);
	console.log(
		`    → ${groupesByTriennat.size} triennats de groupes (filtrés sur triennats avec scrutins)`
	);

	// 4.7 Historiques compacts
	console.log('  • Historiques compacts par sénateur…');
	const historiques = buildHistoriques(senateurs, scrutinsIndex, scrutinsDetails);

	// 4.8 Sessions meta + triennats meta
	console.log('  • Sessions meta + triennats meta…');
	const sessionsMeta = buildSessionsMeta(scrutinsIndex, senateurs, sesLib);
	const triennatsMeta = buildTriennatsMeta(scrutinsIndex, senateurs);

	// ═══ 5/5 Write
	console.log('\n5/5  Écriture des fichiers JSON');
	await writeFile(join(OUT_DIR, 'senateurs.json'), JSON.stringify(senateurs));
	console.log(`  ✓ senateurs.json (${senateurs.length} sénateurs)`);

	await writeFile(join(OUT_DIR, 'sessions.json'), JSON.stringify(sessionsMeta));
	console.log(`  ✓ sessions.json (${sessionsMeta.length} sessions, brique data)`);

	await writeFile(join(OUT_DIR, 'triennats.json'), JSON.stringify(triennatsMeta));
	console.log(`  ✓ triennats.json (${triennatsMeta.length} triennats, cf ADR 0028)`);

	await writeFile(join(OUT_DIR, 'scrutins-index.json'), JSON.stringify(scrutinsIndex));
	console.log(`  ✓ scrutins-index.json (${scrutinsIndex.length} scrutins)`);

	await writeFile(join(OUT_DIR, 'textes.json'), JSON.stringify(textesSenat));
	console.log(`  ✓ textes.json (${textesSenat.length} textes Sénat, ${enrichisCount} enrichis)`);

	for (const [triennatId, groupes] of groupesByTriennat) {
		await writeFile(join(OUT_DIR, 'groupes', `${triennatId}.json`), JSON.stringify(groupes));
	}
	console.log(`  ✓ groupes/{periode}.json (${groupesByTriennat.size} fichiers)`);

	let scrutinWritten = 0;
	for (const [uid, detail] of scrutinsDetails) {
		await writeFile(join(OUT_DIR, 'scrutins', `${uid}.json`), JSON.stringify(detail));
		scrutinWritten++;
		if (scrutinWritten % 1000 === 0)
			console.log(`    … scrutins ${scrutinWritten}/${scrutinsDetails.size}`);
	}
	console.log(`  ✓ scrutins/{uid}.json (${scrutinWritten} fichiers)`);

	let histWritten = 0;
	for (const [matricule, hist] of historiques) {
		await writeFile(join(OUT_DIR, 'historique', `${matricule}.json`), JSON.stringify(hist));
		histWritten++;
		if (histWritten % 500 === 0)
			console.log(`    … historiques ${histWritten}/${historiques.size}`);
	}
	console.log(`  ✓ historique/{matricule}.json (${histWritten} fichiers)`);

	const meta: BuildMetaSenat = {
		generatedAt: new Date().toISOString(),
		sessions: sessionsMeta.map((s) => s.sesann), // sessions avec scrutins (brique data)
		triennats: triennatsMeta.map((t) => t.id), // triennats avec scrutins (cf ADR 0028)
		counts: {
			senateurs: senateurs.length,
			mandats: senateurs.reduce((s, p) => s + p.mandats.length, 0),
			groupesUniques: countDistinctGroupCodes(senateurs),
			sessions: sessionsMeta.length,
			triennats: triennatsMeta.length,
			scrutins: scrutinsIndex.length,
			votesNominatifs: scrutinWritten > 0 ? sumVotesIn(scrutinsDetails) : 0
		},
		sources: SOURCES as unknown as Record<string, string>
	};
	await writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));
	console.log(`  ✓ meta.json`);

	console.log('\n✅ Terminé.');
	console.log(`   Output : ${OUT_DIR}`);
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers d'orchestration
// ────────────────────────────────────────────────────────────────────────────

function makeRow(cols: string[], values: (string | null)[]): Record<string, string | null> {
	const row: Record<string, string | null> = {};
	for (let i = 0; i < cols.length; i++) row[cols[i]] = values[i] ?? null;
	return row;
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
	const out = new Map<string, T[]>();
	for (const r of rows) {
		const k = key(r);
		const arr = out.get(k) ?? [];
		arr.push(r);
		out.set(k, arr);
	}
	return out;
}

// ────────────────────────────────────────────────────────────────────────────
// buildSenateurs : cascade ADR 0025 (api > ODSEN > auteur)
// ────────────────────────────────────────────────────────────────────────────

interface BuildSenateursInputs {
	apiByMat: Map<string, ApiSenateur>;
	odsenByMat: Map<string, OdsenGeneralRow>;
	auteurByMat: Map<string, Record<string, string | null>>;
	histogByMat: Map<string, Record<string, string>[]>;
	elusenByMat: Map<string, Record<string, string>[]>;
}

function buildSenateurs(inputs: BuildSenateursInputs): Senateur[] {
	const matricules = new Set<string>();
	for (const m of inputs.apiByMat.keys()) matricules.add(m);
	for (const m of inputs.odsenByMat.keys()) matricules.add(m);
	for (const m of inputs.auteurByMat.keys()) matricules.add(m);

	const out: Senateur[] = [];
	for (const matricule of matricules) {
		const api = inputs.apiByMat.get(matricule) ?? null;
		const ods = inputs.odsenByMat.get(matricule) ?? null;
		const aut = inputs.auteurByMat.get(matricule) ?? null;
		if (!ods && !aut) continue; // matricule fantôme côté api seulement

		const identite = pickIdentite(matricule, api, ods, aut);
		const mandats = assembleMandats(
			matricule,
			inputs.elusenByMat.get(matricule) ?? [],
			inputs.histogByMat.get(matricule) ?? [],
			api,
			ods?.Circonscription ?? null
		);
		if (mandats.length === 0) continue;

		out.push({ id: matricule, identite, mandats, carriere: emptyCarriere() });
	}
	out.sort((a, b) => a.identite.nom.localeCompare(b.identite.nom));
	return out;
}

function pickIdentite(
	matricule: string,
	api: ApiSenateur | null,
	ods: OdsenGeneralRow | null,
	aut: Record<string, string | null> | null
): SenateurIdentite {
	const civ = (ods?.Qualite ?? api?.civilite ?? aut?.quacod ?? 'M.').trim();
	const sexe: 'F' | 'M' = civ.toLowerCase().startsWith('mme') ? 'F' : 'M';
	const photoUrl = api?.urlAvatar
		? `https://www.senat.fr${api.urlAvatar}`
		: buildSenateurPhotoFallback(matricule, ods, aut);
	return {
		civ,
		prenom: ods?.Prenom_usuel ?? api?.prenom ?? aut?.prenom ?? '',
		nom: ods?.Nom_usuel ?? api?.nom ?? aut?.nomuse ?? '',
		sexe,
		dateNaissance: parseOdsenDate(ods?.Date_naissance ?? null),
		dateDeces: parseOdsenDate(ods?.Date_de_deces ?? null),
		villeNaissance: null, // ODSEN_GENERAL n'expose pas la ville (champ Etalab AN seul)
		photoUrl,
		professionDeclaree: ods?.Description_de_la_profession ?? null,
		categorieProfessionnelle: ods?.Categorie_professionnelle ?? null,
		etat: (ods?.Etat ?? 'ACTIF') as 'ACTIF' | 'ANCIEN'
	};
}

function buildSenateurPhotoFallback(
	matricule: string,
	ods: OdsenGeneralRow | null,
	_aut: Record<string, string | null> | null
): string {
	// Convention senat.fr/senimg : `<nom>_<prenom><matricule>_carre.jpg` lowercase
	const slug = (ods?.Nom_usuel ?? '').toLowerCase().replace(/[^a-z]/g, '_');
	const slugPrenom = (ods?.Prenom_usuel ?? '').toLowerCase().replace(/[^a-z]/g, '_');
	if (!slug || !slugPrenom) return '';
	return `https://www.senat.fr/senimg/${slug}_${slugPrenom}${matricule.toLowerCase()}_carre.jpg`;
}

/** Parse "1956/12/28 00:00:00" ou "1956-12-28 ..." → "1956-12-28". null sur null/vide. */
function parseOdsenDate(raw: string | null): string | null {
	if (!raw) return null;
	const m = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
	if (!m) return null;
	return `${m[1]}-${m[2]}-${m[3]}`;
}

function assembleMandats(
	matricule: string,
	elusenRows: Record<string, string>[],
	histogRows: Record<string, string>[],
	api: ApiSenateur | null,
	circonscription: string | null
): MandatSenat[] {
	const out: MandatSenat[] = [];

	// Trier les mandats ELUSEN par date début pour ordre chronologique
	const sorted = [...elusenRows].sort((a, b) =>
		(a['Date de début de mandat'] ?? '').localeCompare(b['Date de début de mandat'] ?? '')
	);
	for (const m of sorted) {
		const datePriseFonction = parseOdsenDate(m['Date de début de mandat']) ?? '';
		const dateFinFonction = parseOdsenDate(m['Date de fin de mandat']);
		if (!datePriseFonction) continue; // mandat malformé

		const sessions = sessionsCovering(datePriseFonction, dateFinFonction).map<SessionStats>(
			(sesann) => ({
				sesann,
				scrutinsEligibles: 0,
				stats: emptyMandatStats(),
				rangs: emptyMandatRangs()
			})
		);

		// Appartenances groupe filtrées par chevauchement avec ce mandat
		const apps: AppartenanceGroupeSenat[] = histogRows
			.map((h) => {
				const dateDebut = parseOdsenDate(h["Date de début d'appartenance"] ?? '') ?? '';
				const dateFin = parseOdsenDate(h["Date de fin d'appartenance"] ?? '') ?? null;
				return {
					groupeCode: h['Code du groupe politique'] ?? 'AUCUN',
					groupeNomCourt: h['Nom court du groupe politique'] ?? '',
					dateDebut,
					dateFin,
					fonction: h['Nom court fonction'] ?? 'Membre',
					fonctionDateDebut: parseOdsenDate(h['Date de début de la fonction']),
					fonctionDateFin: parseOdsenDate(h['Date de fin de la fonction'])
				};
			})
			.filter((a) => a.dateDebut !== '')
			.filter((a) => {
				// chevauchement ouvert avec [datePriseFonction, dateFinFonction]
				const aFin = a.dateFin ?? '9999-12-31';
				const mFin = dateFinFonction ?? '9999-12-31';
				return a.dateDebut <= mFin && aFin >= datePriseFonction;
			})
			.sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));

		// Dedup sur (groupeCode, dateDebut) : une appartenance peut générer
		// plusieurs lignes dans HISTOGROUPES (une par fonction successive)
		const dedupKey = (a: AppartenanceGroupeSenat) => `${a.groupeCode}|${a.dateDebut}`;
		const seen = new Map<string, AppartenanceGroupeSenat>();
		for (const a of apps) {
			const k = dedupKey(a);
			if (!seen.has(k)) seen.set(k, a);
		}

		// `place`/`serie` : uniquement pour le mandat actif d'un sénateur en exercice
		const isActive = !dateFinFonction;
		const place = isActive && api?.siege ? api.siege : null;
		const serie = isActive && api?.serie ? (parseInt(api.serie, 10) as 1 | 2) : null;

		out.push({
			eluId: m['Identifiant mandat'] ?? `${matricule}-${datePriseFonction}`,
			datePriseFonction,
			dateFinFonction,
			motifDebut: m['Motif début de mandat'] ?? null,
			motifFin: m['Motif fin de mandat'] ?? null,
			circonscription: circonscription ?? null,
			place,
			serie,
			appartenancesGroupe: [...seen.values()],
			sessions,
			triennats: triennatsOfPeriode(datePriseFonction, dateFinFonction).map<TriennatStats>(
				(t) => ({
					triennat: t.id,
					scrutinsEligibles: 0,
					stats: emptyMandatStats(),
					rangs: emptyMandatRangs()
				})
			),
			cumul: emptyMandatStats(),
			badgesMandat: []
		});
	}

	// ELUSEN est mis à jour avec retard : un sénateur réélu au dernier
	// renouvellement (oct 2023) peut ne pas encore avoir de mandat actif.
	// Si api-senat le déclare en exercice, on synthétise un mandat couvrant
	// le post-renouvellement (ouvert, sans dateFinFonction).
	if (api && !out.some((m) => m.dateFinFonction === null)) {
		const lastMandat = out[out.length - 1];
		const lastEnd = lastMandat?.dateFinFonction;
		// Date de prise de fonction du nouveau mandat = lendemain du dernier mandat clos
		// (ou un défaut raisonnable si on n'a aucune info)
		const nouveauDebut = lastEnd ? addOneDay(lastEnd) : '2023-10-02';
		const today = new Date().toISOString().slice(0, 10);

		// Appartenances groupe : recycler celles qui couvrent la période
		const apps: AppartenanceGroupeSenat[] = histogRows
			.map((h) => {
				const dateDebut = parseOdsenDate(h["Date de début d'appartenance"] ?? '') ?? '';
				const dateFin = parseOdsenDate(h["Date de fin d'appartenance"] ?? '') ?? null;
				return {
					groupeCode: h['Code du groupe politique'] ?? 'AUCUN',
					groupeNomCourt: h['Nom court du groupe politique'] ?? '',
					dateDebut,
					dateFin,
					fonction: h['Nom court fonction'] ?? 'Membre',
					fonctionDateDebut: parseOdsenDate(h['Date de début de la fonction']),
					fonctionDateFin: parseOdsenDate(h['Date de fin de la fonction'])
				};
			})
			.filter((a) => a.dateDebut !== '')
			.filter((a) => {
				// chevauchement avec [nouveauDebut, today]
				const aFin = a.dateFin ?? '9999-12-31';
				return a.dateDebut <= today && aFin >= nouveauDebut;
			})
			.sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
		const dedupKey = (a: AppartenanceGroupeSenat) => `${a.groupeCode}|${a.dateDebut}`;
		const seenNew = new Map<string, AppartenanceGroupeSenat>();
		for (const a of apps) {
			const k = dedupKey(a);
			if (!seenNew.has(k)) seenNew.set(k, a);
		}
		// Si toujours rien, fallback sur l'appartenance api-senat actuelle
		const appartenances =
			seenNew.size > 0
				? [...seenNew.values()]
				: api.groupe
					? [
							{
								groupeCode: api.groupe.code,
								groupeNomCourt: api.groupe.libelle,
								dateDebut: nouveauDebut,
								dateFin: null,
								fonction: 'Membre',
								fonctionDateDebut: nouveauDebut,
								fonctionDateFin: null
							}
						]
					: [];

		const sessions = sessionsCovering(nouveauDebut, null).map<SessionStats>((sesann) => ({
			sesann,
			scrutinsEligibles: 0,
			stats: emptyMandatStats(),
			rangs: emptyMandatRangs()
		}));

		out.push({
			eluId: `${matricule}-active-synthetic`,
			datePriseFonction: nouveauDebut,
			dateFinFonction: null,
			motifDebut: null,
			motifFin: null,
			circonscription: circonscription ?? null,
			place: api.siege ?? null,
			serie: api.serie ? (parseInt(api.serie, 10) as 1 | 2) : null,
			appartenancesGroupe: appartenances,
			sessions,
			triennats: triennatsOfPeriode(nouveauDebut, null).map<TriennatStats>((t) => ({
				triennat: t.id,
				scrutinsEligibles: 0,
				stats: emptyMandatStats(),
				rangs: emptyMandatRangs()
			})),
			cumul: emptyMandatStats(),
			badgesMandat: []
		});
	}

	return out;
}

/** Ajoute 1 jour à une date ISO (YYYY-MM-DD). */
function addOneDay(iso: string): string {
	const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10));
	const dt = new Date(Date.UTC(y, m - 1, d + 1));
	return dt.toISOString().slice(0, 10);
}

// ────────────────────────────────────────────────────────────────────────────
// buildScrutins : index + détails
// ────────────────────────────────────────────────────────────────────────────

const POSVOTCOD_TO_POSITION: Record<string, VotePosition> = {
	'1': 'pour',
	'2': 'contre',
	'3': 'abstention',
	'4': 'nonVotant'
};

function buildScrutins(
	scrRows: Record<string, string | null>[],
	votsenByScrutin: Map<string, Array<{ senmat: string; posvotcod: string }>>,
	senateurs: Senateur[]
): { scrutinsIndex: ScrutinSenatIndex[]; scrutinsDetails: Map<string, ScrutinSenatDetail> } {
	const senateursById = new Map(senateurs.map((s) => [s.id, s]));
	const scrutinsIndex: ScrutinSenatIndex[] = [];
	const scrutinsDetails = new Map<string, ScrutinSenatDetail>();

	for (const r of scrRows) {
		const sesann = parseInt(r.sesann ?? '0', 10);
		const scrnum = parseInt(r.scrnum ?? '0', 10);
		const uid = `${sesann}-${scrnum}`;
		const dateRaw = r.scrdat ?? '';
		const date = dateRaw.slice(0, 10); // ISO date courte

		const votesArr = votsenByScrutin.get(uid) ?? [];
		const votes: Record<string, VotePosition> = {};
		const decompte = { pour: 0, contre: 0, abstention: 0, nonVotant: 0 };
		for (const v of votesArr) {
			const pos = POSVOTCOD_TO_POSITION[v.posvotcod];
			if (!pos) continue;
			votes[v.senmat] = pos;
			if (pos === 'pour') decompte.pour++;
			else if (pos === 'contre') decompte.contre++;
			else if (pos === 'abstention') decompte.abstention++;
			else if (pos === 'nonVotant') decompte.nonVotant++;
		}

		// Ventilation par groupe au moment du vote
		const groupesAcc = new Map<
			string,
			{ effectif: number; decompte: { pour: number; contre: number; abstention: number; nonVotant: number } }
		>();
		for (const [matricule, position] of Object.entries(votes)) {
			const sen = senateursById.get(matricule);
			if (!sen) continue;
			const mandat = sen.mandats.find(
				(m) => m.datePriseFonction <= date && (!m.dateFinFonction || m.dateFinFonction >= date)
			);
			if (!mandat) continue;
			const grp = groupeAuVote(mandat.appartenancesGroupe, date);
			if (!grp) continue;
			const acc =
				groupesAcc.get(grp) ??
				({ effectif: 0, decompte: { pour: 0, contre: 0, abstention: 0, nonVotant: 0 } });
			acc.effectif++;
			acc.decompte[position as keyof typeof acc.decompte]++;
			groupesAcc.set(grp, acc);
		}

		const groupes: ScrutinSenatDetail['groupes'] = [];
		const frondeurs: string[] = [];
		for (const [code, acc] of groupesAcc) {
			const positionMajoritaire = pickPositionMajoritaire(acc.decompte);
			groupes.push({ code, effectif: acc.effectif, positionMajoritaire, decompte: acc.decompte });
		}

		// Identifier les frondeurs : vote exprimé ≠ position majoritaire de leur groupe
		// (sauf si la maj est nonVotant ou aucune)
		for (const [matricule, position] of Object.entries(votes)) {
			if (position !== 'pour' && position !== 'contre') continue;
			const sen = senateursById.get(matricule);
			if (!sen) continue;
			const mandat = sen.mandats.find(
				(m) => m.datePriseFonction <= date && (!m.dateFinFonction || m.dateFinFonction >= date)
			);
			if (!mandat) continue;
			const grp = groupeAuVote(mandat.appartenancesGroupe, date);
			if (!grp) continue;
			const grpDetail = groupes.find((g) => g.code === grp);
			const maj = grpDetail?.positionMajoritaire;
			if ((maj === 'pour' || maj === 'contre') && position !== maj) {
				frondeurs.push(matricule);
			}
		}

		const idx: ScrutinSenatIndex = {
			uid,
			sesann,
			scrnum,
			date,
			titre: r.scrint ?? '(sans titre)',
			sort: r.soslib ?? 'non précisé',
			pour: decompte.pour,
			contre: decompte.contre,
			abstention: decompte.abstention,
			nonVotant: decompte.nonVotant,
			texteId: null // sera muté plus tard par aggregeTextesSenat (N3.b navette)
		};
		scrutinsIndex.push(idx);

		scrutinsDetails.set(uid, {
			...idx,
			votes,
			groupes,
			frondeurs
		});
	}

	scrutinsIndex.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.scrnum - a.scrnum));
	return { scrutinsIndex, scrutinsDetails };
}

function pickPositionMajoritaire(d: {
	pour: number;
	contre: number;
	abstention: number;
	nonVotant: number;
}): VotePosition | 'aucune' {
	const max = Math.max(d.pour, d.contre, d.abstention, d.nonVotant);
	if (max === 0) return 'aucune';
	if (max === d.pour) return 'pour';
	if (max === d.contre) return 'contre';
	if (max === d.abstention) return 'abstention';
	return 'nonVotant';
}

// ────────────────────────────────────────────────────────────────────────────
// computeStatsAllSessions : présence + participation + loyauté + frondes
// ────────────────────────────────────────────────────────────────────────────

function computeStatsAllSessions(
	senateurs: Senateur[],
	scrutinsIndex: ScrutinSenatIndex[],
	scrutinsDetails: Map<string, ScrutinSenatDetail>
) {
	// Indexer scrutins par session pour itération efficace
	const scrutinsBySesann = new Map<number, ScrutinSenatIndex[]>();
	for (const s of scrutinsIndex) {
		const arr = scrutinsBySesann.get(s.sesann) ?? [];
		arr.push(s);
		scrutinsBySesann.set(s.sesann, arr);
	}
	for (const arr of scrutinsBySesann.values())
		arr.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.scrnum - b.scrnum));

	for (const sen of senateurs) {
		for (const mandat of sen.mandats) {
			// Index pour additionner aussi côté triennat (cf ADR 0028)
			const triennatById = new Map<TriennatId, TriennatStats>();
			for (const t of mandat.triennats) triennatById.set(t.triennat, t);

			for (const sessionStats of mandat.sessions) {
				const scrutins = scrutinsBySesann.get(sessionStats.sesann) ?? [];
				for (const idx of scrutins) {
					if (mandat.datePriseFonction && idx.date < mandat.datePriseFonction) continue;
					if (mandat.dateFinFonction && idx.date > mandat.dateFinFonction) continue;
					sessionStats.scrutinsEligibles++;

					// Triennat ciblé par la date du scrutin (cf ADR 0028)
					const tri = triennatOfDate(idx.date);
					const triStats = tri ? triennatById.get(tri.id) ?? null : null;
					if (triStats) triStats.scrutinsEligibles++;

					const detail = scrutinsDetails.get(idx.uid);
					if (!detail) continue;
					const position = detail.votes[sen.id];
					const isFronde = detail.frondeurs.includes(sen.id);

					const stats = sessionStats.stats;
					if (position) stats.presence.numerator++;
					if (position === 'pour' || position === 'contre' || position === 'abstention') {
						stats.participation.numerator++;
					}
					if (isFronde) stats.frondes.count++;

					// Idem côté triennat
					if (triStats) {
						if (position) triStats.stats.presence.numerator++;
						if (position === 'pour' || position === 'contre' || position === 'abstention') {
							triStats.stats.participation.numerator++;
						}
						if (isFronde) triStats.stats.frondes.count++;
					}

					// Loyauté : seuls votes exprimés vs position maj du groupe au moment du vote
					if (position === 'pour' || position === 'contre') {
						const grp = groupeAuVote(mandat.appartenancesGroupe, idx.date);
						if (grp) {
							const grpDetail = detail.groupes.find((g) => g.code === grp);
							const maj = grpDetail?.positionMajoritaire;
							if (maj === 'pour' || maj === 'contre') {
								stats.loyaute.denominator++;
								if (position === maj) stats.loyaute.numerator++;
								if (triStats) {
									triStats.stats.loyaute.denominator++;
									if (position === maj) triStats.stats.loyaute.numerator++;
								}
							}
						}
					}
				}
				// Finaliser les ratios pour cette session
				const s = sessionStats.stats;
				const elig = sessionStats.scrutinsEligibles;
				s.presence.denominator = elig;
				s.presence.rate = elig > 0 ? s.presence.numerator / elig : 0;
				s.participation.denominator = elig;
				s.participation.rate = elig > 0 ? s.participation.numerator / elig : 0;
				s.loyaute.rate =
					s.loyaute.denominator > 0 ? s.loyaute.numerator / s.loyaute.denominator : null;
				s.frondes.rate =
					s.participation.numerator > 0 ? s.frondes.count / s.participation.numerator : 0;
			}

			// Finaliser les ratios pour chaque triennat du mandat
			for (const triStats of mandat.triennats) {
				const s = triStats.stats;
				const elig = triStats.scrutinsEligibles;
				s.presence.denominator = elig;
				s.presence.rate = elig > 0 ? s.presence.numerator / elig : 0;
				s.participation.denominator = elig;
				s.participation.rate = elig > 0 ? s.participation.numerator / elig : 0;
				s.loyaute.rate =
					s.loyaute.denominator > 0 ? s.loyaute.numerator / s.loyaute.denominator : null;
				s.frondes.rate =
					s.participation.numerator > 0 ? s.frondes.count / s.participation.numerator : 0;
			}
		}
	}
}

// ────────────────────────────────────────────────────────────────────────────
// Rangs / badges / overalls — par triennat (cohorte = sénateurs ayant ≥ 1 mandat
// avec une TriennatStats sur ce triennat) — cf ADR 0028
// ────────────────────────────────────────────────────────────────────────────

function collectAllSesanns(senateurs: Senateur[]): number[] {
	const set = new Set<number>();
	for (const s of senateurs) {
		for (const m of s.mandats) {
			for (const ss of m.sessions) set.add(ss.sesann);
		}
	}
	return [...set].sort((a, b) => a - b);
}

function collectAllTriennats(senateurs: Senateur[]): TriennatId[] {
	const set = new Set<TriennatId>();
	for (const s of senateurs) {
		for (const m of s.mandats) {
			for (const t of m.triennats) set.add(t.triennat);
		}
	}
	// Tri chronologique sur la table figée (ordre des renouvellements)
	return TRIENNATS.filter((t) => set.has(t.id)).map((t) => t.id);
}

interface TriennatPair {
	senateur: Senateur;
	mandat: MandatSenat;
	triennat: TriennatStats;
}

function cohortForTriennat(senateurs: Senateur[], triennatId: TriennatId): TriennatPair[] {
	const pairs: TriennatPair[] = [];
	for (const sen of senateurs) {
		for (const m of sen.mandats) {
			for (const t of m.triennats) {
				if (t.triennat === triennatId) pairs.push({ senateur: sen, mandat: m, triennat: t });
			}
		}
	}
	return pairs;
}

function computeRangsForTriennat(triennatId: TriennatId, senateurs: Senateur[]) {
	const cohort = cohortForTriennat(senateurs, triennatId);
	const total = cohort.length;
	for (const p of cohort) {
		p.triennat.rangs.presence.total = total;
		p.triennat.rangs.participation.total = total;
		p.triennat.rangs.loyaute.total = total;
		p.triennat.rangs.frondes.total = total;
	}

	const denseRank = (
		key: 'presence' | 'participation' | 'loyaute' | 'frondes',
		valueFn: (p: TriennatPair) => number | null,
		desc: boolean
	) => {
		const sorted = [...cohort].sort((a, b) => {
			const va = valueFn(a);
			const vb = valueFn(b);
			if (va === null && vb === null) return 0;
			if (va === null) return 1;
			if (vb === null) return -1;
			if (va === vb) return 0;
			return desc ? (va < vb ? 1 : -1) : va < vb ? -1 : 1;
		});
		let rank = 0;
		let lastVal: number | null | undefined = undefined;
		for (let i = 0; i < sorted.length; i++) {
			const v = valueFn(sorted[i]);
			if (v === null) {
				(sorted[i].triennat.rangs[key].rank as number | null) = null;
				continue;
			}
			if (v !== lastVal) {
				rank = i + 1;
				lastVal = v;
			}
			(sorted[i].triennat.rangs[key].rank as number) = rank;
		}
	};

	denseRank('presence', (p) => p.triennat.stats.presence.rate, true);
	denseRank('participation', (p) => p.triennat.stats.participation.rate, true);
	denseRank('loyaute', (p) => p.triennat.stats.loyaute.rate, true);
	denseRank('frondes', (p) => p.triennat.stats.frondes.count, true);
}

function computeBadgesForTriennat(triennatId: TriennatId, senateurs: Senateur[]) {
	const cohort = cohortForTriennat(senateurs, triennatId);
	const total = cohort.length;
	if (total === 0) return;
	const t = Math.min(total, Math.max(1, Math.floor(total * 0.1)));

	const sortPres = [...cohort].sort(
		(a, b) => b.triennat.stats.presence.rate - a.triennat.stats.presence.rate
	);
	for (let i = 0; i < t; i++) addBadge(sortPres[i].mandat, 'presence-or');
	for (let i = total - t; i < total; i++) addBadge(sortPres[i].mandat, 'absent-remarquable');

	const withLoy = cohort.filter((p) => p.triennat.stats.loyaute.rate !== null);
	if (withLoy.length > 0) {
		const sortLoy = [...withLoy].sort(
			(a, b) => (b.triennat.stats.loyaute.rate ?? 0) - (a.triennat.stats.loyaute.rate ?? 0)
		);
		const tLoy = Math.min(withLoy.length, Math.max(1, Math.floor(withLoy.length * 0.1)));
		for (let i = 0; i < tLoy; i++) addBadge(sortLoy[i].mandat, 'top-loyaliste');
	}

	const sortFr = [...cohort].sort(
		(a, b) => b.triennat.stats.frondes.count - a.triennat.stats.frondes.count
	);
	for (let i = 0; i < t; i++) {
		if (sortFr[i].triennat.stats.frondes.count > 0) addBadge(sortFr[i].mandat, 'frondeur');
	}
}

function addBadge(mandat: MandatSenat, badge: BadgeMandat) {
	if (!mandat.badgesMandat.includes(badge)) mandat.badgesMandat.push(badge);
}

// ── Overall (cf ADR 0022) — formule transposée telle quelle
const OVERALL_W_PARTICIPATION = 0.55;
const OVERALL_W_VOLUME = 0.35;
const OVERALL_W_PRESENCE = 0.1;

function percentile95(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const idx = Math.floor(0.95 * (sorted.length - 1));
	return sorted[idx];
}

function overallScore(
	participationRate: number,
	presenceRate: number,
	scrutinsVotes: number,
	volumeRef: number
): { overall: number; volume: number } {
	const volume = volumeRef > 0 ? Math.min(1, scrutinsVotes / volumeRef) : 0;
	const score =
		OVERALL_W_PARTICIPATION * participationRate +
		OVERALL_W_VOLUME * volume +
		OVERALL_W_PRESENCE * presenceRate;
	return { overall: Math.round(score * 99), volume };
}

function computeOverallsForTriennat(triennatId: TriennatId, senateurs: Senateur[]) {
	const cohort = cohortForTriennat(senateurs, triennatId);
	const volumeRef = percentile95(cohort.map((p) => p.triennat.stats.participation.numerator));
	for (const p of cohort) {
		const { overall, volume } = overallScore(
			p.triennat.stats.participation.rate,
			p.triennat.stats.presence.rate,
			p.triennat.stats.participation.numerator,
			volumeRef
		);
		p.triennat.stats.overall = overall;
		p.triennat.stats.volume = volume;
	}
}

// ────────────────────────────────────────────────────────────────────────────
// Cumul mandat + carrière
// ────────────────────────────────────────────────────────────────────────────

function computeMandatCumul(mandat: MandatSenat) {
	const c: MandatStats = mandat.cumul;
	for (const ss of mandat.sessions) {
		c.presence.numerator += ss.stats.presence.numerator;
		c.presence.denominator += ss.stats.presence.denominator;
		c.participation.numerator += ss.stats.participation.numerator;
		c.participation.denominator += ss.stats.participation.denominator;
		c.loyaute.numerator += ss.stats.loyaute.numerator;
		c.loyaute.denominator += ss.stats.loyaute.denominator;
		c.frondes.count += ss.stats.frondes.count;
	}
	c.presence.rate = c.presence.denominator > 0 ? c.presence.numerator / c.presence.denominator : 0;
	c.participation.rate =
		c.participation.denominator > 0 ? c.participation.numerator / c.participation.denominator : 0;
	c.loyaute.rate =
		c.loyaute.denominator > 0 ? c.loyaute.numerator / c.loyaute.denominator : null;
	c.frondes.rate = c.participation.numerator > 0 ? c.frondes.count / c.participation.numerator : 0;
	c.overall = 0; // overall mandat non utilisé en v1 (on utilise overall session ou carrière)
	c.volume = 0;
}

function computeCarriere(senateur: Senateur, famillesIdx: FamillesIndex) {
	const c: CarriereSenatAggregee = {
		presence: { numerator: 0, denominator: 0, rate: 0 },
		participation: { numerator: 0, denominator: 0, rate: 0 },
		loyaute: { numerator: 0, denominator: 0, rate: null },
		frondes: { count: 0, rate: 0 },
		nbMandats: senateur.mandats.length,
		sessions: [],
		triennats: [],
		badgesCarriere: [],
		overall: 0,
		volume: 0
	};
	const sessionsSet = new Set<number>();
	const triennatsSet = new Set<TriennatId>();
	for (const m of senateur.mandats) {
		for (const ss of m.sessions) sessionsSet.add(ss.sesann);
		for (const t of m.triennats) triennatsSet.add(t.triennat);
		c.presence.numerator += m.cumul.presence.numerator;
		c.presence.denominator += m.cumul.presence.denominator;
		c.participation.numerator += m.cumul.participation.numerator;
		c.participation.denominator += m.cumul.participation.denominator;
		c.loyaute.numerator += m.cumul.loyaute.numerator;
		c.loyaute.denominator += m.cumul.loyaute.denominator;
		c.frondes.count += m.cumul.frondes.count;
	}
	c.sessions = [...sessionsSet].sort((a, b) => a - b);
	// Tri chronologique sur la table figée
	c.triennats = TRIENNATS.filter((t) => triennatsSet.has(t.id)).map((t) => t.id);
	c.presence.rate = c.presence.denominator > 0 ? c.presence.numerator / c.presence.denominator : 0;
	c.participation.rate =
		c.participation.denominator > 0 ? c.participation.numerator / c.participation.denominator : 0;
	c.loyaute.rate =
		c.loyaute.denominator > 0 ? c.loyaute.numerator / c.loyaute.denominator : null;
	c.frondes.rate = c.participation.numerator > 0 ? c.frondes.count / c.participation.numerator : 0;

	// Badges carrière
	const badges: BadgeCarriere[] = [];
	if (senateur.mandats.length >= 2) badges.push('reelu');
	if (c.sessions.length >= 5) badges.push('veteran');

	// Recomposition : famille politique principale différente entre 2 mandats
	// consécutifs. La table `groupes-familles.json` (cf ADR 0034) neutralise
	// les renommages d'un même parti. Côté Sénat les `groupeCode` sont assez
	// stables (SOC/CRC/UC/UMP) mais on partage la mécanique avec l'AN pour
	// uniformité et pour gérer d'éventuels renommages futurs.
	if (senateur.mandats.length >= 2) {
		const familleOfMandat = (m: MandatSenat): string | null => {
			const stable = m.appartenancesGroupe.find(
				(a) => a.groupeCode !== 'NI' && a.groupeCode !== 'AUCUN'
			);
			if (!stable?.groupeCode) return null;
			return familleSenat(famillesIdx, stable.groupeCode);
		};
		const sorted = [...senateur.mandats].sort((a, b) =>
			a.datePriseFonction.localeCompare(b.datePriseFonction)
		);
		for (let i = 1; i < sorted.length; i++) {
			const prev = familleOfMandat(sorted[i - 1]);
			const cur = familleOfMandat(sorted[i]);
			if (prev && cur && prev !== cur) {
				badges.push('recomposition');
				break;
			}
		}
	}

	// Transfuge : ≥ 2 **familles politiques** distinctes en cours de mandat
	// (hors NI/AUCUN). Symétrique au fix AN (cf ADR 0034) — sans la cascade
	// famille, un sénateur traversant 2 groupes mappés à la même famille
	// serait à tort marqué transfuge.
	for (const m of senateur.mandats) {
		const familles = new Set<string>();
		for (const a of m.appartenancesGroupe) {
			if (a.groupeCode === 'NI' || a.groupeCode === 'AUCUN') continue;
			familles.add(familleSenat(famillesIdx, a.groupeCode));
		}
		if (familles.size >= 2) {
			badges.push('transfuge');
			break;
		}
	}

	c.badgesCarriere = badges;
	senateur.carriere = c;
}

function computeOverallsCarriere(senateurs: Senateur[]) {
	const volumeRef = percentile95(senateurs.map((s) => s.carriere.participation.numerator));
	for (const s of senateurs) {
		const { overall, volume } = overallScore(
			s.carriere.participation.rate,
			s.carriere.presence.rate,
			s.carriere.participation.numerator,
			volumeRef
		);
		s.carriere.overall = overall;
		s.carriere.volume = volume;
	}
}

// ────────────────────────────────────────────────────────────────────────────
// Groupes par triennat (cf ADR 0028)
// ────────────────────────────────────────────────────────────────────────────

function buildGroupesByTriennat(
	senateurs: Senateur[],
	allTriennatIds: TriennatId[],
	apiByMat: Map<string, ApiSenateur>
): Map<TriennatId, GroupeSenat[]> {
	const out = new Map<TriennatId, GroupeSenat[]>();

	for (const triennatId of allTriennatIds) {
		const triennat = TRIENNATS.find((t) => t.id === triennatId);
		if (!triennat) continue;
		// Date de référence pour le groupe principal : fin du triennat (ou aujourd'hui si en cours)
		const today = new Date().toISOString().slice(0, 10);
		const dateRef = triennat.enCours && triennat.dateFin > today ? today : triennat.dateFin;
		const cohort = cohortForTriennat(senateurs, triennatId);

		// Accumuler par code groupe
		const acc = new Map<
			string,
			{
				libelle: string;
				libelleAbrege: string;
				effectif: number;
				overallSum: number;
				presidentMatricule: string | null;
			}
		>();

		for (const p of cohort) {
			// Groupe principal du mandat à la fin du triennat
			const grp = groupeAuVote(p.mandat.appartenancesGroupe, dateRef) ?? findFallbackGroupe(p.mandat);
			if (!grp) continue;

			// Libellé long : depuis l'appartenance, ou api-senat si dispo
			const apparts = p.mandat.appartenancesGroupe.find((a) => a.groupeCode === grp);
			const apiInfo = apiByMat.get(p.senateur.id);
			const libelleLong =
				apiInfo?.groupe?.code === grp
					? apiInfo.groupe.libelle
					: (apparts?.groupeNomCourt ?? grp);

			const a =
				acc.get(grp) ??
				{
					libelle: libelleLong,
					libelleAbrege: grp,
					effectif: 0,
					overallSum: 0,
					presidentMatricule: null
				};
			a.effectif++;
			a.overallSum += p.triennat.stats.overall;
			// Président : appartenance avec fonction "Président"
			const prezApp = p.mandat.appartenancesGroupe.find(
				(x) =>
					x.groupeCode === grp &&
					(x.fonction ?? '').toLowerCase().includes('président') &&
					!(x.fonction ?? '').toLowerCase().includes('vice')
			);
			if (prezApp && !a.presidentMatricule) a.presidentMatricule = p.senateur.id;
			acc.set(grp, a);
		}

		const groupes: GroupeSenat[] = [];
		for (const [code, info] of acc) {
			const ord = POLITICAL_ORDER[code];
			groupes.push({
				code,
				triennat: triennatId,
				libelle: info.libelle,
				libelleAbrege: info.libelleAbrege,
				couleur: ord?.gradientColor ?? '#9ca3af',
				preseance: ord?.rank ?? 99,
				presidentMatricule: info.presidentMatricule,
				dateDebut: triennat.dateDebut,
				dateFin: triennat.dateFin,
				effectifFin: info.effectif,
				overallMoyen: info.effectif > 0 ? Math.round(info.overallSum / info.effectif) : 0,
				overallEffectif: info.effectif
			});
		}
		groupes.sort((a, b) => a.preseance - b.preseance);
		out.set(triennatId, groupes);
	}
	return out;
}

function findFallbackGroupe(mandat: MandatSenat): string | null {
	// Si aucune appartenance stable n'est trouvée à la dateRef de la session
	// (ex. mandat très court), on prend la première appartenance non-NI.
	const stable = mandat.appartenancesGroupe.find(
		(a) => a.groupeCode !== 'NI' && a.groupeCode !== 'AUCUN'
	);
	return stable?.groupeCode ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// Historiques compacts
// ────────────────────────────────────────────────────────────────────────────

function buildHistoriques(
	senateurs: Senateur[],
	scrutinsIndex: ScrutinSenatIndex[],
	scrutinsDetails: Map<string, ScrutinSenatDetail>
): Map<string, VoteHistoryItemSenat[]> {
	const out = new Map<string, VoteHistoryItemSenat[]>();
	// Tri chronologique inverse (plus récent en premier)
	const sorted = [...scrutinsIndex].sort((a, b) =>
		a.date < b.date ? 1 : a.date > b.date ? -1 : b.scrnum - a.scrnum
	);
	for (const idx of sorted) {
		const detail = scrutinsDetails.get(idx.uid);
		if (!detail) continue;
		const frondeurSet = new Set(detail.frondeurs);
		for (const [matricule, position] of Object.entries(detail.votes)) {
			const arr = out.get(matricule) ?? [];
			arr.push([idx.uid, position, frondeurSet.has(matricule) ? 1 : 0, idx.sesann]);
			out.set(matricule, arr);
		}
	}
	return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Sessions meta (brique data) + Triennats meta (cf ADR 0028) + meta global
// ────────────────────────────────────────────────────────────────────────────

function buildSessionsMeta(
	scrutinsIndex: ScrutinSenatIndex[],
	senateurs: Senateur[],
	sesLib: Map<number, string>
): SessionMeta[] {
	const sessionsWithScrutins = new Set(scrutinsIndex.map((s) => s.sesann));
	const out: SessionMeta[] = [];
	for (const sesann of [...sessionsWithScrutins].sort((a, b) => a - b)) {
		// Cohorte = sénateurs ayant ≥ 1 SessionStats sur cette session
		const matsActifs = new Set<string>();
		for (const sen of senateurs) {
			for (const m of sen.mandats) {
				if (m.sessions.some((ss) => ss.sesann === sesann)) {
					matsActifs.add(sen.id);
					break;
				}
			}
		}
		const scrutins = scrutinsIndex.filter((s) => s.sesann === sesann);
		out.push({
			sesann,
			libelle: sesLib.get(sesann) ?? `${sesann}-${sesann + 1}`,
			dateDebut: `${sesann}-10-01`,
			dateFin: `${sesann + 1}-09-30`,
			nbSenateursActifs: matsActifs.size,
			nbScrutins: scrutins.length
		});
	}
	return out;
}

function buildTriennatsMeta(
	scrutinsIndex: ScrutinSenatIndex[],
	senateurs: Senateur[]
): TriennatMeta[] {
	const triennatsWithScrutins = new Set<TriennatId>();
	const scrutinsCountByTriennat = new Map<TriennatId, number>();
	for (const s of scrutinsIndex) {
		const t = triennatOfDate(s.date);
		if (!t) continue;
		triennatsWithScrutins.add(t.id);
		scrutinsCountByTriennat.set(t.id, (scrutinsCountByTriennat.get(t.id) ?? 0) + 1);
	}

	const out: TriennatMeta[] = [];
	for (const t of TRIENNATS) {
		if (!triennatsWithScrutins.has(t.id)) continue;
		// Cohorte = sénateurs ayant ≥ 1 TriennatStats sur ce triennat
		const matsActifs = new Set<string>();
		for (const sen of senateurs) {
			for (const m of sen.mandats) {
				if (m.triennats.some((tr) => tr.triennat === t.id)) {
					matsActifs.add(sen.id);
					break;
				}
			}
		}
		// Sessions couvertes par ce triennat (intersection avec sessions ayant des scrutins)
		const sessionsWithScrutinsSet = new Set(scrutinsIndex.map((s) => s.sesann));
		const sessions: number[] = [];
		for (let s = t.anneeDebut; s < t.anneeFin; s++) {
			if (sessionsWithScrutinsSet.has(s)) sessions.push(s);
		}
		out.push({
			id: t.id,
			libelle: t.id,
			dateDebut: t.dateDebut,
			dateFin: t.dateFin,
			enCours: t.enCours,
			sessions,
			nbSenateursActifs: matsActifs.size,
			nbScrutins: scrutinsCountByTriennat.get(t.id) ?? 0
		});
	}
	return out;
}

function countDistinctGroupCodes(senateurs: Senateur[]): number {
	const set = new Set<string>();
	for (const s of senateurs) {
		for (const m of s.mandats) {
			for (const a of m.appartenancesGroupe) set.add(a.groupeCode);
		}
	}
	return set.size;
}

function sumVotesIn(scrutinsDetails: Map<string, ScrutinSenatDetail>): number {
	let total = 0;
	for (const d of scrutinsDetails.values()) total += Object.keys(d.votes).length;
	return total;
}

// ────────────────────────────────────────────────────────────────────────────
// Empty factories
// ────────────────────────────────────────────────────────────────────────────

function emptyMandatStats(): MandatStats {
	return {
		presence: { numerator: 0, denominator: 0, rate: 0 },
		participation: { numerator: 0, denominator: 0, rate: 0 },
		loyaute: { numerator: 0, denominator: 0, rate: null },
		frondes: { count: 0, rate: 0 },
		overall: 0,
		volume: 0
	};
}

function emptyMandatRangs(): MandatRangs {
	return {
		presence: { rank: 0, total: 0 },
		participation: { rank: 0, total: 0 },
		loyaute: { rank: null, total: 0 },
		frondes: { rank: 0, total: 0 }
	};
}

function emptyCarriere(): CarriereSenatAggregee {
	return {
		presence: { numerator: 0, denominator: 0, rate: 0 },
		participation: { numerator: 0, denominator: 0, rate: 0 },
		loyaute: { numerator: 0, denominator: 0, rate: null },
		frondes: { count: 0, rate: 0 },
		nbMandats: 0,
		sessions: [],
		triennats: [],
		badgesCarriere: [],
		overall: 0,
		volume: 0
	};
}

main().catch((err) => {
	console.error('\n❌ Pipeline Sénat a échoué :', err);
	process.exit(1);
});
