/**
 * Fetch and transform Open Data from the French National Assembly
 * into compact JSON files consumed by the SvelteKit front-end.
 *
 * Outputs (under static/data/):
 *  - deputes.json       : array of 577 deputies (compact)
 *  - groupes.json       : array of political groups with colors
 *  - scrutins-index.json: lightweight list of all scrutins (no per-vote detail)
 *  - scrutins/{uid}.json: per-scrutin file with full nominative votes
 *  - meta.json          : build metadata (date, counts, source URLs)
 */

import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'static', 'data');
const CACHE_DIR = join(tmpdir(), 'hemicycle-manager-cache');

const SOURCES = {
	deputes: 'https://data.assemblee-nationale.fr/static/openData/repository/17/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip',
	scrutins: 'https://data.assemblee-nationale.fr/static/openData/repository/17/loi/scrutins/Scrutins.json.zip'
};

// ────────────────────────────────────────────────────────────────────────────
// Types — shape of the trimmed data we ship to the front-end
// ────────────────────────────────────────────────────────────────────────────

export interface Depute {
	id: string;            // PA{n}
	prenom: string;
	nom: string;
	civ: string;
	groupeId: string | null;
	circo: { dep: string; depNum: string; num: string; region: string } | null;
	place: number | null;  // siège dans l'hémicycle 1..650
	dateNaissance: string | null;
	profession: string | null;
	photoUrl: string;
	datePriseFonction: string | null; // YYYY-MM-DD; used to filter eligible scrutins
	premiereElection: boolean;
}

export interface Groupe {
	id: string;            // PO{n}
	libelle: string;
	libelleAbrege: string;
	couleur: string;       // hex
	effectif: number;      // computed from deputes
	preseance: number;
	presidentId: string | null; // deputy id, set by parseDeputesAndGroupes
}

export type VotePosition = 'pour' | 'contre' | 'abstention' | 'nonVotant' | 'absent';

export interface ScrutinIndex {
	uid: string;
	numero: number;
	date: string;
	titre: string;
	sort: 'adopté' | 'rejeté' | string;
	pour: number;
	contre: number;
	abstention: number;
	demandeur: string | null;
}

export interface ScrutinDetail extends ScrutinIndex {
	objet: string;
	typeVote: string;
	votes: Record<string, VotePosition>;  // deputeId -> position
	groupes: Array<{
		id: string;
		effectif: number;
		positionMajoritaire: 'pour' | 'contre' | 'abstention' | string;
		decompte: { pour: number; contre: number; abstention: number; nonVotant: number };
	}>;
	frondeurs: string[]; // deputeId list — voted opposite to their group's majoritaire
}

export interface DeputeStats {
	id: string;
	scrutinsEligibles: number;     // scrutins post-datePriseFonction
	pour: number;
	contre: number;
	abstention: number;
	nonVotant: number;
	absent: number;                // scrutinsEligibles - sum(others)
	frondes: number;               // votes exprimés contre majorité du groupe
	tauxPresence: number;          // (pour+contre+abst+nonVotant) / eligibles
	tauxParticipation: number;     // (pour+contre+abst) / eligibles
	tauxLoyaute: number | null;    // votes alignés avec majorité / votes exprimés où groupe a majorité
	activite: number;              // (pour+contre+abst), abs raw count
	// Ranks (1 = best). Computed after all stats are filled. Total = 577.
	rangs: {
		presence: number;
		participation: number;
		loyaute: number | null;    // null if tauxLoyaute is null
		frondes: number;            // higher frondes = lower rank (rank 1 = most frondes)
		activite: number;
	};
}

export interface GroupeStats {
	id: string;
	cohesion: number | null;       // moyenne des taux de cohésion par scrutin
	scrutinsConsideres: number;
	tauxPresenceMoyen: number;
	frondesTotales: number;
	topLoyalistes: Array<{ id: string; tauxLoyaute: number }>;
	topFrondeurs: Array<{ id: string; frondes: number }>;
	// Ranks among groups (1 = best). Total = 12 (or fewer if NI excluded).
	rangs: {
		cohesion: number | null;
		presence: number;
		frondes: number;
	};
}

/**
 * Compact per-deputy history entry. We only store the scrutin uid + the
 * deputy's position + a fronde flag. The front-end joins with
 * scrutins-index.json to get titre/date/sort. Saves ~80% of disk space.
 */
export type VoteHistoryItem = [uid: string, position: VotePosition, isFronde: 0 | 1];

// ────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────

async function ensureDir(path: string) {
	await mkdir(path, { recursive: true });
}

async function downloadZip(url: string, target: string): Promise<void> {
	if (existsSync(target)) {
		console.log(`  ↻ cache hit: ${target}`);
		return;
	}
	console.log(`  ⬇ downloading ${url}`);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
	const buf = Buffer.from(await res.arrayBuffer());
	await writeFile(target, buf);
	console.log(`  ✓ ${(buf.length / 1024 / 1024).toFixed(1)} MB → ${target}`);
}

async function unzip(zipPath: string, destDir: string) {
	await ensureDir(destDir);
	console.log(`  ⇢ extracting ${zipPath} → ${destDir}`);
	await execFile('unzip', ['-q', '-o', zipPath, '-d', destDir]);
}

function asArray<T>(v: T | T[] | null | undefined): T[] {
	if (v == null) return [];
	return Array.isArray(v) ? v : [v];
}

// ────────────────────────────────────────────────────────────────────────────
// Step 1 — parse deputies and groups
// ────────────────────────────────────────────────────────────────────────────

interface RawActeur {
	uid: { '#text': string };
	etatCivil: {
		ident: { civ: string; prenom: string; nom: string };
		infoNaissance?: { dateNais?: string };
	};
	profession?: { libelleCourant?: string };
	mandats?: { mandat?: any | any[] };
}

interface RawOrgane {
	uid: string;
	codeType: string;
	libelle: string;
	libelleAbrege?: string;
	couleurAssociee?: string;
	preseance?: string;
	legislature?: string;
	viMoDe?: { dateFin?: string | null };
}

async function parseDeputesAndGroupes(extractDir: string) {
	const acteurDir = join(extractDir, 'json', 'acteur');
	const organeDir = join(extractDir, 'json', 'organe');

	// 1a — Parse all groupes politiques (active in 17e legislature)
	const groupesById = new Map<string, Groupe>();
	const { readdirSync } = await import('node:fs');

	for (const file of readdirSync(organeDir)) {
		const raw = JSON.parse(await readFile(join(organeDir, file), 'utf8'));
		const o: RawOrgane = raw.organe;
		if (o.codeType !== 'GP') continue;
		if (o.legislature !== '17') continue;
		if (o.viMoDe?.dateFin) continue; // skip dissolved groups
		groupesById.set(o.uid, {
			id: o.uid,
			libelle: o.libelle,
			libelleAbrege: o.libelleAbrege ?? o.libelle.slice(0, 6).toUpperCase(),
			couleur: o.couleurAssociee ?? '#888888',
			effectif: 0,
			preseance: parseInt(o.preseance ?? '999', 10),
			presidentId: null
		});
	}

	// 1b — Parse all deputies, attach to their group via mandate
	const deputes: Depute[] = [];
	for (const file of readdirSync(acteurDir)) {
		const raw = JSON.parse(await readFile(join(acteurDir, file), 'utf8'));
		const a: RawActeur = raw.acteur;
		const id = a.uid['#text'];

		const mandats = asArray(a.mandats?.mandat);
		const mandatsGP = mandats.filter(
			(m) => m['@xsi:type'] === 'MandatSimple_Type' && m.typeOrgane === 'GP' && m.legislature === '17' && !m.dateFin
		);
		// Membership mandate (any group affiliation) — first one wins
		const mandatGP = mandatsGP[0];
		const groupeId = mandatGP ? mandatGP.organes?.organeRef ?? null : null;

		// Detect group presidents — there may be a separate mandate with the
		// "Président" qualité distinct from the membership mandate.
		for (const m of mandatsGP) {
			const ref = m.organes?.organeRef as string | undefined;
			const qualite = (m.infosQualite?.libQualite as string | undefined)?.toLowerCase() ?? '';
			if (ref && groupesById.has(ref) && qualite.includes('président')) {
				groupesById.get(ref)!.presidentId = id;
			}
		}

		const mandatParl = mandats.find(
			(m) => m['@xsi:type'] === 'MandatParlementaire_type' && m.typeOrgane === 'ASSEMBLEE' && m.legislature === '17' && !m.dateFin
		);
		const place = mandatParl?.mandature?.placeHemicycle
			? parseInt(mandatParl.mandature.placeHemicycle, 10)
			: null;
		const election = mandatParl?.election?.lieu;
		const circo = election
			? {
					dep: election.departement,
					depNum: election.numDepartement,
					num: election.numCirco,
					region: election.region
				}
			: null;

		const datePriseFonction = mandatParl?.mandature?.datePriseFonction ?? null;
		const premiereElection = mandatParl?.mandature?.premiereElection === '1';

		deputes.push({
			id,
			prenom: a.etatCivil.ident.prenom,
			nom: a.etatCivil.ident.nom,
			civ: a.etatCivil.ident.civ,
			groupeId,
			circo,
			place,
			dateNaissance: a.etatCivil.infoNaissance?.dateNais ?? null,
			profession: a.profession?.libelleCourant ?? null,
			photoUrl: `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${id.replace(/^PA/, '')}.jpg`,
			datePriseFonction,
			premiereElection
		});
	}

	// 1c — Compute group sizes
	for (const d of deputes) {
		if (d.groupeId && groupesById.has(d.groupeId)) {
			groupesById.get(d.groupeId)!.effectif += 1;
		}
	}

	// Sort by political seance (left to right ordering for visualisation)
	const groupes = [...groupesById.values()].sort((a, b) => a.preseance - b.preseance);

	return { deputes, groupes };
}

// ────────────────────────────────────────────────────────────────────────────
// Step 2 — parse scrutins
// ────────────────────────────────────────────────────────────────────────────

async function parseScrutins(extractDir: string) {
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

		// Build per-deputy vote map. We also remember which group each deputy
		// voted in so we can detect frondeurs (vote opposite to group's
		// positionMajoritaire). Abstentions never count as fronde.
		const votes: Record<string, VotePosition> = {};
		const groupesVentilation: ScrutinDetail['groupes'] = [];
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
					// Frondeur if the deputy cast an *expressed* vote (pour/contre)
					// opposite to the group majority. Abstentions never count.
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

			groupesVentilation.push({
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
			groupes: groupesVentilation,
			frondeurs
		});
	}

	// Sort index from most recent to oldest
	index.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.numero - a.numero));

	return { index, details };
}

// ────────────────────────────────────────────────────────────────────────────
// Step 3 — compute deputy + group statistics, build per-deputy histories
// ────────────────────────────────────────────────────────────────────────────

interface ComputedStats {
	deputeStats: Map<string, DeputeStats>;
	groupeStats: Map<string, GroupeStats>;
	historiques: Map<string, VoteHistoryItem[]>;
}

function computeStats(
	deputes: Depute[],
	groupes: Groupe[],
	index: ScrutinIndex[],
	details: Map<string, ScrutinDetail>
): ComputedStats {
	// Pre-sort scrutins chronologically (oldest → newest) so the per-deputy
	// histories naturally come out in the same order. Then we'll reverse for
	// display (newest first) at the end.
	const sortedScrutins = [...index].sort((a, b) =>
		a.date < b.date ? -1 : a.date > b.date ? 1 : a.numero - b.numero
	);

	// ── Initialise accumulators
	const deputeStats = new Map<string, DeputeStats>();
	for (const d of deputes) {
		deputeStats.set(d.id, {
			id: d.id,
			scrutinsEligibles: 0,
			pour: 0,
			contre: 0,
			abstention: 0,
			nonVotant: 0,
			absent: 0,
			frondes: 0,
			tauxPresence: 0,
			tauxParticipation: 0,
			tauxLoyaute: null,
			activite: 0,
			rangs: {
				presence: 0,
				participation: 0,
				loyaute: null,
				frondes: 0,
				activite: 0
			}
		});
	}

	const historiques = new Map<string, VoteHistoryItem[]>();
	for (const d of deputes) historiques.set(d.id, []);

	// For loyalty: count votes_aligned_with_majority and total votes_with_majority
	// (we only consider scrutins where the deputy's group had a clear majority
	// position of pour or contre, and the deputy expressed a vote of pour/contre).
	const loyauteAcc = new Map<string, { aligned: number; considered: number }>();
	for (const d of deputes) loyauteAcc.set(d.id, { aligned: 0, considered: 0 });

	// For group cohesion: per scrutin, store the cohesion ratio for each group.
	// Cohesion = (votes aligned with majority) / (votes expressed in group).
	const groupeCohesionAcc = new Map<string, { sum: number; count: number }>();
	for (const g of groupes) groupeCohesionAcc.set(g.id, { sum: 0, count: 0 });

	// ── Walk scrutins chronologically
	for (const idx of sortedScrutins) {
		const detail = details.get(idx.uid);
		if (!detail) continue;
		const frondeurSet = new Set(detail.frondeurs);

		// Pre-build a map: groupeId → positionMajoritaire of group on this scrutin
		const groupePos = new Map<string, string>();
		for (const g of detail.groupes) groupePos.set(g.id, g.positionMajoritaire);

		// Walk every deputy and increment their counters if they were eligible.
		for (const d of deputes) {
			// Eligibility: scrutin date >= datePriseFonction
			if (d.datePriseFonction && idx.date < d.datePriseFonction) continue;

			const stats = deputeStats.get(d.id)!;
			stats.scrutinsEligibles += 1;

			const position = detail.votes[d.id]; // undefined → absent
			const isFronde = frondeurSet.has(d.id);

			if (position === 'pour') stats.pour += 1;
			else if (position === 'contre') stats.contre += 1;
			else if (position === 'abstention') stats.abstention += 1;
			else if (position === 'nonVotant') stats.nonVotant += 1;
			else stats.absent += 1;

			if (isFronde) stats.frondes += 1;

			// Loyauté accumulator (only when group has clear pour/contre majority
			// AND the deputy expressed a pour/contre vote).
			if (d.groupeId) {
				const maj = groupePos.get(d.groupeId);
				const expressed = position === 'pour' || position === 'contre';
				if ((maj === 'pour' || maj === 'contre') && expressed) {
					const acc = loyauteAcc.get(d.id)!;
					acc.considered += 1;
					if (position === maj) acc.aligned += 1;
				}
			}

			// Per-deputy history (we keep all votes; chronological order)
			if (position) {
				historiques.get(d.id)!.push([idx.uid, position, isFronde ? 1 : 0]);
			}
		}

		// Per-scrutin group cohesion
		for (const g of detail.groupes) {
			const maj = g.positionMajoritaire;
			if (maj !== 'pour' && maj !== 'contre') continue;
			const expressed = g.decompte.pour + g.decompte.contre + g.decompte.abstention;
			if (expressed === 0) continue;
			const aligned = maj === 'pour' ? g.decompte.pour : g.decompte.contre;
			const cohesion = aligned / expressed;
			const acc = groupeCohesionAcc.get(g.id);
			if (acc) {
				acc.sum += cohesion;
				acc.count += 1;
			}
		}
	}

	// ── Finalise depute stats: ratios + loyauté
	for (const d of deputes) {
		const stats = deputeStats.get(d.id)!;
		const eligible = stats.scrutinsEligibles;
		if (eligible > 0) {
			stats.tauxPresence = (stats.pour + stats.contre + stats.abstention + stats.nonVotant) / eligible;
			stats.tauxParticipation = (stats.pour + stats.contre + stats.abstention) / eligible;
		}
		stats.activite = stats.pour + stats.contre + stats.abstention;
		const loy = loyauteAcc.get(d.id)!;
		stats.tauxLoyaute = loy.considered > 0 ? loy.aligned / loy.considered : null;
	}

	// ── Compute ranks. Dense rank: ties get the same rank, next group skips.
	const allStats = [...deputeStats.values()];
	const rankBy = <T>(
		key: keyof DeputeStats['rangs'],
		valueFn: (s: DeputeStats) => T | null,
		desc = true
	) => {
		// Sort with nulls always last
		const sorted = [...allStats].sort((a, b) => {
			const va = valueFn(a);
			const vb = valueFn(b);
			if (va === null && vb === null) return 0;
			if (va === null) return 1;
			if (vb === null) return -1;
			if (va === vb) return 0;
			return desc ? (va < vb ? 1 : -1) : va < vb ? -1 : 1;
		});
		let rank = 0;
		let lastVal: T | null | undefined = undefined;
		for (let i = 0; i < sorted.length; i++) {
			const v = valueFn(sorted[i]);
			if (v === null) {
				sorted[i].rangs[key] = null as never;
				continue;
			}
			if (v !== lastVal) {
				rank = i + 1;
				lastVal = v;
			}
			sorted[i].rangs[key] = rank as never;
		}
	};

	rankBy('presence', (s) => s.tauxPresence, true);
	rankBy('participation', (s) => s.tauxParticipation, true);
	rankBy('loyaute', (s) => s.tauxLoyaute, true);
	rankBy('frondes', (s) => s.frondes, true);
	rankBy('activite', (s) => s.activite, true);

	// ── Group stats
	const groupeStats = new Map<string, GroupeStats>();
	for (const g of groupes) {
		const cohAcc = groupeCohesionAcc.get(g.id)!;
		const cohesion = cohAcc.count > 0 ? cohAcc.sum / cohAcc.count : null;

		const members = deputes.filter((d) => d.groupeId === g.id);
		const presenceSum = members.reduce(
			(acc, m) => acc + (deputeStats.get(m.id)?.tauxPresence ?? 0),
			0
		);
		const tauxPresenceMoyen = members.length > 0 ? presenceSum / members.length : 0;
		const frondesTotales = members.reduce(
			(acc, m) => acc + (deputeStats.get(m.id)?.frondes ?? 0),
			0
		);

		const ranked = members
			.map((m) => deputeStats.get(m.id)!)
			.filter((s) => s.tauxLoyaute !== null);
		const topLoyalistes = [...ranked]
			.sort((a, b) => (b.tauxLoyaute ?? 0) - (a.tauxLoyaute ?? 0))
			.slice(0, 5)
			.map((s) => ({ id: s.id, tauxLoyaute: s.tauxLoyaute! }));
		const topFrondeurs = [...ranked]
			.sort((a, b) => b.frondes - a.frondes)
			.slice(0, 5)
			.filter((s) => s.frondes > 0)
			.map((s) => ({ id: s.id, frondes: s.frondes }));

		groupeStats.set(g.id, {
			id: g.id,
			cohesion,
			scrutinsConsideres: cohAcc.count,
			tauxPresenceMoyen,
			frondesTotales,
			topLoyalistes,
			topFrondeurs,
			rangs: { cohesion: null, presence: 0, frondes: 0 }
		});
	}

	// Compute group ranks (dense)
	const allG = [...groupeStats.values()];
	const rankGroupBy = <T>(
		key: keyof GroupeStats['rangs'],
		valueFn: (s: GroupeStats) => T | null,
		desc = true
	) => {
		const sorted = [...allG].sort((a, b) => {
			const va = valueFn(a);
			const vb = valueFn(b);
			if (va === null && vb === null) return 0;
			if (va === null) return 1;
			if (vb === null) return -1;
			if (va === vb) return 0;
			return desc ? (va < vb ? 1 : -1) : va < vb ? -1 : 1;
		});
		let rank = 0;
		let lastVal: T | null | undefined = undefined;
		for (let i = 0; i < sorted.length; i++) {
			const v = valueFn(sorted[i]);
			if (v === null) {
				sorted[i].rangs[key] = null as never;
				continue;
			}
			if (v !== lastVal) {
				rank = i + 1;
				lastVal = v;
			}
			sorted[i].rangs[key] = rank as never;
		}
	};
	rankGroupBy('cohesion', (s) => s.cohesion, true);
	rankGroupBy('presence', (s) => s.tauxPresenceMoyen, true);
	rankGroupBy('frondes', (s) => s.frondesTotales, true);

	// ── Reverse histories so most recent comes first
	for (const list of historiques.values()) list.reverse();

	return { deputeStats, groupeStats, historiques };
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
	console.log('🏛️  Hémicycle Manager — pipeline data');
	console.log('   Sources : data.assemblee-nationale.fr (17e législature)\n');

	await ensureDir(CACHE_DIR);
	await ensureDir(OUT_DIR);
	await ensureDir(join(OUT_DIR, 'scrutins'));

	// ── Stage 1 : download
	console.log('1/4  Téléchargement des sources');
	const deputesZip = join(CACHE_DIR, 'deputes.json.zip');
	const scrutinsZip = join(CACHE_DIR, 'scrutins.json.zip');
	await downloadZip(SOURCES.deputes, deputesZip);
	await downloadZip(SOURCES.scrutins, scrutinsZip);

	// ── Stage 2 : extract
	console.log('\n2/4  Extraction');
	const deputesDir = join(CACHE_DIR, 'deputes-extracted');
	const scrutinsDir = join(CACHE_DIR, 'scrutins-extracted');
	if (!existsSync(join(deputesDir, 'json', 'acteur'))) {
		await unzip(deputesZip, deputesDir);
	} else {
		console.log('  ↻ déjà extrait : deputes');
	}
	if (!existsSync(scrutinsDir) || (await import('node:fs')).readdirSync(join(scrutinsDir, 'json')).length < 100) {
		await rm(scrutinsDir, { recursive: true, force: true });
		await unzip(scrutinsZip, scrutinsDir);
	} else {
		console.log('  ↻ déjà extrait : scrutins');
	}

	// ── Stage 3 : transform
	console.log('\n3/4  Transformation');
	console.log('  • Députés et groupes…');
	const { deputes, groupes } = await parseDeputesAndGroupes(deputesDir);
	console.log(`    → ${deputes.length} députés, ${groupes.length} groupes`);

	console.log('  • Scrutins (peut prendre 30-60s)…');
	const t0 = Date.now();
	const { index, details } = await parseScrutins(scrutinsDir);
	console.log(`    → ${index.length} scrutins en ${((Date.now() - t0) / 1000).toFixed(1)}s`);

	console.log('  • Calcul des statistiques (présence, loyauté, cohésion, historiques)…');
	const t1 = Date.now();
	const { deputeStats, groupeStats, historiques } = computeStats(deputes, groupes, index, details);
	console.log(`    → stats calculées en ${((Date.now() - t1) / 1000).toFixed(1)}s`);

	// ── Stage 4 : write output
	console.log('\n4/4  Écriture des fichiers JSON');
	await ensureDir(join(OUT_DIR, 'historique'));

	await writeFile(join(OUT_DIR, 'deputes.json'), JSON.stringify(deputes));
	await writeFile(join(OUT_DIR, 'groupes.json'), JSON.stringify(groupes));
	await writeFile(join(OUT_DIR, 'scrutins-index.json'), JSON.stringify(index));
	await writeFile(
		join(OUT_DIR, 'stats-deputes.json'),
		JSON.stringify([...deputeStats.values()])
	);
	await writeFile(
		join(OUT_DIR, 'stats-groupes.json'),
		JSON.stringify([...groupeStats.values()])
	);

	let written = 0;
	for (const [uid, detail] of details) {
		await writeFile(join(OUT_DIR, 'scrutins', `${uid}.json`), JSON.stringify(detail));
		written++;
		if (written % 1000 === 0) console.log(`    … scrutins ${written}/${details.size}`);
	}
	console.log(`    → ${written} fichiers de scrutins écrits`);

	let histWritten = 0;
	for (const [deputeId, list] of historiques) {
		await writeFile(join(OUT_DIR, 'historique', `${deputeId}.json`), JSON.stringify(list));
		histWritten++;
		if (histWritten % 200 === 0) console.log(`    … historiques ${histWritten}/${historiques.size}`);
	}
	console.log(`    → ${histWritten} historiques écrits`);

	const meta = {
		generatedAt: new Date().toISOString(),
		legislature: 17,
		counts: {
			deputes: deputes.length,
			groupes: groupes.length,
			scrutins: index.length,
			historiques: histWritten
		},
		sources: SOURCES
	};
	await writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));

	console.log('\n✅ Terminé.');
	console.log(`   Output : ${OUT_DIR}`);
}

main().catch((err) => {
	console.error('\n❌ Pipeline a échoué :', err);
	process.exit(1);
});
