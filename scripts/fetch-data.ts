/**
 * PolitiDex — pipeline data multi-législature.
 *
 * Source unique pour les acteurs et leurs mandats : AMO30 historique
 * (`tous_acteurs_tous_mandats_tous_organes_historique`) — cf ADR 0018.
 * Source pour les scrutins : un export par législature.
 *
 * Outputs (sous static/data/) — modèle Personne unique cross-législature (cf ADR 0015) :
 *  - personnes.json              : Personne[] avec mandats[] + carriere agrégée
 *  - groupes/{leg}.json          : Groupe[] scopés par législature (cf ADR 0016)
 *  - legislatures.json           : LegislatureMeta[]
 *  - scrutins-index.json         : ScrutinIndex[] cross-législature (avec champ legislature)
 *  - scrutins/{uid}.json         : ScrutinDetail
 *  - stats-personnes.json        : pour debug/inspection — stats par mandat sont déjà dans personnes.json
 *  - historique/{paId}.json      : VoteHistoryItem[] tous mandats confondus
 *  - meta.json                   : build metadata
 *
 * Le tableau LEGISLATURES contrôle la couverture. Phase 1 = [16, 17].
 * Pour étendre Phase 2, ajouter 15 ; Phase 3 ajoute le sénat (modèle à généraliser).
 */

import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

import type {
	Personne,
	Mandat,
	AppartenanceGroupe,
	MandatStats,
	MandatRangs,
	CarriereAggregee,
	BadgeCarriere,
	BadgeMandat,
	Groupe,
	LegislatureMeta,
	ScrutinIndex,
	ScrutinDetail,
	VotePosition,
	VoteHistoryItem,
	BuildMeta
} from '../src/lib/types.ts';

const execFile = promisify(execFileCb);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'static', 'data');
const CACHE_DIR = join(tmpdir(), 'politidex-cache');

/** Législatures couvertes. Phase 1 = [16, 17]. Étendre pour Phase 2/3. */
const LEGISLATURES: number[] = [16, 17];

/** Source historique d'identité (PA-id stable, cross-leg) — cf ADR 0018. */
const SOURCE_ACTEURS =
	'https://data.assemblee-nationale.fr/static/openData/repository/17/amo/tous_acteurs_mandats_organes_xi_legislature/AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip';

/**
 * Sources d'enrichissement par législature (AMO10 / AMO20). Cf ADR 0019 :
 * AMO10 (legis. en cours) et AMO20 (legis. passées) sont prioritaires sur AMO30
 * pour les champs précis (placeHemicycle notamment).
 *
 * Pour Phase 1 :
 *   - 17ᵉ législature → AMO10 (snapshot temps réel)
 *   - 16ᵉ législature → AMO20 (snapshot figé à la dissolution 2024-06-09)
 */
const SOURCES_ENRICHISSEMENT = new Map<number, string>([
	[
		17,
		'https://data.assemblee-nationale.fr/static/openData/repository/17/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip'
	],
	[
		16,
		'https://data.assemblee-nationale.fr/static/openData/repository/16/amo/deputes_senateurs_ministres_legislature/AMO20_dep_sen_min_tous_mandats_et_organes.json.zip'
	]
]);

// ⚠️  L'archive Scrutins.json.zip de la 17ᵉ législature est servie extrêmement
//     lentement par le CDN AN (POP 46.105.202.26 / Rouen) : ~25-30 KB/s, identique
//     en navigateur. Un fresh download peut prendre 10-12 minutes pour ~20 MB.
//     Le cache `politidex-cache/` dans tmpdir est notre garde-fou : NE PAS le purger
//     entre deux runs si tu n'as pas explicitement besoin de re-fetch.
//     Côté Coolify : prévoir un build timeout ≥ 15 min.

const sourceScrutins = (leg: number) =>
	`https://data.assemblee-nationale.fr/static/openData/repository/${leg}/loi/scrutins/Scrutins.json.zip`;

/** Seuil pour identifier le NI-bridge transitoire (en jours).
 *  En 16ᵉ le délai d'inscription au groupe a été ~6 jours (22→28 juin 2022).
 *  En 17ᵉ il a été plus long (~10 jours : 8→18 juillet 2024) car élections
 *  législatives anticipées + congés d'été. On garde une marge à 21 jours
 *  pour absorber les variations futures. */
const NI_BRIDGE_MAX_DURATION_DAYS = 21;

// ────────────────────────────────────────────────────────────────────────────
// Utilitaires
// ────────────────────────────────────────────────────────────────────────────

async function ensureDir(path: string) {
	await mkdir(path, { recursive: true });
}

/**
 * Télécharge un ZIP via `curl` avec progression et reprise automatique.
 *
 * Stratégie de robustesse face au CDN Etalab très lent (cf commentaire SOURCE_ACTEURS) :
 * - Détection du Content-Length serveur ; si le fichier local existe et a la même
 *   taille → cache hit complet, on saute.
 * - Sinon, on appelle `curl -C -` qui reprend depuis l'offset existant.
 * - `--max-time` = 30 min par tentative (le 17ᵉ scrutins peut prendre ~12 min en fresh,
 *   on garde de la marge pour les CDN extra-lents).
 * - `--retry 5 --retry-delay 5` : 5 tentatives, 5s d'attente.
 * - Boucle externe : si curl plante quand même (ex: code 92 stream error), on relance
 *   jusqu'à 3 fois — la reprise repartira d'où on s'est arrêté.
 */
async function downloadZip(url: string, target: string): Promise<void> {
	// FORCE_CACHE=1 court-circuite la vérification de Content-Length serveur
	// (utile en dev quand on touche à la pipeline et qu'on veut épargner les
	// 12 min de re-download des scrutins 17ᵉ).
	if (process.env.FORCE_CACHE === '1' && existsSync(target)) {
		const localSize = (await import('node:fs')).statSync(target).size;
		console.log(`  ↻ cache hit (forcé): ${target} (${(localSize / 1024 / 1024).toFixed(1)} MB)`);
		return;
	}
	const expected = await remoteContentLength(url);
	if (existsSync(target)) {
		const localSize = (await import('node:fs')).statSync(target).size;
		if (expected !== null && localSize === expected) {
			console.log(`  ↻ cache hit: ${target} (${(localSize / 1024 / 1024).toFixed(1)} MB)`);
			return;
		}
		if (expected !== null) {
			console.log(
				`  ⏯ reprise: ${(localSize / 1024 / 1024).toFixed(1)} / ${(expected / 1024 / 1024).toFixed(1)} MB`
			);
		}
	}
	console.log(`  ⬇ ${url}`);

	const { spawn } = await import('node:child_process');
	const MAX_OUTER_RETRIES = 3;
	for (let attempt = 1; attempt <= MAX_OUTER_RETRIES; attempt++) {
		try {
			await new Promise<void>((resolve, reject) => {
				const c = spawn(
					'curl',
					[
						'-L',
						'-C',
						'-',
						'--retry',
						'5',
						'--retry-delay',
						'5',
						'--max-time',
						'1800',
						'--progress-bar',
						'-o',
						target,
						url
					],
					{ stdio: ['ignore', 'inherit', 'inherit'] }
				);
				c.on('error', reject);
				c.on('exit', (code) => {
					if (code === 0) resolve();
					else reject(new Error(`curl exited ${code}`));
				});
			});
			break; // success
		} catch (err) {
			if (attempt === MAX_OUTER_RETRIES) {
				throw new Error(`curl failed ${attempt}× for ${url}: ${(err as Error).message}`);
			}
			console.log(`  ⚠ tentative ${attempt}/${MAX_OUTER_RETRIES} échouée, reprise…`);
			await new Promise((r) => setTimeout(r, 5000));
		}
	}

	const stats = await import('node:fs').then((m) => m.statSync(target));
	console.log(`  ✓ ${(stats.size / 1024 / 1024).toFixed(1)} MB → ${target}`);
}

/** Récupère le Content-Length d'un fichier distant via HEAD. Retourne null si indispo. */
async function remoteContentLength(url: string): Promise<number | null> {
	try {
		const res = await fetch(url, { method: 'HEAD' });
		if (!res.ok) return null;
		const cl = res.headers.get('content-length');
		return cl ? parseInt(cl, 10) : null;
	} catch {
		return null;
	}
}

async function unzip(zipPath: string, destDir: string) {
	await ensureDir(destDir);
	console.log(`  ⇢ ${zipPath} → ${destDir}`);
	// bsdtar gère les ZIP modernes mieux que unzip macOS (notamment ZIP64 et
	// gros fichiers). On garde un fallback unzip si bsdtar n'est pas dispo.
	try {
		await execFile('bsdtar', ['-xf', zipPath, '-C', destDir]);
	} catch (errBsd) {
		try {
			await execFile('unzip', ['-q', '-o', zipPath, '-d', destDir]);
		} catch (errUnzip) {
			throw new Error(
				`unzip failed (bsdtar: ${(errBsd as Error).message} / unzip: ${(errUnzip as Error).message})`
			);
		}
	}
}

function asArray<T>(v: T | T[] | null | undefined): T[] {
	if (v == null) return [];
	return Array.isArray(v) ? v : [v];
}

function daysBetween(a: string, b: string): number {
	const da = new Date(a).getTime();
	const db = new Date(b).getTime();
	return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

/** Compare deux qualités GP par préséance. Plus haut = meilleur. */
function qualiteRank(qualite: string | null | undefined): number {
	if (!qualite) return 0;
	const q = qualite.toLowerCase();
	if (q.includes('président') && !q.includes('vice')) return 5;
	if (q.includes('vice-président')) return 4;
	if (q.includes('secrétaire')) return 3;
	if (q.includes('trésorier')) return 2;
	if (q.includes('membre')) return 1;
	return 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Étape 1 — extraction des groupes politiques par législature
// ────────────────────────────────────────────────────────────────────────────

interface RawOrgane {
	uid: string;
	codeType: string;
	libelle: string;
	libelleAbrege?: string;
	libelleAbrev?: string;
	couleurAssociee?: string;
	preseance?: string;
	legislature?: string;
	viMoDe?: { dateDebut?: string; dateFin?: string | null };
}

async function parseGroupes(extractDir: string): Promise<Map<number, Groupe[]>> {
	const organeDir = join(extractDir, 'json', 'organe');
	const { readdirSync } = await import('node:fs');

	const byLegislature = new Map<number, Groupe[]>();
	for (const leg of LEGISLATURES) byLegislature.set(leg, []);

	for (const file of readdirSync(organeDir)) {
		const raw = JSON.parse(await readFile(join(organeDir, file), 'utf8'));
		const o: RawOrgane = raw.organe;
		if (o.codeType !== 'GP') continue;
		const leg = o.legislature ? parseInt(o.legislature, 10) : NaN;
		if (!LEGISLATURES.includes(leg)) continue;

		const list = byLegislature.get(leg)!;
		list.push({
			id: o.uid,
			legislature: leg,
			libelle: o.libelle,
			libelleAbrege: o.libelleAbrege ?? o.libelleAbrev ?? o.libelle.slice(0, 6).toUpperCase(),
			couleur: o.couleurAssociee ?? '#888888',
			preseance: parseInt(o.preseance ?? '999', 10),
			presidentId: null, // rempli plus tard à partir des mandats
			dateDebut: o.viMoDe?.dateDebut ?? '',
			dateFin: o.viMoDe?.dateFin ?? null,
			effectifFin: 0 // calculé plus tard
		});
	}

	for (const list of byLegislature.values()) {
		list.sort((a, b) => a.preseance - b.preseance);
	}
	return byLegislature;
}

// ────────────────────────────────────────────────────────────────────────────
// Étape 2 — extraction des personnes + mandats parlementaires + appartenances groupe
// ────────────────────────────────────────────────────────────────────────────

interface RawActeur {
	uid: { '#text': string };
	etatCivil: {
		ident: { civ: string; prenom: string; nom: string };
		infoNaissance?: { dateNais?: string | null; villeNais?: string | null };
	};
	profession?: { libelleCourant?: string | null };
	mandats?: { mandat?: any | any[] };
}

interface RawMandat {
	'@xsi:type'?: string;
	uid?: string;
	acteurRef?: string;
	legislature?: string | null;
	typeOrgane?: string;
	dateDebut?: string;
	dateFin?: string | null;
	infosQualite?: { libQualite?: string };
	organes?: { organeRef?: string };
	mandature?: {
		datePriseFonction?: string;
		causeFin?: string | null;
		premiereElection?: string;
		placeHemicycle?: string;
	};
	election?: {
		lieu?: {
			region?: string;
			departement?: string;
			numDepartement?: string;
			numCirco?: string;
		};
	};
}

interface PartialPersonne {
	id: string;
	identite: Personne['identite'];
	mandatsByLeg: Map<number, Mandat>; // legislature → Mandat
}

async function parsePersonnesAndMandats(
	extractDir: string,
	groupesByLeg: Map<number, Groupe[]>
): Promise<Map<string, PartialPersonne>> {
	const acteurDir = join(extractDir, 'json', 'acteur');
	const { readdirSync } = await import('node:fs');

	const groupeIdsByLeg = new Map<number, Set<string>>();
	for (const [leg, list] of groupesByLeg) {
		groupeIdsByLeg.set(leg, new Set(list.map((g) => g.id)));
	}

	const personnes = new Map<string, PartialPersonne>();

	for (const file of readdirSync(acteurDir)) {
		const raw = JSON.parse(await readFile(join(acteurDir, file), 'utf8'));
		const a: RawActeur = raw.acteur;
		const id = a.uid['#text'];
		const allMandats = asArray(a.mandats?.mandat) as RawMandat[];

		// Pour chaque législature visée, retenir les mandats parlementaires
		// (typeOrgane=ASSEMBLEE) qui matchent.
		const mandatsByLeg = new Map<number, Mandat>();

		for (const leg of LEGISLATURES) {
			const mandatsParl = allMandats.filter(
				(m) =>
					m['@xsi:type'] === 'MandatParlementaire_type' &&
					m.typeOrgane === 'ASSEMBLEE' &&
					m.legislature === String(leg)
			);
			if (mandatsParl.length === 0) continue;

			// On prend le premier (typiquement il y en a un seul, ou plusieurs si
			// substitution successive — on garde le plus précoce dateDebut).
			mandatsParl.sort((x, y) => (x.dateDebut ?? '').localeCompare(y.dateDebut ?? ''));
			const parl = mandatsParl[0];

			const datePriseFonction = parl.mandature?.datePriseFonction ?? parl.dateDebut ?? '';
			const dateFinFonction = parl.dateFin ?? null;
			const lieu = parl.election?.lieu;

			// Extraire les appartenances GP de cette législature.
			const appartenances = extractAppartenancesGroupe(
				allMandats,
				leg,
				groupeIdsByLeg.get(leg)!,
				datePriseFonction
			);

			const mandat: Mandat = {
				legislature: leg,
				datePriseFonction,
				dateFinFonction,
				premiereElection: parl.mandature?.premiereElection === '1',
				circonscription: lieu
					? {
							dep: lieu.departement ?? '',
							depNum: lieu.numDepartement ?? '',
							num: lieu.numCirco ?? '',
							region: lieu.region ?? ''
						}
					: null,
				place: parl.mandature?.placeHemicycle
					? parseInt(parl.mandature.placeHemicycle, 10)
					: null,
				appartenancesGroupe: appartenances,
				scrutinsEligibles: 0, // rempli après parse scrutins
				stats: emptyStats(),
				rangs: emptyRangs(),
				badgesMandat: []
			};
			mandatsByLeg.set(leg, mandat);
		}

		if (mandatsByLeg.size === 0) continue;

		const ec = a.etatCivil.ident;
		const sexe: 'F' | 'M' = ec.civ === 'Mme' ? 'F' : 'M';

		personnes.set(id, {
			id,
			identite: {
				civ: ec.civ,
				prenom: ec.prenom,
				nom: ec.nom,
				sexe,
				dateNaissance: a.etatCivil.infoNaissance?.dateNais ?? null,
				villeNaissance: a.etatCivil.infoNaissance?.villeNais ?? null,
				photoUrl: photoUrl(id, mandatsByLeg),
				professionDeclaree: a.profession?.libelleCourant ?? null
			},
			mandatsByLeg
		});
	}

	return personnes;
}

/** URL de la photo officielle. Préférer la législature la plus récente où la
 *  personne a siégé (les photos sont versionnées par législature côté AN). */
function photoUrl(id: string, mandatsByLeg: Map<number, Mandat>): string {
	const legs = [...mandatsByLeg.keys()].sort((a, b) => b - a);
	const leg = legs[0] ?? 17;
	const num = id.replace(/^PA/, '');
	return `https://www2.assemblee-nationale.fr/static/tribun/${leg}/photos/${num}.jpg`;
}

/**
 * Enrichit les mandats existants avec les champs précis venus d'AMO10/AMO20
 * (cf ADR 0019). Lecture par législature : pour chaque acteur trouvé dans la
 * source d'enrichissement, on cherche son mandat parlementaire de la légis.
 * et on remplace les champs `place`/`circonscription`/`premiereElection`
 * quand AMO30 n'avait que des valeurs nulles ou moins précises.
 *
 * Renvoie un compteur de champs enrichis (pour log).
 */
async function enrichMandatsFromSource(
	extractDir: string,
	leg: number,
	personnes: Map<string, PartialPersonne>
): Promise<{ placeAjoute: number; circoAjoutee: number; total: number }> {
	const acteurDir = join(extractDir, 'json', 'acteur');
	const { readdirSync } = await import('node:fs');
	if (!existsSync(acteurDir)) {
		console.log(`    ⚠ pas de dossier acteur dans la source d'enrichissement leg ${leg}`);
		return { placeAjoute: 0, circoAjoutee: 0, total: 0 };
	}

	let placeAjoute = 0;
	let circoAjoutee = 0;
	let total = 0;

	for (const file of readdirSync(acteurDir)) {
		const raw = JSON.parse(await readFile(join(acteurDir, file), 'utf8'));
		const a: RawActeur = raw.acteur;
		const id = a.uid['#text'];
		const partial = personnes.get(id);
		if (!partial) continue;
		const m = partial.mandatsByLeg.get(leg);
		if (!m) continue;

		const allMandats = asArray(a.mandats?.mandat) as RawMandat[];
		const mandatsParl = allMandats.filter(
			(md) =>
				md['@xsi:type'] === 'MandatParlementaire_type' &&
				md.typeOrgane === 'ASSEMBLEE' &&
				md.legislature === String(leg)
		);
		if (mandatsParl.length === 0) continue;
		mandatsParl.sort((x, y) => (x.dateDebut ?? '').localeCompare(y.dateDebut ?? ''));
		const parl = mandatsParl[0];

		// placeHemicycle : remplace si AMO30 n'avait pas de place et que la nouvelle source en a une.
		const newPlace = parl.mandature?.placeHemicycle
			? parseInt(parl.mandature.placeHemicycle, 10)
			: null;
		if (newPlace !== null && !Number.isNaN(newPlace) && m.place === null) {
			m.place = newPlace;
			placeAjoute++;
		}

		// Circonscription : si AMO30 ne l'avait pas mais la nouvelle source oui.
		if (m.circonscription === null && parl.election?.lieu) {
			const lieu = parl.election.lieu;
			m.circonscription = {
				dep: lieu.departement ?? '',
				depNum: lieu.numDepartement ?? '',
				num: lieu.numCirco ?? '',
				region: lieu.region ?? ''
			};
			circoAjoutee++;
		}

		total++;
	}

	return { placeAjoute, circoAjoutee, total };
}

/** Extrait, dédoublonne et marque les appartenances GP d'une législature donnée.
 *  - Filtre sur typeOrgane=GP + organeRef ∈ groupes connus de la législature
 *  - Dédoublonne sur (organeRef, dateDebut) en gardant la qualité la plus haute
 *  - Marque isTransitoireNI = true pour les mandats NI ≤ 7 jours en début de législature
 *  - Trie chronologiquement
 */
function extractAppartenancesGroupe(
	mandats: RawMandat[],
	legislature: number,
	groupeIds: Set<string>,
	legDatePriseFonction: string
): AppartenanceGroupe[] {
	const candidats = mandats.filter((m) => {
		if (m['@xsi:type'] !== 'MandatSimple_Type') return false;
		if (m.typeOrgane !== 'GP') return false;
		const ref = m.organes?.organeRef;
		if (!ref) return false;
		// On filtre sur l'appartenance au set de groupes de cette législature.
		// Le champ m.legislature est parfois absent, on s'en passe.
		return groupeIds.has(ref);
	});

	// Dédoublonnage sur (organeRef, dateDebut) — garder la qualité la plus haute.
	const dedupKey = (m: RawMandat) => `${m.organes?.organeRef}|${m.dateDebut}`;
	const best = new Map<string, RawMandat>();
	for (const m of candidats) {
		const k = dedupKey(m);
		const cur = best.get(k);
		if (!cur || qualiteRank(m.infosQualite?.libQualite) > qualiteRank(cur.infosQualite?.libQualite)) {
			best.set(k, m);
		}
	}

	const out: AppartenanceGroupe[] = [];
	for (const m of best.values()) {
		const dateDebut = m.dateDebut!;
		const dateFin = m.dateFin ?? null;
		const qualite = m.infosQualite?.libQualite ?? 'Membre';

		// NI-bridge : appartenance "Député non-inscrit" courte au tout début de la législature.
		const isNI = qualite.toLowerCase().includes('non-inscrit');
		const isAtStart = legDatePriseFonction
			? Math.abs(daysBetween(legDatePriseFonction, dateDebut)) <= 1
			: false;
		const duration =
			dateFin && dateDebut ? daysBetween(dateDebut, dateFin) : Number.POSITIVE_INFINITY;
		const isTransitoireNI = isNI && isAtStart && duration <= NI_BRIDGE_MAX_DURATION_DAYS;

		out.push({
			groupeId: m.organes!.organeRef!,
			dateDebut,
			dateFin,
			qualite,
			isTransitoireNI
		});
	}

	out.sort((x, y) => x.dateDebut.localeCompare(y.dateDebut));
	return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Étape 3 — parse scrutins (un export par législature)
// ────────────────────────────────────────────────────────────────────────────

async function parseScrutins(extractDir: string, legislature: number) {
	const dir = join(extractDir, 'json');
	const { readdirSync } = await import('node:fs');
	const files = readdirSync(dir).filter((f) => f.startsWith('VTANR') && f.endsWith('.json'));

	const index: ScrutinIndex[] = [];
	const details = new Map<string, ScrutinDetail>();

	for (const file of files) {
		const raw = JSON.parse(await readFile(join(dir, file), 'utf8'));
		const s = raw.scrutin;
		const decompte = s.syntheseVote?.decompte;

		const idx: ScrutinIndex = {
			uid: s.uid,
			legislature,
			numero: parseInt(s.numero, 10),
			date: s.dateScrutin,
			titre: s.titre ?? s.objet?.libelle ?? '(sans titre)',
			sort: s.sort?.code ?? 'inconnu',
			pour: parseInt(decompte?.pour ?? '0', 10),
			contre: parseInt(decompte?.contre ?? '0', 10),
			abstention: parseInt(decompte?.abstentions ?? '0', 10),
			demandeur: s.demandeur?.texte ?? null
		};
		index.push(idx);

		const votes: Record<string, VotePosition> = {};
		const groupesVent: ScrutinDetail['groupes'] = [];
		const frondeurs: string[] = [];
		const groupesArr = asArray(s.ventilationVotes?.organe?.groupes?.groupe);

		for (const g of groupesArr) {
			const dn = g.vote?.decompteNominatif ?? {};
			const decompteG = g.vote?.decompteVoix ?? {};
			const positionMaj = g.vote?.positionMajoritaire as string | undefined;

			const collect = (nodes: any, position: VotePosition) => {
				for (const v of asArray(nodes?.votant)) {
					if (!v?.acteurRef) continue;
					votes[v.acteurRef] = position;
					if (
						(position === 'pour' || position === 'contre') &&
						(positionMaj === 'pour' || positionMaj === 'contre') &&
						position !== positionMaj
					) {
						frondeurs.push(v.acteurRef);
					}
				}
			};
			collect(dn.pours, 'pour');
			collect(dn.contres, 'contre');
			collect(dn.abstentions, 'abstention');
			collect(dn.nonVotants, 'nonVotant');

			groupesVent.push({
				id: g.organeRef,
				effectif: parseInt(g.nombreMembresGroupe ?? '0', 10),
				positionMajoritaire: positionMaj ?? 'abstention',
				decompte: {
					pour: parseInt(decompteG.pour ?? '0', 10),
					contre: parseInt(decompteG.contre ?? '0', 10),
					abstention: parseInt(decompteG.abstentions ?? '0', 10),
					nonVotant: parseInt(decompteG.nonVotants ?? '0', 10)
				}
			});
		}

		details.set(s.uid, {
			...idx,
			objet: s.objet?.libelle ?? idx.titre,
			typeVote: s.typeVote?.libelleTypeVote ?? 'inconnu',
			votes,
			groupes: groupesVent,
			frondeurs
		});
	}

	return { index, details };
}

// ────────────────────────────────────────────────────────────────────────────
// Étape 4 — calcul stats par mandat + cumul carrière + rangs + badges
// ────────────────────────────────────────────────────────────────────────────

function emptyStats(): MandatStats {
	return {
		presence: { numerator: 0, denominator: 0, rate: 0 },
		participation: { numerator: 0, denominator: 0, rate: 0 },
		loyaute: { numerator: 0, denominator: 0, rate: null },
		frondes: { count: 0, rate: 0 }
	};
}

function emptyRangs(): MandatRangs {
	return {
		presence: { rank: 0, total: 0 },
		participation: { rank: 0, total: 0 },
		loyaute: { rank: null, total: 0 },
		frondes: { rank: 0, total: 0 }
	};
}

interface ComputedHistoriques {
	historiques: Map<string, VoteHistoryItem[]>;
}

/** Parcourt les scrutins d'une législature et accumule les stats sur chaque mandat correspondant. */
function computeStatsForLegislature(
	legislature: number,
	personnes: Map<string, PartialPersonne>,
	scrutinsIndex: ScrutinIndex[],
	scrutinsDetails: Map<string, ScrutinDetail>,
	historiques: Map<string, VoteHistoryItem[]>
) {
	// Tri chronologique croissant pour l'historique
	const sorted = [...scrutinsIndex].sort((a, b) =>
		a.date < b.date ? -1 : a.date > b.date ? 1 : a.numero - b.numero
	);

	for (const idx of sorted) {
		const detail = scrutinsDetails.get(idx.uid);
		if (!detail) continue;
		const frondeurSet = new Set(detail.frondeurs);

		for (const p of personnes.values()) {
			const mandat = p.mandatsByLeg.get(legislature);
			if (!mandat) continue;
			// Éligibilité : scrutin date >= datePriseFonction du mandat (ADR 0006)
			if (mandat.datePriseFonction && idx.date < mandat.datePriseFonction) continue;

			mandat.scrutinsEligibles += 1;
			const position = detail.votes[p.id];
			const isFronde = frondeurSet.has(p.id);

			const stats = mandat.stats;
			// Présence = position connue (pas 'absent')
			if (position) stats.presence.numerator += 1;
			// Participation = vote exprimé (pour/contre/abstention)
			if (position === 'pour' || position === 'contre' || position === 'abstention') {
				stats.participation.numerator += 1;
			}

			if (isFronde) stats.frondes.count += 1;

			// Loyauté : groupe au moment du vote (cf ADR 0016) → on cherche
			// l'appartenance qui couvre idx.date
			const groupeAuVote = appartenanceAuVote(mandat.appartenancesGroupe, idx.date);
			if (groupeAuVote && (position === 'pour' || position === 'contre')) {
				const grpDetail = detail.groupes.find((g) => g.id === groupeAuVote.groupeId);
				const maj = grpDetail?.positionMajoritaire;
				if (maj === 'pour' || maj === 'contre') {
					stats.loyaute.denominator += 1;
					if (position === maj) stats.loyaute.numerator += 1;
				}
			}

			// Historique compact
			if (position) {
				const histList = historiques.get(p.id) ?? [];
				histList.push([idx.uid, position, isFronde ? 1 : 0, legislature]);
				historiques.set(p.id, histList);
			}
		}
	}
}

/** Retourne l'appartenance groupe qui couvre la date donnée, ou null si aucune
 *  (ne renvoie pas le NI-bridge transitoire, qui ne doit pas servir au calcul de loyauté). */
function appartenanceAuVote(
	apps: AppartenanceGroupe[],
	date: string
): AppartenanceGroupe | null {
	for (const a of apps) {
		if (a.isTransitoireNI) continue;
		if (a.dateDebut > date) continue;
		if (a.dateFin && a.dateFin < date) continue;
		return a;
	}
	return null;
}

/** Finalise les ratios stats sur chaque mandat. */
function finalizeMandatStats(personne: PartialPersonne) {
	for (const mandat of personne.mandatsByLeg.values()) {
		const s = mandat.stats;
		const elig = mandat.scrutinsEligibles;
		s.presence.denominator = elig;
		s.presence.rate = elig > 0 ? s.presence.numerator / elig : 0;
		s.participation.denominator = elig;
		s.participation.rate = elig > 0 ? s.participation.numerator / elig : 0;
		s.loyaute.rate =
			s.loyaute.denominator > 0 ? s.loyaute.numerator / s.loyaute.denominator : null;
		s.frondes.rate = s.participation.numerator > 0 ? s.frondes.count / s.participation.numerator : 0;
	}
}

/** Calcule rangs (par législature, dense rank) sur la cohorte des personnes
 *  ayant un mandat dans cette législature. */
function computeRangsForLegislature(
	legislature: number,
	personnes: Map<string, PartialPersonne>
) {
	const cohort: Mandat[] = [];
	for (const p of personnes.values()) {
		const m = p.mandatsByLeg.get(legislature);
		if (m) cohort.push(m);
	}
	const total = cohort.length;
	for (const m of cohort) {
		m.rangs.presence.total = total;
		m.rangs.participation.total = total;
		m.rangs.loyaute.total = total;
		m.rangs.frondes.total = total;
	}

	const denseRank = (
		key: 'presence' | 'participation' | 'loyaute' | 'frondes',
		valueFn: (m: Mandat) => number | null,
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
				sorted[i].rangs[key].rank = null as never;
				continue;
			}
			if (v !== lastVal) {
				rank = i + 1;
				lastVal = v;
			}
			sorted[i].rangs[key].rank = rank as never;
		}
	};

	denseRank('presence', (m) => m.stats.presence.rate, true);
	denseRank('participation', (m) => m.stats.participation.rate, true);
	denseRank('loyaute', (m) => m.stats.loyaute.rate, true);
	denseRank('frondes', (m) => m.stats.frondes.count, true);
}

/** Calcul des badges mandat (top 10% / bottom 10% par législature). */
function computeBadgesMandat(legislature: number, personnes: Map<string, PartialPersonne>) {
	const cohort: Mandat[] = [];
	for (const p of personnes.values()) {
		const m = p.mandatsByLeg.get(legislature);
		if (m) cohort.push(m);
	}
	const top10 = (n: number) => Math.max(1, Math.floor(n * 0.1));
	const total = cohort.length;
	const t = top10(total);

	// Présence en or
	const sortPres = [...cohort].sort((a, b) => b.stats.presence.rate - a.stats.presence.rate);
	for (let i = 0; i < t; i++) sortPres[i].badgesMandat.push('presence-or');
	// Absent remarquable
	for (let i = total - t; i < total; i++) sortPres[i].badgesMandat.push('absent-remarquable');

	// Top loyaliste
	const withLoy = cohort.filter((m) => m.stats.loyaute.rate !== null);
	const sortLoy = [...withLoy].sort(
		(a, b) => (b.stats.loyaute.rate ?? 0) - (a.stats.loyaute.rate ?? 0)
	);
	const tLoy = top10(withLoy.length);
	for (let i = 0; i < tLoy; i++) sortLoy[i].badgesMandat.push('top-loyaliste');

	// Frondeur (top 10% en nombre absolu de frondes)
	const sortFr = [...cohort].sort((a, b) => b.stats.frondes.count - a.stats.frondes.count);
	for (let i = 0; i < t; i++) {
		if (sortFr[i].stats.frondes.count > 0) sortFr[i].badgesMandat.push('frondeur');
	}
}

/** Calcul de la carrière agrégée (cumul pondéré, cf ADR 0017) + badges carrière. */
function computeCarriere(personne: PartialPersonne): CarriereAggregee {
	const mandats = [...personne.mandatsByLeg.values()];
	const carriere: CarriereAggregee = {
		presence: { numerator: 0, denominator: 0, rate: 0 },
		participation: { numerator: 0, denominator: 0, rate: 0 },
		loyaute: { numerator: 0, denominator: 0, rate: null },
		frondes: { count: 0, rate: 0 },
		nbMandats: mandats.length,
		legislatures: mandats.map((m) => m.legislature).sort((a, b) => a - b),
		badgesCarriere: []
	};

	for (const m of mandats) {
		carriere.presence.numerator += m.stats.presence.numerator;
		carriere.presence.denominator += m.stats.presence.denominator;
		carriere.participation.numerator += m.stats.participation.numerator;
		carriere.participation.denominator += m.stats.participation.denominator;
		carriere.loyaute.numerator += m.stats.loyaute.numerator;
		carriere.loyaute.denominator += m.stats.loyaute.denominator;
		carriere.frondes.count += m.stats.frondes.count;
	}
	carriere.presence.rate =
		carriere.presence.denominator > 0
			? carriere.presence.numerator / carriere.presence.denominator
			: 0;
	carriere.participation.rate =
		carriere.participation.denominator > 0
			? carriere.participation.numerator / carriere.participation.denominator
			: 0;
	carriere.loyaute.rate =
		carriere.loyaute.denominator > 0
			? carriere.loyaute.numerator / carriere.loyaute.denominator
			: null;
	carriere.frondes.rate =
		carriere.participation.numerator > 0
			? carriere.frondes.count / carriere.participation.numerator
			: 0;

	// Badges carrière
	if (mandats.length >= 2) carriere.badgesCarriere.push('reelu');
	if (mandats.length >= 3) carriere.badgesCarriere.push('veteran');

	// Recomposition : groupe principal de chaque mandat différent du précédent
	if (mandats.length >= 2) {
		const sorted = [...mandats].sort((a, b) => a.legislature - b.legislature);
		const principalGroupe = (m: Mandat) => {
			const stable = m.appartenancesGroupe.find((a) => !a.isTransitoireNI);
			return stable?.groupeId ?? null;
		};
		for (let i = 1; i < sorted.length; i++) {
			const prev = principalGroupe(sorted[i - 1]);
			const cur = principalGroupe(sorted[i]);
			if (prev && cur && prev !== cur) {
				carriere.badgesCarriere.push('recomposition');
				break;
			}
		}
	}

	// Transfuge : ≥ 2 appartenances stables (hors NI-bridge) dans un même mandat
	for (const m of mandats) {
		const stables = m.appartenancesGroupe.filter((a) => !a.isTransitoireNI);
		const distincts = new Set(stables.map((a) => a.groupeId));
		if (distincts.size >= 2) {
			carriere.badgesCarriere.push('transfuge');
			break;
		}
	}

	return carriere;
}

// ────────────────────────────────────────────────────────────────────────────
// Étape 5 — finalisation des Groupes (effectifs + président)
// ────────────────────────────────────────────────────────────────────────────

function finalizeGroupes(
	groupesByLeg: Map<number, Groupe[]>,
	personnes: Map<string, PartialPersonne>
) {
	for (const [leg, groupes] of groupesByLeg) {
		const byId = new Map(groupes.map((g) => [g.id, g]));

		for (const p of personnes.values()) {
			const m = p.mandatsByLeg.get(leg);
			if (!m) continue;

			// L'effectif final est l'appartenance stable la plus récente (qui couvre
			// la fin du mandat ou est encore ouverte).
			const lastStable = [...m.appartenancesGroupe]
				.filter((a) => !a.isTransitoireNI)
				.pop();
			if (lastStable) {
				const g = byId.get(lastStable.groupeId);
				if (g) g.effectifFin += 1;
			}

			// Présidence : on cherche une appartenance avec qualité "Président" et
			// dateFin null (ou la plus récente).
			for (const a of m.appartenancesGroupe) {
				const q = (a.qualite ?? '').toLowerCase();
				if (q.includes('président') && !q.includes('vice')) {
					const g = byId.get(a.groupeId);
					if (g && !g.presidentId) g.presidentId = p.id;
				}
			}
		}
	}
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
	console.log('🏛️  PolitiDex — pipeline data multi-législature');
	console.log(`   Législatures couvertes : ${LEGISLATURES.join(', ')}\n`);

	await ensureDir(CACHE_DIR);
	await ensureDir(OUT_DIR);
	await ensureDir(join(OUT_DIR, 'scrutins'));
	await ensureDir(join(OUT_DIR, 'groupes'));
	await ensureDir(join(OUT_DIR, 'historique'));

	// ── Stage 1 : download
	console.log('1/5  Téléchargement des sources');
	const acteursZip = join(CACHE_DIR, 'acteurs-historique.json.zip');
	await downloadZip(SOURCE_ACTEURS, acteursZip);

	const scrutinsZips = new Map<number, string>();
	for (const leg of LEGISLATURES) {
		const zp = join(CACHE_DIR, `scrutins-${leg}.json.zip`);
		await downloadZip(sourceScrutins(leg), zp);
		scrutinsZips.set(leg, zp);
	}

	// Sources d'enrichissement (AMO10/AMO20) — cf ADR 0019
	const enrichZips = new Map<number, string>();
	for (const [leg, url] of SOURCES_ENRICHISSEMENT) {
		if (!LEGISLATURES.includes(leg)) continue;
		const zp = join(CACHE_DIR, `enrich-${leg}.json.zip`);
		await downloadZip(url, zp);
		enrichZips.set(leg, zp);
	}

	// ── Stage 2 : extract
	console.log('\n2/5  Extraction');
	const acteursDir = join(CACHE_DIR, 'acteurs-extracted');
	if (!existsSync(join(acteursDir, 'json', 'acteur'))) {
		await unzip(acteursZip, acteursDir);
	} else {
		console.log('  ↻ déjà extrait : acteurs');
	}
	const scrutinsDirs = new Map<number, string>();
	for (const leg of LEGISLATURES) {
		const sd = join(CACHE_DIR, `scrutins-${leg}-extracted`);
		const sentinelDir = join(sd, 'json');
		if (!existsSync(sentinelDir) || (await import('node:fs')).readdirSync(sentinelDir).length < 50) {
			await rm(sd, { recursive: true, force: true });
			await unzip(scrutinsZips.get(leg)!, sd);
		} else {
			console.log(`  ↻ déjà extrait : scrutins ${leg}`);
		}
		scrutinsDirs.set(leg, sd);
	}

	// Extract sources d'enrichissement
	const enrichDirs = new Map<number, string>();
	for (const [leg, zp] of enrichZips) {
		const ed = join(CACHE_DIR, `enrich-${leg}-extracted`);
		const sentinelDir = join(ed, 'json', 'acteur');
		if (!existsSync(sentinelDir) || (await import('node:fs')).readdirSync(sentinelDir).length < 50) {
			await rm(ed, { recursive: true, force: true });
			try {
				await unzip(zp, ed);
			} catch (err) {
				console.log(`    ⚠ extraction enrich-${leg} : ${(err as Error).message}`);
			}
		} else {
			console.log(`  ↻ déjà extrait : enrich ${leg}`);
		}
		enrichDirs.set(leg, ed);
	}

	// ── Stage 3 : transform — groupes + personnes + mandats
	console.log('\n3/5  Transformation');
	console.log('  • Groupes politiques par législature…');
	const groupesByLeg = await parseGroupes(acteursDir);
	for (const [leg, list] of groupesByLeg) {
		console.log(`    → ${list.length} groupes en ${leg}ᵉ`);
	}

	console.log('  • Personnes + mandats parlementaires + appartenances groupe…');
	const personnes = await parsePersonnesAndMandats(acteursDir, groupesByLeg);
	console.log(`    → ${personnes.size} personnes uniques sur ${LEGISLATURES.join('+')}`);
	const mandatsTotal = [...personnes.values()].reduce((s, p) => s + p.mandatsByLeg.size, 0);
	console.log(`    → ${mandatsTotal} mandats total`);

	// Passe d'enrichissement AMO10/AMO20 (cf ADR 0019) : on remplit les champs
	// que AMO30 historique laisse souvent vides pour les mandats clos (placeHemicycle).
	console.log('  • Enrichissement AMO10/AMO20 (places hémicycle, etc.)…');
	for (const [leg, dir] of enrichDirs) {
		if (!existsSync(join(dir, 'json', 'acteur'))) {
			console.log(`    ⚠ enrich-${leg} non disponible, skip`);
			continue;
		}
		const stats = await enrichMandatsFromSource(dir, leg, personnes);
		console.log(
			`    → leg ${leg} : ${stats.placeAjoute} places ajoutées, ${stats.circoAjoutee} circo ajoutées (${stats.total} mandats croisés)`
		);
	}

	// ── Stage 4 : scrutins + stats par législature
	console.log('\n4/5  Scrutins et calcul des stats');
	const allScrutinsIndex: ScrutinIndex[] = [];
	const allScrutinsDetails = new Map<string, ScrutinDetail>();
	const historiques = new Map<string, VoteHistoryItem[]>();

	for (const leg of LEGISLATURES) {
		console.log(`  • Scrutins ${leg}ᵉ…`);
		const t0 = Date.now();
		const { index, details } = await parseScrutins(scrutinsDirs.get(leg)!, leg);
		console.log(`    → ${index.length} scrutins en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
		allScrutinsIndex.push(...index);
		for (const [u, d] of details) allScrutinsDetails.set(u, d);

		console.log(`    • Stats sur les mandats ${leg}ᵉ…`);
		computeStatsForLegislature(leg, personnes, index, details, historiques);
	}

	// Finalisation des stats puis rangs et badges par législature
	for (const p of personnes.values()) finalizeMandatStats(p);
	for (const leg of LEGISLATURES) {
		computeRangsForLegislature(leg, personnes);
		computeBadgesMandat(leg, personnes);
	}

	// Carrière agrégée + badges carrière
	const personnesFull: Personne[] = [];
	for (const p of personnes.values()) {
		const carriere = computeCarriere(p);
		const mandats = [...p.mandatsByLeg.values()].sort((a, b) => a.legislature - b.legislature);
		personnesFull.push({
			id: p.id,
			identite: p.identite,
			mandats,
			carriere
		});
	}
	personnesFull.sort((a, b) => a.identite.nom.localeCompare(b.identite.nom));

	// Finalisation des groupes (effectif + président) — utilise les appartenances déjà calculées
	finalizeGroupes(groupesByLeg, personnes);

	// Index scrutins trié desc (plus récent en premier)
	allScrutinsIndex.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.numero - a.numero));

	// Reverse historiques (plus récent en premier) après accumulation chronologique
	for (const list of historiques.values()) list.reverse();

	// ── Stage 5 : write output
	console.log('\n5/5  Écriture des fichiers JSON');

	await writeFile(join(OUT_DIR, 'personnes.json'), JSON.stringify(personnesFull));
	console.log(`  ✓ personnes.json (${personnesFull.length} personnes)`);

	for (const [leg, list] of groupesByLeg) {
		await writeFile(join(OUT_DIR, 'groupes', `${leg}.json`), JSON.stringify(list));
	}
	console.log(`  ✓ groupes/{${LEGISLATURES.join(',')}}.json`);

	const legislaturesMeta: LegislatureMeta[] = LEGISLATURES.map((leg) => {
		const personnesLeg = personnesFull.filter((p) =>
			p.mandats.some((m) => m.legislature === leg)
		);
		const scrutinsLeg = allScrutinsIndex.filter((s) => s.legislature === leg);
		const dates = personnesLeg.flatMap((p) =>
			p.mandats.filter((m) => m.legislature === leg).map((m) => m.datePriseFonction)
		);
		const dateDebut = dates.sort()[0] ?? '';
		const finsConnues = personnesLeg
			.flatMap((p) => p.mandats.filter((m) => m.legislature === leg).map((m) => m.dateFinFonction))
			.filter((d): d is string => !!d);
		const dateFin = finsConnues.length > 0 ? finsConnues.sort().reverse()[0] : null;
		return {
			num: leg,
			dateDebut,
			dateFin,
			nbPersonnes: personnesLeg.length,
			nbScrutins: scrutinsLeg.length
		};
	});
	await writeFile(join(OUT_DIR, 'legislatures.json'), JSON.stringify(legislaturesMeta));
	console.log(`  ✓ legislatures.json`);

	await writeFile(join(OUT_DIR, 'scrutins-index.json'), JSON.stringify(allScrutinsIndex));
	console.log(`  ✓ scrutins-index.json (${allScrutinsIndex.length} scrutins)`);

	let written = 0;
	for (const [uid, detail] of allScrutinsDetails) {
		await writeFile(join(OUT_DIR, 'scrutins', `${uid}.json`), JSON.stringify(detail));
		written++;
		if (written % 1000 === 0) console.log(`    … scrutins ${written}/${allScrutinsDetails.size}`);
	}
	console.log(`  ✓ scrutins/{uid}.json (${written} fichiers)`);

	let histWritten = 0;
	for (const [paId, list] of historiques) {
		await writeFile(join(OUT_DIR, 'historique', `${paId}.json`), JSON.stringify(list));
		histWritten++;
		if (histWritten % 200 === 0) console.log(`    … historiques ${histWritten}/${historiques.size}`);
	}
	console.log(`  ✓ historique/{paId}.json (${histWritten} fichiers)`);

	const meta: BuildMeta = {
		generatedAt: new Date().toISOString(),
		legislatures: LEGISLATURES,
		counts: {
			personnes: personnesFull.length,
			mandats: mandatsTotal,
			groupes: [...groupesByLeg.values()].reduce((s, l) => s + l.length, 0),
			scrutins: allScrutinsIndex.length
		},
		sources: {
			acteurs: SOURCE_ACTEURS,
			...Object.fromEntries(LEGISLATURES.map((leg) => [`scrutins_${leg}`, sourceScrutins(leg)]))
		}
	};
	await writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));
	console.log(`  ✓ meta.json`);

	console.log('\n✅ Terminé.');
	console.log(`   Output : ${OUT_DIR}`);
}

main().catch((err) => {
	console.error('\n❌ Pipeline a échoué :', err);
	process.exit(1);
});
